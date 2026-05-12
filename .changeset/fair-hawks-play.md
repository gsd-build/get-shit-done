---
type: Added
pr: 3444
---

**Codex managed hook commands now project through the shared shell-command seam** — the installer reuses the same runtime-aware command rendering policy for `config.toml` hook blocks and Codex reinstall rewrites, reducing shell-format drift between runtime surfaces. Closes #3440.
