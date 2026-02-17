# Phase 11: Async Error Classification Fix - Discussion Guide

**Researched:** 2026-02-17
**Domain:** Code bug fix (error classification accuracy)

## Summary

Exit codes 127 (command not found) and 126 (permission denied) are misclassified as `EXIT_ERROR` instead of `NOT_FOUND` and `PERMISSION` in the async invocation path (`invokeAsync`) across all three CLI adapters (codex.cjs, gemini.cjs, opencode.cjs). The sync path (`invoke` via `execSync`) classifies these correctly. The bug affects error metadata accuracy but not functional behavior.

## Key Decision Areas

### Error Property for Exit Code Extraction
- **Root cause:** `err.code` used instead of `err.status` in async callback
- **Key question:** Use `err.status` (matching sync) or defensive `err.code || err.status`?

### Testing Coverage
- **Key question:** Code fix only, or include tests to prevent regression?
- **Options:** code-only, unit tests, integration tests, full matrix

### Sync/Async Consistency Verification
- **Key question:** How to validate both paths produce identical classifications?
- **Options:** manual verification, automated matrix test, consolidate function

---

*Phase: 11-async-error-classification-fix*
*Guide generated: 2026-02-17*
