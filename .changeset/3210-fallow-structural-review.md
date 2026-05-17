---
type: Added
pr: 3424
---
**Adds optional fallow structural pre-pass support for `/gsd-code-review` via `code_quality.fallow.*` config keys** — when enabled, the workflow resolves a fallow binary (`PATH` then `node_modules/.bin`), writes `.planning/phases/<phase>/FALLOW.json`, and passes a dedicated `<structural_findings>` block into `gsd-code-reviewer` so `REVIEW.md` can separate `Structural Findings (fallow)` from narrative reviewer findings. This ships a new CLI module (`fallow-runner.cjs`) plus SDK twin normalization logic (`sdk/src/query/fallow-audit.ts`), updates config schema/docs, and keeps default behavior unchanged when fallow remains disabled.
