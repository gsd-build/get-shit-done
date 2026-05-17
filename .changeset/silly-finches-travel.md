---
type: Fixed
pr: 3563
---
**Ultraplan runtime gate now detects Claude Code correctly** - runtime gating no longer relies on `CLAUDE_CODE_VERSION`; it uses Claude Code marker env vars and preserves the minimum supported version floor. Fixes #3561.
