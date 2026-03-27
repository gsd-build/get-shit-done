---
description: Diagnose planning directory health and optionally repair issues
---

# GSD Health

Validate `.planning/` directory integrity and report actionable issues.

## Usage

```
/gsd-health [--repair]
```

**Flags:**
- `--repair` — Automatically fix detected issues

## Process

Execute the health workflow from `get-shit-done/workflows/health.md` end-to-end.

## Reference

See `commands/gsd/health.md` in the GSD source for the full command definition.