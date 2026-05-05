# Worktree Path Safety

Guards for executor agents running inside Claude Code worktrees. Three checks
must run before any staging, Edit, or Write operation in worktree mode.

---

## Worktree branch check (run once at spawn-time)

FIRST ACTION: HEAD assertion MUST run before any reset/checkout. Worktrees
spawned by Claude Code's `isolation="worktree"` use the `worktree-agent-<id>`
namespace. If HEAD is on a protected ref (main/master/develop/trunk/release/*)
or detached, HALT — do NOT self-recover by force-rewinding via `git update-ref`,
that destroys concurrent commits in multi-active scenarios (#2924). Only after
this passes is `git reset --hard` safe (#2015 — affects all platforms).

```bash
HEAD_REF=$(git symbolic-ref --quiet HEAD || echo "DETACHED")
ACTUAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$HEAD_REF" = "DETACHED" ] || echo "$ACTUAL_BRANCH" | grep -Eq '^(main|master|develop|trunk|release/.*)$'; then
  echo "FATAL: worktree HEAD on '$ACTUAL_BRANCH' (expected worktree-agent-*); refusing to self-recover via 'git update-ref' (#2924)." >&2
  exit 1
fi
if ! echo "$ACTUAL_BRANCH" | grep -Eq '^worktree-agent-[A-Za-z0-9._/-]+$'; then
  echo "FATAL: worktree HEAD '$ACTUAL_BRANCH' is not in the worktree-agent-* namespace; refusing to commit (#2924)." >&2
  exit 1
fi
ACTUAL_BASE=$(git merge-base HEAD {EXPECTED_BASE})
if [ "$ACTUAL_BASE" != "{EXPECTED_BASE}" ]; then
  git reset --hard {EXPECTED_BASE}
  [ "$(git rev-parse HEAD)" != "{EXPECTED_BASE}" ] && { echo "ERROR: could not correct worktree base"; exit 1; }
fi
```

Per-commit HEAD assertion: `agents/gsd-executor.md` `<task_commit_protocol>` step 0.

---

## cwd-drift sentinel — step 0a (#3097)

A prior Bash call may have `cd`'d out of the worktree into the main repo. When
that happens `[ -f .git ]` is false (main repo's `.git` is a directory), silently
skipping all worktree guards. The sentinel captures the spawn-time toplevel and
detects drift before every commit.

```bash
if [ -f .git ]; then  # we are in a worktree
  WT_GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
  case "$WT_GIT_DIR" in
    *.git/worktrees/*)
      SENTINEL="$WT_GIT_DIR/gsd-spawn-toplevel"
      [ ! -f "$SENTINEL" ] && git rev-parse --show-toplevel > "$SENTINEL" 2>/dev/null
      EXPECTED_TL=$(cat "$SENTINEL" 2>/dev/null)
      ACTUAL_TL=$(git rev-parse --show-toplevel 2>/dev/null)
      if [ -n "$EXPECTED_TL" ] && [ "$ACTUAL_TL" != "$EXPECTED_TL" ]; then
        echo "FATAL: cwd drifted from spawn-time worktree root (#3097)" >&2
        echo "  Spawn-time: $EXPECTED_TL" >&2
        echo "  Current:    $ACTUAL_TL" >&2
        echo "RECOVERY: cd \"$EXPECTED_TL\" before staging, then re-run this commit." >&2
        exit 1
      fi
      ;;
  esac
fi
```

---

## Absolute-path guard — step 0b (#3099)

Edit/Write calls using absolute paths constructed from the **orchestrator's** `pwd`
(main repo root) will resolve to the main repo, not the worktree. Writes land in
the wrong directory; `git commit` from the worktree sees a clean tree and the work
is silently lost.

Before any Edit or Write using an absolute path:

```bash
WT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
# Fail fast if ABS_PATH resolves outside the worktree
if [[ "$ABS_PATH" != "$WT_ROOT"* ]]; then
  echo "WARNING: $ABS_PATH is outside the worktree ($WT_ROOT)" >&2
  echo "Use a relative path or recompute the absolute path from WT_ROOT." >&2
fi
```

**Prefer relative paths** for all Edit/Write operations. When an absolute path is
unavoidable, always derive it from `git rev-parse --show-toplevel` run inside the
worktree — never from `pwd` captured in the orchestrator context.
