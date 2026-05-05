---
phase: 08
slug: new-milestone-process-detection
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-30
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| milestone goal text -> sme.detect-processes | User-provided milestone goal text passed to SDK query handler | Free-text string (non-sensitive) |
| user-provided process names -> gsd-sme-creator | Process names entered by user during DETECT-04 prompt | Alphanumeric string used as file path component |
| frontmatter.merge -> STATE.md | JSON data written to STATE.md frontmatter | Process name array written to YAML frontmatter |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01 | Tampering | sme-step.md process name from user input | mitigate | Regex validation `[a-zA-Z0-9_-]+` at sme-step.md step 5 before gsd-sme-creator spawn | closed |
| T-08-02 | Tampering | frontmatter.merge path traversal | accept | `resolvePathUnderProject` + null-byte rejection in frontmatter-mutation.ts:243-250; hardcoded path `.planning/STATE.md` in sme-step.md | closed |
| T-08-03 | Tampering | milestone goal injection into detect-processes --goal | accept | `sme.detect-processes` uses case-insensitive substring match only (`.toLowerCase().includes()` at sme.ts:203-209); goal string is never executed | closed |
| T-08-04 | Information Disclosure | SME process names leaked in commit messages | accept | Commit message is "docs: queue active SMEs for milestone" — does not include process names; process names are non-sensitive project metadata | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-02 | Path traversal prevention already enforced by SDK layer (`resolvePathUnderProject` rejects `..` traversals; null-byte guard rejects poison bytes); sme-step.md hardcodes the target path | plan-phase threat model | 2026-04-30 |
| AR-08-02 | T-08-03 | Goal string is workflow-controlled (from new-milestone.md step 2), not arbitrary user file input; `sme.detect-processes` only performs substring matching, never executes the input | plan-phase threat model | 2026-04-30 |
| AR-08-03 | T-08-04 | Process names are non-sensitive project metadata; commit message template does not include them | plan-phase threat model | 2026-04-30 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-30 | 4 | 4 | 0 | gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-30
