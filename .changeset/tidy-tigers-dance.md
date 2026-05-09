---
type: Removed
pr: 3313
---
**Redundant `CHANGELOG.md` row left behind by #3308 has been deleted** — the canonical `.changeset/3262-extract-scan-phase-plans.md` fragment remains the single source of truth for the `scanPhasePlans` extraction (k014, #3262). Per [CONTRIBUTING.md](CONTRIBUTING.md) ("Do not edit `CHANGELOG.md` directly"), the release workflow folds `.changeset/*.md` fragments into the changelog at release time; the hand-written row would have produced a duplicated entry on the next release. (#3313)
