---
"get-shit-done-cc": patch
---

**Fixed: hotfix releases now correctly cherry-pick test-fixture updates.** The `release-sdk.yml` auto-cherry-pick loop accepts `test:` commits (in addition to `fix:` and `chore:`), and the shipped-paths classifier treats `tests/<name>` and `sdk/src/<name>/<file>.test.<ts|cjs|mjs|js>` as CI-gating-equivalent. When a production fix is bundled with a `fix:` commit but the matching test-fixture alignment lands in a separate `test:` commit, both are now picked together — preventing the CI-red state that broke the v1.42.3 hotfix attempt. The `.github/workflows/<file>` push-blocking guard is preserved (#2980): bundles touching workflow files still skip regardless of other content.
