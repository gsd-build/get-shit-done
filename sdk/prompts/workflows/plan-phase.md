<purpose>
Create executable phase plans (PLAN.md files) for a roadmap phase with integrated research and verification.
Headless SDK variant — runs autonomously. Research, planning, and plan-checking proceed without user prompts.
Default flow: Research (if needed) -> Plan -> Verify -> Done.
</purpose>

<process>

<step name="initialize">
Load all context from injected context files. Extract: phase directory, phase number, phase name, research status, context status, plan count, requirement IDs.

If planning directory is missing: report error via event stream.
</step>

<step name="validate_phase">
Validate phase exists in roadmap. If not found: report error with available phases.
</step>

<step name="load_context">
Load CONTEXT.md if it exists. This contains user decisions that constrain planning.

If no CONTEXT.md exists: proceed without — plan using research and requirements only. In headless mode, there is no interactive discuss-phase; context comes from prior artifacts or is skipped.
</step>

<step name="handle_research">
If RESEARCH.md exists: use existing research.

If RESEARCH.md is missing and research is enabled:
1. Execute research phase (spawn researcher agent)
2. Researcher writes RESEARCH.md
3. Continue to planning

If research is disabled: skip to planning step.
</step>

<step name="spawn_planner">
Execute planning with the planner agent definition. Provide:
- Phase number, name, and goal
- Context files: state, roadmap, requirements, context, research
- Phase requirement IDs (every ID must appear in a plan's requirements field)

The planner creates PLAN.md files with task breakdown, dependency analysis, and verification criteria.
</step>

<step name="handle_planner_return">
- **PLANNING COMPLETE** — Plans created. If plan checker is enabled: proceed to verification.
- **PLANNING BLOCKED** — Log blocker, report via event stream.
- **PLANNING INCONCLUSIVE** — Report with available context.
</step>

<step name="spawn_plan_checker">
If plan checker is enabled, execute verification with the plan-checker agent. Provide:
- Phase number and goal
- Plan files to verify
- Roadmap, requirements, context, research files
- Phase requirement IDs

The checker verifies plans will achieve the phase goal before execution.
</step>

<step name="handle_checker_return">
- **VERIFICATION PASSED** — Plans ready for execution.
- **ISSUES FOUND** — Enter revision loop (max 3 iterations):
  1. Send issues back to planner for targeted revision
  2. Re-run plan checker
  3. If max iterations reached: proceed with current plans, log remaining issues
</step>

<step name="requirements_coverage_gate">
After plans pass the checker (or checker is skipped), verify all phase requirements are covered:
1. Extract requirement IDs claimed by plans
2. Compare against phase requirements from roadmap
3. If gaps found: log as warning, continue (headless mode does not block for coverage gaps)
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Research completed (unless skipped or existing)
- PLAN.md file(s) created with valid structure
- Plan checker passed (or issues logged)
- Requirements coverage verified
</success_criteria>
