---
type: Added
pr: 2975
---
**Changeset-fragment workflow** — eliminates CHANGELOG.md merge conflicts. Each PR drops `.changeset/<random-name>.md` with frontmatter (`type:`, `pr:`) plus a markdown body; the release-time `npm run changelog:render` consolidates fragments into `CHANGELOG.md` and deletes them. CI lint (`npm run lint:changeset`) requires a fragment on any PR touching user-facing files (`bin/`, `get-shit-done/`, `agents/`, `commands/`, `hooks/`, `sdk/src/`); contributors can opt out via the `no-changelog` label for purely internal changes. See [.changeset/README.md](.changeset/README.md) and CONTRIBUTING.md for the workflow.
