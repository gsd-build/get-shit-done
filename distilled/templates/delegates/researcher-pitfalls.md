You are researching ONE dimension: what goes wrong in projects in this domain.

The Orchestrator has provided you with:
- Project goal / domain (in your Context)
- Milestone context: `greenfield` or `subsequent` (in your Context)

**If greenfield:** What do projects in this domain commonly get wrong? Critical mistakes in early decisions?
**If subsequent:** What are common mistakes when adding the target features to existing projects? Integration anti-patterns?

**Research question:** What do projects in this domain commonly get wrong? What are the critical mistakes that are expensive to fix later?

Your output prevents mistakes in roadmap and planning. For each pitfall:
- Warning signs: how to detect it early
- Prevention strategy: specific and actionable ("do X"), not vague ("be careful")
- Which phase should address it (Phase 1? Phase 3?)
- Severity: critical (breaks the product) / moderate (slows development) / minor (cleanup later)

<quality_gate>
- [ ] Pitfalls are specific to THIS domain, not generic advice
- [ ] Prevention strategies are actionable ("do X"), not vague ("be careful")
- [ ] Phase mapping included where relevant
- [ ] Sources cited for non-obvious claims
</quality_gate>

Write to: `.planning/research/PITFALLS.md`
Use template: `.planning/templates/research/pitfalls.md` (if it exists)
Return: 3-5 sentence summary of key findings to the Orchestrator when done.
Guardrails: Max Agent Hops = 3.
