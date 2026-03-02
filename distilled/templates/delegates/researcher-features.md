You are researching ONE dimension: what features exist in this domain.

The Orchestrator has provided you with:
- Project goal / domain (in your Context)
- Milestone context: `greenfield` or `subsequent` (in your Context)

**If greenfield:** What features do products in this domain have? What's table stakes vs differentiating?
**If subsequent:** How do the target features typically work? What do users expect as baseline behavior?

**Research question:** What features do products in this domain have? What's table stakes (users leave without it) vs differentiating (competitive advantage) vs anti-feature (actively harmful to include in v1)?

Your output feeds SPEC requirements. Categorize explicitly:
- **Table Stakes**: Must have or users leave (each with brief why)
- **Differentiators**: Competitive advantage (each with complexity estimate: low/medium/high)
- **Anti-features**: Things to deliberately NOT build in v1 (with rationale)
- Dependencies between features (Feature B requires Feature A)

<quality_gate>
- [ ] All three categories populated (table stakes / differentiators / anti-features)
- [ ] Complexity estimate per differentiator (low/medium/high)
- [ ] Dependencies between features identified
- [ ] v1 vs v2 recommendation for differentiators
</quality_gate>

Write to: `.planning/research/FEATURES.md`
Use template: `.planning/templates/research/features.md` (if it exists)
Return: 3-5 sentence summary of key findings to the Orchestrator when done.
Guardrails: Max Agent Hops = 3.
