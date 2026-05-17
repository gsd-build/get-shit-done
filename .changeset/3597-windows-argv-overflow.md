---
type: Fixed
pr: 3649
---
**`scripts/run-tests.cjs` no longer fails on Windows when invoking many test files at once** — Windows `CreateProcess` caps `lpCommandLine` at 32,767 chars, so an unchunked spawn of `node --test <546 paths>` aborted instantly with exit 1 and no test output (Linux/macOS allow ~2 MB so the same path worked there). The harness now batches selected files into chunks whose total argv stays under 28,000 chars and runs each chunk sequentially, reporting `run-tests: chunk N/M — K files` to stderr. The ceiling is overridable via `RUN_TESTS_MAX_CMDLINE_CHARS` for tuning and tests. Adds a cross-platform regression test that forces chunking with a low ceiling.
