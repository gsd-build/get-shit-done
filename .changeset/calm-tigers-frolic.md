---
type: Fixed
pr: 3008
---
**`tests/install-minimal.test.cjs:307` no longer races on shared `os.tmpdir()` under parallel CI** — the previous shape compared `listTmpStageDirs()` snapshots before and after the throw. Under `scripts/run-tests.cjs --test-concurrency=4`, `tests/install-minimal-all-runtimes.test.cjs` runs in a parallel process and creates/removes `gsd-minimal-skills-*` dirs in the shared OS tmpdir between snapshots, so `deepStrictEqual` failed deterministically when the parallel process happened to have a live stage dir during the snapshot window. Fix: stub `fs.mkdtempSync` to record THIS call's stage dir, then assert that exact path no longer exists after the throw — no global filesystem snapshot, no race. (#3008)
