---
name: gsd:sync-skills
description: Sync managed GSD skills across runtime roots so multi-runtime users stay aligned after an update
allowed-tools:
  - Bash
  - AskUserQuestion
---

<objective>
Sync managed `gsd-*` skill directories from one canonical runtime's skills root to one or more destination runtime skills roots.

Routes to the sync-skills workflow which handles:
- Argument parsing (--from, --to, --dry-run, --apply)
- Runtime skills root resolution via install.js --skills-root
- Diff computation (CREATE / UPDATE / REMOVE per destination)
- Dry-run reporting (default — no writes)
- Apply execution (copy and remove with idempotency)
- Non-GSD skill preservation (only gsd-* dirs are touched)
</objective>
