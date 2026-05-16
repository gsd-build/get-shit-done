---
"get-shit-done-cc": patch
---

**Added: filesystem fault-injection coverage for `platformWriteSync`.** New tests in `tests/feat-3595-fs-fault-injection-atomic-write.test.cjs` use `node:test`'s `mock.method()` to inject `ENOSPC`, `EACCES`, `EXDEV`, `EBUSY`, and `EISDIR` against the shared atomic-write seam in `get-shit-done/bin/lib/shell-command-projection.cjs`. Covers rename-failure fallback, double-failure error propagation, mkdir failure, target-is-directory collision, paths with spaces/Unicode/newlines, symlink-replacement safety (writer does NOT follow symlinks), broken-symlink handling, and concurrent-write collision. Documents two pre-existing behavior gaps (fallback error swallows original cause; mkdir failure escapes unhandled) as pinned current behavior, ready for the future fix to flip the assertion.
