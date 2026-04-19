/**
 * MaaMitra — Claude API Proxy (Cloudflare Worker)
 *
 * Keeps the Anthropic API key server-side so it is never exposed in the
 * browser bundle. The app calls this Worker; the Worker calls Anthropic.
 *
 * Security:
 *   • Every request must carry a valid Firebase ID token in the
 *     `Authorization: Bearer <token>` header. Unauthenticated callers
 *     cannot burn API credits.
 *   • CORS is restricted to the app's known origins.
 *   • Optional: wire a Cloudflare KV or Durable Object for per-uid rate
 *     limiting (see RATE_LIMIT comment below).
 *
 * Deploy steps:
 *   1. Cloudflare dashboard → Workers & Pages → your worker
 *   2. Settings → Variables → add secret:
 *        ANTHROPIC_API_KEY = sk-ant-api03-…
 *   3. Settings → Variables → add plaintext env var:
 *        FIREBASE_PROJECT_ID = maa-mitra-7kird8
 *   4. (Optional) Bind a KV namespace named RATE_LIMIT for throttling.
 *   5. Deploy this file. Keep the Worker URL in EXPO_PUBLIC_CLAUDE_WORKER_URL.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VER = '2023-06-01';
// Sonnet 4.5 → substantially smarter on parenting/medical nuance than
// Haiku, worth the ~3× cost per token for MaaMitra's small-but-growing
// base. Drop back to Haiku with a router if cost becomes an issue.
const MODEL         = 'claude-sonnet-4-5-20250929';
// 2× the previous cap — Sonnet gives richer answers and users asked for
// 'super smart + very informative'. Worker still caps messages[] at 40,
// so a runaway thread can't escalate cost.
const MAX_TOKENS    = 2048;
// Lower than default (1.0). Keeps medical/parenting guidance grounded
// and consistent without losing the warm-friend voice.
const TEMPERATURE   = 0.6;

const ALLOWED_ORIGINS = [
  'https://maa-mitra-7kird8.web.app',
  'https://maa-mitra-7kird8.firebaseapp.com',
  'http://localhost:8081',
  'http://localhost:19006',
];

// Google's public keys for Firebase ID tokens. Cached per worker isolate.
const GOOGLE_X509_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cachedKeys = null;   // { expiresAt: number, keys: Record<kid, CryptoKey> }

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, origin);
    }
    if (request.method !== 'POST') {
      return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405, origin);
    }

    // ── Auth: require a valid Firebase ID token ──────────────────────────────
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return corsResponse(JSON.stringify({ error: 'Missing Authorization' }), 401, origin);
    }

    let claims;
    try {
      claims = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
    } catch (err) {
      return corsResponse(JSON.stringify({ error: 'Invalid token', detail: String(err.message || err) }), 401, origin);
    }

    // ── Rate limit (optional, requires KV binding named RATE_LIMIT) ──────────
    if (env.RATE_LIMIT) {
      const key = `u:${claims.sub}:${Math.floor(Date.now() / 60_000)}`; // per-uid per-minute
      const count = parseInt((await env.RATE_LIMIT.get(key)) || '0', 10);
      if (count >= 20) {
        return corsResponse(JSON.stringify({ error: 'Rate limit exceeded' }), 429, origin);
      }
      await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 120 });
    }

    // ── Parse + forward ──────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400, origin);
    }

    const { messages, systemPrompt } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return corsResponse(JSON.stringify({ error: 'messages array required' }), 400, origin);
    }
    if (messages.length > 40) {
      return corsResponse(JSON.stringify({ error: 'Too many messages' }), 400, origin);
    }

    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VER,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: systemPrompt ?? '',
        messages,
      }),
    });

    const data = await anthropicRes.json();
    return corsResponse(JSON.stringify(data), anthropicRes.status, origin);
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Firebase ID token verification (Web Crypto, no Admin SDK needed)
// ──────────────────────────────────────────────────────────────────────────────

async function verifyFirebaseIdToken(token, projectId) {
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID not configured');

  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error('malformed JWT');

  const header  = JSON.parse(b64urlDecodeText(headerB64));
  const payload = JSON.parse(b64urlDecodeText(payloadB64));

  if (header.alg !== 'RS256') throw new Error('unexpected alg');
  if (!header.kid) throw new Error('no kid in header');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) throw new Error('token expired');
  if (payload.iat && now < payload.iat - 60) throw new Error('token not yet valid');
  if (payload.aud !== projectId) throw new Error('bad aud');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad iss');
  if (!payload.sub) throw new Error('no sub');

  const key = await getGoogleKey(header.kid);
  const signature = b64urlDecodeBytes(sigB64);
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const ok = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    signature,
    signedData,
  );
  if (!ok) throw new Error('bad signature');

  return payload;
}

async function getGoogleKey(kid) {
  const now = Date.now();
  if (!cachedKeys || now >= cachedKeys.expiresAt || !cachedKeys.keys[kid]) {
    const res = await fetch(GOOGLE_X509_URL);
    if (!res.ok) throw new Error('unable to fetch Google keys');

    const certs = await res.json(); // { kid: "-----BEGIN CERTIFICATE-----…" }
    const keys = {};
    for (const [k, pem] of Object.entries(certs)) {
      keys[k] = await importRsaPublicKeyFromCertPem(pem);
    }

    // Honour Cache-Control max-age; fall back to 1 hour.
    const cacheControl = res.headers.get('Cache-Control') || '';
    const m = cacheControl.match(/max-age=(\d+)/);
    const ttlMs = (m ? parseInt(m[1], 10) : 3600) * 1000;
    cachedKeys = { expiresAt: now + ttlMs, keys };
  }

  const key = cachedKeys.keys[kid];
  if (!key) throw new Error(`unknown kid: ${kid}`);
  return key;
}

async function importRsaPublicKeyFromCertPem(pem) {
  // Extract the DER from the PEM envelope.
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  const der = base64ToBytes(b64);
  const spki = extractSpkiFromX509(der);

  return crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

// Walk a DER-encoded X.509 certificate and return the SubjectPublicKeyInfo.
function extractSpkiFromX509(derBytes) {
  let i = 0;
  // outer SEQUENCE (Certificate)
  if (derBytes[i++] !== 0x30) throw new Error('X.509: expected SEQUENCE');
  i += lengthSize(derBytes, i);

  // tbsCertificate SEQUENCE
  if (derBytes[i] !== 0x30) throw new Error('X.509: expected tbsCertificate');
  const tbsStart = i;
  i++;
  const tbsLen = readLength(derBytes, i);
  i += lengthSize(derBytes, i);
  const tbsEnd = i + tbsLen;

  // Inside tbsCertificate, walk until we reach SubjectPublicKeyInfo (6th field).
  // Fields: version[0], serialNumber, signature, issuer, validity, subject, spki…
  let p = i;
  // optional version [0] EXPLICIT
  if (derBytes[p] === 0xa0) p = skipTlv(derBytes, p);
  // serialNumber INTEGER
  p = skipTlv(derBytes, p);
  // signature AlgorithmIdentifier
  p = skipTlv(derBytes, p);
  // issuer Name
  p = skipTlv(derBytes, p);
  // validity SEQUENCE
  p = skipTlv(derBytes, p);
  // subject Name
  p = skipTlv(derBytes, p);
  // subjectPublicKeyInfo SEQUENCE — this is what we want.
  const spkiStart = p;
  const spkiEnd = skipTlv(derBytes, p);
  // ignore tbsEnd, keep lint happy
  void tbsStart; void tbsEnd;

  return derBytes.slice(spkiStart, spkiEnd).buffer;
}

function readLength(buf, i) {
  const b = buf[i];
  if (b < 0x80) return b;
  const n = b & 0x7f;
  let len = 0;
  for (let j = 1; j <= n; j++) len = (len << 8) | buf[i + j];
  return len;
}
function lengthSize(buf, i) {
  const b = buf[i];
  if (b < 0x80) return 1;
  return 1 + (b & 0x7f);
}
function skipTlv(buf, i) {
  i++; // tag
  const len = readLength(buf, i);
  i += lengthSize(buf, i);
  return i + len;
}

// ── base64 helpers ───────────────────────────────────────────────────────────
function b64urlToB64(s) {
  return s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
}
function b64urlDecodeText(s) {
  return atob(b64urlToB64(s));
}
function b64urlDecodeBytes(s) {
  return base64ToBytes(b64urlToB64(s));
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── CORS ─────────────────────────────────────────────────────────────────────
function corsResponse(body, status, origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return new Response(body, {
    status,
    headers: {
      'Content-Type':                 'application/json',
      'Access-Control-Allow-Origin':  allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary':                         'Origin',
    },
  });
}
