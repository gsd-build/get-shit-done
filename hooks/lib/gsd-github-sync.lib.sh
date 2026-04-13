#!/usr/bin/env bash
# gsd-github-sync.lib.sh — shared helpers for the GSD↔GitHub sync feature.
#
# Used by:
#   - hooks/gsd-github-sync.sh                 (PostToolUse hook)
#   - get-shit-done/bin/sync-github-impl.sh    (slash command implementation)
#
# Sync is project-local opt-in via .planning/config.json#github_sync.enabled.
# Never blocks the GSD action — preflight failures degrade gracefully.
#
# Uses Node.js for JSON parsing/writing (no jq dependency, matching the
# existing pattern in hooks/gsd-phase-boundary.sh).
#
# Public env vars:
#   GSD_SYNC_DRYRUN=1   — convert every gh write into an echo
#   GSD_SYNC_VERBOSE=1   — print debug traces on stderr
#   GSD_SYNC_SANDBOX=1   — read .planning/config.local.json instead of config.json

set -u

# ---------------------------------------------------------------------------
# Path discovery
# ---------------------------------------------------------------------------

gsd_sync_planning_root() {
  local d="${PWD}"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/.planning" ]]; then
      printf '%s/.planning' "$d"
      return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

gsd_sync_config_path() {
  local root
  root="$(gsd_sync_planning_root)" || return 1
  local main="$root/config.json" local_override="$root/config.local.json"
  if [[ -n "${GSD_SYNC_SANDBOX:-}" && -f "$local_override" ]]; then
    printf '%s' "$local_override"; return 0
  fi
  printf '%s' "$main"
}

gsd_sync_registry_path() {
  local root
  root="$(gsd_sync_planning_root)" || return 1
  printf '%s/.github-sync.json' "$root"
}

gsd_sync_log_path() {
  local root
  root="$(gsd_sync_planning_root)" || return 1
  printf '%s/.github-sync.log' "$root"
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

gsd_sync_log() {
  local level="${1:-info}" msg="${2:-}" path
  path="$(gsd_sync_log_path)" || return 0
  local ts; ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '%s [%s] %s\n' "$ts" "$level" "$msg" >> "$path"
  if [[ -n "${GSD_SYNC_VERBOSE:-}" ]]; then
    printf '[gsd-sync] %s: %s\n' "$level" "$msg" >&2
  fi
}

# ---------------------------------------------------------------------------
# Config (Node.js-based JSON, no jq dependency)
# ---------------------------------------------------------------------------

gsd_sync_config_enabled() {
  local cfg; cfg="$(gsd_sync_config_path)" || return 1
  [[ -f "$cfg" ]] || return 1
  local enabled
  enabled="$(node -e "try{const c=require('$cfg');process.stdout.write(String(c.github_sync?.enabled===true))}catch{process.stdout.write('false')}" 2>/dev/null)"
  [[ "$enabled" == "true" ]]
}

gsd_sync_config_repo() {
  local cfg; cfg="$(gsd_sync_config_path)" || return 1
  node -e "try{const c=require('$cfg');process.stdout.write(c.github_sync?.repo||'')}catch{}" 2>/dev/null
}

gsd_sync_config_value() {
  # Args: <path-segments...> [<default>]
  # Path segments are dot-free; e.g. "github_sync label_prefix gsd"
  local cfg; cfg="$(gsd_sync_config_path)" || { echo "${@: -1}"; return 0; }
  local default="${@: -1}"
  local segments=("${@:1:$#-1}")
  local jspath="c"
  for s in "${segments[@]}"; do jspath="${jspath}?.['${s}']"; done
  local v
  v="$(node -e "try{const c=require('$cfg');const v=${jspath};process.stdout.write(v==null?'':String(v))}catch{}" 2>/dev/null)"
  [[ -z "$v" ]] && echo "$default" || echo "$v"
}

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------

gsd_sync_preflight() {
  if ! gsd_sync_config_enabled; then
    gsd_sync_log debug "skipped: github_sync.enabled=false"; return 1
  fi
  local repo; repo="$(gsd_sync_config_repo)"
  if [[ -z "$repo" ]]; then
    gsd_sync_log warn "skipped: github_sync.repo is empty"; return 1
  fi
  if ! command -v gh >/dev/null 2>&1; then
    gsd_sync_log warn "skipped: gh CLI not found"; return 1
  fi
  if ! timeout 3 gh auth status >/dev/null 2>&1; then
    gsd_sync_log warn "skipped: gh auth status failed"; return 1
  fi
  local issues_enabled
  issues_enabled="$(timeout 3 gh repo view "$repo" --json hasIssuesEnabled --jq '.hasIssuesEnabled' 2>/dev/null || echo "")"
  if [[ "$issues_enabled" != "true" ]]; then
    gsd_sync_log warn "skipped: $repo has issues disabled (got: '$issues_enabled')"; return 1
  fi
  local remaining
  remaining="$(timeout 3 gh api rate_limit --jq '.resources.core.remaining' 2>/dev/null || echo 0)"
  if [[ "$remaining" -lt 10 ]]; then
    gsd_sync_log warn "skipped: rate limit too low ($remaining)"; return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# gh wrapper (respects GSD_SYNC_DRYRUN)
# ---------------------------------------------------------------------------

gsd_sync_gh() {
  if [[ -n "${GSD_SYNC_DRYRUN:-}" ]]; then
    printf '[gsd-sync:dryrun] gh %s\n' "$*" >&2
    gsd_sync_log dryrun "gh $*"
    return 0
  fi
  gsd_sync_log info "gh $*"
  gh "$@"
}

# ---------------------------------------------------------------------------
# Registry (.planning/.github-sync.json)
# ---------------------------------------------------------------------------

gsd_sync_registry_init() {
  local reg; reg="$(gsd_sync_registry_path)" || return 1
  [[ -f "$reg" ]] && return 0
  local repo; repo="$(gsd_sync_config_repo)"
  cat > "$reg" <<EOF
{
  "repo": "${repo}",
  "milestones": {},
  "phases": {}
}
EOF
  gsd_sync_log info "registry created at $reg"
}

gsd_sync_registry_get() {
  # Args: <dot-path>   (e.g. "phases.22.4.issue" — but dots in keys must be quoted)
  # Returns the value as a string. For nested objects, returns JSON-stringified.
  local path="${1:-}"
  local reg; reg="$(gsd_sync_registry_path)" || return 1
  [[ ! -f "$reg" ]] && { echo ""; return 0; }
  node -e "
    try {
      const r = require('$reg');
      const segs = ${path@Q}.split('.').filter(Boolean);
      let v = r;
      for (const s of segs) { if (v == null) break; v = v[s]; }
      if (v == null) { process.stdout.write(''); }
      else if (typeof v === 'object') { process.stdout.write(JSON.stringify(v)); }
      else { process.stdout.write(String(v)); }
    } catch { process.stdout.write(''); }
  " 2>/dev/null
}

gsd_sync_registry_set() {
  # Args: <dot-path> <json-value>
  # Supports nested keys; creates parent objects as needed.
  local path="${1:?dot path required}" value="${2:?json value required}"
  local reg; reg="$(gsd_sync_registry_path)" || return 1
  gsd_sync_registry_init
  node -e "
    const fs = require('fs');
    const file = '$reg';
    const r = JSON.parse(fs.readFileSync(file, 'utf8'));
    const segs = ${path@Q}.split('.').filter(Boolean);
    let cur = r;
    for (let i = 0; i < segs.length - 1; i++) {
      if (cur[segs[i]] == null || typeof cur[segs[i]] !== 'object') cur[segs[i]] = {};
      cur = cur[segs[i]];
    }
    cur[segs[segs.length - 1]] = JSON.parse(${value@Q});
    fs.writeFileSync(file, JSON.stringify(r, null, 2) + '\n');
  " 2>/dev/null
  gsd_sync_log info "registry set: ${path} = ${value}"
}

# ---------------------------------------------------------------------------
# Label management
# ---------------------------------------------------------------------------

gsd_sync_ensure_labels() {
  # Idempotently create the standard label set. Pass milestone title to also
  # ensure the milestone-specific label.
  local milestone="${1:-}"
  local repo; repo="$(gsd_sync_config_repo)" || return 1
  local prefix; prefix="$(gsd_sync_config_value github_sync label_prefix gsd)"
  local -a labels=(
    "${prefix}:phase|6b7280|GSD phase mirrored from .planning/"
    "${prefix}:status:planned|3b82f6|GSD phase: planned"
    "${prefix}:status:in-progress|eab308|GSD phase: in-progress"
    "${prefix}:status:blocked|ef4444|GSD phase: blocked"
  )
  [[ -n "$milestone" ]] && labels+=("${prefix}:milestone:${milestone}|8b5cf6|GSD milestone: ${milestone}")
  local spec name color desc
  for spec in "${labels[@]}"; do
    IFS='|' read -r name color desc <<< "$spec"
    gsd_sync_gh label create "$name" --repo "$repo" --color "$color" --description "$desc" --force >/dev/null 2>&1 || true
  done
  gsd_sync_log info "labels ensured for milestone=${milestone:-<none>}"
}

# ---------------------------------------------------------------------------
# Actions — invoked by hook + slash command
# ---------------------------------------------------------------------------

gsd_sync_action_create_milestone() {
  local title="${1:-}"
  [[ -z "$title" ]] && { gsd_sync_log warn "create_milestone: empty title"; return 0; }
  gsd_sync_preflight || return 0
  local repo; repo="$(gsd_sync_config_repo)"
  local number
  number="$(gsd_sync_gh api "repos/${repo}/milestones" -f "title=${title}" --jq '.number' 2>/dev/null || echo "")"
  if [[ -n "$number" && "$number" != "null" ]]; then
    gsd_sync_registry_set "milestones.${title}" "{\"number\": ${number}, \"state\": \"open\"}"
  fi
  gsd_sync_ensure_labels "$title"
}

gsd_sync_action_close_milestone() {
  local title="${1:-}"
  [[ -z "$title" ]] && return 0
  gsd_sync_preflight || return 0
  local repo; repo="$(gsd_sync_config_repo)"
  local number; number="$(gsd_sync_registry_get "milestones.${title}.number")"
  [[ -z "$number" ]] && { gsd_sync_log warn "close_milestone: '$title' not in registry"; return 0; }
  gsd_sync_gh api -X PATCH "repos/${repo}/milestones/${number}" -f state=closed >/dev/null 2>&1 || true
  gsd_sync_registry_set "milestones.${title}.state" '"closed"'
}

gsd_sync_action_create_phase_issue() {
  local phase="${1:-}" name="${2:-}" milestone="${3:-}"
  [[ -z "$phase" || -z "$name" ]] && return 0
  gsd_sync_preflight || return 0
  local repo; repo="$(gsd_sync_config_repo)"
  local prefix; prefix="$(gsd_sync_config_value github_sync label_prefix gsd)"
  local title="Phase ${phase}: ${name}"
  local labels="${prefix}:phase,${prefix}:status:planned"
  [[ -n "$milestone" ]] && labels="${labels},${prefix}:milestone:${milestone}"
  local body; body="$(mktemp)"
  cat > "$body" <<EOF
<!-- gsd:managed - auto-generated; manual edits above this marker are overwritten on next sync -->

**Phase ${phase}** mirrored from \`.planning/phases/${phase}-.../\`.

Source of truth lives in the phase directory under \`.planning/\`. This issue is a read-only reflection of phase state, maintained automatically by the GSD↔GitHub sync.

See the phase's \`CONTEXT.md\` and \`PLAN\` files in the repo for details.

<!-- /gsd:managed -->
EOF
  local extra=()
  [[ -n "$milestone" ]] && extra+=("--milestone" "$milestone")
  local url
  url="$(gsd_sync_gh issue create --repo "$repo" --title "$title" --label "$labels" --body-file "$body" "${extra[@]}" 2>/dev/null || echo "")"
  rm -f "$body"
  local number; number="$(echo "$url" | grep -oE '[0-9]+$')"
  if [[ -n "$number" ]]; then
    gsd_sync_registry_set "phases.${phase}" "{\"issue\": ${number}, \"milestone\": \"${milestone}\", \"state\": \"planned\"}"
  fi
}

gsd_sync_action_transition_phase() {
  local phase="${1:-}" status="${2:-}"
  [[ -z "$phase" || -z "$status" ]] && return 0
  gsd_sync_preflight || return 0
  local repo; repo="$(gsd_sync_config_repo)"
  local prefix; prefix="$(gsd_sync_config_value github_sync label_prefix gsd)"
  local issue; issue="$(gsd_sync_registry_get "phases.${phase}.issue")"
  [[ -z "$issue" ]] && { gsd_sync_log debug "transition_phase: ${phase} not in registry"; return 0; }
  if [[ "$status" == "shipped" ]]; then
    gsd_sync_gh issue close "$issue" --repo "$repo" --reason completed >/dev/null 2>&1 || true
  else
    gsd_sync_gh issue edit "$issue" --repo "$repo" \
      --remove-label "${prefix}:status:planned" \
      --remove-label "${prefix}:status:in-progress" \
      --remove-label "${prefix}:status:blocked" \
      --add-label "${prefix}:status:${status}" >/dev/null 2>&1 || true
  fi
  gsd_sync_registry_set "phases.${phase}.state" "\"${status}\""
}

gsd_sync_action_close_phase_issue() {
  local phase="${1:-}" reason="${2:-not_planned}"
  [[ -z "$phase" ]] && return 0
  gsd_sync_preflight || return 0
  local repo; repo="$(gsd_sync_config_repo)"
  local issue; issue="$(gsd_sync_registry_get "phases.${phase}.issue")"
  [[ -z "$issue" ]] && return 0
  gsd_sync_gh issue close "$issue" --repo "$repo" --reason "$reason" >/dev/null 2>&1 || true
  gsd_sync_registry_set "phases.${phase}.state" '"closed"'
}
