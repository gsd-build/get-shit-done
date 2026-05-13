---
type: Fixed
pr: 3463
---
**State mutations now preserve literal dollar amounts** — begin-phase, advance-plan, and complete-phase no longer recurse Current Position content when values contain `$N` patterns.
