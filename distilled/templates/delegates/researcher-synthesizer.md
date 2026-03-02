Synthesize the 4 research files into a single actionable SUMMARY.md.

Read these files (all should exist):
- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`

Cross-reference them. Surface conflicts and dependencies between findings. Do NOT do new research — synthesize what exists.

SUMMARY.md MUST include:
1. **Key Findings** — top 5-7 bullets across all 4 dimensions
2. **Implications for Roadmap** — suggested phase groupings derived from architecture build order + pitfall avoidance (this is the critical handoff to the roadmapper)
3. **Research Flags** — which phases need deeper research vs standard patterns
4. **Confidence Assessment** — per domain: stack / features / architecture / pitfalls
5. **Sources** — all sources cited across the 4 research files, deduplicated

Use template: `.planning/templates/research/summary.md` (if it exists)

<quality_gate>
- [ ] "Implications for Roadmap" section populated with phase suggestions
- [ ] Conflicts between research files surfaced (not hidden)
- [ ] Confidence levels consistent with what researchers assigned
- [ ] No new claims introduced (only synthesis)
</quality_gate>

Write to: `.planning/research/SUMMARY.md`
Return: 5-7 bullet key findings to the Orchestrator when done.
Guardrails: Max Agent Hops = 2. Do not do new research — synthesize only.
