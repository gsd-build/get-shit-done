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

Also write individual section files so the budget tool can re-trim per reviewer:

```bash
# Write individual section files for per-reviewer budget trimming
# These are always written so reviewers with a budget can invoke prompt-budget
cp "$INSTRUCTIONS_BLOCK_FILE" "/tmp/gsd-review-${PHASE}-instructions.md"
cp "$ROADMAP_SECTION_FILE" "/tmp/gsd-review-${PHASE}-roadmap.md"

# Plan files: copy each PLAN.md to a predictable numbered path
PLAN_INDEX=0
for PLAN_FILE in "${PHASE_DIR}"/*-PLAN.md; do
  PADDED_IDX=$(printf '%02d' "$PLAN_INDEX")
  cp "$PLAN_FILE" "/tmp/gsd-review-${PHASE}-plan-${PADDED_IDX}.md"
  PLAN_INDEX=$((PLAN_INDEX + 1))
done

# Optional section files (only if content was included in the combined prompt)
if [ -f ".planning/PROJECT.md" ]; then
  cp .planning/PROJECT.md "/tmp/gsd-review-${PHASE}-project.md"
fi
if ls "${PHASE_DIR}/"*"-CONTEXT.md" >/dev/null 2>&1; then
  cat "${PHASE_DIR}/"*"-CONTEXT.md" > "/tmp/gsd-review-${PHASE}-context.md"
fi
if ls "${PHASE_DIR}/"*"-RESEARCH.md" >/dev/null 2>&1; then
  cat "${PHASE_DIR}/"*"-RESEARCH.md" > "/tmp/gsd-review-${PHASE}-research.md"
fi
if [ -f ".planning/REQUIREMENTS.md" ]; then
  cp .planning/REQUIREMENTS.md "/tmp/gsd-review-${PHASE}-requirements.md"
fi
```

Note: The variable names above (`INSTRUCTIONS_BLOCK_FILE`, `ROADMAP_SECTION_FILE`, `PHASE_DIR`, `PHASE`) reference the variables already established during prompt assembly. In practice the AI implementing this step writes the instruction and roadmap blocks to temp files while assembling the combined prompt, then copies those same temp files to the per-reviewer section paths. If the assembled prompt was built inline (string concatenation rather than file-by-file), write each section to the corresponding path after writing the combined file.
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
# Shared helper: apply prompt-budget trimming for local reviewers
prepare_trimmed_prompt_for_reviewer() {
  REVIEWER_KEY="$1"
  REVIEWER_BUDGET="$2"
  OUTPUT_PROMPT="$3"
  OUTPUT_META="$4"

  [ -z "$REVIEWER_BUDGET" ] && return 0
  [ "$REVIEWER_BUDGET" = "null" ] && return 0
  [ "$REVIEWER_BUDGET" = "0" ] && return 0

  PLAN_FILE_ARGS=""
  for p in /tmp/gsd-review-{phase}-plan-*.md; do
    [ -f "$p" ] && PLAN_FILE_ARGS="$PLAN_FILE_ARGS --plan-file $p"
  done
  PROJECT_ARG=""
  [ -f "/tmp/gsd-review-{phase}-project.md" ] && PROJECT_ARG="--project-file /tmp/gsd-review-{phase}-project.md"
  CONTEXT_ARG=""
  [ -f "/tmp/gsd-review-{phase}-context.md" ] && CONTEXT_ARG="--context-file /tmp/gsd-review-{phase}-context.md"
  RESEARCH_ARG=""
  [ -f "/tmp/gsd-review-{phase}-research.md" ] && RESEARCH_ARG="--research-file /tmp/gsd-review-{phase}-research.md"
  REQUIREMENTS_ARG=""
  [ -f "/tmp/gsd-review-{phase}-requirements.md" ] && REQUIREMENTS_ARG="--requirements-file /tmp/gsd-review-{phase}-requirements.md"

  gsd-sdk query prompt-budget \
    --budget "$REVIEWER_BUDGET" \
    --instructions-file "/tmp/gsd-review-{phase}-instructions.md" \
    --roadmap-file "/tmp/gsd-review-{phase}-roadmap.md" \
    $PLAN_FILE_ARGS $PROJECT_ARG $CONTEXT_ARG $RESEARCH_ARG $REQUIREMENTS_ARG \
    --output-prompt "$OUTPUT_PROMPT" \
    --output-metadata "$OUTPUT_META"
  return $?
}

# Resolve prompt budget for Ollama: per-reviewer override > global default > null
OLLAMA_REVIEWER_BUDGET=$(gsd-sdk query config-get review.max_prompt_tokens_per_reviewer.ollama 2>/dev/null | jq -r '.' 2>/dev/null || echo "null")
if [ -z "$OLLAMA_REVIEWER_BUDGET" ] || [ "$OLLAMA_REVIEWER_BUDGET" = "null" ]; then
  OLLAMA_REVIEWER_BUDGET=$(gsd-sdk query config-get review.max_prompt_tokens 2>/dev/null | jq -r '.' 2>/dev/null || echo "null")
fi

# Apply budget trim for Ollama if a budget is configured
OLLAMA_PROMPT_FILE="/tmp/gsd-review-prompt-{phase}.md"
OLLAMA_SKIP=0
if [ -n "$OLLAMA_REVIEWER_BUDGET" ] && [ "$OLLAMA_REVIEWER_BUDGET" != "null" ] && [ "$OLLAMA_REVIEWER_BUDGET" != "0" ]; then
  OLLAMA_TRIMMED_PROMPT="/tmp/gsd-review-prompt-{phase}-ollama.md"
  OLLAMA_TRIM_META="/tmp/gsd-review-prompt-{phase}-ollama.metadata.json"
  prepare_trimmed_prompt_for_reviewer "ollama" "$OLLAMA_REVIEWER_BUDGET" "$OLLAMA_TRIMMED_PROMPT" "$OLLAMA_TRIM_META"
  OLLAMA_EXIT=$?
  if [ $OLLAMA_EXIT -ne 0 ]; then
    if [ $OLLAMA_EXIT -eq 2 ] || [ $OLLAMA_EXIT -eq 11 ]; then
      echo "WARNING: prompt budget for ollama (${OLLAMA_REVIEWER_BUDGET} tokens) is too small for the minimum review set. Skipping Ollama reviewer." >&2
    else
      echo "WARNING: prompt-budget returned unexpected exit code ${OLLAMA_EXIT} for ollama. Skipping Ollama reviewer." >&2
    fi
    OLLAMA_SKIP=1
  else
    OLLAMA_PROMPT_FILE="$OLLAMA_TRIMMED_PROMPT"
  fi
fi

if [ "$OLLAMA_SKIP" != "1" ]; then
OLLAMA_HOST=$(gsd-sdk query config-get review.ollama_host 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$OLLAMA_HOST" ] || [ "$OLLAMA_HOST" = "null" ]; then OLLAMA_HOST="http://localhost:11434"; fi
OLLAMA_MODEL=$(gsd-sdk query config-get review.models.ollama 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$OLLAMA_MODEL" ] || [ "$OLLAMA_MODEL" = "null" ]; then
  OLLAMA_MODEL=$(curl -s --max-time 2 "${OLLAMA_HOST}/v1/models" 2>/dev/null | jq -r '.data[0].id // "llama3"' 2>/dev/null || echo "llama3")
fi
jq -n --rawfile content "$OLLAMA_PROMPT_FILE" \
  --arg model "$OLLAMA_MODEL" \
  '{model: $model, messages: [{role: "user", content: $content}]}' | \
  curl -s --max-time 120 -X POST "${OLLAMA_HOST}/v1/chat/completions" \
    -H "Content-Type: application/json" -d @- 2>/dev/null | \
  jq -r '.choices[0].message.content // "Ollama review failed or returned empty output."' \
  > /tmp/gsd-review-ollama-{phase}.md
if [ ! -s /tmp/gsd-review-ollama-{phase}.md ]; then
  echo "Ollama review failed or returned empty output." > /tmp/gsd-review-ollama-{phase}.md
fi
fi
```

**LM Studio (local, OpenAI-compatible):**
```bash
# Resolve prompt budget for LM Studio: per-reviewer override > global default > null
LM_STUDIO_REVIEWER_BUDGET=$(gsd-sdk query config-get review.max_prompt_tokens_per_reviewer.lm_studio 2>/dev/null | jq -r '.' 2>/dev/null || echo "null")
if [ -z "$LM_STUDIO_REVIEWER_BUDGET" ] || [ "$LM_STUDIO_REVIEWER_BUDGET" = "null" ]; then
  LM_STUDIO_REVIEWER_BUDGET=$(gsd-sdk query config-get review.max_prompt_tokens 2>/dev/null | jq -r '.' 2>/dev/null || echo "null")
fi

# Apply budget trim for LM Studio if a budget is configured
LM_STUDIO_PROMPT_FILE="/tmp/gsd-review-prompt-{phase}.md"
LM_STUDIO_SKIP=0
if [ -n "$LM_STUDIO_REVIEWER_BUDGET" ] && [ "$LM_STUDIO_REVIEWER_BUDGET" != "null" ] && [ "$LM_STUDIO_REVIEWER_BUDGET" != "0" ]; then
  LM_STUDIO_TRIMMED_PROMPT="/tmp/gsd-review-prompt-{phase}-lm_studio.md"
  LM_STUDIO_TRIM_META="/tmp/gsd-review-prompt-{phase}-lm_studio.metadata.json"
  prepare_trimmed_prompt_for_reviewer "lm_studio" "$LM_STUDIO_REVIEWER_BUDGET" "$LM_STUDIO_TRIMMED_PROMPT" "$LM_STUDIO_TRIM_META"
  LM_STUDIO_EXIT=$?
  if [ $LM_STUDIO_EXIT -ne 0 ]; then
    if [ $LM_STUDIO_EXIT -eq 2 ] || [ $LM_STUDIO_EXIT -eq 11 ]; then
      echo "WARNING: prompt budget for lm_studio (${LM_STUDIO_REVIEWER_BUDGET} tokens) is too small for the minimum review set. Skipping LM Studio reviewer." >&2
    else
      echo "WARNING: prompt-budget returned unexpected exit code ${LM_STUDIO_EXIT} for lm_studio. Skipping LM Studio reviewer." >&2
    fi
    LM_STUDIO_SKIP=1
  else
    LM_STUDIO_PROMPT_FILE="$LM_STUDIO_TRIMMED_PROMPT"
  fi
fi

if [ "$LM_STUDIO_SKIP" != "1" ]; then
LM_STUDIO_HOST=$(gsd-sdk query config-get review.lm_studio_host 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LM_STUDIO_HOST" ] || [ "$LM_STUDIO_HOST" = "null" ]; then LM_STUDIO_HOST="http://localhost:1234"; fi
LM_STUDIO_MODEL=$(gsd-sdk query config-get review.models.lm_studio 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LM_STUDIO_MODEL" ] || [ "$LM_STUDIO_MODEL" = "null" ]; then
  LM_STUDIO_MODEL=$(curl -s --max-time 2 "${LM_STUDIO_HOST}/v1/models" 2>/dev/null | jq -r '.data[0].id // "local-model"' 2>/dev/null || echo "local-model")
fi
LM_STUDIO_RESPONSE=$(jq -n --rawfile content "$LM_STUDIO_PROMPT_FILE" \
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
fi
```

**llama.cpp (local, OpenAI-compatible):**
```bash
# Resolve prompt budget for llama.cpp: per-reviewer override > global default > null
LLAMA_CPP_REVIEWER_BUDGET=$(gsd-sdk query config-get review.max_prompt_tokens_per_reviewer.llama_cpp 2>/dev/null | jq -r '.' 2>/dev/null || echo "null")
if [ -z "$LLAMA_CPP_REVIEWER_BUDGET" ] || [ "$LLAMA_CPP_REVIEWER_BUDGET" = "null" ]; then
  LLAMA_CPP_REVIEWER_BUDGET=$(gsd-sdk query config-get review.max_prompt_tokens 2>/dev/null | jq -r '.' 2>/dev/null || echo "null")
fi

# Apply budget trim for llama.cpp if a budget is configured
LLAMA_CPP_PROMPT_FILE="/tmp/gsd-review-prompt-{phase}.md"
LLAMA_CPP_SKIP=0
if [ -n "$LLAMA_CPP_REVIEWER_BUDGET" ] && [ "$LLAMA_CPP_REVIEWER_BUDGET" != "null" ] && [ "$LLAMA_CPP_REVIEWER_BUDGET" != "0" ]; then
  LLAMA_CPP_TRIMMED_PROMPT="/tmp/gsd-review-prompt-{phase}-llama_cpp.md"
  LLAMA_CPP_TRIM_META="/tmp/gsd-review-prompt-{phase}-llama_cpp.metadata.json"
  prepare_trimmed_prompt_for_reviewer "llama_cpp" "$LLAMA_CPP_REVIEWER_BUDGET" "$LLAMA_CPP_TRIMMED_PROMPT" "$LLAMA_CPP_TRIM_META"
  LLAMA_CPP_EXIT=$?
  if [ $LLAMA_CPP_EXIT -ne 0 ]; then
    if [ $LLAMA_CPP_EXIT -eq 2 ] || [ $LLAMA_CPP_EXIT -eq 11 ]; then
      echo "WARNING: prompt budget for llama_cpp (${LLAMA_CPP_REVIEWER_BUDGET} tokens) is too small for the minimum review set. Skipping llama.cpp reviewer." >&2
    else
      echo "WARNING: prompt-budget returned unexpected exit code ${LLAMA_CPP_EXIT} for llama_cpp. Skipping llama.cpp reviewer." >&2
    fi
    LLAMA_CPP_SKIP=1
  else
    LLAMA_CPP_PROMPT_FILE="$LLAMA_CPP_TRIMMED_PROMPT"
  fi
fi

if [ "$LLAMA_CPP_SKIP" != "1" ]; then
LLAMA_CPP_HOST=$(gsd-sdk query config-get review.llama_cpp_host 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LLAMA_CPP_HOST" ] || [ "$LLAMA_CPP_HOST" = "null" ]; then LLAMA_CPP_HOST="http://localhost:8080"; fi
LLAMA_CPP_MODEL=$(gsd-sdk query config-get review.models.llama_cpp 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
if [ -z "$LLAMA_CPP_MODEL" ] || [ "$LLAMA_CPP_MODEL" = "null" ]; then
  LLAMA_CPP_MODEL=$(curl -s --max-time 2 "${LLAMA_CPP_HOST}/v1/models" 2>/dev/null | jq -r '.data[0].id // "local-model"' 2>/dev/null || echo "local-model")
fi
LLAMA_CPP_CONTENT=$(jq -n --rawfile content "$LLAMA_CPP_PROMPT_FILE" \
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

After all reviewers complete, collect trim metadata files written during the run. For each reviewer that was trimmed (i.e. a `.metadata.json` file exists and `hardFailed` or `omitted` is non-empty, or `projectMdShrunk` is true, or `planTruncationPct > 0`), include a `trimmed_reviewers` block in the frontmatter. Omit the key entirely if no reviewer was trimmed.

```markdown
---
phase: {N}
reviewers: [gemini, claude, codex, coderabbit, opencode, qwen, cursor, ollama, lm_studio, llama_cpp]  # populate at runtime with only the reviewers actually invoked
reviewed_at: {ISO timestamp}
plans_reviewed: [{list of PLAN.md files}]
trimmed_reviewers:        # only present if at least one reviewer was trimmed
  ollama:
    budget: 6000
    effective_budget: 5400
    estimated_tokens: 5380
    omitted: [context, research]
    project_md_shrunk: true
    plan_truncation_pct: 22
    hard_failed: false
    note_injected: true
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
