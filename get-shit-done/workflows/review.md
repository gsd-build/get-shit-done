<purpose>
Cross-AI peer review — invoke external AI CLIs to independently review phase plans.
Each CLI gets the same prompt (PROJECT.md context, phase plans, requirements) and
produces structured feedback. Results are combined into REVIEWS.md for the planner
to incorporate via --reviews flag.

This implements adversarial review: different AI models catch different blind spots.
A plan that survives review from 2-3 independent AI systems is more robust.
</purpose>

<process>

<step name="detect_clis">
Check which AI CLIs are available on the system:

```bash
# Check each CLI
command -v gemini >/dev/null 2>&1 && echo "gemini:available" || echo "gemini:missing"
command -v claude >/dev/null 2>&1 && echo "claude:available" || echo "claude:missing"
command -v codex >/dev/null 2>&1 && echo "codex:available" || echo "codex:missing"
command -v coderabbit >/dev/null 2>&1 && echo "coderabbit:available" || echo "coderabbit:missing"
command -v opencode >/dev/null 2>&1 && echo "opencode:available" || echo "opencode:missing"
```

Parse flags from `$ARGUMENTS`:
- `--gemini` → include Gemini
- `--claude` → include Claude
- `--codex` → include Codex
- `--coderabbit` → include CodeRabbit
- `--opencode` → include OpenCode
- `--all` → include all available
- No flags → include all available

If no CLIs are available:
```
No external AI CLIs found. Install at least one:
- gemini: https://github.com/google-gemini/gemini-cli
- codex: https://github.com/openai/codex
- claude: https://github.com/anthropics/claude-code
- opencode: https://opencode.ai (leverages GitHub Copilot subscription models)

Then run /gsd-review again.
```
Exit.

Determine which CLI to skip based on the current runtime environment:

```bash
# Environment-based runtime detection (priority order)
if [ "$ANTIGRAVITY_AGENT" = "1" ]; then
  # Antigravity is a separate client — all CLIs are external, skip none
  SELF_CLI="none"
elif [ -n "$CLAUDE_CODE_ENTRYPOINT" ]; then
  # Running inside Claude Code CLI — skip claude for independence
  SELF_CLI="claude"
else
  # Other environments (Gemini CLI, Codex CLI, etc.)
  # Fall back to AI self-identification to decide which CLI to skip
  SELF_CLI="auto"
fi
```

Rules:
- If `SELF_CLI="none"` → invoke ALL available CLIs (no skip)
- If `SELF_CLI="claude"` → skip claude, use gemini/codex
- If `SELF_CLI="auto"` → the executing AI identifies itself and skips its own CLI
- At least one DIFFERENT CLI must be available for the review to proceed.
</step>

<step name="gather_context">
Collect phase artifacts for the review prompt:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Read from init: `phase_dir`, `phase_number`, `padded_phase`.

Then read:
1. `.planning/PROJECT.md` (first 80 lines — project context)
2. Phase section from `.planning/ROADMAP.md`
3. All `*-PLAN.md` files in the phase directory
4. `*-CONTEXT.md` if present (user decisions)
5. `*-RESEARCH.md` if present (domain research)
6. `.planning/REQUIREMENTS.md` (requirements this phase addresses)
</step>

<step name="build_prompt">
Build a structured review prompt:

```markdown
# Cross-AI Plan Review Request

You are reviewing implementation plans for a software project phase.
Provide structured feedback on plan quality, completeness, and risks.

## Project Context
{first 80 lines of PROJECT.md}

## Phase {N}: {phase name}
### Roadmap Section
{roadmap phase section}

### Requirements Addressed
{requirements for this phase}

### User Decisions (CONTEXT.md)
{context if present}

### Research Findings
{research if present}

### Plans to Review
{all PLAN.md contents}

## Review Instructions

Analyze each plan and provide:

1. **Summary** — One-paragraph assessment
2. **Strengths** — What's well-designed (bullet points)
3. **Concerns** — Potential issues, gaps, risks (bullet points with severity: HIGH/MEDIUM/LOW)
4. **Suggestions** — Specific improvements (bullet points)
5. **Risk Assessment** — Overall risk level (LOW/MEDIUM/HIGH) with justification

Focus on:
- Missing edge cases or error handling
- Dependency ordering issues
- Scope creep or over-engineering
- Security considerations
- Performance implications
- Whether the plans actually achieve the phase goals

Output your review in markdown format.
```

Write to a temp file: `/tmp/gsd-review-prompt-{phase}.md`
</step>

<step name="invoke_reviewers">
For each selected CLI, invoke in sequence (not parallel — avoid rate limits):

**Gemini:**
```bash
gemini -p "$(cat /tmp/gsd-review-prompt-{phase}.md)" 2>/dev/null > /tmp/gsd-review-gemini-{phase}.md
```

**Claude (separate session):**
```bash
claude -p "$(cat /tmp/gsd-review-prompt-{phase}.md)" 2>/dev/null > /tmp/gsd-review-claude-{phase}.md
```

**Codex:**
```bash
codex exec --skip-git-repo-check "$(cat /tmp/gsd-review-prompt-{phase}.md)" 2>/dev/null > /tmp/gsd-review-codex-{phase}.md
```

**CodeRabbit:**

Note: CodeRabbit reviews the current git diff/working tree — it does not accept a prompt. It may take up to 5 minutes. Use `timeout: 360000` on the Bash tool call.

```bash
coderabbit review --prompt-only 2>/dev/null > /tmp/gsd-review-coderabbit-{phase}.md
```

**OpenCode (via GitHub Copilot):**
```bash
cat /tmp/gsd-review-prompt-{phase}.md | opencode run - 2>/dev/null > /tmp/gsd-review-opencode-{phase}.md
if [ ! -s /tmp/gsd-review-opencode-{phase}.md ]; then
  echo "OpenCode review failed or returned empty output." > /tmp/gsd-review-opencode-{phase}.md
fi
```

If a CLI fails, log the error and continue with remaining CLIs.

Display progress:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CROSS-AI REVIEW — Phase {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Reviewing with {CLI}... done ✓
◆ Reviewing with {CLI}... done ✓
```
</step>

<step name="write_reviews">
Combine all review responses into `{phase_dir}/{padded_phase}-REVIEWS.md`:

```markdown
---
phase: {N}
reviewers: [gemini, claude, codex, coderabbit, opencode]
reviewed_at: {ISO timestamp}
plans_reviewed: [{list of PLAN.md files}]
---

# Cross-AI Plan Review — Phase {N}

## Gemini Review

{gemini review content}

---

## Claude Review

{claude review content}

---

## Codex Review

{codex review content}

---

## CodeRabbit Review

{coderabbit review content}

---

## OpenCode Review

{opencode review content}

---

## Consensus Summary

{synthesize common concerns across all reviewers}

### Agreed Strengths
{strengths mentioned by 2+ reviewers}

### Agreed Concerns
{concerns raised by 2+ reviewers — highest priority}

### Divergent Views
{where reviewers disagreed — worth investigating}
```

Commit:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: cross-AI review for phase {N}" --files {phase_dir}/{padded_phase}-REVIEWS.md
```
</step>

<step name="present_results">
Display summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► REVIEW COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase {N} reviewed by {count} AI systems.

Consensus concerns:
{top 3 shared concerns}

Full review: {padded_phase}-REVIEWS.md

To incorporate feedback into planning:
  /gsd-plan-phase {N} --reviews
```

Clean up temp files.
</step>

</process>

<success_criteria>
- [ ] At least one external CLI invoked successfully
- [ ] REVIEWS.md written with structured feedback
- [ ] Consensus summary synthesized from multiple reviewers
- [ ] Temp files cleaned up
- [ ] User knows how to use feedback (/gsd-plan-phase --reviews)
</success_criteria>
