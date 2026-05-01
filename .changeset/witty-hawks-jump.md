---
type: Fixed
pr: 2973
---
/gsd-profile-user --refresh writes dev-preferences.md to ~/.claude/skills/gsd-dev-preferences/SKILL.md instead of the legacy commands/gsd/ directory. Installer migrates any preserved legacy file to the new location. See #2973.
