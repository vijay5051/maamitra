/**
 * MaaMitra — Claude API Proxy (Cloudflare Worker)
 *
 * Keeps the Anthropic API key server-side so it is never exposed in the
 * browser bundle. The app calls this Worker; the Worker calls Anthropic.
 *
 * Deploy steps (one-time, ~2 minutes):
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Paste this entire file, click "Save and Deploy"
 *   3. Go to Settings → Variables → Secrets → Add secret:
 *        Name:  ANTHROPIC_API_KEY
 *        Value: sk-ant-api03-xxxx (your key from .env)
 *   4. Copy the Worker URL (e.g. https://maamitra-claude.YOUR_NAME.workers.dev)
 *   5. Set EXPO_PUBLIC_CLAUDE_WORKER_URL=<that URL> in .env, remove EXPO_PUBLIC_ANTHROPIC_API_KEY
 *   6. Rebuild and redeploy the app
 */

const ALLOWED_ORIGIN = 'https://maa-mitra-7kird8.web.app';
const ANTHROPIC_API   = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VER   = '2023-06-01';
const MODEL           = 'claude-haiku-4-5-20251001';
const MAX_TOKENS      = 1024;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS pre-flight
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, origin);
    }

    if (request.method !== 'POST') {
      return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405, origin);
    }

    // Parse request body: { messages, systemPrompt }
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400, origin);
    }

    const { messages, systemPrompt } = body;

    if (!messages || !Array.isArray(messages)) {
      return corsResponse(JSON.stringify({ error: 'messages array required' }), 400, origin);
    }

    // Forward to Anthropic
    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VER,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt ?? '',
        messages,
      }),
    });

    const data = await anthropicRes.json();
    return corsResponse(JSON.stringify(data), anthropicRes.status, origin);
  },
};

function corsResponse(body, status, origin) {
  // Allow the Firebase Hosting domain and localhost for local dev
  const allowed = [ALLOWED_ORIGIN, 'http://localhost:8081', 'http://localhost:19006'];
  const allowOrigin = allowed.includes(origin) ? origin : ALLOWED_ORIGIN;

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin':  allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
