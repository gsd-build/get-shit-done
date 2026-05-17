---
type: Fixed
issue: 3610
---
**Fresh `npx get-shit-done-cc@latest --codex` no longer hard-aborts when leftover bundled `hooks/gsd-*` files are present** — `classifyPromptUserAction` in `installer-migration-report.cjs` now recognizes the bundled GSD hooks (`hooks/gsd-<name>.{js,sh,cjs,mjs}`) as a known category (`bundled-gsd-hook`) and resolves them to `remove` so the installer can write the fresh bundled versions. The classifier-based safe-default resolver in `bin/install.js` now runs regardless of TTY state — gating it on `!isTTY` made interactive installs throw `installer migration blocked pending user choice` for files that have no actual user choice to make.
