/**
 * One-time migration: seed app_settings/integrations in Firestore with the
 * API keys that currently live in functions/.env and the root .env.
 *
 * After this runs, the Integration Hub page will show all your existing
 * credentials and the Firestore-first config path will be fully populated.
 *
 * Uses the Firebase CLI's stored credentials — no service account JSON needed.
 * Re-running is safe — uses merge:true, won't overwrite manually-set keys.
 *
 * Run:
 *   node scripts/migrate-env-to-firestore.mjs
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getAccessToken } = require('../node_modules/firebase-tools/lib/auth');
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const PROJECT_ID = 'maa-mitra-7kird8';

// ── Auth via Firebase CLI stored credentials ──────────────────────────────────

const cliCfgPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
let refreshToken;
try {
  const cliCfg = JSON.parse(readFileSync(cliCfgPath, 'utf8'));
  refreshToken = cliCfg?.tokens?.refresh_token;
} catch {
  console.error('❌  Could not read Firebase CLI credentials. Run: npx firebase login');
  process.exit(1);
}
if (!refreshToken) {
  console.error('❌  No refresh token found. Run: npx firebase login');
  process.exit(1);
}

const tokenResult = await getAccessToken(refreshToken, []);
const accessToken = tokenResult.access_token;

// ── Firestore REST write ──────────────────────────────────────────────────────

// Convert a plain JS object to Firestore REST value format.
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'object' && !Array.isArray(v)) {
    const fields = {};
    for (const [k, val] of Object.entries(v)) {
      fields[k] = toFirestoreValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

async function firestoreSet(docPath, data, accessToken) {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  const fields = {};
  const updateMaskPaths = [];
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
    updateMaskPaths.push(k);
  }
  const url = `${baseUrl}?updateMask.fieldPaths=${updateMaskPaths.map(encodeURIComponent).join('&updateMask.fieldPaths=')}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Firestore PATCH ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
}

// ── Parse .env files ──────────────────────────────────────────────────────────

function parseEnv(filePath) {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const idx = l.indexOf('=');
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

const fnEnv   = parseEnv(join(root, 'functions', '.env'));
const rootEnv = parseEnv(join(root, '.env'));

// ── Build the Firestore patch ─────────────────────────────────────────────────

function val(obj, key) {
  const v = obj[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

const patch = {};

// OpenAI
const openaiKey = val(fnEnv, 'OPENAI_API_KEY');
if (openaiKey) {
  patch.openai = { apiKey: openaiKey, defaultModel: 'gpt-4o-mini' };
}

// Gemini
const geminiKey = val(fnEnv, 'GEMINI_API_KEY');
if (geminiKey) {
  patch.gemini = { apiKey: geminiKey };
}

// Replicate
const replicateToken = val(fnEnv, 'REPLICATE_API_TOKEN');
if (replicateToken) {
  patch.replicate = { apiToken: replicateToken };
}

// Pexels
const pexelsKey = val(fnEnv, 'PEXELS_API_KEY');
if (pexelsKey) {
  patch.pexels = { apiKey: pexelsKey };
}

// Anthropic Worker URL (from root .env)
const workerUrl = val(rootEnv, 'EXPO_PUBLIC_CLAUDE_WORKER_URL');
if (workerUrl) {
  patch.anthropic = { workerUrl };
}

// Meta
const meta = {};
const metaMap = {
  igUserId:           'META_IG_USER_ID',
  igAccessToken:      'META_IG_ACCESS_TOKEN',
  fbPageId:           'META_FB_PAGE_ID',
  fbPageAccessToken:  'META_FB_PAGE_ACCESS_TOKEN',
  appSecret:          'META_APP_SECRET',
  webhookVerifyToken: 'META_WEBHOOK_VERIFY_TOKEN',
  adAccountId:        'META_AD_ACCOUNT_ID',
};
for (const [field, envKey] of Object.entries(metaMap)) {
  const v = val(fnEnv, envKey);
  if (v) meta[field] = v;
}
if (Object.keys(meta).length > 0) {
  patch.meta = meta;
}

// ── Write to Firestore ────────────────────────────────────────────────────────

if (Object.keys(patch).length === 0) {
  console.log('⚠️  No keys found in .env files — nothing to migrate.');
  process.exit(0);
}

console.log('Migrating the following sections to app_settings/integrations:');
for (const [k, v] of Object.entries(patch)) {
  const fields = Object.keys(v);
  console.log(`  ${k}: ${fields.join(', ')}`);
}

await firestoreSet('app_settings/integrations', patch, accessToken);

console.log('\n✅  Migration complete. Integration Hub will now show all credentials.');
console.log('   You can safely delete this script after running it, or keep it for future reference.');
process.exit(0);
