<purpose>
Research how to implement a phase. Produces RESEARCH.md consumed by the planner.
Headless SDK variant — runs autonomously without interactive prompts.
</purpose>

<process>

<step name="resolve_model">
Use the model configuration provided by the SDK session. No interactive model selection.
</step>

<step name="validate_phase">
Validate the phase exists in the roadmap using context files. If not found: report error via event stream.
</step>

<step name="check_existing_research">
Check if RESEARCH.md already exists for this phase. If exists and no force-refresh requested: use existing, skip research.
</step>

<step name="gather_phase_context">
Load phase context from injected context files:
- Context file (CONTEXT.md) — user decisions
- Requirements file (REQUIREMENTS.md) — project requirements
- State file (STATE.md) — project decisions and history
</step>

<step name="spawn_researcher">
Execute research with the phase researcher agent definition. Provide:
- Phase number and name
- Phase description and goal
- Context files to read
- Output path for RESEARCH.md

The researcher investigates the phase's technical domain, identifies standard stack, patterns, pitfalls, and writes RESEARCH.md.
</step>

<step name="handle_return">
Process researcher results:
- **RESEARCH COMPLETE** — Research file written, proceed to next phase step
- **RESEARCH BLOCKED** — Log blocker, report to event stream
- **RESEARCH INCONCLUSIVE** — Log findings, continue with available context
</step>

</process>
