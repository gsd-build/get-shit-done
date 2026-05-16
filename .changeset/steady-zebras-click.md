---
type: Added
pr: 3213
---
**Added: `lint:docs` enforcement.** New `scripts/lint-docs-required.cjs` + `Docs Required` CI workflow fail any PR whose changeset fragment is typed `Added` / `Changed` / `Deprecated` / `Removed` without modifying at least one file under `docs/`. Escape hatches: `no-docs` PR label, or per-fragment `<!-- docs-exempt: <reason> -->` marker. `Fixed` and `Security` fragments are not gated. PR templates (`enhancement.md`, `feature.md`) gain a Documentation checklist; `CONTRIBUTING.md` adds a `Documentation Updates` section codifying the which-doc-to-update matrix and English-canonical language policy (#3213).
