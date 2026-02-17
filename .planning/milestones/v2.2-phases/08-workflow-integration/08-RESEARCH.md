# Phase 8: Workflow Integration - Research

**Researched:** 2026-02-17
**Domain:** Draft-review-synthesize pattern at workflow checkpoints with co-planner feedback, attribution, and synthesis
**Confidence:** HIGH

## Summary

Phase 8 connects the Phase 6 invocation layer and Phase 7 configuration system to the four existing workflow checkpoint locations (requirements, roadmap, plan, verification). The work is primarily markdown instruction editing -- modifying three workflow command files (`new-project.md`, `plan-phase.md`, `execute-phase.md`) to add co-planner review sections that run BEFORE the existing adversary review at each checkpoint.

The existing adversary pattern provides an exact structural precedent. Each adversary checkpoint section follows a consistent pattern: (1) read config, (2) display banner, (3) loop with spawn/parse/decide, (4) display summary, (5) conditional commit. Co-planner sections mirror this structure but with key differences: co-planners are single-pass (no debate loop), produce refinement suggestions (not adversarial challenges), and their feedback is advisory with an explicit accept/reject log.

The draft-review-synthesize loop is: Claude drafts artifact -> `gsd-tools.cjs coplanner agents <checkpoint>` resolves which agents to call -> for each agent, `gsd-tools.cjs coplanner invoke <cli> --prompt <review_prompt>` sends the artifact with a checkpoint-tailored review prompt -> Claude parses response into challenges/suggestions/endorsements -> Claude displays per-agent attributed feedback blocks -> Claude applies accepted suggestions directly to the artifact -> Claude shows accept/reject log -> adversary runs after on the (potentially revised) artifact. Zero new functions or tools needed -- all building blocks exist.

**Primary recommendation:** Add co-planner review sections at the four checkpoint locations in the three workflow command files. Each section uses the existing `coplanner agents` and `coplanner invoke` subcommands. Feedback display uses bordered per-agent blocks with the `─── {Agent} Feedback ───` header style. Claude modifies artifacts directly based on accepted feedback, then the adversary reviews the revised artifact.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All four checkpoint types get external agent review: requirements, roadmap, plan, verification
- Tailored review prompt per checkpoint type:
  - Requirements: feasibility & gaps
  - Roadmap: ordering & risk distribution
  - Plan: completeness & wiring
  - Verification: coverage & blind spots
- Co-planners run first (refine), adversary runs second (challenge) -- consistent with Phase 7 design
- Per-agent blocks -- each agent's feedback shown in its own attributed section
- Bordered sections with agent name header (e.g., `─── Codex Feedback ───`), consistent with existing GSD visual style
- Explicit accept/reject log -- Claude shows which suggestions were accepted and which were rejected with brief reasoning
- All feedback is advisory -- Claude always makes the final decision
- Modify artifact directly based on accepted feedback -- no separate synthesis document
- Claude uses judgment to resolve conflicts between agents, explains reasoning in the accept/reject log
- Continue with warning on agent failure -- log the failure, show warning, proceed with Claude's own review
- No circuit breaker -- each checkpoint invocation is independent, Phase 6 handles per-invocation errors
- Single global timeout from `co_planners.timeout_ms` (120s default) for all checkpoints

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `gsd-tools.cjs` | Existing | `coplanner agents <checkpoint>` for agent resolution, `coplanner invoke <cli>` for invocation | All Phase 6/7 primitives already exist. Phase 8 consumes them from workflow markdown instructions. |
| `commands/gsd/new-project.md` | Existing | Checkpoint locations for requirements and roadmap | Contains adversary review at Phase 7.5 (requirements) and Phase 8.5 (roadmap). Co-planner review inserts before each. |
| `commands/gsd/plan-phase.md` | Existing | Checkpoint location for plan | Contains adversary review at step 12.5 (plan). Co-planner review inserts before it. |
| `commands/gsd/execute-phase.md` | Existing (workflow) | Checkpoint location for verification | Contains adversary review at step 7.5 (verification). Co-planner review inserts before it. |
| `agents/gsd-adversary.md` | Existing | Adversarial review runs AFTER co-planner refinement | No changes needed. Adversary receives the already-refined artifact. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `get-shit-done/bin/adapters/*.cjs` | Existing | CLI-specific invocation (codex, gemini, opencode) | Called indirectly via `coplanner invoke`. Phase 8 never calls adapters directly. |
| `.planning/config.json` | Existing | `co_planners` section with agents and checkpoints | Read via `coplanner agents` command. Phase 8 never reads config directly. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline co-planner logic in each command file | Shared workflow fragment file | The adversary review is already inlined at each checkpoint (3 files, 4 checkpoints). Co-planner follows the same pattern. A shared fragment would require a new inclusion mechanism that does not exist. Inline is consistent with the existing codebase pattern. |
| Parse co-planner responses into structured JSON | Treat responses as free text | External CLIs return natural language, not structured JSON. Parsing into challenges/suggestions/endorsements is Claude's job (the orchestrator reads the response and categorizes). No programmatic parsing needed. |
| New gsd-tools.cjs command for "review artifact" | Direct `coplanner invoke` with tailored prompt | A higher-level "review" command would duplicate prompt construction logic. The prompt is checkpoint-specific and belongs in the workflow instructions, not in gsd-tools.cjs. Keep gsd-tools.cjs as low-level primitives. |

**Installation:**
```bash
# No installation needed -- zero new dependencies
# All changes are edits to existing markdown command files
```

## Architecture Patterns

### Recommended Project Structure
```
commands/gsd/
  new-project.md       # MODIFY: add co-planner review before adversary at requirements + roadmap
  plan-phase.md        # MODIFY: add co-planner review before adversary at plan
  execute-phase.md     # MODIFY (workflow): add co-planner review before adversary at verification
```

### Pattern 1: Co-Planner Review Section Structure
**What:** Each co-planner review section follows a consistent structure at every checkpoint: resolve agents, skip if none, display banner, iterate agents, display feedback, synthesize, commit if revised.
**When to use:** At all four checkpoint locations.
**Example:**
```markdown
## Co-Planner Review — {Checkpoint Type}

**Resolve co-planner agents:**

```bash
CO_AGENTS_JSON=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner agents "{checkpoint_name}")
```

Parse JSON: `agents` array and `warnings` array.

**If agents is empty:** Skip to adversary review (no co-planners configured for this checkpoint).

**If agents is non-empty:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CO-PLANNER REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Reviewing {artifact_type} with {agent_count} co-planner(s)...
```

**For each agent in agents array:**

1. Read artifact from disk
2. Construct checkpoint-tailored review prompt
3. Invoke: `node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner invoke {agent} --prompt "{review_prompt}"`
4. Parse result JSON: check for error/errorType
5. If error: display warning, continue to next agent
6. If success: parse response text into feedback categories

**Display per-agent feedback:**
```
─── {Agent Name} Feedback ───

**Suggestions:**
- {suggestion 1}
- {suggestion 2}

**Challenges:**
- {challenge 1}

**Endorsements:**
- {endorsement 1}

──────────────────────────────
```

**Synthesize feedback:**
- Review all agent suggestions
- Apply accepted suggestions to artifact via Edit tool
- Build accept/reject log

**Display accept/reject log:**
```
### Co-Planner Synthesis

| # | Source | Feedback | Decision | Reasoning |
|---|--------|----------|----------|-----------|
| 1 | codex | {suggestion} | Accepted | {why} |
| 2 | codex | {challenge} | Noted | {why} |
| 3 | gemini | {suggestion} | Rejected | {why} |
```

**Conditional commit:**
If artifact was modified:
```bash
git add {artifact_path}
git commit -m "docs({scope}): incorporate co-planner feedback ({checkpoint_type})"
```
```

### Pattern 2: Checkpoint-Tailored Review Prompts
**What:** Each checkpoint type has a focused review prompt that directs the external agent's attention to what matters most at that stage.
**When to use:** When constructing the `--prompt` argument for `coplanner invoke`.
**Example:**
```markdown
### Requirements Review Prompt
"Review these requirements for a software project. Focus on:
1. FEASIBILITY: Can these requirements be built with reasonable effort? Are there technical blockers?
2. GAPS: What obvious requirements are missing? What would a user expect that isn't listed?
3. CONFLICTS: Do any requirements contradict each other?
4. SCOPE: Are any requirements actually implementation details disguised as requirements?

Organize your response into three sections:
- **Suggestions:** Specific improvements or additions
- **Challenges:** Concerns or potential problems
- **Endorsements:** What looks good and well-thought-out

Requirements to review:
{ARTIFACT_CONTENT}"

### Roadmap Review Prompt
"Review this project roadmap. Focus on:
1. ORDERING: Does the phase sequence make sense? Are dependencies respected?
2. RISK DISTRIBUTION: Are risky items front-loaded? What happens if an early phase fails?
3. SCOPE: Is any phase too large or too small?
4. COVERAGE: Do all requirements map to phases?

[Same three-section response format]

Roadmap to review:
{ARTIFACT_CONTENT}"

### Plan Review Prompt
"Review this implementation plan. Focus on:
1. COMPLETENESS: Are tasks atomic enough? Can each be verified independently?
2. WIRING: Are integration points explicitly planned? Does component A connect to component B?
3. EDGE CASES: What could go wrong? Are error states handled?
4. COMPLEXITY: Are there tasks hiding significant complexity?

[Same three-section response format]

Plan to review:
{ARTIFACT_CONTENT}"

### Verification Review Prompt
"Review this verification report for a completed implementation phase. Focus on:
1. COVERAGE: Were all must-haves actually verified with evidence?
2. BLIND SPOTS: What wasn't checked that should have been?
3. FALSE POSITIVES: Could passing checks hide real issues?
4. CONCLUSION VALIDITY: Are the conclusions justified by the evidence?

[Same three-section response format]

Verification report to review:
{ARTIFACT_CONTENT}"
```

### Pattern 3: Agent Ordering -- Co-Planners Then Adversary
**What:** At each checkpoint, co-planner review runs FIRST (refinement), then adversary review runs SECOND (challenge) on the potentially-revised artifact.
**When to use:** At every checkpoint location.
**Why this ordering matters:** Co-planners refine the artifact (add missing items, improve wording, fix gaps). The adversary then challenges the improved artifact, which means the adversary is reviewing the best version of the artifact, not the initial draft. This ordering is consistent with the Phase 7 design decision.
**Example flow:**
```
1. Claude drafts REQUIREMENTS.md
2. Co-planner review: codex suggests adding accessibility requirement → Claude accepts → edits artifact
3. Adversary review: challenges revised artifact (which now includes accessibility) → debate loop
4. Final artifact committed
```

### Pattern 4: Feedback Parsing (Claude's Job, Not Programmatic)
**What:** The orchestrator (Claude) reads the free-text response from the external agent and categorizes it into suggestions, challenges, and endorsements. This is a natural language understanding task, not a programmatic parsing task.
**When to use:** After receiving each agent's response text.
**Why not programmatic:** External CLIs (codex, gemini, opencode) return natural language responses. Even though the review prompt asks for three sections, agents may format differently. Claude, as the orchestrator, has the language understanding to extract the intent regardless of exact formatting.
**Key constraint:** If the response cannot be meaningfully parsed (e.g., the agent returned an error message, nonsensical output, or off-topic content), treat as a failed invocation -- display warning, skip this agent's feedback, continue.

### Pattern 5: Graceful Degradation at Workflow Level
**What:** When a co-planner agent fails (timeout, error, unavailable), the workflow displays a warning and continues with remaining agents. If ALL agents fail, the workflow continues with no external feedback (Claude's own judgment).
**When to use:** After each `coplanner invoke` call.
**Example:**
```markdown
Parse invoke result:
- If `errorType` is non-null: display warning, skip to next agent
  ```
  ⚠ {agent} failed ({errorType}): {error message}
  Continuing with remaining agents...
  ```
- If ALL agents fail: display warning, skip to adversary review
  ```
  ⚠ All co-planners failed. Proceeding with Claude's review only.
  ```
```

### Anti-Patterns to Avoid
- **Creating a new agent/subagent for co-planner review:** Co-planner review is orchestrator-level logic (resolve agents, invoke, parse, display, synthesize). It does NOT spawn a Task tool subagent. The orchestrator (Claude, running the workflow) does all the work inline. The only tool calls are Bash (for `gsd-tools.cjs coplanner` commands) and Edit (for artifact modifications).
- **Multi-round debate with co-planners:** Co-planners are single-pass reviewers. They provide one round of feedback. The adversary handles multi-round debate. Co-planners refine; adversary challenges. Do not add a debate loop to co-planner review.
- **Separate synthesis document:** The decision locks "modify artifact directly." Do not create a separate SYNTHESIS.md or CO-PLANNER-FEEDBACK.md. Accepted suggestions are applied directly to the artifact (REQUIREMENTS.md, ROADMAP.md, PLAN.md, VERIFICATION.md). The accept/reject log is displayed inline, not persisted.
- **Programmatic JSON parsing of agent responses:** External CLIs return natural language. Do not try to `JSON.parse()` the response text. Claude reads it and categorizes. The prompt asks for three sections, but the parser is Claude's understanding, not regex.
- **Blocking on co-planner failure:** The decision locks "continue with warning." A failed co-planner is a degraded-but-functional state, not a workflow stopper.
- **Calling adapters directly from workflow instructions:** Always use `gsd-tools.cjs coplanner invoke`. The coplanner command handles kill switch checks, adapter loading, timeout, and error classification. Workflow instructions should never `require()` an adapter or run a CLI directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent resolution per checkpoint | Custom config reading in workflow | `gsd-tools.cjs coplanner agents <checkpoint>` | Already handles fallback chain, validation, kill switch. Phase 7 built this. |
| CLI invocation with timeout | `execSync` in workflow bash blocks | `gsd-tools.cjs coplanner invoke <cli> --prompt` | Already handles adapter loading, temp file management, error classification, timeout. Phase 6 built this. |
| Feedback category parsing | Regex extractors for "Suggestions:", "Challenges:" | Claude's natural language understanding | External agents format responses differently. Claude is better at understanding intent than regex is at matching format. |
| Config-based skip logic | Manual `cat .planning/config.json | grep` patterns | `coplanner agents` returns empty array when disabled | The command already checks kill switch + config + env var. Empty array = skip. |

**Key insight:** Phase 8 is a pure integration phase. All tooling primitives exist (Phase 6 adapters, Phase 7 config resolution). Phase 8 writes the workflow instructions that wire them together. The "code" is markdown prompt engineering, not JavaScript.

## Common Pitfalls

### Pitfall 1: Review Prompt Too Long for CLI Stdin
**What goes wrong:** The review prompt includes the full artifact content. For a large REQUIREMENTS.md or ROADMAP.md (500+ lines), the prompt exceeds shell command-line argument limits or the CLI's input buffer.
**Why it happens:** The `coplanner invoke` command passes the prompt via `--prompt` flag, which has shell argument length limits. However, looking at the adapter implementations, the prompt is written to a temp file and piped via stdin, so the actual shell arg limit is avoided. The concern is more about token limits in the external CLI.
**How to avoid:** The adapters already write prompts to temp files and pipe via `cat`. The 120s timeout provides a natural ceiling on response length. For very large artifacts, consider truncating to the most relevant section. In practice, GSD artifacts are typically 50-200 lines, well within limits.
**Warning signs:** `coplanner invoke` hangs or returns truncated responses on large artifacts.

### Pitfall 2: Co-Planner Prompt Passed via --prompt Flag Length
**What goes wrong:** The `--prompt` flag in the CLI router (gsd-tools.cjs line 5438) reads `args[promptIdx + 1]`, which is a single command-line argument. Long prompts with embedded artifact content may be truncated or cause argument parsing issues.
**Why it happens:** Shell argument parsing splits on whitespace. A prompt containing newlines or special characters may be parsed incorrectly.
**How to avoid:** The workflow instructions should write the complete review prompt (including artifact content) to a temp file, then pass it as a shorter reference: `--prompt "$(cat /tmp/review-prompt.txt)"`. However, the current `coplanner invoke` already handles this internally by writing to a temp file. The real concern is the shell argument limit when the orchestrator constructs the bash command. Use a heredoc or temp file approach in the workflow instructions:
```bash
REVIEW_PROMPT=$(cat <<'PROMPT_EOF'
Review these requirements...
{ARTIFACT_CONTENT}
PROMPT_EOF
)
RESULT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner invoke codex --prompt "$REVIEW_PROMPT")
```
**Warning signs:** Prompt is silently truncated. Agent reviews an incomplete artifact.

### Pitfall 3: Ordering Conflict Between Co-Planner and Adversary Commits
**What goes wrong:** Co-planner review modifies and commits the artifact. Then adversary review also modifies and commits. If both change the same lines, the git history shows two separate "incorporate feedback" commits that could confuse the narrative.
**Why it happens:** Both review stages can modify the same artifact file.
**How to avoid:** This is expected and acceptable behavior. The git history shows: (1) initial artifact creation, (2) co-planner refinement, (3) adversary revision. Each commit has a distinct message (`docs: incorporate co-planner feedback` vs `docs: incorporate adversary review feedback`). The adversary always reviews the post-co-planner version because it runs second. No conflict resolution needed.
**Warning signs:** None -- this is by design. The two-commit pattern provides clear attribution of which review stage caused which changes.

### Pitfall 4: Agent Response Contains Unhelpful or Off-Topic Content
**What goes wrong:** An external agent (especially when using a less capable model) returns a response that doesn't follow the requested format -- no clear suggestions/challenges/endorsements, just a generic "looks good" or a completely off-topic response.
**Why it happens:** External CLIs may use models with varying capabilities. The review prompt is a best-effort instruction, not a guaranteed format.
**How to avoid:** The orchestrator (Claude) evaluates each response for substance. If the response has no actionable feedback (just "looks good" or off-topic), the orchestrator displays it in the agent's feedback block but notes "No actionable feedback" and moves on. Do not treat an unhelpful response as an error -- it is valid input that happens to have no suggestions.
**Warning signs:** Accept/reject log is empty (no feedback to act on). Agent's feedback block shows only endorsements with no substance.

### Pitfall 5: Feedback Display Overwhelms User
**What goes wrong:** With multiple agents each providing multiple suggestions, challenges, and endorsements, the feedback display becomes very long and the user loses track of what actually changed.
**Why it happens:** Three agents * 3-5 items each = 9-15 feedback items plus the accept/reject log.
**How to avoid:** Phase 8 only supports a single agent per checkpoint (Phase 9 adds multi-agent). With one agent, the display is manageable: one feedback block + one synthesis table. Even with the future multi-agent case, the accept/reject log provides a concise summary. The feedback blocks can be collapsed in the future but for Phase 8 the volume is manageable.
**Warning signs:** User skips reading feedback. Accept/reject log has 15+ rows.

### Pitfall 6: Inconsistent Section Numbering in Workflow Files
**What goes wrong:** The existing adversary sections use decimal numbering (Phase 7.5, Phase 8.5, step 12.5, step 7.5). Adding co-planner sections requires new section numbers that do not collide.
**Why it happens:** The workflow files use a phase/step numbering scheme where ".5" sections are interleaved review points.
**How to avoid:** Use a consistent numbering pattern: co-planner review at `.3` (runs before adversary at `.5`). For example:
- `new-project.md`: Phase 7.3 (co-planner requirements) before Phase 7.5 (adversary requirements); Phase 8.3 (co-planner roadmap) before Phase 8.5 (adversary roadmap)
- `plan-phase.md`: step 12.3 (co-planner plan) before step 12.5 (adversary plan)
- `execute-phase.md`: step 7.3 (co-planner verification) before step 7.5 (adversary verification)
**Warning signs:** Section references in the workflow become ambiguous. "Skip to step 12.5" no longer has a clear antecedent.

## Code Examples

Verified patterns from codebase investigation:

### Complete Co-Planner Review Section (Requirements Checkpoint)
```markdown
## Phase 7.3: Co-Planner Review — Requirements

**Resolve co-planner agents:**

```bash
CO_AGENTS_JSON=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner agents "requirements")
```

Parse JSON: extract `agents` array and `warnings` array.

**If agents array is empty:** Skip to Phase 7.5 (adversary review).

**If agents array is non-empty:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CO-PLANNER REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Reviewing requirements with {N} co-planner(s)...
```

Set `CO_PLANNER_RAN_REQUIREMENTS=true`.

**For each agent in agents array:**

1. **Read artifact from disk:**
   ```bash
   ARTIFACT_CONTENT=$(cat .planning/REQUIREMENTS.md)
   PROJECT_CONTEXT=$(head -50 .planning/PROJECT.md)
   ```

2. **Construct review prompt and invoke:**
   ```bash
   REVIEW_PROMPT=$(cat <<'PROMPT_EOF'
   Review these requirements for a software project. Focus on:
   1. FEASIBILITY: Can these requirements be built with reasonable effort? Are there technical blockers?
   2. GAPS: What obvious requirements are missing? What would a user expect that isn't listed?
   3. CONFLICTS: Do any requirements contradict each other?
   4. SCOPE: Are any requirements actually implementation details disguised as requirements?

   Organize your response into three sections:
   - **Suggestions:** Specific improvements or additions you recommend
   - **Challenges:** Concerns or potential problems you see
   - **Endorsements:** What looks good and is well-thought-out

   Project context:
   {PROJECT_CONTEXT}

   Requirements to review:
   {ARTIFACT_CONTENT}
   PROMPT_EOF
   )

   RESULT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner invoke {agent} --prompt "$REVIEW_PROMPT")
   ```

3. **Check for errors:**
   Parse `RESULT` JSON. If `errorType` is non-null:
   ```
   ⚠ {agent} failed ({errorType}): {error}
   Continuing with remaining agents...
   ```
   Skip to next agent.

4. **Display attributed feedback block:**
   ```
   ─── {Agent Name} Feedback ───

   **Suggestions:**
   - {extracted from response}

   **Challenges:**
   - {extracted from response}

   **Endorsements:**
   - {extracted from response}

   ──────────────────────────────
   ```

**After all agents reviewed:**

Synthesize: Review all suggestions and challenges. For each:
- Accept: apply change to REQUIREMENTS.md via Edit tool
- Reject: note with brief reasoning

Display accept/reject log:
```
### Co-Planner Synthesis

| # | Source | Feedback | Decision | Reasoning |
|---|--------|----------|----------|-----------|
| 1 | {agent} | {feedback summary} | Accepted | {why} |
| 2 | {agent} | {feedback summary} | Rejected | {why} |

{N} suggestions accepted, {M} rejected
```

**Conditional commit:**
If artifact was revised (`CO_PLANNER_REVISED_REQUIREMENTS = true`):
```bash
git add .planning/REQUIREMENTS.md
git commit -m "$(cat <<'EOF'
docs: incorporate co-planner feedback (requirements)
EOF
)"
```
```

### Invocation Pattern (How to Call coplanner invoke)
```bash
# JSON output (default):
RESULT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner invoke codex --prompt "$REVIEW_PROMPT")

# RESULT is JSON:
# Success: { "text": "...", "cli": "codex", "duration": 5432, "exitCode": 0, "error": null, "errorType": null }
# Failure: { "text": null, "cli": "codex", "duration": 120001, "exitCode": 1, "error": "...", "errorType": "TIMEOUT" }
# Disabled: { "skipped": true, "reason": "co-planners disabled", "source": "config" }

# Human-readable output (with --raw):
RESULT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner invoke codex --prompt "$REVIEW_PROMPT" --raw)
# Returns just the text response on success, or "error [TYPE]: message" on failure
```

### Agent Resolution Pattern
```bash
# Get agents for a specific checkpoint:
AGENTS_JSON=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner agents "requirements")
# Returns: { "agents": ["codex"], "warnings": [] }

# If co-planners disabled or no agents configured:
# Returns: { "agents": [], "warnings": [] }

# If invalid agent in config:
# Returns: { "agents": ["codex"], "warnings": ["Unknown agent 'invalid' skipped. Valid: codex, gemini, opencode"] }
```

### Where Each Checkpoint Lives (File Locations)

| Checkpoint | File | Current Section | New Section |
|------------|------|-----------------|-------------|
| requirements | `commands/gsd/new-project.md` | Phase 7.5 (adversary, line ~870) | Phase 7.3 (co-planner, insert before) |
| roadmap | `commands/gsd/new-project.md` | Phase 8.5 (adversary, line ~1143) | Phase 8.3 (co-planner, insert before) |
| plan | `commands/gsd/plan-phase.md` | Step 12.5 (adversary, line ~472) | Step 12.3 (co-planner, insert before) |
| verification | `commands/gsd/execute-phase.md` (workflow) | Step 7.5 (adversary, line ~113) | Step 7.3 (co-planner, insert before) |

### Existing Skip-Chain Updates Required

When co-planner review is added, some "skip to" references need updating:

| File | Current | Updated |
|------|---------|---------|
| `new-project.md` | "Skip to Phase 7.5 (adversary)" | "Skip to Phase 7.3 (co-planner), which may then skip to 7.5" |
| `plan-phase.md` | "Skip to step 12.5 (adversary review)" | "Skip to step 12.3 (co-planner review)" |
| `execute-phase.md` | "Continue to step 7.5 (adversary review)" | "Continue to step 7.3 (co-planner review)" |

However, in practice, the co-planner section handles its own skip logic (empty agents = skip to next section). The simplest approach: keep existing "skip to adversary" references and add the co-planner section immediately before the adversary section. The flow naturally falls through: co-planner (skips if no agents) -> adversary (skips if disabled).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Claude-only artifact creation | Draft-review-synthesize with external agents | Phase 8 | Artifacts benefit from external perspectives before adversarial challenge |
| Adversary is the only external reviewer | Co-planners refine first, adversary challenges second | Phase 8 | Two-stage review: improvement then stress-testing |
| No feedback attribution | Per-agent attributed feedback blocks | Phase 8 | User can trace each suggestion to its source |
| Implicit synthesis (Claude just revises) | Explicit accept/reject log | Phase 8 | Transparency in how external feedback influenced the final artifact |

**Deprecated/outdated:**
- Nothing is deprecated. Phase 8 extends the existing adversary pattern without replacing it. The adversary continues to function identically -- it just receives a potentially-refined artifact instead of the raw draft.

## Open Questions

1. **Should the accept/reject log be persisted to disk?**
   - What we know: The decision says "modify artifact directly -- no separate synthesis document." The accept/reject log is displayed inline during the workflow.
   - What's unclear: Whether the accept/reject log should be appended to STATE.md, committed as a comment in the git history, or truly ephemeral (displayed only, not persisted).
   - Recommendation: Keep it ephemeral for Phase 8. The git diff between pre-co-planner and post-co-planner commits provides the persistent record of what changed. The accept/reject log adds context during the session but does not need persistence. If users want audit trails, that is a future enhancement.

2. **How much artifact content to include in the review prompt?**
   - What we know: The full artifact content is the most accurate input. But large artifacts may exceed external CLI context windows or produce shallow reviews.
   - What's unclear: Whether truncation or summarization of large artifacts would improve review quality.
   - Recommendation: Send the full artifact for Phase 8. GSD artifacts are typically 50-200 lines, well within context limits. If a specific artifact is very large (500+ lines), the orchestrator can note this and consider summarizing, but this is an edge case not worth engineering for in Phase 8.

3. **Should co-planner review in `execute-phase.md` go in the workflow file or the command file?**
   - What we know: The adversary review for verification is in `commands/gsd/execute-phase.md` (line ~113), but the execute-phase workflow is actually in `get-shit-done/workflows/execute-phase.md`. The command file delegates to the workflow. The adversary section for verification is in the COMMAND file (which contains the post-execution verification flow), not the workflow file.
   - What's unclear: Whether the workflow file at `get-shit-done/workflows/execute-phase.md` also needs changes.
   - Recommendation: The verification checkpoint's adversary review (step 7.5) is in `commands/gsd/execute-phase.md`, not the workflow. Add the co-planner review (step 7.3) in the same file, immediately before step 7.5. The workflow file (`get-shit-done/workflows/execute-phase.md`) handles plan execution, not verification review -- it does not need changes.

## Implementation Notes

### Files to Modify

| File | Changes | Estimated Size |
|------|---------|---------------|
| `commands/gsd/new-project.md` | Add Phase 7.3 (co-planner requirements) and Phase 8.3 (co-planner roadmap) sections | ~200 lines added (two checkpoint sections) |
| `commands/gsd/plan-phase.md` | Add step 12.3 (co-planner plan) section | ~100 lines added (one checkpoint section) |
| `commands/gsd/execute-phase.md` | Add step 7.3 (co-planner verification) section | ~100 lines added (one checkpoint section) |

### Each Checkpoint Section Contains

1. Agent resolution call (~5 lines)
2. Skip logic (~3 lines)
3. Banner display (~8 lines)
4. Per-agent loop with invocation (~30 lines)
5. Error handling per agent (~5 lines)
6. Feedback display template (~15 lines)
7. Synthesis instructions (~15 lines)
8. Accept/reject log template (~10 lines)
9. Conditional commit (~5 lines)

Total: ~95 lines per checkpoint, ~400 lines total across 4 checkpoints in 3 files.

### Prompt Construction Detail

The review prompt must be constructed by the orchestrator at runtime, not stored as a static template. This is because:
1. `{ARTIFACT_CONTENT}` is read from disk at invocation time (may have been modified by earlier steps)
2. `{PROJECT_CONTEXT}` varies per project
3. The checkpoint-specific focus areas are static text embedded in the workflow instructions

The prompt construction is part of the workflow markdown instructions, not a gsd-tools.cjs function. This is consistent with how adversary prompts are constructed (inline in the workflow, not abstracted).

### Testing Strategy

Each requirement maps to a verifiable scenario:

| Requirement | Verification |
|-------------|--------------|
| CORE-01 (draft-review-synthesize) | Enable co-planners, configure an agent, run `/gsd:new-project` -> co-planner invoked at requirements checkpoint, artifact modified |
| CORE-02 (structured feedback) | Co-planner response parsed into suggestions/challenges/endorsements sections |
| CORE-04 (advisory only) | Accept/reject log shows Claude made decisions, some suggestions rejected with reasoning |
| UX-01 (formatted display) | Feedback shown in bordered block before Claude acts on it |
| UX-02 (attribution) | Feedback block header shows agent name (e.g., `─── Codex Feedback ───`) |

## Sources

### Primary (HIGH confidence)
- `commands/gsd/new-project.md` (lines 870-1025) -- adversary review pattern at requirements checkpoint, exact structural precedent
- `commands/gsd/new-project.md` (lines 1143-1295) -- adversary review pattern at roadmap checkpoint
- `commands/gsd/plan-phase.md` (lines 472-700) -- adversary review pattern at plan checkpoint
- `commands/gsd/execute-phase.md` (lines 113-300) -- adversary review pattern at verification checkpoint
- `get-shit-done/bin/gsd-tools.cjs` (lines 252-346) -- co-planner helpers: VALID_CHECKPOINTS, checkKillSwitch, filterValidAgents, getAgentsForCheckpoint
- `get-shit-done/bin/gsd-tools.cjs` (lines 4965-5024) -- cmdCoplannerInvoke, cmdCoplannerEnabled, cmdCoplannerAgents implementations
- `get-shit-done/bin/gsd-tools.cjs` (lines 5427-5460) -- CLI router for coplanner subcommands
- `get-shit-done/bin/adapters/codex.cjs`, `gemini.cjs`, `opencode.cjs` -- adapter implementations with detect/invoke/CLI_NAME exports
- `get-shit-done/templates/config.json` -- config template with co_planners section
- `.planning/config.json` -- live project config showing co_planners structure
- `agents/gsd-adversary.md` -- adversary agent showing checkpoint-specific challenge categories and output format

### Secondary (MEDIUM confidence)
- `.planning/phases/06-foundation/06-RESEARCH.md` -- Phase 6 research: adapter architecture, error classification, temp file patterns
- `.planning/phases/07-configuration/07-RESEARCH.md` -- Phase 7 research: config resolution, fallback chain, settings integration
- `.planning/phases/08-workflow-integration/08-CONTEXT.md` -- locked decisions for Phase 8
- `.planning/REQUIREMENTS.md` -- CORE-01, CORE-02, CORE-04, UX-01, UX-02 requirement definitions
- `.planning/ROADMAP.md` -- Phase 8 success criteria

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase artifacts.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all changes to existing markdown files, no new JavaScript code
- Architecture: HIGH -- exact structural precedent in adversary review pattern, all tooling primitives exist from Phase 6/7
- Pitfalls: HIGH -- identified from actual codebase patterns (prompt length, section numbering, commit ordering, response quality variance)
- Integration points: HIGH -- all four checkpoint locations identified with exact line numbers, insertion points clear

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- workflow integration is internal to GSD, not dependent on external libraries)

---
*Phase: 08-workflow-integration*
*Research for: Draft-review-synthesize pattern at workflow checkpoints*
