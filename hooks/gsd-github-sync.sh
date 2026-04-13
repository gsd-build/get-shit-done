#!/usr/bin/env bash
# gsd-github-sync.sh — PostToolUse hook. Reacts to GSD skill invocations and
# mirrors the corresponding state change to GitHub Issues/Milestones.
#
# Configured in the project's .claude/settings.json:
#   {
#     "hooks": {
#       "PostToolUse": [
#         {
#           "matcher": "Skill",
#           "hooks": [
#             { "type": "command", "command": "hooks/gsd-github-sync.sh", "timeout": 20 }
#           ]
#         }
#       ]
#     }
#   }
#
# Sync is opt-in via .planning/config.json#github_sync.enabled (default false).
# Never blocks the GSD action — preflight failures degrade gracefully and log
# to .planning/.github-sync.log.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/gsd-github-sync.lib.sh
source "${SCRIPT_DIR}/lib/gsd-github-sync.lib.sh"

EVENT_JSON="$(cat)"
[[ -z "${EVENT_JSON}" ]] && exit 0

# Parse tool name + skill name via Node.js (no jq dependency, matching
# the pattern used by hooks/gsd-phase-boundary.sh).
parse_event() {
  echo "$EVENT_JSON" | node -e "
    let d = '';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      try {
        const e = JSON.parse(d);
        const tool = e.tool_name || '';
        const skill = e.tool_input?.skill || '';
        const args = e.tool_input?.args || '';
        process.stdout.write(\`\${tool}\\t\${skill}\\t\${args}\`);
      } catch {}
    });
  " 2>/dev/null
}

PARSED="$(parse_event)"
TOOL_NAME="$(echo "$PARSED" | cut -f1)"
SKILL_NAME="$(echo "$PARSED" | cut -f2)"
SKILL_ARGS="$(echo "$PARSED" | cut -f3)"

[[ "${TOOL_NAME}" != "Skill" || -z "${SKILL_NAME}" ]] && exit 0

# Strip namespace prefix (e.g. "plugin:gsd-ship" -> "gsd-ship")
SKILL_BASE="${SKILL_NAME##*:}"

case "${SKILL_BASE}" in
  gsd-ship|gsd-add-phase|gsd-insert-phase|gsd-execute-phase|gsd-new-milestone|gsd-complete-milestone|gsd-remove-phase) ;;
  *) exit 0 ;;
esac

gsd_sync_config_enabled || exit 0

gsd_sync_log info "hook fired: skill=${SKILL_BASE} args=${SKILL_ARGS}"

# Best-effort phase id extraction from args
PHASE_ID="$(echo "${SKILL_ARGS}" | grep -oE '^[0-9]+(\.[0-9]+)*' | head -n1 || echo "")"

case "${SKILL_BASE}" in
  gsd-new-milestone)
    MS="$(echo "${SKILL_ARGS}" | awk '{print $1}')"
    [[ -n "${MS}" ]] && gsd_sync_action_create_milestone "${MS}"
    ;;
  gsd-complete-milestone)
    MS="$(echo "${SKILL_ARGS}" | awk '{print $1}')"
    [[ -n "${MS}" ]] && gsd_sync_action_close_milestone "${MS}"
    ;;
  gsd-add-phase|gsd-insert-phase)
    if [[ -n "${PHASE_ID}" ]]; then
      ROOT="$(gsd_sync_planning_root || true)"
      if [[ -n "${ROOT}" ]]; then
        DIR="$(find "${ROOT}/phases" -maxdepth 1 -type d -name "${PHASE_ID}-*" 2>/dev/null | head -n1)"
        if [[ -n "${DIR}" ]]; then
          SLUG="$(basename "${DIR}")"
          NAME="${SLUG#"${PHASE_ID}-"}"
          # Pick the first open milestone in the registry as the active one
          MS="$(gsd_sync_registry_get "milestones" \
            | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const m=JSON.parse(d);for(const[k,v]of Object.entries(m)){if(v?.state==='open'){process.stdout.write(k);return}}}catch{}})" 2>/dev/null)"
          gsd_sync_action_create_phase_issue "${PHASE_ID}" "${NAME}" "${MS}"
        fi
      fi
    fi
    ;;
  gsd-execute-phase)
    [[ -n "${PHASE_ID}" ]] && gsd_sync_action_transition_phase "${PHASE_ID}" "in-progress"
    ;;
  gsd-ship)
    [[ -n "${PHASE_ID}" ]] && gsd_sync_action_transition_phase "${PHASE_ID}" "shipped"
    ;;
  gsd-remove-phase)
    [[ -n "${PHASE_ID}" ]] && gsd_sync_action_close_phase_issue "${PHASE_ID}" "not_planned"
    ;;
esac

exit 0
