---
phase: "03"
slug: sme-creator-agent
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-30
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Process name input -> file path construction | Process name from workflow prompt used to construct grep patterns and SME output paths | String (process name) -> filesystem paths |
| Agent-generated findings -> SME document | LLM-generated findings written to .planning/smes/ and consumed by downstream gate | Code analysis text (file paths, function names, risk descriptions) |
| Sub-agent .tmp files -> orchestrator | Analyzer sub-agents write findings to .tmp files that the orchestrator reads and trusts | Compressed finding blocks |
| Eval config -> filesystem | JavaScript assertions in eval config read files from .planning/smes/ | Code analysis text (no PII) |
| Eval config -> LLM judge | llm-rubric assertions send SME content to LLM for severity analysis | Project-internal code analysis |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Tampering | gsd-sme-creator.md — process name in file path | mitigate | Process name scoped to grep/find against known directories only (sdk/src/, agents/, get-shit-done/). No arbitrary path construction. | closed |
| T-03-02 | Spoofing | gsd-sme-creator-analyzer.md — fabricated file paths in findings | mitigate | Analyzer requires `ls <path>` verification before citing any file path. Promptfoo eval (Test 7) checks for hallucinated paths post-run. | closed |
| T-03-03 | Tampering | gsd-sme-creator.md — git command injection via file paths | accept | File paths passed to `git log --follow` come from grep/glob discovery (repo-controlled filenames), not user input. Risk minimal. | closed |
| T-03-04 | Information Disclosure | gsd-sme-creator-analyzer.md — secrets leakage into findings | mitigate | `<forbidden_files>` block lists .env, .pem, .key, credentials.*, secrets.* patterns. Agent instructed to note existence only, never read or quote contents. | closed |
| T-03-05 | Spoofing | gsd-sme-creator.md — BLOCKER inflation (false positives) | mitigate | Inline severity calibration examples in `<severity_examples>` block. BLOCKER definition requires historical evidence (commit hash, PR, or code comment). Critical rules reinforce strict severity. | closed |
| T-03-06 | Information Disclosure | evals/sme-creator.promptfooconfig.yaml — eval assertions read .planning/smes/ content | accept | SME documents contain code analysis only (file paths, function names, risks). No PII or secrets. Forbidden_files block in analyzer prevents secrets from entering SME documents. | closed |
| T-03-07 | Denial of Service | evals/sme-creator.promptfooconfig.yaml — JavaScript assertions could loop on malformed input | accept | Eval assertions are developer-run CI tools, not production services. Promptfoo has built-in timeout per assertion. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-03 | File paths from readdir (repo-controlled filenames); attacker would need shell metacharacters in committed filenames | gsd-secure-phase | 2026-04-30 |
| AR-03-02 | T-03-06 | SME docs contain code analysis text only; forbidden_files block in analyzer prevents secrets from entering | gsd-secure-phase | 2026-04-30 |
| AR-03-03 | T-03-07 | Developer-run CI tool with Promptfoo built-in timeouts; self-correcting | gsd-secure-phase | 2026-04-30 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-30 | 7 | 7 | 0 | gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-30
