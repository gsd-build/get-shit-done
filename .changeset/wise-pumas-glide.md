---
type: Fixed
pr: 3766
---
**`applySurface` now prunes `~/.claude/skills/gsd-STEM/` directories on cluster disable** — matches the install/uninstall behavior; disabled clusters were leaving stale skill dirs on disk because the surface.md spec directed the AI to use the skills sub-directory as `runtimeConfigDir` instead of the base config dir. Extracts `pruneSkillDirs()` as the single point of truth for skill-dir removal.
