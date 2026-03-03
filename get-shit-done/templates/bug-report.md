# Bug Report Template

Documents the `.planning/bugs/BUG-{NNN}.md` file format, frontmatter fields, sections, and lifecycle.

## File Format

Bug files live in `.planning/bugs/` (active) or `.planning/bugs/resolved/` (closed).

### Frontmatter Fields

```yaml
---
id: BUG-{NNN}              # Unique identifier, zero-padded to 3 digits
title: "{title}"            # Short description, 3-10 words
severity: critical|high|medium|low
status: reported|investigating|fixing|resolved
area: {area}                # Inferred from file paths (auth, api, ui, etc.)
phase: {phase or null}      # Related phase number, if applicable
created: {ISO timestamp}    # When the bug was reported
updated: {ISO timestamp}    # Last modification time
github_issue: {URL or null} # GitHub issue URL if created
files:                      # Related source files
  - {file paths}
---
```

### Sections

| Section | Mutability | Description |
|---------|-----------|-------------|
| `## Description` | Immutable | What the bug is |
| `## Expected Behavior` | Immutable | What should happen |
| `## Actual Behavior` | Immutable | What actually happens |
| `## Reproduction Steps` | Immutable | How to reproduce (or "unknown") |
| `## Environment` | Immutable | Branch, OS, Node version, etc. |
| `## Related Code` | Appendable | File paths and code snippets |
| `## Diagnostic Logs` | Appendable | Git state, log files, error output |

## Severity Guide

| Level | Keywords | Examples |
|-------|----------|----------|
| **critical** | crash, data loss, security, vulnerability, corruption, infinite loop, memory leak | App crashes on startup, user data deleted |
| **high** | broken, fails, error, exception, cannot, blocks, regression, timeout | Feature completely broken, blocking other work |
| **medium** | incorrect, wrong, unexpected, inconsistent, slow, intermittent | Wrong output, occasional failures |
| **low** | typo, alignment, color, spacing, formatting, cosmetic, minor | Visual glitches, text errors |

Default severity is **medium** if no keywords match.

## Lifecycle States

```
reported -> investigating -> fixing -> resolved
```

- **reported**: Bug filed, not yet triaged
- **investigating**: Actively looking into root cause
- **fixing**: Root cause known, fix in progress
- **resolved**: Fix applied and verified (file moved to `bugs/resolved/`)

## Area Inference

Areas are inferred from related file paths:

| Path Pattern | Area |
|-------------|------|
| `src/api`, `routes/`, `endpoints/` | api |
| `src/auth`, `auth/`, `login` | auth |
| `src/ui`, `components/`, `pages/` | ui |
| `src/db`, `prisma/`, `migrations/` | database |
| `tests/`, `__tests__/`, `*.test.*` | testing |
| `docs/`, `*.md` | docs |
| (no match) | general |
