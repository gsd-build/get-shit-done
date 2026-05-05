---
phase: "05"
slug: sme-auditor-agent
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-30
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| SME content -> Agent prompt | SME document content injected into agent prompt via `<sme_context>` XML block | Domain findings (file paths, severity labels, mitigations) |
| PLAN.md -> Agent analysis | Agent reads PLAN.md files from the filesystem | Task definitions, action blocks, file references |
| Agent output -> Gate | Agent return markers consumed by Phase 6 gate workflow regex | `## SME_APPROVED` or `## SME_CONCERNS` marker string |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-05-01 | Tampering | agents/gsd-sme-auditor.md | accept | SME documents are author-created project files at same trust level as PLAN.md (established in T-02-02, Phase 2). No untrusted external content enters the agent prompt. | closed |
| T-05-02 | Elevation of Privilege | agents/gsd-sme-auditor.md | mitigate | Read-only enforced: `tools: Read, Bash, Glob, Grep` in YAML frontmatter (line 4). SDK cannot grant tools not listed. Structural test AUDIT-02 (`sme-auditor-structure.test.ts` lines 66-77) validates no Write/Edit in tools field. | closed |
| T-05-03 | Tampering | agents/gsd-sme-auditor.md | mitigate | `<critical_rules>` block (line 158) states "INHERIT SEVERITY FROM SME. Do not re-assess severity." Prevents LLM severity inflation that could cause false-positive trust erosion. | closed |
| T-05-04 | Spoofing | get-shit-done/references/agent-contracts.md | accept | Marker strings (`## SME_APPROVED`, `## SME_CONCERNS`) are project-internal conventions. Spoofing requires modifying agent-contracts.md, which is a developer-authored project file. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-01 | SME documents are author-created project files at the same trust level as PLAN.md. No untrusted external content enters the agent prompt. Established precedent in T-02-02. | gsd-secure-phase | 2026-04-30 |
| AR-05-02 | T-05-04 | Marker strings are project-internal conventions consumed by workflow regex. Spoofing requires write access to agent-contracts.md, which is developer-authored. | gsd-secure-phase | 2026-04-30 |

*Accepted risks do not resurface in future audit runs.*

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
