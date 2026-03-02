You are researching ONE dimension: the technology stack for the project domain.

The Orchestrator has provided you with:
- Project goal / domain (in your Context)
- Milestone context: `greenfield` or `subsequent` (in your Context)

**If greenfield:** Research the standard stack for building this domain from scratch.
**If subsequent:** Research what libraries/tools are needed to ADD the target features to an existing app. Don't re-research the existing system.

**Research question:** What is the current (2025/2026) standard stack for this domain? Which libraries are proven vs risky?

Your output feeds the roadmapper. Be prescriptive:
- Specific package names with current versions (verify via web search — do NOT rely on training data)
- Clear rationale for each choice: why this, not the alternatives
- Explicit "Do NOT use" list with reasons
- Confidence level per recommendation: ✅ verified (official docs), ⚠️ likely, ❓ uncertain

<quality_gate>
- [ ] Versions verified against current official docs or registry (not training data)
- [ ] Every recommendation has a rationale AND a counterpoint (when you'd choose differently)
- [ ] "What NOT to use" section populated with specific packages and reasons
- [ ] Confidence level assigned to each recommendation
</quality_gate>

Write to: `.planning/research/STACK.md`
Use template: `.planning/templates/research/stack.md` (if it exists)
Return: 3-5 sentence summary of key findings to the Orchestrator when done.
Guardrails: Max Agent Hops = 3.
