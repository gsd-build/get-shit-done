# GSD Cursor Integration

## What This Is

Cursor IDE support for the GSD unified installer. Users can now install GSD directly to `~/.cursor/` using `npx get-shit-done-cc --cursor --global`. All commands, agents, and supporting files are automatically converted from Claude Code format to Cursor format during installation.

## Core Value

Single unified installer that supports all AI runtimes (Claude Code, OpenCode, Gemini, Cursor) with consistent behavior and automatic format conversion.

## Current State

**Shipped:** v1.0 (2026-02-05)

The unified installer now supports Cursor as a first-class runtime:
- `--cursor` CLI flag for targeted installation
- Interactive prompt includes Cursor option
- Automatic tool name conversion (PascalCase → snake_case)
- Automatic frontmatter conversion (array → object format)
- Automatic path conversion (`~/.claude/` → `~/.cursor/`)
- Hook deployment correctly skipped (Cursor has no hook API)

## Requirements

### Validated

- ✓ Multi-runtime installer supporting Claude Code, OpenCode, Gemini, Cursor — v1.0
- ✓ Tool name mapping for Cursor (claudeToCursorTools) — v1.0
- ✓ Frontmatter conversion for Cursor (array → object) — v1.0
- ✓ Path reference conversion (~/.claude/ → ~/.cursor/) — v1.0
- ✓ Command format conversion (/gsd: → /gsd-) — v1.0
- ✓ --cursor CLI flag and interactive prompt — v1.0
- ✓ Install/uninstall for Cursor runtime — v1.0
- ✓ Hook skipping for Cursor (no hook API) — v1.0
- ✓ Human-verified working in Cursor IDE — v1.0

### Active

(No active requirements — milestone complete. Run `/gsd-new-milestone` to define next milestone requirements.)

### Out of Scope

- Local install for Cursor — keeping global-only for simplicity (v2 candidate)
- Runtime auto-detection — explicit flag required (v2 candidate)
- Cursor-specific hooks — Cursor has no hook/notification API
- Separate cursor-gsd distribution — consolidated into main installer

## Context

**Tech stack:** Node.js installer (bin/install.js), zero runtime dependencies
**Codebase:** ~1750 lines in bin/install.js with Cursor support
**User feedback:** Human-verified working in Cursor IDE

## Constraints

- **No new dependencies** — maintain zero runtime dependencies
- **Reuse existing patterns** — Cursor conversion follows OpenCode/Gemini approach
- **Backward compatible** — existing Claude/OpenCode/Gemini installs unaffected

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Global-only for Cursor | Simplify initial implementation | ✓ Good — works well |
| Skip hooks for Cursor | Cursor has no statusline/notification API | ✓ Good — correct behavior |
| Remove cursor-gsd after consolidation | Eliminate duplicate code | ✓ Good — cleaner repo |
| snake_case for Cursor tools | Matches OpenCode pattern | ✓ Good — consistent |
| /gsd- command format | Matches OpenCode flat structure | ✓ Good — works in Cursor |

---
*Last updated: 2026-02-05 after v1.0 milestone*
