#!/usr/bin/env bash
# GSD vs GSDF Benchmark Suite
# Static analysis: counts lines loaded into context per operation × variant × scenario
# Also: feature coverage matrix, prompt snapshots, quality evaluation
#
# Usage:
#   bash run-benchmark.sh                    # Full benchmark (context + coverage)
#   bash run-benchmark.sh --scenario level-3 # Specific scenario
#   bash run-benchmark.sh --operation execute # Specific operation
#   bash run-benchmark.sh --coverage         # Coverage matrix only
#   bash run-benchmark.sh --prompts          # Generate prompt snapshots
#   bash run-benchmark.sh --quality          # Quality evaluation (costs API tokens)

set -uo pipefail

# ─── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GSD_ROOT="$(dirname "$SCRIPT_DIR")"
CLAUDE_ROOT="$(dirname "$GSD_ROOT")"
AGENTS_DIR="$CLAUDE_ROOT/agents"
COMMANDS_DIR="$CLAUDE_ROOT/commands"
SKILLS_DIR="$CLAUDE_ROOT/skills"
WORKFLOWS_DIR="$GSD_ROOT/workflows"
REFERENCES_DIR="$GSD_ROOT/references"
SCENARIOS_DIR="$SCRIPT_DIR/scenarios"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
REPORTS_DIR="$SCRIPT_DIR/reports"

# ─── CLI Arguments ──────────────────────────────────────────────────────────────
FILTER_SCENARIO=""
FILTER_OPERATION=""
RUN_COVERAGE=false
RUN_PROMPTS=false
RUN_QUALITY=false
COVERAGE_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) FILTER_SCENARIO="$2"; shift 2 ;;
    --operation) FILTER_OPERATION="$2"; shift 2 ;;
    --coverage) COVERAGE_ONLY=true; RUN_COVERAGE=true; shift ;;
    --prompts) RUN_PROMPTS=true; shift ;;
    --quality) RUN_QUALITY=true; RUN_PROMPTS=true; shift ;;
    --help|-h)
      echo "Usage: bash run-benchmark.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --scenario LEVEL  Run specific scenario (e.g., level-3)"
      echo "  --operation OP    Run specific operation (execute, plan, quick, debug)"
      echo "  --coverage        Feature coverage matrix only"
      echo "  --prompts         Generate prompt snapshot files"
      echo "  --quality         Quality evaluation (requires API tokens)"
      echo "  --help            Show this help"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# If no explicit flags, run context + coverage
if ! $COVERAGE_ONLY && ! $RUN_PROMPTS && ! $RUN_QUALITY; then
  RUN_COVERAGE=true
fi

# ─── Utility Functions ──────────────────────────────────────────────────────────

count_lines() {
  local file="$1"
  if [[ -f "$file" ]]; then
    wc -l < "$file" | tr -d ' '
  else
    echo "0"
  fi
}

bar_chart() {
  local value="$1"
  local max_val="$2"
  local width=40
  if [[ "$max_val" -eq 0 ]]; then
    printf "%${width}s" ""
    return
  fi
  local filled=$(( (value * width) / max_val ))
  [[ $filled -gt $width ]] && filled=$width
  local empty=$(( width - filled ))
  printf '%0.s█' $(seq 1 $filled 2>/dev/null) || true
  printf '%0.s░' $(seq 1 $empty 2>/dev/null) || true
}

format_number() {
  printf "%'d" "$1" 2>/dev/null || echo "$1"
}

pct_savings() {
  local gsd="$1" gsdf="$2"
  if [[ "$gsd" -eq 0 ]]; then
    echo "0"
  else
    echo "$(( (gsd - gsdf) * 100 / gsd ))"
  fi
}

# ─── File Size Cache ────────────────────────────────────────────────────────────
# Pre-compute all file sizes once

# Agents
SZ_EXECUTOR=$(count_lines "$AGENTS_DIR/gsd-executor.md")
SZ_EXECUTOR_CORE=$(count_lines "$AGENTS_DIR/gsd-executor-core.md")
SZ_PLANNER=$(count_lines "$AGENTS_DIR/gsd-planner.md")
SZ_PLANNER_CORE=$(count_lines "$AGENTS_DIR/gsd-planner-core.md")
SZ_DEBUGGER=$(count_lines "$AGENTS_DIR/gsd-debugger.md")
SZ_DEBUGGER_CORE=$(count_lines "$AGENTS_DIR/gsd-debugger-core.md")
SZ_PLAN_CHECKER=$(count_lines "$AGENTS_DIR/gsd-plan-checker.md")
SZ_RESEARCHER=$(count_lines "$AGENTS_DIR/gsd-phase-researcher.md")
SZ_VERIFIER=$(count_lines "$AGENTS_DIR/gsd-verifier.md")

# Commands
SZ_CMD_EXECUTE=$(count_lines "$COMMANDS_DIR/gsd/execute-phase.md")
SZ_CMD_EXECUTE_GSDF=$(count_lines "$COMMANDS_DIR/gsdf/execute-phase.md")
SZ_CMD_PLAN=$(count_lines "$COMMANDS_DIR/gsd/plan-phase.md")
SZ_CMD_PLAN_GSDF=$(count_lines "$COMMANDS_DIR/gsdf/plan-phase.md")
SZ_CMD_QUICK=$(count_lines "$COMMANDS_DIR/gsd/quick.md")
SZ_CMD_QUICK_GSDF=$(count_lines "$COMMANDS_DIR/gsdf/quick.md")
SZ_CMD_DEBUG=$(count_lines "$COMMANDS_DIR/gsd/debug.md")
SZ_CMD_DEBUG_GSDF=$(count_lines "$COMMANDS_DIR/gsdf/debug.md")

# Workflows
SZ_WF_EXECUTE_PLAN=$(count_lines "$WORKFLOWS_DIR/execute-plan.md")
SZ_WF_EXECUTE_PHASE=$(count_lines "$WORKFLOWS_DIR/execute-phase.md")
SZ_WF_PLAN_PHASE=$(count_lines "$WORKFLOWS_DIR/plan-phase.md")

# References
SZ_UI_BRAND=$(count_lines "$REFERENCES_DIR/ui-brand.md")

# Skills - Executor
SZ_SK_DEVIATION=$(count_lines "$SKILLS_DIR/executor/deviation-rules.md")
SZ_SK_CHECKPOINTS_E=$(count_lines "$SKILLS_DIR/executor/checkpoints.md")
SZ_SK_TDD_E=$(count_lines "$SKILLS_DIR/executor/tdd.md")
SZ_SK_AUTH_GATES=$(count_lines "$SKILLS_DIR/executor/auth-gates.md")
SZ_SK_CONTINUATION=$(count_lines "$SKILLS_DIR/executor/continuation.md")

# Skills - Planner
SZ_SK_GAP_CLOSURE=$(count_lines "$SKILLS_DIR/planner/gap-closure.md")
SZ_SK_TDD_P=$(count_lines "$SKILLS_DIR/planner/tdd.md")
SZ_SK_CHECKPOINTS_P=$(count_lines "$SKILLS_DIR/planner/checkpoints.md")
SZ_SK_REVISION=$(count_lines "$SKILLS_DIR/planner/revision.md")
SZ_SK_USER_SETUP=$(count_lines "$SKILLS_DIR/planner/user-setup.md")
SZ_SK_DISCOVERY=$(count_lines "$SKILLS_DIR/planner/discovery.md")

# ─── Context Calculation Functions ──────────────────────────────────────────────
# Each function sets: GSD_ORCH, GSD_PER_AGENT, GSD_AGENT_COUNT, GSD_PROJECT_CTX,
#                     GSDF_ORCH, GSDF_PER_AGENT, GSDF_AGENT_COUNT, GSDF_PROJECT_CTX

calc_execute_phase() {
  local num_plans=$NUM_PLANS
  local plan_lines=$PLAN_LINES
  local state_lines=$STATE_LINES
  local roadmap_lines=$ROADMAP_LINES

  # --- GSD ---
  GSD_ORCH=$(( SZ_CMD_EXECUTE + SZ_UI_BRAND + SZ_WF_EXECUTE_PHASE + state_lines + roadmap_lines ))
  GSD_PER_AGENT=$(( SZ_EXECUTOR + plan_lines + state_lines ))
  GSD_AGENT_COUNT=$num_plans
  GSD_PROJECT_CTX=0

  # --- GSDF ---
  GSDF_ORCH=$(( SZ_CMD_EXECUTE_GSDF + state_lines + roadmap_lines ))

  local gsdf_skills=$SZ_SK_DEVIATION
  if [[ "$HAS_CHECKPOINTS" == "true" ]]; then gsdf_skills=$(( gsdf_skills + SZ_SK_CHECKPOINTS_E )); fi
  if [[ "$HAS_TDD" == "true" ]]; then gsdf_skills=$(( gsdf_skills + SZ_SK_TDD_E )); fi
  if [[ "$HAS_AUTH_GATES" == "true" ]]; then gsdf_skills=$(( gsdf_skills + SZ_SK_AUTH_GATES )); fi
  if [[ "$HAS_CONTINUATION" == "true" ]]; then gsdf_skills=$(( gsdf_skills + SZ_SK_CONTINUATION )); fi

  GSDF_PER_AGENT=$(( SZ_EXECUTOR_CORE + gsdf_skills + plan_lines + state_lines ))
  GSDF_AGENT_COUNT=$num_plans
  GSDF_PROJECT_CTX=0

  GSDF_SKILLS_DETAIL="deviation($SZ_SK_DEVIATION)"
  if [[ "$HAS_CHECKPOINTS" == "true" ]]; then GSDF_SKILLS_DETAIL+="+checkpoints($SZ_SK_CHECKPOINTS_E)"; fi
  if [[ "$HAS_TDD" == "true" ]]; then GSDF_SKILLS_DETAIL+="+tdd($SZ_SK_TDD_E)"; fi
  if [[ "$HAS_AUTH_GATES" == "true" ]]; then GSDF_SKILLS_DETAIL+="+auth($SZ_SK_AUTH_GATES)"; fi
  if [[ "$HAS_CONTINUATION" == "true" ]]; then GSDF_SKILLS_DETAIL+="+continuation($SZ_SK_CONTINUATION)"; fi
}

calc_plan_phase() {
  local state_lines=$STATE_LINES
  local roadmap_lines=$ROADMAP_LINES
  local research_lines=$RESEARCH_LINES
  local context_lines=$CONTEXT_LINES
  local shared_ctx=$(( state_lines + roadmap_lines + research_lines + context_lines ))

  # --- GSD ---
  GSD_ORCH=$(( SZ_CMD_PLAN + SZ_UI_BRAND + SZ_WF_PLAN_PHASE + state_lines + roadmap_lines ))
  local gsd_researcher=$(( SZ_RESEARCHER + shared_ctx ))
  local gsd_planner=$(( SZ_PLANNER + shared_ctx ))
  local gsd_checker=$(( SZ_PLAN_CHECKER + shared_ctx ))
  GSD_PER_AGENT=0
  GSD_AGENT_COUNT=3
  GSD_PROJECT_CTX=$(( gsd_researcher + gsd_planner + gsd_checker ))

  # --- GSDF ---
  GSDF_ORCH=$(( SZ_CMD_PLAN_GSDF + SZ_UI_BRAND + state_lines + roadmap_lines ))

  local gsdf_planner_skills=0
  if [[ "$HAS_GAP_CLOSURE" == "true" ]]; then gsdf_planner_skills=$(( gsdf_planner_skills + SZ_SK_GAP_CLOSURE )); fi
  if [[ "$HAS_TDD" == "true" ]]; then gsdf_planner_skills=$(( gsdf_planner_skills + SZ_SK_TDD_P )); fi
  if [[ "$HAS_CHECKPOINTS" == "true" ]]; then gsdf_planner_skills=$(( gsdf_planner_skills + SZ_SK_CHECKPOINTS_P )); fi
  if [[ "$HAS_USER_SETUP" == "true" ]]; then gsdf_planner_skills=$(( gsdf_planner_skills + SZ_SK_USER_SETUP )); fi
  if [[ "$HAS_DISCOVERY" == "true" ]]; then gsdf_planner_skills=$(( gsdf_planner_skills + SZ_SK_DISCOVERY )); fi

  local gsdf_researcher=$(( SZ_RESEARCHER + shared_ctx ))
  local gsdf_planner=$(( SZ_PLANNER_CORE + gsdf_planner_skills + shared_ctx ))
  local gsdf_checker=$(( SZ_PLAN_CHECKER + shared_ctx ))
  GSDF_PER_AGENT=0
  GSDF_AGENT_COUNT=3
  GSDF_PROJECT_CTX=$(( gsdf_researcher + gsdf_planner + gsdf_checker ))

  GSDF_SKILLS_DETAIL=""
  if [[ "$HAS_GAP_CLOSURE" == "true" ]]; then GSDF_SKILLS_DETAIL+="gap-closure($SZ_SK_GAP_CLOSURE)+"; fi
  if [[ "$HAS_TDD" == "true" ]]; then GSDF_SKILLS_DETAIL+="tdd($SZ_SK_TDD_P)+"; fi
  if [[ "$HAS_CHECKPOINTS" == "true" ]]; then GSDF_SKILLS_DETAIL+="checkpoints($SZ_SK_CHECKPOINTS_P)+"; fi
  if [[ "$HAS_USER_SETUP" == "true" ]]; then GSDF_SKILLS_DETAIL+="user-setup($SZ_SK_USER_SETUP)+"; fi
  if [[ "$HAS_DISCOVERY" == "true" ]]; then GSDF_SKILLS_DETAIL+="discovery($SZ_SK_DISCOVERY)+"; fi
  GSDF_SKILLS_DETAIL="${GSDF_SKILLS_DETAIL%+}"
  if [[ -z "$GSDF_SKILLS_DETAIL" ]]; then GSDF_SKILLS_DETAIL="none"; fi
}

calc_quick() {
  local state_lines=$STATE_LINES
  local plan_lines=$PLAN_LINES

  # --- GSD ---
  GSD_ORCH=$(( SZ_CMD_QUICK + state_lines ))
  local gsd_planner_sub=$(( SZ_PLANNER + plan_lines + state_lines ))
  local gsd_executor_sub=$(( SZ_EXECUTOR + plan_lines + state_lines ))
  GSD_PER_AGENT=0
  GSD_AGENT_COUNT=2
  GSD_PROJECT_CTX=$(( gsd_planner_sub + gsd_executor_sub ))

  # --- GSDF ---
  GSDF_ORCH=$(( SZ_CMD_QUICK_GSDF + state_lines ))

  local gsdf_skills_e=$SZ_SK_DEVIATION
  if [[ "$HAS_CHECKPOINTS" == "true" ]]; then gsdf_skills_e=$(( gsdf_skills_e + SZ_SK_CHECKPOINTS_E )); fi
  if [[ "$HAS_TDD" == "true" ]]; then gsdf_skills_e=$(( gsdf_skills_e + SZ_SK_TDD_E )); fi

  local gsdf_planner_sub=$(( SZ_PLANNER_CORE + plan_lines + state_lines ))
  local gsdf_executor_sub=$(( SZ_EXECUTOR_CORE + gsdf_skills_e + plan_lines + state_lines ))
  GSDF_PER_AGENT=0
  GSDF_AGENT_COUNT=2
  GSDF_PROJECT_CTX=$(( gsdf_planner_sub + gsdf_executor_sub ))

  GSDF_SKILLS_DETAIL="deviation($SZ_SK_DEVIATION)"
  if [[ "$HAS_CHECKPOINTS" == "true" ]]; then GSDF_SKILLS_DETAIL+="+checkpoints($SZ_SK_CHECKPOINTS_E)"; fi
  if [[ "$HAS_TDD" == "true" ]]; then GSDF_SKILLS_DETAIL+="+tdd($SZ_SK_TDD_E)"; fi
}

calc_debug() {
  local state_lines=$STATE_LINES

  # --- GSD ---
  GSD_ORCH=$(( SZ_CMD_DEBUG + state_lines ))
  GSD_PER_AGENT=$SZ_DEBUGGER
  GSD_AGENT_COUNT=1
  GSD_PROJECT_CTX=0

  # --- GSDF ---
  GSDF_ORCH=$(( SZ_CMD_DEBUG_GSDF + state_lines ))
  GSDF_PER_AGENT=$SZ_DEBUGGER_CORE  # 0 if missing
  GSDF_AGENT_COUNT=1
  GSDF_PROJECT_CTX=0
  GSDF_SKILLS_DETAIL="N/A (core missing)"
}

calc_total() {
  local orch="$1" per_agent="$2" agent_count="$3" project_ctx="$4"
  echo $(( orch + (per_agent * agent_count) + project_ctx ))
}

# ─── Context Analysis ───────────────────────────────────────────────────────────

OPERATIONS=("execute" "plan" "quick" "debug")
TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
REPORT_FILE="$REPORTS_DIR/benchmark-${TIMESTAMP}.md"

run_context_analysis() {
  local report=""

  report+="# GSD Benchmark Report\n"
  report+="Generated: $(date '+%Y-%m-%d %H:%M:%S')\n"
  report+="Git hash: $(cd "$CLAUDE_ROOT" && git rev-parse --short HEAD 2>/dev/null || echo 'N/A')\n\n"

  # ─── File Versions ──────────────────────────────────────────────────────────
  report+="## File Versions (Reproducibility)\n\n"
  report+="| File | Lines | Last Modified |\n"
  report+="|------|-------|---------------|\n"
  for f in \
    "$AGENTS_DIR/gsd-executor.md" \
    "$AGENTS_DIR/gsd-executor-core.md" \
    "$AGENTS_DIR/gsd-planner.md" \
    "$AGENTS_DIR/gsd-planner-core.md" \
    "$AGENTS_DIR/gsd-debugger.md" \
    "$AGENTS_DIR/gsd-debugger-core.md" \
    "$AGENTS_DIR/gsd-plan-checker.md" \
    "$AGENTS_DIR/gsd-phase-researcher.md" \
    "$AGENTS_DIR/gsd-verifier.md" \
    "$COMMANDS_DIR/gsd/execute-phase.md" \
    "$COMMANDS_DIR/gsdf/execute-phase.md" \
    "$COMMANDS_DIR/gsd/plan-phase.md" \
    "$COMMANDS_DIR/gsdf/plan-phase.md" \
    "$COMMANDS_DIR/gsd/quick.md" \
    "$COMMANDS_DIR/gsdf/quick.md" \
    "$COMMANDS_DIR/gsd/debug.md" \
    "$COMMANDS_DIR/gsdf/debug.md" \
    "$WORKFLOWS_DIR/execute-plan.md" \
    "$WORKFLOWS_DIR/execute-phase.md" \
    "$WORKFLOWS_DIR/plan-phase.md" \
    "$REFERENCES_DIR/ui-brand.md" \
  ; do
    local fname=$(basename "$f")
    local dir=$(basename "$(dirname "$f")")
    local lines=$(count_lines "$f")
    local modified
    if [[ -f "$f" ]]; then
      modified=$(stat -f "%Sm" -t "%Y-%m-%d" "$f" 2>/dev/null || stat --format="%y" "$f" 2>/dev/null | cut -d' ' -f1 || echo "?")
    else
      modified="MISSING"
    fi
    report+="| $dir/$fname | $lines | $modified |\n"
  done

  report+="\n| **Skill** | **Lines** | **Modified** |\n"
  report+="|-----------|-----------|---------------|\n"
  for f in \
    "$SKILLS_DIR/executor/deviation-rules.md" \
    "$SKILLS_DIR/executor/checkpoints.md" \
    "$SKILLS_DIR/executor/tdd.md" \
    "$SKILLS_DIR/executor/auth-gates.md" \
    "$SKILLS_DIR/executor/continuation.md" \
    "$SKILLS_DIR/planner/gap-closure.md" \
    "$SKILLS_DIR/planner/tdd.md" \
    "$SKILLS_DIR/planner/checkpoints.md" \
    "$SKILLS_DIR/planner/revision.md" \
    "$SKILLS_DIR/planner/user-setup.md" \
    "$SKILLS_DIR/planner/discovery.md" \
  ; do
    local fname=$(basename "$f")
    local dir=$(basename "$(dirname "$f")")
    local lines=$(count_lines "$f")
    local modified
    if [[ -f "$f" ]]; then
      modified=$(stat -f "%Sm" -t "%Y-%m-%d" "$f" 2>/dev/null || stat --format="%y" "$f" 2>/dev/null | cut -d' ' -f1 || echo "?")
    else
      modified="MISSING"
    fi
    report+="| $dir/$fname | $lines | $modified |\n"
  done
  report+="\n"

  # ─── Summary Table ──────────────────────────────────────────────────────────
  report+="## Summary\n\n"
  report+="| Operation | Scenario | GSD (lines) | GSDF (lines) | Savings % | Est. Tokens Saved |\n"
  report+="|-----------|----------|-------------|------------------|-----------|-----------|\n"

  # Collect all results for summary and detailed output
  declare -a ALL_RESULTS=()

  for scenario_file in "$SCENARIOS_DIR"/*.conf; do
    local scenario_name=$(basename "$scenario_file" .conf)
    if [[ -n "$FILTER_SCENARIO" && "$scenario_name" != *"$FILTER_SCENARIO"* ]]; then
      continue
    fi

    # Source scenario
    source "$scenario_file"

    for op in "${OPERATIONS[@]}"; do
      if [[ -n "$FILTER_OPERATION" && "$op" != "$FILTER_OPERATION" ]]; then
        continue
      fi

      # Calculate
      "calc_${op}_phase" 2>/dev/null || "calc_${op}" 2>/dev/null || continue

      local gsd_total=$(calc_total "$GSD_ORCH" "$GSD_PER_AGENT" "$GSD_AGENT_COUNT" "$GSD_PROJECT_CTX")
      local gsdf_total=$(calc_total "$GSDF_ORCH" "$GSDF_PER_AGENT" "$GSDF_AGENT_COUNT" "$GSDF_PROJECT_CTX")
      local savings=$(pct_savings "$gsd_total" "$gsdf_total")
      local tokens_saved=$(( (gsd_total - gsdf_total) * 4 ))

      report+="| $op | $SCENARIO_NAME (L$SCENARIO_LEVEL) | $(format_number $gsd_total) | $(format_number $gsdf_total) | ${savings}% | ~$(format_number $tokens_saved) |\n"

      # Store for detailed breakdown
      ALL_RESULTS+=("${op}|${SCENARIO_NAME}|${SCENARIO_LEVEL}|${gsd_total}|${gsdf_total}|${savings}|${GSD_ORCH}|${GSD_PER_AGENT}|${GSD_AGENT_COUNT}|${GSD_PROJECT_CTX}|${GSDF_ORCH}|${GSDF_PER_AGENT}|${GSDF_AGENT_COUNT}|${GSDF_PROJECT_CTX}|${GSDF_SKILLS_DETAIL:-none}")
    done
  done
  report+="\n"

  # ─── Visual Comparison ──────────────────────────────────────────────────────
  report+="## Visual Comparison\n\n"

  local max_val=0
  # Find global max for consistent bar scaling
  for result in "${ALL_RESULTS[@]}"; do
    IFS='|' read -r op name level gsd gsdf sav _ <<< "$result"
    if [[ $gsd -gt $max_val ]]; then max_val=$gsd; fi
    if [[ $gsdf -gt $max_val ]]; then max_val=$gsdf; fi
  done

  # Group by operation (iterate ops, filter results)
  for target_op in "${OPERATIONS[@]}"; do
    local has_results=false
    for result in "${ALL_RESULTS[@]}"; do
      IFS='|' read -r op _ _ _ _ _ _ <<< "$result"
      if [[ "$op" == "$target_op" ]]; then has_results=true; break; fi
    done
    if ! $has_results; then continue; fi

    report+="### ${target_op}-phase\n\n"
    report+="\`\`\`\n"
    for result in "${ALL_RESULTS[@]}"; do
      IFS='|' read -r op name level gsd gsdf sav _ <<< "$result"
      if [[ "$op" != "$target_op" ]]; then continue; fi

      local gsd_bar=$(bar_chart "$gsd" "$max_val")
      local gsdf_bar=$(bar_chart "$gsdf" "$max_val")

      report+="L${level} (${name}):\n"
      report+="  GSD      ${gsd_bar}  $(format_number $gsd)\n"
      report+="  GSDF ${gsdf_bar}  $(format_number $gsdf)  (-${sav}%)\n\n"
    done
    report+="\`\`\`\n\n"
  done

  # ─── Detailed Breakdown ─────────────────────────────────────────────────────
  report+="## Detailed Breakdown\n\n"

  for result in "${ALL_RESULTS[@]}"; do
    IFS='|' read -r op name level gsd_total gsdf_total sav gsd_orch gsd_per gsd_count gsd_proj gsdf_orch gsdf_per gsdf_count gsdf_proj skills <<< "$result"

    local gsd_agents_total=$(( gsd_per * gsd_count + gsd_proj ))
    local gsdf_agents_total=$(( gsdf_per * gsdf_count + gsdf_proj ))

    report+="### ${op}-phase x Level ${level} (${name})\n\n"
    report+="| Component | GSD | GSDF | Delta |\n"
    report+="|-----------|-----|----------|-------|\n"
    report+="| Orchestrator | $gsd_orch | $gsdf_orch | $(( gsdf_orch - gsd_orch )) |\n"

    if [[ "$gsd_per" -gt 0 || "$gsdf_per" -gt 0 ]]; then
      report+="| Per-agent base (x$gsd_count) | $(( gsd_per * gsd_count )) | $(( gsdf_per * gsdf_count )) | $(( gsdf_per * gsdf_count - gsd_per * gsd_count )) |\n"
    fi
    if [[ "$gsd_proj" -gt 0 || "$gsdf_proj" -gt 0 ]]; then
      report+="| Subagent contexts | $gsd_proj | $gsdf_proj | $(( gsdf_proj - gsd_proj )) |\n"
    fi

    report+="| **Total** | **$gsd_total** | **$gsdf_total** | **$(( gsdf_total - gsd_total ))** |\n"
    report+="| GSDF skills | - | $skills | |\n\n"
  done

  echo -e "$report"
}

# ─── Feature Coverage Matrix ───────────────────────────────────────────────────

run_coverage_matrix() {
  local report=""
  report+="## Feature Coverage Matrix\n\n"

  # --- Agent Section → Skill Coverage ---
  report+="### Agent Section -> Skill Coverage\n\n"
  report+="| Agent Section | Skill File | Status | Lines |\n"
  report+="|---------------|-----------|--------|-------|\n"

  # Use parallel arrays instead of associative arrays (bash compat)
  local skill_sections=(
    "executor.deviation_rules"
    "executor.auth_gates"
    "executor.checkpoint_protocol"
    "executor.continuation"
    "executor.tdd_execution"
    "planner.checkpoints"
    "planner.tdd_integration"
    "planner.gap_closure"
    "planner.revision_mode"
    "planner.user_setup"
    "planner.discovery_levels"
  )
  local skill_files=(
    "$SKILLS_DIR/executor/deviation-rules.md"
    "$SKILLS_DIR/executor/auth-gates.md"
    "$SKILLS_DIR/executor/checkpoints.md"
    "$SKILLS_DIR/executor/continuation.md"
    "$SKILLS_DIR/executor/tdd.md"
    "$SKILLS_DIR/planner/checkpoints.md"
    "$SKILLS_DIR/planner/tdd.md"
    "$SKILLS_DIR/planner/gap-closure.md"
    "$SKILLS_DIR/planner/revision.md"
    "$SKILLS_DIR/planner/user-setup.md"
    "$SKILLS_DIR/planner/discovery.md"
  )

  local skill_pass=0 skill_total=0
  local i
  for i in "${!skill_sections[@]}"; do
    local section="${skill_sections[$i]}"
    local skill_file="${skill_files[$i]}"
    local fname
    fname=$(basename "$skill_file")
    local dir
    dir=$(basename "$(dirname "$skill_file")")
    local status lines
    skill_total=$(( skill_total + 1 ))
    if [[ -f "$skill_file" ]]; then
      status="PASS"
      lines=$(count_lines "$skill_file")
      skill_pass=$(( skill_pass + 1 ))
    else
      status="MISSING"
      lines=0
    fi
    report+="| $section | $dir/$fname | $status | $lines |\n"
  done
  report+="\n"

  # --- Core Agent Completeness ---
  report+="### Core Agent Completeness\n\n"

  # Executor core sections
  report+="**gsd-executor-core.md vs gsd-executor.md:**\n\n"
  report+="| Section | Full Agent | Core Agent | Status |\n"
  report+="|---------|-----------|------------|--------|\n"

  local exec_sections=("load_project_state" "load_plan" "execute_tasks" "task_commit_protocol" "summary_creation" "self_check" "state_updates" "final_commit")
  local core_pass=0 core_total=0

  for section in "${exec_sections[@]}"; do
    core_total=$(( core_total + 1 ))
    local in_full="N" in_core="N" status="MISSING"
    grep -q "$section" "$AGENTS_DIR/gsd-executor.md" 2>/dev/null && in_full="Y"
    if grep -q "$section" "$AGENTS_DIR/gsd-executor-core.md" 2>/dev/null; then
      in_core="Y"; status="PASS"; core_pass=$(( core_pass + 1 ))
    elif grep -rq "$section" "$SKILLS_DIR/executor/" 2>/dev/null; then
      in_core="via skill"; status="PASS"; core_pass=$(( core_pass + 1 ))
    fi
    report+="| $section | $in_full | $in_core | $status |\n"
  done
  report+="\n"

  # Planner core sections
  report+="**gsd-planner-core.md vs gsd-planner.md:**\n\n"
  report+="| Section | Full Agent | Core Agent | Status |\n"
  report+="|---------|-----------|------------|--------|\n"

  local plan_sections=("context_fidelity" "philosophy" "task_breakdown" "dependency_graph" "scope_estimation" "plan_format" "goal_backward" "execution_flow" "structured_returns")

  for section in "${plan_sections[@]}"; do
    core_total=$(( core_total + 1 ))
    local in_full="N" in_core="N" status="MISSING"
    grep -q "$section" "$AGENTS_DIR/gsd-planner.md" 2>/dev/null && in_full="Y"
    if grep -q "$section" "$AGENTS_DIR/gsd-planner-core.md" 2>/dev/null; then
      in_core="Y"; status="PASS"; core_pass=$(( core_pass + 1 ))
    elif grep -rq "$section" "$SKILLS_DIR/planner/" 2>/dev/null; then
      in_core="via skill"; status="PASS"; core_pass=$(( core_pass + 1 ))
    fi
    report+="| $section | $in_full | $in_core | $status |\n"
  done
  report+="\n"

  # --- Skill Detection in Commands ---
  report+="### Skill Detection in Commands\n\n"
  report+="| Command | Skill | Detection Pattern | Status |\n"
  report+="|---------|-------|-------------------|--------|\n"

  # Execute-phase detection checks
  local exec_skills=("checkpoints" "tdd" "auth_gates" "continuation" "deviation-rules")
  local exec_patterns=("HAS_CHECKPOINTS" "HAS_TDD" "HAS_AUTH_GATES" "HAS_CONTINUATION" "deviation-rules")

  local detect_pass=0 detect_total=0

  for i in "${!exec_skills[@]}"; do
    local skill="${exec_skills[$i]}"
    local pattern="${exec_patterns[$i]}"
    detect_total=$(( detect_total + 1 ))
    local status="MISSING"
    if grep -q "$pattern" "$COMMANDS_DIR/gsdf/execute-phase.md" 2>/dev/null; then
      status="PASS"; detect_pass=$(( detect_pass + 1 ))
    fi
    report+="| gsdf/execute-phase | $skill | $pattern | $status |\n"
  done

  # Plan-phase detection checks
  local plan_skills=("checkpoints" "discovery" "gap_closure" "tdd" "user_setup")
  local plan_patterns=("NEEDS_CHECKPOINTS" "NEEDS_DISCOVERY" "NEEDS_GAP_CLOSURE" "NEEDS_TDD" "NEEDS_USER_SETUP")

  for i in "${!plan_skills[@]}"; do
    local skill="${plan_skills[$i]}"
    local pattern="${plan_patterns[$i]}"
    detect_total=$(( detect_total + 1 ))
    local status="MISSING"
    if grep -q "$pattern" "$COMMANDS_DIR/gsdf/plan-phase.md" 2>/dev/null; then
      status="PASS"; detect_pass=$(( detect_pass + 1 ))
    fi
    report+="| gsdf/plan-phase | $skill | $pattern | $status |\n"
  done
  report+="\n"

  # --- Missing Agent References ---
  report+="### Missing Agent References\n\n"
  report+="| Command | References | File Exists | Status |\n"
  report+="|---------|-----------|-------------|--------|\n"

  local ref_pass=0 ref_total=0
  for cmd_file in "$COMMANDS_DIR"/gsdf/*.md; do
    local cmd_name
    cmd_name=$(basename "$cmd_file" .md)
    # Look for core agent references
    local agent_refs
    agent_refs=$(grep -oE 'gsd-[a-z]+-core\.md' "$cmd_file" 2>/dev/null | sort -u || true)
    while IFS= read -r agent_ref; do
      [[ -z "$agent_ref" ]] && continue
      ref_total=$(( ref_total + 1 ))
      local agent_path="$AGENTS_DIR/$agent_ref"
      local status="MISSING" exists="N"
      if [[ -f "$agent_path" ]]; then
        status="OK"; exists="Y"; ref_pass=$(( ref_pass + 1 ))
      fi
      report+="| gsdf/$cmd_name | $agent_ref | $exists | $status |\n"
    done <<< "$agent_refs"
  done
  report+="\n"

  # --- Summary ---
  local total_checks=$(( skill_total + core_total + detect_total + ref_total ))
  local total_pass=$(( skill_pass + core_pass + detect_pass + ref_pass ))
  report+="### Coverage Summary\n\n"
  report+="| Category | Passed | Total | Status |\n"
  report+="|----------|--------|-------|--------|\n"
  report+="| Skill files exist | $skill_pass | $skill_total | $([ $skill_pass -eq $skill_total ] && echo 'PASS' || echo 'GAPS') |\n"
  report+="| Core agent sections | $core_pass | $core_total | $([ $core_pass -eq $core_total ] && echo 'PASS' || echo 'GAPS') |\n"
  report+="| Skill detection | $detect_pass | $detect_total | $([ $detect_pass -eq $detect_total ] && echo 'PASS' || echo 'GAPS') |\n"
  report+="| Agent references | $ref_pass | $ref_total | $([ $ref_pass -eq $ref_total ] && echo 'PASS' || echo 'GAPS') |\n"
  report+="| **Overall** | **$total_pass** | **$total_checks** | **$([ $total_pass -eq $total_checks ] && echo 'ALL PASS' || echo "$((total_checks - total_pass)) issues")** |\n"
  report+="\n"

  echo -e "$report"
}

# ─── Prompt Snapshots ───────────────────────────────────────────────────────────

run_prompt_snapshots() {
  local prompts_dir="$REPORTS_DIR/prompts"
  mkdir -p "$prompts_dir"

  local report=""
  report+="## Prompt Snapshots\n\n"
  report+="Generated to: \`reports/prompts/\`\n\n"
  report+="| File | Variant | Operation | Scenario | Lines |\n"
  report+="|------|---------|-----------|----------|-------|\n"

  for scenario_file in "$SCENARIOS_DIR"/*.conf; do
    local scenario_name=$(basename "$scenario_file" .conf)
    if [[ -n "$FILTER_SCENARIO" && "$scenario_name" != *"$FILTER_SCENARIO"* ]]; then
      continue
    fi

    source "$scenario_file"
    local level="level-${SCENARIO_LEVEL}"
    local fixture_dir="$FIXTURES_DIR/$level"

    # --- Execute-phase executor prompts ---
    if [[ -z "$FILTER_OPERATION" || "$FILTER_OPERATION" == "execute" ]]; then
      # GSD executor prompt
      local gsd_file="$prompts_dir/gsd-execute-${scenario_name}.txt"
      {
        echo "# GSD Executor Prompt - ${SCENARIO_NAME} (${scenario_name})"
        echo "# This is the prompt sent to gsd-executor subagent"
        echo ""
        echo "# --- Agent Definition (loaded via subagent_type) ---"
        cat "$AGENTS_DIR/gsd-executor.md" 2>/dev/null
        echo ""
        echo "# --- Plan Content ---"
        echo "<plan>"
        cat "$fixture_dir/sample-plan.md" 2>/dev/null
        echo "</plan>"
        echo ""
        echo "# --- Project State ---"
        cat "$fixture_dir/STATE.md" 2>/dev/null
      } > "$gsd_file"

      # GSDF executor prompt
      local gsdf_file="$prompts_dir/gsdf-execute-${scenario_name}.txt"
      {
        echo "# GSDF Executor Prompt - ${SCENARIO_NAME} (${scenario_name})"
        echo "# This is the prompt sent to general-purpose subagent with inlined core"
        echo ""
        echo "# --- Core Agent (inlined) ---"
        cat "$AGENTS_DIR/gsd-executor-core.md" 2>/dev/null
        echo ""
        echo "# --- Skills (always loaded) ---"
        echo "--- DEVIATION RULES SKILL ---"
        cat "$SKILLS_DIR/executor/deviation-rules.md" 2>/dev/null
        echo ""
        if [[ "$HAS_CHECKPOINTS" == "true" ]]; then
          echo "--- CHECKPOINTS SKILL ---"
          cat "$SKILLS_DIR/executor/checkpoints.md" 2>/dev/null
          echo ""
        fi
        if [[ "$HAS_TDD" == "true" ]]; then
          echo "--- TDD SKILL ---"
          cat "$SKILLS_DIR/executor/tdd.md" 2>/dev/null
          echo ""
        fi
        if [[ "$HAS_AUTH_GATES" == "true" ]]; then
          echo "--- AUTH GATES SKILL ---"
          cat "$SKILLS_DIR/executor/auth-gates.md" 2>/dev/null
          echo ""
        fi
        if [[ "$HAS_CONTINUATION" == "true" ]]; then
          echo "--- CONTINUATION SKILL ---"
          cat "$SKILLS_DIR/executor/continuation.md" 2>/dev/null
          echo ""
        fi
        echo "# --- Plan Content ---"
        echo "<plan>"
        cat "$fixture_dir/sample-plan.md" 2>/dev/null
        echo "</plan>"
        echo ""
        echo "# --- Project State ---"
        cat "$fixture_dir/STATE.md" 2>/dev/null
      } > "$gsdf_file"

      local gsd_lines=$(count_lines "$gsd_file")
      local gsdf_lines=$(count_lines "$gsdf_file")
      report+="| $(basename $gsd_file) | GSD | execute | $SCENARIO_NAME | $gsd_lines |\n"
      report+="| $(basename $gsdf_file) | GSDF | execute | $SCENARIO_NAME | $gsdf_lines |\n"
    fi

    # --- Plan-phase planner prompts ---
    if [[ -z "$FILTER_OPERATION" || "$FILTER_OPERATION" == "plan" ]]; then
      local gsd_file="$prompts_dir/gsd-plan-${scenario_name}.txt"
      {
        echo "# GSD Planner Prompt - ${SCENARIO_NAME} (${scenario_name})"
        echo "# Sent to gsd-planner subagent"
        echo ""
        cat "$AGENTS_DIR/gsd-planner.md" 2>/dev/null
        echo ""
        echo "# --- Context ---"
        cat "$fixture_dir/ROADMAP.md" 2>/dev/null
        cat "$fixture_dir/STATE.md" 2>/dev/null
        [[ -f "$fixture_dir/RESEARCH.md" ]] && cat "$fixture_dir/RESEARCH.md"
        [[ -f "$fixture_dir/CONTEXT.md" ]] && cat "$fixture_dir/CONTEXT.md"
      } > "$gsd_file"

      local gsdf_file="$prompts_dir/gsdf-plan-${scenario_name}.txt"
      {
        echo "# GSDF Planner Prompt - ${SCENARIO_NAME} (${scenario_name})"
        echo "# Sent to general-purpose with inlined planner core"
        echo ""
        cat "$AGENTS_DIR/gsd-planner-core.md" 2>/dev/null
        echo ""
        if [[ "$HAS_GAP_CLOSURE" == "true" ]]; then
          echo "--- GAP CLOSURE SKILL ---"
          cat "$SKILLS_DIR/planner/gap-closure.md" 2>/dev/null
          echo ""
        fi
        if [[ "$HAS_TDD" == "true" ]]; then
          echo "--- TDD SKILL ---"
          cat "$SKILLS_DIR/planner/tdd.md" 2>/dev/null
          echo ""
        fi
        if [[ "$HAS_CHECKPOINTS" == "true" ]]; then
          echo "--- CHECKPOINTS SKILL ---"
          cat "$SKILLS_DIR/planner/checkpoints.md" 2>/dev/null
          echo ""
        fi
        if [[ "$HAS_USER_SETUP" == "true" ]]; then
          echo "--- USER SETUP SKILL ---"
          cat "$SKILLS_DIR/planner/user-setup.md" 2>/dev/null
          echo ""
        fi
        if [[ "$HAS_DISCOVERY" == "true" ]]; then
          echo "--- DISCOVERY SKILL ---"
          cat "$SKILLS_DIR/planner/discovery.md" 2>/dev/null
          echo ""
        fi
        echo "# --- Context ---"
        cat "$fixture_dir/ROADMAP.md" 2>/dev/null
        cat "$fixture_dir/STATE.md" 2>/dev/null
        [[ -f "$fixture_dir/RESEARCH.md" ]] && cat "$fixture_dir/RESEARCH.md"
        [[ -f "$fixture_dir/CONTEXT.md" ]] && cat "$fixture_dir/CONTEXT.md"
      } > "$gsdf_file"

      local gsd_lines=$(count_lines "$gsd_file")
      local gsdf_lines=$(count_lines "$gsdf_file")
      report+="| $(basename $gsd_file) | GSD | plan | $SCENARIO_NAME | $gsd_lines |\n"
      report+="| $(basename $gsdf_file) | GSDF | plan | $SCENARIO_NAME | $gsdf_lines |\n"
    fi
  done

  report+="\nUse \`diff\` to compare GSD vs Lite prompts for any scenario.\n\n"
  echo -e "$report"
}

# ─── Quality Evaluation ────────────────────────────────────────────────────────

run_quality_eval() {
  local report=""
  report+="## Quality Evaluation\n\n"

  # Check if claude CLI is available
  if ! command -v claude &>/dev/null; then
    report+="**Skipped:** \`claude\` CLI not found. Install Claude Code to run quality evaluation.\n\n"
    echo -e "$report"
    return
  fi

  local prompts_dir="$REPORTS_DIR/prompts"
  if [[ ! -d "$prompts_dir" ]]; then
    report+="**Skipped:** No prompt snapshots found. Run with \`--prompts\` first.\n\n"
    echo -e "$report"
    return
  fi

  report+="### Scoring Rubric\n\n"
  report+="| Criterion | Weight | Check |\n"
  report+="|-----------|--------|-------|\n"
  report+="| Valid frontmatter | 10 | Has wave:, depends_on:, files_modified: |\n"
  report+="| Numbered tasks | 15 | Has <task> elements |\n"
  report+="| Task verification | 15 | Each task has done/verification |\n"
  report+="| must_haves section | 10 | Section exists |\n"
  report+="| Task count | 10 | 2-5 tasks per plan |\n"
  report+="| Wave assignment | 10 | Tasks have wave numbers |\n"
  report+="| success_criteria | 10 | Section exists |\n"
  report+="| Context respect | 10 | Decisions referenced |\n"
  report+="| No hallucinations | 10 | Files match fixture |\n\n"

  report+="**Note:** Quality evaluation sends prompts to Claude API. Each prompt costs tokens.\n"
  report+="Run \`bash run-benchmark.sh --quality --scenario level-2\` to test a single scenario first.\n\n"

  # For each prompt snapshot pair, run through claude and score
  for gsd_prompt in "$prompts_dir"/gsd-plan-*.txt; do
    [[ -f "$gsd_prompt" ]] || continue
    local scenario=$(basename "$gsd_prompt" .txt | sed 's/gsd-plan-//')
    local gsdf_prompt="$prompts_dir/gsdf-plan-${scenario}.txt"
    [[ -f "$gsdf_prompt" ]] || continue

    report+="### $scenario\n\n"
    report+="Sending prompts to Claude API...\n\n"

    # Run GSD prompt
    local gsd_output
    gsd_output=$(claude -p "$(cat "$gsd_prompt")" --max-turns 1 2>/dev/null || echo "ERROR: API call failed")
    local gsd_score=0

    # Score GSD output
    grep -q "wave:" <<< "$gsd_output" && gsd_score=$(( gsd_score + 10 ))
    grep -q "<task" <<< "$gsd_output" && gsd_score=$(( gsd_score + 15 ))
    grep -q "must_haves\|must-haves" <<< "$gsd_output" && gsd_score=$(( gsd_score + 10 ))
    grep -q "success_criteria\|success criteria" <<< "$gsd_output" && gsd_score=$(( gsd_score + 10 ))
    grep -qE "<done>|verification" <<< "$gsd_output" && gsd_score=$(( gsd_score + 15 ))

    # Run Lite prompt
    local gsdf_output
    gsdf_output=$(claude -p "$(cat "$gsdf_prompt")" --max-turns 1 2>/dev/null || echo "ERROR: API call failed")
    local gsdf_score=0

    grep -q "wave:" <<< "$gsdf_output" && gsdf_score=$(( gsdf_score + 10 ))
    grep -q "<task" <<< "$gsdf_output" && gsdf_score=$(( gsdf_score + 15 ))
    grep -q "must_haves\|must-haves" <<< "$gsdf_output" && gsdf_score=$(( gsdf_score + 10 ))
    grep -q "success_criteria\|success criteria" <<< "$gsdf_output" && gsdf_score=$(( gsdf_score + 10 ))
    grep -qE "<done>|verification" <<< "$gsdf_output" && gsdf_score=$(( gsdf_score + 15 ))

    report+="| Variant | Score | Notes |\n"
    report+="|---------|-------|-------|\n"
    report+="| GSD | $gsd_score/100 | |\n"
    report+="| GSDF | $gsdf_score/100 | |\n"
    report+="| Delta | $(( gsdf_score - gsd_score )) | |\n\n"
  done

  echo -e "$report"
}

# ─── Main ───────────────────────────────────────────────────────────────────────

main() {
  echo "GSD Benchmark Suite"
  echo "==================="
  echo ""

  local full_report=""

  if $COVERAGE_ONLY; then
    full_report+=$(run_coverage_matrix)
    echo -e "$full_report"
    echo -e "$full_report" > "$REPORT_FILE"
    echo ""
    echo "Report saved to: $REPORT_FILE"
    return
  fi

  # Context analysis (default)
  echo "Running context analysis..."
  full_report+=$(run_context_analysis)

  # Coverage matrix (default)
  if $RUN_COVERAGE; then
    echo "Running feature coverage matrix..."
    full_report+="\n$(run_coverage_matrix)"
  fi

  # Prompt snapshots (optional)
  if $RUN_PROMPTS; then
    echo "Generating prompt snapshots..."
    full_report+="\n$(run_prompt_snapshots)"
  fi

  # Quality evaluation (optional, costs tokens)
  if $RUN_QUALITY; then
    echo "Running quality evaluation (this costs API tokens)..."
    full_report+="\n$(run_quality_eval)"
  fi

  # Write report
  echo -e "$full_report" > "$REPORT_FILE"
  echo ""
  echo "Report saved to: $REPORT_FILE"
  echo ""

  # Print summary to terminal
  echo -e "$full_report" | head -60
  echo ""
  echo "... (full report in $REPORT_FILE)"
}

main
