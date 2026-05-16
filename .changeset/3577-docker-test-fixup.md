---
type: Fixed
pr: 3577
---
**Docker test fix-forward: 12 ubuntu-only regressions surfaced by `gsd-test-summary` cleared** —
- `agents/gsd-intel-updater.md` retargeted from `gsd-sdk query intel.*` to `gsd-tools intel <subcommand>` (intel is out-of-seam per ADR §3 / PRD L160; the SDK has no handler for it, so the agent's CLI calls were broken).
- `roadmap.get-phase` two-pass lookup for project-code-prefixed IDs (port of CJS `phaseMarkdownRegexSourceExact`, #3599): a `PROJ-42` query now matches `### Phase PROJ-42:` directly without cross-matching a bare `### Phase 42:` that happens to share the trailing integer.
- `roadmap.analyze` extracts the `**Mode:**` field per phase (parity with `roadmap.get-phase`).
- `phase.remove` depth-aware end-of-section regex (port of CJS #3601 fix): removing `### Phase 2:` stops at `### Phase 2.1:` (peer-depth decimal preserved) but continues past `#### Phase 27.1:` (child-depth decimal of `### Phase 27:`). Named capture `(?<h>#{2,4})` + backreference `\k<h>(?!#)` enforces same-depth termination.
- `phase.remove` slugged-plan reference renumbering (port of CJS #3602 fix): the padded-plan-reference pattern now allows arbitrary kebab-case slug segments between `NN-NN` and the `-PLAN.md` / `-SUMMARY.md` suffix, so references like `07-01-cherry-pick-foundation-PLAN.md` get renumbered to `06-01-…` when Phase 7 is removed.
- `configNewProject` filters out manifest keys that legacy CJS init does not materialize (`git.base_branch`, `resolve_model_ids`, `context_window`, `mode`, `planning`, `graphify`): these have their own resolution paths (auto-detect, opt-in) and materializing manifest values would suppress them. `config-get git.base_branch` correctly returns "Key not found" so workflows can fall back to `origin/HEAD` resolution.
