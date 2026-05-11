---
type: Fixed
pr: 3368
---

**Gemini install output is valid on Windows PowerShell** - managed hook commands now use PowerShell's call operator when invoking quoted Node runners on Windows, and reinstall rewrites existing managed hooks without double-prefixing them. Gemini agent conversion also drops Claude-only `AskUserQuestion` / `ask_user` tool metadata and rewrites body references to runtime-neutral prompt wording. Fixes #3362.
