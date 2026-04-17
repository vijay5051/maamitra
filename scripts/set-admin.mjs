/**
 * Grant admin to a Firebase user via a custom claim ({ admin: true }).
 *
 * This replaces the email-based admin fallback in firestore.rules. Once every
 * admin account has the claim, we can delete the email whitelist and rely on
 * custom claims exclusively.
 *
 * One-time setup:
 *   1. Firebase Console → Project settings → Service accounts → Generate new
 *      private key. Save as `google-service-account.json` at the repo root.
 *      This file is already gitignored.
 *   2. npm install -D firebase-admin
 *
 * Run:
 *   node scripts/set-admin.mjs <uid>
 *     e.g. node scripts/set-admin.mjs abc123xyz
 *
 *   node scripts/set-admin.mjs --email admin@maamitra.app
 *     Looks up the uid by email, then sets the claim.
 *
 *   node scripts/set-admin.mjs --revoke <uid>
 *     Removes admin privileges.
 *
 * After running, the user must sign out and back in (or call
 * `auth.currentUser.getIdToken(true)`) for the new claim to take effect.
 */

import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'google-service-account.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error(`\n  ❌ Missing ${keyPath}`);
  console.error(`     Firebase Console → Project settings → Service accounts`);
  console.error(`     → Generate new private key → save as google-service-account.json\n`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const emailIdx = args.indexOf('--email');
let targetUid = null;

if (emailIdx !== -1) {
  const email = args[emailIdx + 1];
  if (!email) { console.error('  ❌ --email requires an email address'); process.exit(1); }
  const user = await admin.auth().getUserByEmail(email);
  targetUid = user.uid;
  console.log(`  ✓ Resolved ${email} → uid ${targetUid}`);
} else {
  targetUid = args.find(a => !a.startsWith('--'));
}

if (!targetUid) {
  console.error('  ❌ Usage: node scripts/set-admin.mjs <uid>');
  console.error('         node scripts/set-admin.mjs --email <email>');
  console.error('         node scripts/set-admin.mjs --revoke <uid>');
  process.exit(1);
}

const user = await admin.auth().getUser(targetUid);
const existing = user.customClaims || {};
const next = revoke ? { ...existing, admin: false } : { ...existing, admin: true };

await admin.auth().setCustomUserClaims(targetUid, next);

console.log(`\n  ✅ ${revoke ? 'Revoked admin from' : 'Granted admin to'} ${user.email || targetUid}`);
console.log(`     Claims now: ${JSON.stringify(next)}`);
console.log(`     User must sign out and back in for the change to take effect.\n`);

process.exit(0);
