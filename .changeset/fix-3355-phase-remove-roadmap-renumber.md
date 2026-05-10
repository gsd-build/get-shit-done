---
type: Fixed
pr: 3367
---
**`phase remove --force` no longer collapses all later ROADMAP phases to the removed phase number** — integer phase removal now renumbers ROADMAP structures in single-pass callbacks, preserving later progress rows/headings and avoiding repeated rewrites of newly generated phase numbers. (#3355)
