<purpose>
Verify phase goal achievement through goal-backward analysis. Check that the codebase delivers what the phase promised, not just that tasks completed.
Headless SDK variant — runs autonomously without interactive prompts.
</purpose>

<core_principle>
**Task completion does not equal goal achievement.**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — but the goal "working chat interface" was not achieved.

Goal-backward verification:
1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?

Then verify each level against the actual codebase.
</core_principle>

<process>

<step name="load_context" priority="first">
Load phase operation context from injected context files. Extract: phase directory, phase number, phase name, plan count.

Load phase details, plans, and summaries. Extract the **phase goal** from the roadmap (the outcome to verify, not tasks) and **requirements** if they exist.
</step>

<step name="establish_must_haves">
**Option A: Must-haves in PLAN frontmatter**

Extract must_haves from each PLAN: `{ truths: [...], artifacts: [...], key_links: [...] }`

Aggregate all must_haves across plans for phase-level verification.

**Option B: Use Success Criteria from roadmap**

If no must_haves in frontmatter, use Success Criteria directly as truths. Derive artifacts and key links from there.

**Option C: Derive from phase goal (fallback)**

If neither source available: state the goal, derive 3-7 observable truths, derive artifacts, derive key links.
</step>

<step name="verify_truths">
For each observable truth, determine if the codebase enables it.

**Status:** VERIFIED (all supporting artifacts pass) | FAILED (artifact missing/stub/unwired) | UNCERTAIN (needs investigation)

For each truth: identify supporting artifacts, check artifact status, check wiring, determine truth status.
</step>

<step name="verify_artifacts">
Three-level verification:

**Level 1 — Exists:** File exists on disk.
**Level 2 — Substantive:** File has real content (not stub/placeholder). Check line count, expected patterns.
**Level 3 — Wired:** File is imported AND used by other code.

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| Yes    | Yes         | Yes   | VERIFIED |
| Yes    | Yes         | No    | ORPHANED |
| Yes    | No          | -     | STUB |
| No     | -           | -     | MISSING |
</step>

<step name="verify_wiring">
Key links are critical connections. If broken, the goal fails even with all artifacts present.

Verify each key link by checking imports, usage patterns, fetch calls, database queries, form handlers, and state rendering.
</step>

<step name="verify_requirements">
For each requirement mapped to this phase: identify supporting truths/artifacts, determine status (SATISFIED / BLOCKED / UNCERTAIN).
</step>

<step name="scan_antipatterns">
Scan files modified in this phase for:

| Pattern | Severity |
|---------|----------|
| TODO/FIXME/XXX/HACK | Warning |
| Placeholder content | Blocker |
| Empty returns | Warning |
| Log-only functions | Warning |

Categorize: Blocker (prevents goal) | Warning (incomplete) | Info (notable).
</step>

<step name="determine_status">
**passed:** All truths VERIFIED, all artifacts pass levels 1-3, all key links WIRED, no blocker anti-patterns.

**gaps_found:** Any truth FAILED, artifact MISSING/STUB, key link NOT_WIRED, or blocker found.

**Score:** verified_truths / total_truths
</step>

<step name="generate_fix_plans">
If gaps_found:
1. Cluster related gaps by concern
2. Generate plan per cluster: objective, 2-3 tasks, re-verify step
3. Order by dependency: fix missing, fix stubs, fix wiring, verify
</step>

<step name="create_report">
Create VERIFICATION.md with: frontmatter (phase/timestamp/status/score), goal achievement, artifact table, wiring table, requirements coverage, anti-patterns, gaps summary, fix plans (if gaps_found).
</step>

<step name="return_to_orchestrator">
Return status (passed | gaps_found), score (N/M must-haves), report path.

If gaps_found: list gaps and recommended fix plan names.
</step>

</process>

<success_criteria>
- Must-haves established (from frontmatter or derived)
- All truths verified with status and evidence
- All artifacts checked at all three levels
- All key links verified
- Requirements coverage assessed
- Anti-patterns scanned and categorized
- Overall status determined
- Fix plans generated (if gaps_found)
- VERIFICATION.md created with complete report
- Results returned to orchestrator
</success_criteria>
