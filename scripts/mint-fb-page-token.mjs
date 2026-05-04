#!/usr/bin/env node
// Mint a non-expiring FB Page Access Token (M4c support).
//
// Standard Meta flow for production-grade page tokens:
//   1. Get a SHORT-lived user token via Graph API Explorer (~1-2 hr).
//   2. Exchange for a LONG-lived user token (~60 days) via
//      /oauth/access_token?grant_type=fb_exchange_token.
//   3. Call /me/accounts with the long-lived user token. The page
//      `access_token` returned is **never-expiring** as long as the
//      user keeps Page admin role.
//
// Usage:
//   node scripts/mint-fb-page-token.mjs <short-lived-user-token>
//
// Reads META_APP_SECRET + META_FB_PAGE_ID from functions/.env so you
// never have to type the secret on the command line.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', 'functions', '.env');
const APP_ID = '1485870226522993'; // MaaMitra app

const shortToken = process.argv[2];
if (!shortToken) {
  console.error('Usage: node scripts/mint-fb-page-token.mjs <short-lived-user-token>');
  console.error('');
  console.error('Get the short-lived token from:');
  console.error('  https://developers.facebook.com/tools/explorer/');
  console.error('  → Top right: select MaaMitra app');
  console.error('  → Get Token → Get User Access Token');
  console.error('  → Tick: pages_show_list, pages_manage_posts, pages_manage_engagement,');
  console.error('          pages_manage_metadata, pages_read_engagement, read_insights,');
  console.error('          instagram_basic, instagram_content_publish,');
  console.error('          instagram_manage_comments, instagram_manage_insights');
  console.error('  → Generate Access Token, copy the result, pass it as the arg here.');
  process.exit(1);
}

// ── Load .env ───────────────────────────────────────────────────────────────
let env;
try {
  env = parseEnv(readFileSync(ENV_PATH, 'utf8'));
} catch (e) {
  console.error(`Could not read ${ENV_PATH}:`, e.message);
  process.exit(1);
}
const APP_SECRET = env.META_APP_SECRET;
const PAGE_ID = env.META_FB_PAGE_ID;
if (!APP_SECRET) { console.error('META_APP_SECRET missing from functions/.env'); process.exit(1); }
if (!PAGE_ID) { console.error('META_FB_PAGE_ID missing from functions/.env'); process.exit(1); }

console.log('→ Step 1: exchange short-lived user token for long-lived user token…');

// ── Step 1: short-lived user token → long-lived user token ──────────────────
const exchangeUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
exchangeUrl.searchParams.set('client_id', APP_ID);
exchangeUrl.searchParams.set('client_secret', APP_SECRET);
exchangeUrl.searchParams.set('fb_exchange_token', shortToken);

const exchRes = await fetch(exchangeUrl);
const exch = await exchRes.json();
if (!exch.access_token) {
  console.error('  ✗ Exchange failed:', JSON.stringify(exch, null, 2));
  process.exit(1);
}
const longUserToken = exch.access_token;
const days = exch.expires_in ? Math.round(exch.expires_in / 86400) : 60;
console.log(`  ✓ Got long-lived user token (expires in ~${days} days)`);

// ── Step 2: long-lived user token → never-expiring Page token ───────────────
console.log('→ Step 2: fetch Page Access Token from /me/accounts…');
const accUrl = new URL('https://graph.facebook.com/v21.0/me/accounts');
accUrl.searchParams.set('fields', 'id,name,access_token,perms');
accUrl.searchParams.set('access_token', longUserToken);

const accRes = await fetch(accUrl);
const acc = await accRes.json();
if (!Array.isArray(acc.data) || acc.data.length === 0) {
  console.error('  ✗ /me/accounts returned no pages:', JSON.stringify(acc, null, 2));
  process.exit(1);
}
const ourPage = acc.data.find((p) => p.id === PAGE_ID);
if (!ourPage) {
  console.error(`  ✗ Page ${PAGE_ID} not in your admin list. Pages found:`);
  acc.data.forEach((p) => console.error(`     - ${p.name} (${p.id})`));
  process.exit(1);
}
if (!ourPage.access_token) {
  console.error('  ✗ Page entry has no access_token field.');
  console.error('    Likely the user token is missing pages_* scopes. Re-mint with all scopes.');
  process.exit(1);
}

console.log(`  ✓ Got never-expiring Page Access Token for ${ourPage.name}`);
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Paste this line into functions/.env (replacing the existing one):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log(`META_FB_PAGE_ACCESS_TOKEN=${ourPage.access_token}`);
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Page: ${ourPage.name} (${ourPage.id})`);
console.log(`  Perms: ${(ourPage.perms ?? []).join(', ') || '(none returned — check Graph debugger)'}`);
console.log('  Expires: never (as long as you keep Page admin role)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

function parseEnv(raw) {
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}
