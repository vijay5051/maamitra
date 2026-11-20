/**
 * Writes MaaMitra's WhatsApp Cloud API settings to app_settings/integrations
 * (the `whatsapp` map read by whatsappWebhookReceiver + the inbox publisher).
 *
 * Uses the Firebase CLI's stored credentials, like migrate-env-to-firestore.mjs.
 * Only the fields you pass are written; everything else in the doc is kept.
 *
 * Run:
 *   node scripts/set-whatsapp-config.mjs --ids --verify-token <token>
 *       → phoneNumberId + wabaId (MaaMitra number) + webhookVerifyToken
 *   node scripts/set-whatsapp-config.mjs --app-secret
 *       → prompts for the MaaMitra WA app secret (input hidden, never printed)
 *   node scripts/set-whatsapp-config.mjs --access-token
 *       → prompts for a permanent system-user token (input hidden), used to
 *         send inbox replies
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getAccessToken } = require('../node_modules/firebase-tools/lib/auth');
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline';

const PROJECT_ID = 'maa-mitra-7kird8';
const DOC = `projects/${PROJECT_ID}/databases/(default)/documents/app_settings/integrations`;
// MaaMitra's number (+1 555-754-0257) and its WhatsApp Business Account.
const PHONE_NUMBER_ID = '1484661554725273';
const WABA_ID = '925930867152323';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

const fields = {};
if (has('--ids')) {
  fields.phoneNumberId = PHONE_NUMBER_ID;
  fields.wabaId = WABA_ID;
}
if (val('--verify-token')) fields.webhookVerifyToken = val('--verify-token');
if (has('--app-secret')) fields.appSecret = await askHidden('MaaMitra WA app secret (hidden): ');
if (has('--access-token')) fields.accessToken = await askHidden('WhatsApp access token (hidden): ');

if (!Object.keys(fields).length || Object.values(fields).some((v) => !v)) {
  console.error('Nothing to write (or an empty value). See the usage at the top of this file.');
  process.exit(1);
}

let refreshToken;
try {
  refreshToken = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'))?.tokens?.refresh_token;
} catch { /* handled below */ }
if (!refreshToken) {
  console.error('❌  No Firebase CLI login found. Run: npx firebase login');
  process.exit(1);
}
const { access_token } = await getAccessToken(refreshToken, []);

const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=whatsapp.${k}`).join('&');
const body = {
  fields: {
    whatsapp: { mapValue: { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: v }])) } },
  },
};
const res = await fetch(`https://firestore.googleapis.com/v1/${DOC}?${mask}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`❌  Firestore write failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
console.log(`✅  Saved whatsapp.{${Object.keys(fields).join(', ')}} to app_settings/integrations.`);
console.log('    Cloud Functions pick it up within 5 minutes (config cache).');
