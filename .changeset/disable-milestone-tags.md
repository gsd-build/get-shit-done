---
type: Added
pr: 3508
---
**Configurable milestone git-tag creation** — new `git.create_tag` boolean config (default `true`, backcompat) lets projects with their own release flow disable GSD's automatic `git tag -a v[X.Y]` on milestone completion. Set via `/gsd:settings` or `gsd config-set git.create_tag false`. Also adds tag-collision pre-check to prevent silent failure when re-running a milestone close. (#3508)
