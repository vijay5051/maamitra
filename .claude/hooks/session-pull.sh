#!/usr/bin/env bash
# SessionStart hook: sync with origin/main before any work starts, so this
# machine never edits (or OTA-publishes) a stale copy. See CLAUDE.md §3.
#
# - On `main` with no uncommitted tracked changes → git pull --rebase.
# - Dirty tree, other branch, or pull failure → fetch only, and warn.
# Never stashes, resets, or discards anything. Always exits 0.

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

say() {
  # $1 = short message for the user, $2 = context for Claude
  jq -n --arg m "$1" --arg c "$2" \
    '{systemMessage: $m, hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $c}}'
  exit 0
}

if ! git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=15 fetch --quiet --tags origin 2>/dev/null; then
  say "⚠ git: couldn't reach origin — working on possibly stale code." \
      "SessionStart auto-pull: git fetch failed (offline?). Local copy may be behind origin/main. Tell the user and retry git pull --rebase origin main before editing."
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
before="$(git rev-parse --short HEAD)"

if [ "$branch" != "main" ]; then
  say "git: on '$branch' (not main) — fetched only; $behind commit(s) behind origin/main." \
      "SessionStart auto-pull skipped: current branch is '$branch', not main. origin/main is $behind commit(s) ahead of HEAD. Rebase onto origin/main before editing if appropriate."
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  say "⚠ git: uncommitted changes — did NOT pull ($behind commit(s) behind origin/main)." \
      "SessionStart auto-pull skipped: working tree has uncommitted tracked changes (possibly another agent's work). origin/main is $behind commit(s) ahead. Per CLAUDE.md §3, stop and tell the user before touching files."
fi

if [ "$behind" -eq 0 ]; then
  say "git: up to date with origin/main ($before)." \
      "SessionStart auto-pull: already up to date with origin/main at $before."
fi

if out="$(git pull --rebase --quiet origin main 2>&1)"; then
  after="$(git rev-parse --short HEAD)"
  say "git: pulled $behind commit(s) from origin/main ($before → $after)." \
      "SessionStart auto-pull: pulled $behind commit(s) from origin/main ($before → $after). If package.json/package-lock.json changed, run npm ci."
else
  git rebase --abort >/dev/null 2>&1
  say "⚠ git: pull --rebase failed — local main unchanged. Needs manual attention." \
      "SessionStart auto-pull FAILED (rebase aborted, nothing lost): $out. Tell the user before editing."
fi
