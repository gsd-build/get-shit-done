---
type: Fixed
pr: 3579
---
**Graphify auto-update hook now ships to install targets** — `gsd-graphify-update.sh` was missing from `scripts/build-hooks.js` `HOOKS_TO_COPY`, so it never landed in `hooks/dist/` and the installer's flat-readdir loop never copied it to `~/.claude/hooks/`. The hook's detached rebuild helper at `hooks/lib/gsd-graphify-rebuild.sh` was also dropped because both `build-hooks.js` and `bin/install.js` only walked top-level files. Both gaps are fixed: the allowlist now includes the hook, `build-hooks.js` copies whitelisted hook subdirectories into `hooks/dist/`, and `bin/install.js` mirrors hook subdirs to the target. Added a coverage drift guard so every top-level `hooks/*.sh` must be listed in `HOOKS_TO_COPY` going forward (#3579).
