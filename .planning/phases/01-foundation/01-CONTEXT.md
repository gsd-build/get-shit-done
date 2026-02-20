# Phase 1 Context: Foundation

**Created:** 2026-02-20
**Phase Goal:** Establish worktree lifecycle management with atomic locking and registry tracking

## Decisions

### Worktree Location and Naming

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Worktree location | Subdirectory in repo (`.worktrees/`) | Keeps worktrees contained within project structure |
| Branch naming pattern | `phase-{N}-{slug}` | Simple, no namespace prefix (e.g., `phase-1-foundation`) |
| Directory naming | `{repo}-phase-{N}` | Includes repo name for clarity (e.g., `get-shit-done-phase-1`) |
| Path storage in registry | Absolute paths | Unambiguous, works from anywhere |

**Implications:**
- Must add `.worktrees/` to `.gitignore`
- Directory pattern: `.worktrees/{repo}-phase-{N}/`
- Full example: `.worktrees/get-shit-done-phase-1/` with branch `phase-1-foundation`

### Command Output Format

Left to implementation discretion. Researcher/planner should follow GSD conventions:
- Human-readable by default
- JSON available via `--json` flag if needed for scripting

### Lock Behavior and Ownership

Left to implementation discretion. Research established:
- Directory-based locks (`mkdir` is POSIX-atomic)
- Store in `.planning/worktrees/locks/`
- Track timestamp and owner metadata

### Error Messages and Recovery

Left to implementation discretion. Follow GSD conventions:
- Clear error messages with actionable recovery steps
- Non-zero exit codes on failure

## Deferred Ideas

None captured.

## Open Questions

- Should `.worktrees/` be created lazily on first worktree, or eagerly during project init?
- How to handle the case where `.worktrees/` is accidentally deleted but registry still has entries?

---
*Context captured: 2026-02-20*
