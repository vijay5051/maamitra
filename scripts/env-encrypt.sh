#!/usr/bin/env bash
# Encrypts .env → .env.enc (safe to commit; the repo is public).
# Run after ANY change to .env, then commit + push .env.enc.
#
# Usage: ./scripts/env-encrypt.sh
# Passphrase lives in Vijay's password manager ("MaaMitra .env passphrase").
# Never commit, paste in chat, or hardcode the passphrase.

set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "✘ .env not found at repo root"; exit 1; }

openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in .env -out .env.enc

echo "✔ Wrote .env.enc — now: git add .env.enc && git commit -m 'chore: update encrypted env' && git push"
