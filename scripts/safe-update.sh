#!/usr/bin/env bash
# Guard against the failure mode that wiped out an entire morning of work
# on 2026-05-01: an agent runs `eas update` from a dirty / un-pushed
# working tree, the bundle ships, and then the next push from a different
# agent overwrites the bundle on the channel — leaving the source nowhere
# in git. This script blocks that by refusing to publish unless:
#   1. The working tree is clean (no staged or unstaged changes).
#   2. The branch is up to date with origin (no unpushed commits).
#
# Use this for ANY production OTA. Web deploys + AAB builds also need a
# clean tree, but they're harder to silently lose, so we don't gate
# them here.
#
# Override (NOT recommended): SAFE_UPDATE_BYPASS=1 npm run update

set -e

if [ "${SAFE_UPDATE_BYPASS:-}" = "1" ]; then
  echo "⚠️  SAFE_UPDATE_BYPASS=1 — skipping clean-tree guard. Make sure you know what you're doing."
else
  if [ -n "$(git status --porcelain)" ]; then
    echo "✘ Refusing to publish: working tree is dirty."
    echo
    git status --short
    echo
    echo "Commit or stash these changes first. The OTA bundle ships from"
    echo "your *current* working tree — anything uncommitted goes into the"
    echo "bundle but stays nowhere in git, and the next push will overwrite"
    echo "it on the channel. (See scripts/safe-update.sh for the rationale.)"
    exit 1
  fi

  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  git fetch --quiet origin "$current_branch" || true
  local_head="$(git rev-parse HEAD)"
  remote_head="$(git rev-parse "origin/$current_branch" 2>/dev/null || echo '')"
  if [ -n "$remote_head" ] && [ "$local_head" != "$remote_head" ]; then
    behind="$(git rev-list --count "HEAD..origin/$current_branch")"
    ahead="$(git rev-list --count "origin/$current_branch..HEAD")"
    if [ "$ahead" -gt 0 ]; then
      echo "✘ Refusing to publish: $ahead commit(s) ahead of origin/$current_branch."
      echo "  Push first: git push origin $current_branch"
      exit 1
    fi
    if [ "$behind" -gt 0 ]; then
      echo "✘ Refusing to publish: $behind commit(s) behind origin/$current_branch."
      echo "  Pull first: git pull --rebase"
      exit 1
    fi
  fi
fi

echo "✔ Working tree clean and in sync with origin. Publishing OTA…"

# Default --message + --environment so `npm run update` works without
# needing the caller to thread flags through. EAS requires both for a
# non-interactive publish on the current CLI; they're easy to omit by
# accident, and a missing flag fails AFTER the bundle has uploaded —
# wasting an upload cycle. Pre-fill them, and let any explicit flag in
# "$@" override.
extra_args=()
case " $* " in
  *" --message "*|*" -m "*) ;;
  *)
    commit_subject="$(git log -1 --format='%s' 2>/dev/null || echo 'OTA update')"
    extra_args+=("--message" "$commit_subject")
    ;;
esac
case " $* " in
  *" --environment "*|*" -e "*) ;;
  *)
    extra_args+=("--environment" "production")
    ;;
esac
case " $* " in
  *" --non-interactive "*) ;;
  *) extra_args+=("--non-interactive") ;;
esac

exec npx eas-cli update --branch production "${extra_args[@]}" "$@"
