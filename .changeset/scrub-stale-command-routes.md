---
type: Fixed
pr: 3029
---
**`/gsd-code-review-fix` and `/gsd-plan-milestone-gaps` no longer surface as "Unknown command"** — both were consolidated by #2790 (`/gsd-code-review --fix` and inline gap planning in `/gsd-audit-milestone` respectively), but several user-facing surfaces still emitted the old slash forms in their offer text. Fixed audit-milestone offer blocks, gsd-complete-milestone routing, code-review/execute-phase offer text, gsd-code-fixer agent role card, and the doc surfaces (USER-GUIDE, FEATURES, INVENTORY, AGENTS, CONFIGURATION). Closes #3029, closes #3034.
