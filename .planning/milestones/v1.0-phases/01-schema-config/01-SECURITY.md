---
phase: 01
slug: schema-config
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-28
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Template file -> stdout | Template content read from disk, output to consumers via `process.stdout.write` | Non-sensitive boilerplate (no secrets) |
| Config user input -> config-set validation | User-supplied config key paths validated against VALID_CONFIG_KEYS and DYNAMIC_KEY_PATTERNS | Config key strings (developer-facing) |
| Dynamic pattern regex -> process name extraction | `sme.processes.{name}.block_mode` regex constrains process names to `[a-zA-Z0-9_-]+` | Process name strings |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | `sme.md` template content | accept | Template is project-internal, authored by GSD developers, not user-supplied. No untrusted input enters this file. | closed |
| T-01-02 | Tampering | `sme.processes.{name}.block_mode` dynamic config key | mitigate | Regex `^sme\.processes\.[a-zA-Z0-9_-]+\.block_mode$` restricts process names — no path traversal characters allowed. Enforced in `config-schema.cjs:88` and `config-schema.ts:117` via `isValidConfigKey`. | closed |
| T-01-03 | Information Disclosure | Config defaults expose SME feature existence | accept | Config keys are developer-facing, not user-facing. Default `false` means no SME behavior active. No sensitive data exposed. | closed |
| T-01-04 | Tampering | Template file path construction in `gsd-tools.cjs` | mitigate | Path constructed via `path.resolve(__dirname, '..', 'templates', 'sme.md')` at `gsd-tools.cjs:569` — hardcoded relative path, no user input in path construction. No path traversal possible. | closed |
| T-01-05 | Information Disclosure | Template content output to stdout | accept | Template is project-internal boilerplate with no secrets. Stdout output is intended behavior per D-07. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-01 | Template is project-internal with no user-supplied content — tampering risk is negligible | GSD workflow | 2026-04-28 |
| AR-01-02 | T-01-03 | Config keys are developer-facing tooling internals — feature existence is not sensitive | GSD workflow | 2026-04-28 |
| AR-01-03 | T-01-05 | Stdout output of boilerplate template is the intended design — no secrets present | GSD workflow | 2026-04-28 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-28 | 5 | 5 | 0 | GSD secure-phase workflow |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-28
