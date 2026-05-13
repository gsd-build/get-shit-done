---
type: Changed
pr: 3039
---
**`/gsd-help` is now tiered** — default output fits one screen, `--brief` gives a 10-line refresher, `--full` keeps the complete reference, `/gsd-help <topic>` jumps straight to one section (e.g. `/gsd-help debug`), and `/gsd-help --brief <topic>` is a compact scoped lookup (signature + one-line summary). Every topic output starts with a resolved-routing preamble so the matched alias and scope are visible. Closes #3039.
