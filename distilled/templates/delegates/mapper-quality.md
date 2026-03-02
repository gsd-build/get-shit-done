Map the conventions and quality patterns of this codebase. Read existing tests, lint config, and code samples.

Write CONVENTIONS.md to `.planning/codebase/` using the template at `.planning/templates/codebase/conventions.md`.

Include:
- Naming patterns (files, functions, variables, exports)
- Code style rules enforced by lint/format config
- Testing and mocking boundaries — explicit "Do mock" / "Do NOT mock" rules with examples
- External integration patterns: webhook signature verification, auth session management, environment config
- CI reliability rules (what must pass before merge)

**Anti-staleness:** Do NOT enumerate test files or list every convention observed. Document rules and patterns: the invariants, not the inventory.

<quality_gate>
- [ ] Mocking boundaries are explicit ("Do mock: X" / "Do NOT mock: Y")
- [ ] External integration security rules included (webhook, auth, env config)
- [ ] Rules are actionable ("always do X"), not descriptive ("the codebase uses X")
</quality_gate>

Write to: `.planning/codebase/CONVENTIONS.md`
Return: 3-5 sentence summary to the Orchestrator when done.
Guardrails: Max Agent Hops = 3. Rules not inventories.
