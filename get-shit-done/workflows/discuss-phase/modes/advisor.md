# Advisor mode — research-backed comparison tables

> **Lazy-loaded and gated.** The parent `workflows/discuss-phase.md` Reads
> this file ONLY when `ADVISOR_MODE` is true (i.e., when
> `$HOME/.claude/get-shit-done/USER-PROFILE.md` exists). Skip the Read
> entirely when no profile is present — that's the inverse of the
> `--advisor` flag from #2174 (don't pay the cost when unused).

## Activation

```bash
PROFILE_PATH="$HOME/.claude/get-shit-done/USER-PROFILE.md"
if [ -f "$PROFILE_PATH" ]; then
  ADVISOR_MODE=true
else
  ADVISOR_MODE=false
fi
```

If `ADVISOR_MODE` is false, do **not** Read this file — proceed with the
standard `default.md` discussion flow.

## Calibration tier

Resolve `vendor_philosophy` calibration tier:
1. **Priority 1:** Read `config.json` > `preferences.vendor_philosophy`
   (project-level override)
2. **Priority 2:** Read USER-PROFILE.md `Vendor Choices/Philosophy` rating
   (global)
3. **Priority 3:** Default to `"standard"` if neither has a value or value
   is `UNSCORED`

Map to calibration tier:
- `conservative` OR `thorough-evaluator` → `full_maturity`
- `opinionated` → `minimal_decisive`
- `pragmatic-fast` OR any other value OR empty → `standard`

Resolve advisor model:
```bash
ADVISOR_MODEL=$(gsd-sdk query resolve-model gsd-advisor-researcher --raw)
```

## Non-technical owner detection

Read USER-PROFILE.md and check for product-owner signals:

```bash
PROFILE_CONTENT=$(cat "$HOME/.claude/get-shit-done/USER-PROFILE.md" 2>/dev/null || true)
```

Set `NON_TECHNICAL_OWNER = true` if ANY of the following are present:
- `learning_style: guided`
- The word `jargon` appears in a `frustration_triggers` section
- `explanation_depth: practical-detailed` (without a technical modifier)
- `explanation_depth: high-level`

**Tie-breaker / precedence (when signals conflict):**
1. An explicit `technical_background: true` (or any `explanation_depth` value
   tagged with a technical modifier such as `practical-detailed:technical`)
   **overrides** all inferred non-technical signals — set
   `NON_TECHNICAL_OWNER = false`.
2. Otherwise, ANY single matching signal is sufficient to set
   `NON_TECHNICAL_OWNER = true` (signals are OR-aggregated, not weighted).
3. Contradictory `explanation_depth` values: the most recent entry wins.

Log the resolved value and the matched/overriding signal so the user can
audit why a given framing was used.

When `NON_TECHNICAL_OWNER` is true, reframe gray area labels and
descriptions in product-outcome language before presenting them. Preserve
the same underlying decision — only change the framing:

- Technical implementation term → outcome the user will experience
  - "Token architecture" → "Color system: which approach prevents the dark theme from flashing white on open"
  - "CSS variable strategy" → "Theme colors: how your brand colors stay consistent in both light and dark mode"
  - "Component API surface area" → "How the building blocks connect: how tightly coupled should these parts be"
  - "Caching strategy: SWR vs React Query" → "Loading speed: should screens show saved data right away or wait for fresh data"

This reframing applies to:
1. Gray area labels and descriptions in `present_gray_areas`
2. Advisor research rationale rewrites in the synthesis step below

## advisor_research step

After the user selects gray areas in `present_gray_areas`, spawn parallel
research agents.

1. Display brief status: `Researching {N} areas...`

2. For EACH user-selected gray area, spawn a `Task()` in parallel:

   ```
   Task(
     prompt="First, read @~/.claude/agents/gsd-advisor-researcher.md for your role and instructions.

     <gray_area>{area_name}: {area_description from gray area identification}</gray_area>
     <phase_context>{phase_goal and description from ROADMAP.md}</phase_context>
     <project_context>{project name and brief description from PROJECT.md}</project_context>
     <calibration_tier>{resolved calibration tier: full_maturity | standard | minimal_decisive}</calibration_tier>

     Research this gray area and return a structured comparison table with rationale.
     ${AGENT_SKILLS_ADVISOR}",
     subagent_type="general-purpose",
     model="{ADVISOR_MODEL}",
     description="Research: {area_name}"
   )
   ```

   All `Task()` calls spawn simultaneously — do NOT wait for one before
   starting the next.

   > **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling all Task() calls above to spawn research agents, do NOT independently research or analyze any of the gray areas while the subagents are active. Wait for all subagents to return before synthesizing results. This prevents duplicate work and wasted context.

3. After ALL agents return, **synthesize results** before presenting:

   For each agent's return:
   a. Parse the markdown comparison table and rationale paragraph
   b. Verify all 5 columns present (Option | Pros | Cons | Complexity | Recommendation) — fill any missing columns rather than showing broken table
   c. Verify option count matches calibration tier:
      - `full_maturity`: 3-5 options acceptable
      - `standard`: 2-4 options acceptable
      - `minimal_decisive`: 1-2 options acceptable
      If agent returned too many, trim least viable. If too few, accept as-is.
   d. Rewrite rationale paragraph to weave in project context and ongoing discussion context that the agent did not have access to
   e. If agent returned only 1 option, convert from table format to direct recommendation: "Standard approach for {area}: {option}. {rationale}"
   f. **If `NON_TECHNICAL_OWNER` is true:** apply a plain language rewrite to the rationale paragraph. Replace implementation-level terms with outcome descriptions the user can reason about without technical context. The Recommendation column value and the table structure remain intact. Do not remove detail; translate it. Example: "SWR uses stale-while-revalidate to serve cached responses immediately" → "This approach shows you something right away, then quietly updates in the background — users see data instantly."

4. Store synthesized tables for use in `discuss_areas` (table-first flow).

## discuss_areas (advisor table-first flow)

For each selected area:

1. **Present the synthesized comparison table + rationale paragraph** (from
   `advisor_research`)

2. **Use AskUserQuestion** (or text-mode equivalent if `--text` overlay):
   - header: `{area_name}`
   - question: `Which approach for {area_name}?`
   - options: extract from the table's Option column (AskUserQuestion adds
     "Other" automatically)

3. **Record the user's selection:**
   - If user picks from table options → record as locked decision for that
     area
   - If user picks "Other" → receive their input, reflect it back for
     confirmation, record

4. **Thinking partner (conditional):** same rule as default mode — if
   `features.thinking_partner` is enabled and tradeoff signals are
   detected, offer a 3-5 bullet analysis before locking in.

5. **After recording pick, decide whether follow-up questions are needed:**
   - If the pick has ambiguity that would affect downstream planning →
     ask 1-2 targeted follow-up questions using AskUserQuestion
   - If the pick is clear and self-contained → move to next area
   - Do NOT ask the standard 4 questions — the table already provided the
     context

6. **After all areas processed:**
   - header: "Done"
   - question: "That covers [list areas]. Ready to create context?"
   - options: "Create context" / "Revisit an area"

## Scope creep handling (advisor mode)

If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

Track deferred ideas internally.
