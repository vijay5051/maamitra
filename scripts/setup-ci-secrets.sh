#!/usr/bin/env bash
# Run this ONCE from Vijay's Mac to seed GitHub + EAS with all secrets.
# After this, every push to main triggers the full deploy automatically.
#
# Prerequisites (install if missing):
#   brew install gh
#   npm install -g eas-cli
#
# Usage:
#   chmod +x scripts/setup-ci-secrets.sh
#   ./scripts/setup-ci-secrets.sh /path/to/firebase-service-account.json

set -e

REPO="vijay5051/maamitra"
ENV_FILE="$(dirname "$0")/../.env"
SERVICE_ACCOUNT_JSON="${1:-}"

# ── Preflight ────────────────────────────────────────────────────────────────

if [ ! -f "$ENV_FILE" ]; then
  echo "✘ .env not found at $ENV_FILE"
  exit 1
fi

if [ -z "$SERVICE_ACCOUNT_JSON" ] || [ ! -f "$SERVICE_ACCOUNT_JSON" ]; then
  echo "Usage: $0 /path/to/firebase-service-account.json"
  echo ""
  echo "Get the JSON from:"
  echo "  Firebase Console → Project Settings → Service Accounts → Generate new private key"
  exit 1
fi

command -v gh    >/dev/null || { echo "✘ gh CLI not found. Install: brew install gh"; exit 1; }
command -v eas   >/dev/null || { echo "✘ eas CLI not found. Install: npm i -g eas-cli"; exit 1; }

echo "→ Checking GitHub auth…"
gh auth status || gh auth login

echo "→ Checking EAS auth…"
eas whoami || eas login

# ── Step 1: GitHub secrets ───────────────────────────────────────────────────

echo ""
echo "── Step 1: GitHub secrets ──────────────────────────────────────────────"

echo "→ Creating EXPO_TOKEN…"
EXPO_TOKEN=$(eas token:create --name "github-actions-$(date +%Y%m)" --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || true)

if [ -z "$EXPO_TOKEN" ]; then
  echo "  Auto-create failed. Generate one manually:"
  echo "  https://expo.dev/accounts/[your-account]/settings/access-tokens"
  read -r -p "  Paste EXPO_TOKEN: " EXPO_TOKEN
fi

gh secret set EXPO_TOKEN --repo "$REPO" --body "$EXPO_TOKEN"
echo "✔ EXPO_TOKEN set"

echo "→ Setting FIREBASE_SERVICE_ACCOUNT…"
gh secret set FIREBASE_SERVICE_ACCOUNT --repo "$REPO" --body "$(cat "$SERVICE_ACCOUNT_JSON")"
echo "✔ FIREBASE_SERVICE_ACCOUNT set"

# ── Step 2: Upload env vars to EAS ──────────────────────────────────────────

echo ""
echo "── Step 2: EAS production environment variables ────────────────────────"
echo "   (GitHub Actions pulls these with: eas env:pull production)"
echo ""

# Load .env, skip comments and blank lines
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  # Only sync EXPO_PUBLIC_* vars (server-side keys stay local)
  [[ "$key" != EXPO_PUBLIC_* ]] && continue
  echo "→ Syncing $key…"
  # Try create first; if it already exists, update it
  eas env:create production "$key" "$value" --non-interactive 2>/dev/null \
    || eas env:update production "$key" "$value" --non-interactive 2>/dev/null \
    || echo "  ⚠ Could not set $key — set it manually in expo.dev"
done < "$ENV_FILE"

echo ""
echo "✔ All done. GitHub Actions will now:"
echo "  • Build + deploy to Firebase Hosting on every push to main"
echo "  • Push OTA update to all existing app installs"
echo ""
echo "  Monitor runs at: https://github.com/$REPO/actions"
