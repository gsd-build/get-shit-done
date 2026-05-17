---
type: Fixed
pr: 3450
---
**Stabilized shell-command projection integration and uninstall hook cleanup** — rebasing the ADR-0009 projection work onto `main` now preserves the typed PATH-action seam while keeping the persistent PATH-export adapter used by installer messaging. It also hardens `settings.json` hook cleanup in `bin/install.js` to skip malformed/non-command hook entries before calling managed-hook classification, preventing uninstall-time crashes when mixed hook shapes are present.
