---
type: Added
pr: 3445
---

**Shell command projection is now centralized for key installer/runtime surfaces** — managed-hook rewrites, local hook command construction, Windows shim rendering, and SDK PATH diagnostics now share one projection seam to reduce cross-shell drift and runtime-specific regressions. (#3445)
