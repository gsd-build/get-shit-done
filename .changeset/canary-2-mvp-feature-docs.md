---
type: Changed
pr: 0
---
**First end-to-end user-facing docs for the MVP umbrella feature** — `docs/USER-GUIDE.md` gains an "MVP Mode" walkthrough section (when to pick it, 5-row diff table vs standard mode, worked example with the same webhook-validator scenario as the standard walkthrough, "how to confirm MVP mode is on" recipe, configuration knobs, links to all reference docs); `docs/COMMANDS.md` gains a full `### /gsd-mvp-phase` entry, the `--mvp` flag row on `/gsd-plan-phase`, and the Vertical MVP / Horizontal Layers mode prompt on `/gsd-new-project`; `docs/CLI-TOOLS.md` gains a "MVP Commands" section documenting the three new query verbs (`phase.mvp-mode`, `task.is-behavior-adding`, `user-story.validate`) with input forms, return shapes, per-field tables. New `docs/RELEASE-v1.50.0-canary.2.md` cross-links into all of the above as the canary release notes. Closes the docs gap between canary.1 (feature shipped) and canary.2 (feature documented).
