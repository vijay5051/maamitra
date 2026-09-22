#!/usr/bin/env bash
# Decrypts .env.enc → .env on a fresh machine.
#
# Usage: ./scripts/env-decrypt.sh        (refuses to overwrite an existing .env)
#        ./scripts/env-decrypt.sh -f     (overwrite)
# Passphrase lives in Vijay's password manager ("MaaMitra .env passphrase").

set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.enc ] || { echo "✘ .env.enc not found — run git pull first"; exit 1; }

if [ -f .env ] && [ "${1:-}" != "-f" ]; then
  echo "✘ .env already exists. Re-run with -f to overwrite."
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in .env.enc -out "$tmp" 2>/dev/null; then
  echo "✘ Wrong passphrase (or corrupted .env.enc). Nothing written."
  exit 1
fi

mv "$tmp" .env
chmod 600 .env
trap - EXIT

echo "✔ .env restored ($(grep -c '=' .env) vars)."
