---
phase: 1
slug: schema-config
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-28
last_audit: 2026-04-28
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | sdk/vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01-01 | 1 | SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04 | T-01-01 | Template is project-internal, no untrusted input | structural | `grep -c "^## " get-shit-done/templates/sme.md \| grep -q "^6$" && grep -q "process_name:" get-shit-done/templates/sme.md && grep -q "finding_counts:" get-shit-done/templates/sme.md && echo PASS` | No (creates file) | COVERED |
| 01-02-T1 | 01-02 | 1 | CONFIG-01, CONFIG-03 | T-01-02 | Regex restricts process names to `[a-zA-Z0-9_-]+` | parity | `node --test tests/config-schema-docs-parity.test.cjs && node --test tests/config-schema-sdk-parity.test.cjs` | Yes | COVERED |
| 01-02-T2 | 01-02 | 1 | CONFIG-01, CONFIG-02, CONFIG-03 | T-01-03 | Default false prevents accidental activation | unit | `grep -q "use_sme_agents: false" get-shit-done/bin/lib/config.cjs && grep -q "use_sme_agents: boolean" sdk/src/config.ts && npx vitest run --project unit sdk/src/query/config-mutation.test.ts` | Yes | COVERED |
| 01-03-T1 | 01-03 | 2 | SCHEMA-05 | T-01-04 | Hardcoded path, no user input in path construction | smoke | `node get-shit-done/bin/gsd-tools.cjs template sme 2>/dev/null \| head -1 \| grep -q "^---$" && echo PASS` | No (modifies file) | COVERED |
| 01-03-T2 | 01-03 | 2 | SCHEMA-01, SCHEMA-05 | T-01-05 | Template is boilerplate, no secrets | e2e | `node get-shit-done/bin/gsd-tools.cjs template sme > /tmp/gsd-sme-test.md && node get-shit-done/bin/gsd-tools.cjs frontmatter get /tmp/gsd-sme-test.md 2>/dev/null \| grep -q "process_name" && rm -f /tmp/gsd-sme-test.md && echo PASS` | Yes | COVERED |

*Status: ALL COVERED -- all tasks pass automated verification*

---

## Wave 0 Requirements

- [x] No new test files required -- existing parity tests and vitest suite cover CONFIG-* requirements
- [x] SCHEMA-* requirements verified by structural grep checks and CLI smoke tests embedded in task verify commands

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `gsd-tools template sme` outputs valid blank | SCHEMA-05 | CLI output visual inspection (automated smoke test also covers this) | Run command, inspect output for all 6 sections |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-04-28

---

## Validation Audit 2026-04-28

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 5 task verification commands executed and passed. No gaps detected — phase is fully Nyquist-compliant.
