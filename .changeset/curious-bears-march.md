---
type: Fixed
pr: 3012
---
**Post-install message and update.md no longer recommend the removed `/gsd-reapply-patches` command** — after PR #2824 consolidated 86 skills into ~58, `/gsd-reapply-patches` was folded into a flag (`/gsd-update --reapply`). The 1.39.1 hotfix (#2954) updated `help.md` but missed `bin/install.js`'s `reportLocalPatches` runtime emitter, `get-shit-done/workflows/update.md` Step 4, and the English + zh-CN/ja-JP/ko-KR doc set. Users hit "Unknown command" after every install with backed-up patches. All five runtime branches in `reportLocalPatches` (claude, opencode, kilo, copilot, gemini, codex, cursor) now emit the consolidated form. Regression: `tests/bug-3010-reapply-patches-references.test.cjs` scans `bin/install.js`, every workflow file, and every doc (excluding CHANGELOG history and help.md's deprecation notice) for stale recommendations. See #3010.
