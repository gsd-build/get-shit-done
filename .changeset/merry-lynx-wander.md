---
type: Fixed
pr: 3007
---
**PR templates now point at the changeset workflow** — the `Fix`, `Enhancement`, and `Feature` PR templates previously asked contributors to tick `CHANGELOG.md updated`, which contradicted the post-#2978 rule that `CHANGELOG.md` must not be edited directly. Each checkbox now references `npm run changeset` (and the `no-changelog` opt-out where applicable).
