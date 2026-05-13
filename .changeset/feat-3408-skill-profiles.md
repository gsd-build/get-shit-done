---
type: Added
pr: 3408
---
**Named install profiles and dependency manifest for skill surface budget control** — GSD now ships a typed profile model (`core`, `standard`, `full`) replacing the binary `--minimal`/full toggle. Install with `--profile=core` (~87 desc tokens) or `--profile=standard` (~700 tokens) to reduce the GSD share of the Claude Code skill-listing budget. Profiles compute transitive closure over a new `requires:` frontmatter field added to all 66 skills, so dependent skills are automatically included. The active profile is persisted to a `.gsd-profile` marker and respected by `gsd update` — no more silent re-expansion to full on upgrade. A new CI lint gate (`lint:skill-deps`) enforces frontmatter-body consistency and profile closure safety. `--minimal` / `--core-only` remain as aliases for `--profile=core`. (#3408)
