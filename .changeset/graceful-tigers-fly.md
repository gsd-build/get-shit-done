---
type: Fixed
pr: 3583
---
Claude skill install (convertClaudeCommandToClaudeSkill + copyCommandsAsClaudeSkills) now normalizes retired /gsd:<cmd> references in SKILL.md bodies to the canonical gsd-<cmd> hyphen form using the new transformContentToHyphen from the shared fix-slash-commands.cjs transformer. Frontmatter name: was already correct since #2808; body leakage is now eliminated for Claude, Qwen, and Hermes. Added regression guard in bug-2808 test. Fixes #3583.
