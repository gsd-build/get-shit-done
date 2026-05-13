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
command -v qwen >/dev/null 2>&1 && echo "qwen:available" || echo "qwen:missing"
command -v cursor >/dev/null 2>&1 && echo "cursor:available" || echo "cursor:missing"

# Check local model servers (OpenAI-compatible HTTP API — no CLI binary required)
OLLAMA_HOST=$(gsd-sdk query config-get review.ollama_host 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$OLLAMA_HOST" ] || [ "$OLLAMA_HOST" = "null" ]; then OLLAMA_HOST="http://localhost:11434"; fi
curl -s --max-time 2 "${OLLAMA_HOST}/v1/models" >/dev/null 2>&1 && echo "ollama:available" || echo "ollama:missing"

LM_STUDIO_HOST=$(gsd-sdk query config-get review.lm_studio_host 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LM_STUDIO_HOST" ] || [ "$LM_STUDIO_HOST" = "null" ]; then LM_STUDIO_HOST="http://localhost:1234"; fi
curl -s --max-time 2 "${LM_STUDIO_HOST}/v1/models" >/dev/null 2>&1 && echo "lm_studio:available" || echo "lm_studio:missing"

LLAMA_CPP_HOST=$(gsd-sdk query config-get review.llama_cpp_host 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LLAMA_CPP_HOST" ] || [ "$LLAMA_CPP_HOST" = "null" ]; then LLAMA_CPP_HOST="http://localhost:8080"; fi
curl -s --max-time 2 "${LLAMA_CPP_HOST}/v1/models" >/dev/null 2>&1 && echo "llama_cpp:available" || echo "llama_cpp:missing"
```

Parse flags from `$ARGUMENTS`:
- `--gemini` → include Gemini
- `--claude` → include Claude
- `--codex` → include Codex
- `--coderabbit` → include CodeRabbit
- `--opencode` → include OpenCode
- `--qwen` → include Qwen Code
- `--cursor` → include Cursor
- `--ollama` → include Ollama (local server, OpenAI-compatible)
- `--lm-studio` → include LM Studio (local server, OpenAI-compatible)
- `--llama-cpp` → include llama.cpp (local server, OpenAI-compatible)
- `--all` → include all available (CLIs + running local servers)
- No flags → if `review.default_reviewers` is set, include only configured reviewers that are detected; otherwise include all available

Reviewer-selection precedence:
1. Individual reviewer flags (`--gemini`, `--codex`, etc.)
2. `--all`
3. `review.default_reviewers`
4. No key + no flags → all detected reviewers

`review.default_reviewers` behavior:
- Value must be a non-empty array of slug strings (configured via `gsd config-set review.default_reviewers '["gemini","codex"]'`)
- Unknown slugs warn and are ignored
- Known-but-undetected slugs emit an info note and are ignored
- If all configured reviewers are unavailable, fail with an actionable message

If no CLIs are available:
```
No external AI CLIs found. Install at least one:
- gemini: https://github.com/google-gemini/gemini-cli
- codex: https://github.com/openai/codex
- claude: https://github.com/anthropics/claude-code
- opencode: https://opencode.ai (leverages GitHub Copilot subscription models)
- qwen: https://github.com/nicepkg/qwen-code (Alibaba Qwen models)
- cursor: https://cursor.com (Cursor IDE agent mode)

Then run /gsd:review again.
```
Exit.

Determine which CLI to skip based on the current runtime environment:

```bash
# Environment-based runtime detection (priority order)
if [ "$ANTIGRAVITY_AGENT" = "1" ]; then
  # Antigravity is a separate client — all CLIs are external, skip none
  SELF_CLI="none"
elif [ -n "$CURSOR_SESSION_ID" ]; then
  # Running inside Cursor agent — skip cursor for independence
  SELF_CLI="cursor"
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
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
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
Read model preferences from planning config. Null/missing values fall back to CLI defaults.

```bash
# JSON scalars from gsd-sdk query; use jq -r to strip JSON string quotes (install jq if missing)
GEMINI_MODEL=$(gsd-sdk query config-get review.models.gemini 2>/dev/null | jq -r '.' 2>/dev/null || true)
CLAUDE_MODEL=$(gsd-sdk query config-get review.models.claude 2>/dev/null | jq -r '.' 2>/dev/null || true)
CODEX_MODEL=$(gsd-sdk query config-get review.models.codex 2>/dev/null | jq -r '.' 2>/dev/null || true)
OPENCODE_MODEL=$(gsd-sdk query config-get review.models.opencode 2>/dev/null | jq -r '.' 2>/dev/null || true)
```

For each selected CLI, invoke in sequence (not parallel — avoid rate limits):

**Gemini:**
```bash
if [ -n "$GEMINI_MODEL" ] && [ "$GEMINI_MODEL" != "null" ]; then
  cat /tmp/gsd-review-prompt-{phase}.md | gemini -m "$GEMINI_MODEL" -p - 2>/dev/null > /tmp/gsd-review-gemini-{phase}.md
else
  cat /tmp/gsd-review-prompt-{phase}.md | gemini -p - 2>/dev/null > /tmp/gsd-review-gemini-{phase}.md
fi
```

**Claude (separate session):**
```bash
if [ -n "$CLAUDE_MODEL" ] && [ "$CLAUDE_MODEL" != "null" ]; then
  cat /tmp/gsd-review-prompt-{phase}.md | claude --model "$CLAUDE_MODEL" -p - 2>/dev/null > /tmp/gsd-review-claude-{phase}.md
else
  cat /tmp/gsd-review-prompt-{phase}.md | claude -p - 2>/dev/null > /tmp/gsd-review-claude-{phase}.md
fi
```

**Codex:**
```bash
if [ -n "$CODEX_MODEL" ] && [ "$CODEX_MODEL" != "null" ]; then
  cat /tmp/gsd-review-prompt-{phase}.md | codex exec --model "$CODEX_MODEL" --skip-git-repo-check - 2>/dev/null > /tmp/gsd-review-codex-{phase}.md
else
  cat /tmp/gsd-review-prompt-{phase}.md | codex exec --skip-git-repo-check - 2>/dev/null > /tmp/gsd-review-codex-{phase}.md
fi
```

**CodeRabbit:**

Note: CodeRabbit reviews the current git diff/working tree — it does not accept a prompt or model flag. It may take up to 5 minutes. Use `timeout: 360000` on the Bash tool call.

```bash
coderabbit review --prompt-only 2>/dev/null > /tmp/gsd-review-coderabbit-{phase}.md
```

**OpenCode (via GitHub Copilot):**
```bash
if [ -n "$OPENCODE_MODEL" ] && [ "$OPENCODE_MODEL" != "null" ]; then
  cat /tmp/gsd-review-prompt-{phase}.md | opencode run --model "$OPENCODE_MODEL" - 2>/dev/null > /tmp/gsd-review-opencode-{phase}.md
else
  cat /tmp/gsd-review-prompt-{phase}.md | opencode run - 2>/dev/null > /tmp/gsd-review-opencode-{phase}.md
fi
if [ ! -s /tmp/gsd-review-opencode-{phase}.md ]; then
  echo "OpenCode review failed or returned empty output." > /tmp/gsd-review-opencode-{phase}.md
fi
```

**Qwen Code:**
```bash
cat /tmp/gsd-review-prompt-{phase}.md | qwen - 2>/dev/null > /tmp/gsd-review-qwen-{phase}.md
if [ ! -s /tmp/gsd-review-qwen-{phase}.md ]; then
  echo "Qwen review failed or returned empty output." > /tmp/gsd-review-qwen-{phase}.md
fi
```

**Cursor:**
```bash
cat /tmp/gsd-review-prompt-{phase}.md | cursor agent -p --mode ask --trust 2>/dev/null > /tmp/gsd-review-cursor-{phase}.md
if [ ! -s /tmp/gsd-review-cursor-{phase}.md ]; then
  echo "Cursor review failed or returned empty output." > /tmp/gsd-review-cursor-{phase}.md
fi
```

**Ollama (local, OpenAI-compatible):**

Read host and model from config. All three local backends share the same `/v1/chat/completions` endpoint — only host and model differ. Use `jq --rawfile` to safely encode the multi-line prompt as JSON without shell-escaping issues.

```bash
OLLAMA_HOST=$(gsd-sdk query config-get review.ollama_host 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$OLLAMA_HOST" ] || [ "$OLLAMA_HOST" = "null" ]; then OLLAMA_HOST="http://localhost:11434"; fi
OLLAMA_MODEL=$(gsd-sdk query config-get review.models.ollama 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$OLLAMA_MODEL" ] || [ "$OLLAMA_MODEL" = "null" ]; then
  OLLAMA_MODEL=$(curl -s --max-time 2 "${OLLAMA_HOST}/v1/models" 2>/dev/null | jq -r '.data[0].id // "llama3"' 2>/dev/null || echo "llama3")
fi
jq -n --rawfile content /tmp/gsd-review-prompt-{phase}.md \
  --arg model "$OLLAMA_MODEL" \
  '{model: $model, messages: [{role: "user", content: $content}]}' | \
  curl -s --max-time 120 -X POST "${OLLAMA_HOST}/v1/chat/completions" \
    -H "Content-Type: application/json" -d @- 2>/dev/null | \
  jq -r '.choices[0].message.content // "Ollama review failed or returned empty output."' \
  > /tmp/gsd-review-ollama-{phase}.md
if [ ! -s /tmp/gsd-review-ollama-{phase}.md ]; then
  echo "Ollama review failed or returned empty output." > /tmp/gsd-review-ollama-{phase}.md
fi
```

**LM Studio (local, OpenAI-compatible):**
```bash
LM_STUDIO_HOST=$(gsd-sdk query config-get review.lm_studio_host 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LM_STUDIO_HOST" ] || [ "$LM_STUDIO_HOST" = "null" ]; then LM_STUDIO_HOST="http://localhost:1234"; fi
LM_STUDIO_MODEL=$(gsd-sdk query config-get review.models.lm_studio 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LM_STUDIO_MODEL" ] || [ "$LM_STUDIO_MODEL" = "null" ]; then
  LM_STUDIO_MODEL=$(curl -s --max-time 2 "${LM_STUDIO_HOST}/v1/models" 2>/dev/null | jq -r '.data[0].id // "local-model"' 2>/dev/null || echo "local-model")
fi
LM_STUDIO_RESPONSE=$(jq -n --rawfile content /tmp/gsd-review-prompt-{phase}.md \
  --arg model "$LM_STUDIO_MODEL" \
  '{model: $model, messages: [{role: "user", content: $content}]}' | \
  curl -s --max-time 120 -X POST "${LM_STUDIO_HOST}/v1/chat/completions" \
    -H "Content-Type: application/json" -d @- 2>/dev/null)
LM_STUDIO_ACTUAL_MODEL=$(echo "$LM_STUDIO_RESPONSE" | jq -r '.model // ""' 2>/dev/null || echo "")
if [ -n "$LM_STUDIO_ACTUAL_MODEL" ] && [ "$LM_STUDIO_ACTUAL_MODEL" != "null" ] && [ "$LM_STUDIO_ACTUAL_MODEL" != "$LM_STUDIO_MODEL" ]; then
  echo "Warning: LM Studio served model '$LM_STUDIO_ACTUAL_MODEL' but '$LM_STUDIO_MODEL' was requested. Review may be from a different model." >&2
fi
LM_STUDIO_CONTENT=$(echo "$LM_STUDIO_RESPONSE" | jq -r '.choices[0].message.content // ""' 2>/dev/null || echo "")
if [ -n "$LM_STUDIO_CONTENT" ]; then
  echo "$LM_STUDIO_CONTENT" > /tmp/gsd-review-lm_studio-{phase}.md
else
  echo "Warning: LM Studio returned empty content — skipping review." >&2
fi
```

**llama.cpp (local, OpenAI-compatible):**
```bash
LLAMA_CPP_HOST=$(gsd-sdk query config-get review.llama_cpp_host 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LLAMA_CPP_HOST" ] || [ "$LLAMA_CPP_HOST" = "null" ]; then LLAMA_CPP_HOST="http://localhost:8080"; fi
LLAMA_CPP_MODEL=$(gsd-sdk query config-get review.models.llama_cpp 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LLAMA_CPP_MODEL" ] || [ "$LLAMA_CPP_MODEL" = "null" ]; then
  LLAMA_CPP_MODEL=$(curl -s --max-time 2 "${LLAMA_CPP_HOST}/v1/models" 2>/dev/null | jq -r '.data[0].id // "local-model"' 2>/dev/null || echo "local-model")
fi
LLAMA_CPP_CONTENT=$(jq -n --rawfile content /tmp/gsd-review-prompt-{phase}.md \
  --arg model "$LLAMA_CPP_MODEL" \
  '{model: $model, messages: [{role: "user", content: $content}]}' | \
  curl -s --max-time 120 -X POST "${LLAMA_CPP_HOST}/v1/chat/completions" \
    -H "Content-Type: application/json" -d @- 2>/dev/null | \
  jq -r '.choices[0].message.content // ""' 2>/dev/null || echo "")
if [ -n "$LLAMA_CPP_CONTENT" ]; then
  echo "$LLAMA_CPP_CONTENT" > /tmp/gsd-review-llama_cpp-{phase}.md
else
  echo "Warning: llama.cpp returned empty content — skipping review." >&2
fi
```

If a CLI or local server fails, log the error and continue with remaining reviewers.

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
reviewers: [gemini, claude, codex, coderabbit, opencode, qwen, cursor, ollama, lm_studio, llama_cpp]  # populate at runtime with only the reviewers actually invoked
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

## Qwen Review

{qwen review content}

---

## Cursor Review

{cursor review content}

---

## Ollama Review

{ollama review content}

---

## LM Studio Review

{lm_studio review content}

---

## llama.cpp Review

{llama_cpp review content}

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
gsd-sdk query commit "docs: cross-AI review for phase {N}" --files {phase_dir}/{padded_phase}-REVIEWS.md
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
  /gsd:plan-phase {N} --reviews
```

Clean up temp files.
</step>

</process>

<success_criteria>
- [ ] At least one external CLI invoked successfully
- [ ] REVIEWS.md written with structured feedback
- [ ] Consensus summary synthesized from multiple reviewers
- [ ] Temp files cleaned up
- [ ] User knows how to use feedback (/gsd:plan-phase --reviews)
</success_criteria>
