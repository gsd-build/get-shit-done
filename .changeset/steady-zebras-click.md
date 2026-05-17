---
type: Added
pr: 3213
---
**Added: `lint:docs` enforcement.** New `scripts/lint-docs-required.cjs` + `Docs Required` CI workflow fail any PR whose changeset fragment is typed `Added` / `Changed` / `Deprecated` / `Removed` without modifying at least one file under `docs/`. Escape hatches: the `no-docs` PR label, or a per-fragment HTML-comment marker on its own line at the end of the fragment body (extracted at the `parseFragment` seam so it never bleeds into CHANGELOG.md or GitHub release-notes output). `Fixed` and `Security` fragments are not gated. Malformed fragments now fail closed via the new `FAIL_MALFORMED_FRAGMENT` verdict — a triggering fragment with bad frontmatter cannot silently bypass docs enforcement. PR templates (`enhancement.md`, `feature.md`) gain a Documentation checklist; `CONTRIBUTING.md` adds a `Documentation Updates` section codifying the which-doc-to-update matrix and English-canonical language policy.

<!-- docs-exempt: bootstrap of docs-required lint itself; contributor-facing enforcement lives in CONTRIBUTING.md and the PR templates, while docs/ is reserved for end-user documentation -->

