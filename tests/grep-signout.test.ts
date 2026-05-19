/**
 * Enforce: the only file allowed to call useAuthStore.signOut() directly
 * is hooks/useSignOut.ts. Everything else MUST go through the hook.
 *
 * This test fails the build if anyone tries to bypass the unified flow.
 *
 * The exception list:
 *   - hooks/useSignOut.ts — the canonical hook
 *   - store/useAuthStore.ts — the store itself (internal definition)
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const ALLOWED = new Set([
  'hooks/useSignOut.ts',
  'store/useAuthStore.ts',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.expo', '.next', 'dist', 'build',
  'ios', 'android', 'tests', 'docs', '.claude', '.superpowers',
]);

function walk(dir: string, hits: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, hits);
    else if (/\.(ts|tsx)$/.test(name)) hits.push(p);
  }
  return hits;
}

describe('grep: no raw signOut() outside the hook', () => {
  test('all signOut() callsites are inside the allowed files', () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = file.replace(ROOT + '/', '');
      if (ALLOWED.has(rel)) continue;
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match patterns like:
        //   useAuthStore.getState().signOut(
        //   .signOut()
        // Exclude:
        //   firebaseSignOut(auth)   — firebase auth's own signOut
        //   firebase/auth signOut   — direct firebase import
        //   await signOut.confirm()  — useSignOut hook's confirm
        //   signOut.open() / signOut.cancel()  — hook methods
        if (!/\.signOut\(/.test(line)) continue;
        if (/firebaseSignOut|firebase\/auth|auth\.signOut\(/.test(line)) continue;
        if (/signOut\.(open|cancel|confirm)\(/.test(line)) continue;
        offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
      }
    }
    if (offenders.length) {
      // eslint-disable-next-line no-console
      console.error('\nRaw signOut() callsites found outside hooks/useSignOut.ts:\n  ' + offenders.join('\n  '));
    }
    expect(offenders).toEqual([]);
  });
});
