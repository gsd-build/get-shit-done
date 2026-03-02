Map the technical debt, security concerns, and risks in this codebase.

**Security check first (hard stop):** Before writing anything, grep for these patterns:
`API_KEY`, `SECRET`, `PASSWORD`, `PRIVATE_KEY`, `-----BEGIN`, `Authorization:`

If any hardcoded secrets are found: STOP immediately and report to the Orchestrator. Do NOT write CONCERNS.md. This is a hard stop.

If no secrets found, write CONCERNS.md to `.planning/codebase/` using the template at `.planning/templates/codebase/concerns.md`.

Include:
- Known bugs or fragile areas (with file references where possible)
- Security vulnerabilities or missing validations
- Performance bottlenecks
- Missing test coverage for critical paths
- Deprecated or end-of-life dependencies

<quality_gate>
- [ ] Secret scan completed and result reported
- [ ] Concerns are specific (file references, not vague "some places")
- [ ] Severity assigned per concern: critical / moderate / minor
- [ ] Deprecated dependencies listed with EOL dates if known
</quality_gate>

Write to: `.planning/codebase/CONCERNS.md`
Return: 3-5 sentence summary to the Orchestrator when done. If secrets found, STOP and report immediately.
Guardrails: Max Agent Hops = 3. Hard stop on secrets.
