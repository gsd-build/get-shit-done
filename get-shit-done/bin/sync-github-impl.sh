#!/usr/bin/env bash
# sync-github-impl.sh — implementation backing /gsd-sync-github.
#
# Modes: --dry-run (default), --apply, --seed-historical, --repair
#
# Respects GSD_SYNC_DRYRUN, GSD_SYNC_SANDBOX, GSD_SYNC_VERBOSE.

set -u

# Resolve the repo root from this script's location (bin/ is two levels deep)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${REPO_ROOT}/hooks/lib/gsd-github-sync.lib.sh"

if [[ ! -f "$LIB" ]]; then
  echo "error: lib not found at $LIB" >&2
  exit 1
fi
# shellcheck source=../../hooks/lib/gsd-github-sync.lib.sh
source "$LIB"

MODE="${1:---dry-run}"

# ---------------------------------------------------------------------------
# Roadmap + filesystem parsers (GSD source-of-truth side)
# ---------------------------------------------------------------------------

planning_root() { gsd_sync_planning_root; }
roadmap_path() { echo "$(planning_root)/ROADMAP.md"; }

roadmap_milestone_title() {
  # Extracts e.g. "v1.0" from a header like "# Roadmap: v1.0,1.1 Title"
  local head; head="$(head -1 "$(roadmap_path)" 2>/dev/null)"
  echo "$head" | sed -nE 's/^# Roadmap: ([^,[:space:]]+).*/\1/p' | head -1
}

list_phase_dirs() {
  # Excludes 999.x backlog entries (parked ideas, not real phases).
  local root; root="$(planning_root)"
  ls -1 "$root/phases" 2>/dev/null \
    | grep -E '^[0-9]+(\.[0-9]+)*-' \
    | grep -vE '^999\.' \
    | sort -t- -k1,1V || true
}

phase_id_from_dir() { echo "$1" | sed -nE 's/^([0-9]+(\.[0-9]+)*).*/\1/p'; }
phase_name_from_dir() {
  local dir="$1" id; id="$(phase_id_from_dir "$dir")"
  echo "${dir#"${id}-"}"
}

phase_roadmap_state() {
  # Primary: checkbox in ROADMAP bullet ([x]=shipped, [ ]=planned).
  # Fallback: filesystem inspection (presence of *SUMMARY*.md = shipped).
  local id="$1" id_esc
  id_esc="$(printf '%s' "$id" | sed 's/\./\\./g')"
  local line
  line="$(grep -E "^- \[[x ]\] \*\*Phase ${id_esc}:" "$(roadmap_path)" 2>/dev/null | head -1)"
  if [[ -n "$line" ]]; then
    if echo "$line" | grep -qE '^- \[x\]'; then echo "shipped"; else echo "planned"; fi
    return
  fi
  local root dir; root="$(planning_root)"
  dir="$(find "$root/phases" -maxdepth 1 -type d -name "${id}-*" | head -1)"
  if [[ -n "$dir" ]] && ls "$dir"/*SUMMARY*.md >/dev/null 2>&1; then
    echo "shipped"
  else
    echo "planned"
  fi
}

# ---------------------------------------------------------------------------
# GitHub state fetchers
# ---------------------------------------------------------------------------

gh_list_milestones() {
  local repo="$1"
  timeout 10 gh api "repos/${repo}/milestones?state=all&per_page=100" --jq '.[] | {title, number, state}' 2>/dev/null
}

gh_list_phase_issues() {
  local repo="$1" prefix
  prefix="$(gsd_sync_config_value github_sync label_prefix gsd)"
  timeout 15 gh issue list --repo "$repo" --label "${prefix}:phase" --state all --limit 500 \
    --json number,title,state,labels 2>/dev/null
}

# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------

sync_dryrun() {
  local apply="${1:-no}"
  if ! gsd_sync_config_enabled; then
    echo "github_sync.enabled=false — nothing to do"; return 0
  fi
  if ! gsd_sync_preflight; then
    echo "preflight failed — see .planning/.github-sync.log"; return 1
  fi

  local repo milestone
  repo="$(gsd_sync_config_repo)"
  milestone="$(roadmap_milestone_title)"
  echo "sync plan for repo: ${repo}"
  echo "roadmap milestone:  ${milestone:-<none>}"
  echo

  local gh_ms gh_issues_json
  gh_ms="$(gh_list_milestones "$repo")"
  gh_issues_json="$(gh_list_phase_issues "$repo")"

  echo "== Milestones =="
  if [[ -n "$milestone" ]]; then
    if echo "$gh_ms" | grep -qF "\"title\":\"${milestone}\""; then
      echo "  ok: $milestone exists on GitHub"
    else
      echo "  MISSING: create milestone '$milestone'"
      [[ "$apply" == "yes" ]] && gsd_sync_action_create_milestone "$milestone"
    fi
  fi

  echo
  echo "== Phases =="
  local dir id name state issue_num
  while read -r dir; do
    [[ -z "$dir" ]] && continue
    id="$(phase_id_from_dir "$dir")"
    name="$(phase_name_from_dir "$dir")"
    state="$(phase_roadmap_state "$id")"
    issue_num="$(gsd_sync_registry_get "phases.${id}.issue")"

    if [[ -z "$issue_num" ]]; then
      local gh_issue_num
      gh_issue_num="$(echo "$gh_issues_json" | node -e "
        let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
          try {
            const arr = JSON.parse(d);
            const m = arr.find(i => i.title.startsWith('Phase ${id}:'));
            if (m) process.stdout.write(String(m.number));
          } catch {}
        });" 2>/dev/null)"
      if [[ -n "$gh_issue_num" ]]; then
        echo "  drift: phase ${id} has issue #${gh_issue_num} on GitHub but not in registry — run --repair"
      else
        if [[ "$state" == "planned" ]]; then
          echo "  MISSING: phase ${id} (${name}) has no issue — create"
          [[ "$apply" == "yes" ]] && gsd_sync_action_create_phase_issue "$id" "$name" "$milestone"
        else
          echo "  skip-historical: phase ${id} already shipped — covered by --seed-historical umbrella"
        fi
      fi
    else
      local gh_state
      gh_state="$(echo "$gh_issues_json" | node -e "
        let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
          try {
            const arr = JSON.parse(d);
            const m = arr.find(i => i.number === ${issue_num});
            if (m) process.stdout.write(m.state);
          } catch {}
        });" 2>/dev/null)"
      case "$state:$gh_state" in
        shipped:CLOSED|planned:OPEN|"")
          echo "  ok: phase ${id} state=${state} issue=#${issue_num} (${gh_state})"
          ;;
        *)
          echo "  DRIFT: phase ${id} planning=${state} github=${gh_state} — transition"
          [[ "$apply" == "yes" ]] && gsd_sync_action_transition_phase "$id" "$state"
          ;;
      esac
    fi
  done <<< "$(list_phase_dirs)"

  echo
  echo "== Registry staleness =="
  local reg_phases
  reg_phases="$(gsd_sync_registry_get phases | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{Object.keys(JSON.parse(d)).forEach(k=>console.log(k))}catch{}})" 2>/dev/null)"
  while read -r regid; do
    [[ -z "$regid" ]] && continue
    if ! list_phase_dirs | grep -qE "^${regid}-"; then
      echo "  STALE: registry has phase ${regid} but no directory exists"
    fi
  done <<< "$reg_phases"

  echo
  if [[ "$apply" == "yes" ]]; then
    echo "applied — see .planning/.github-sync.log"
  else
    echo "dry-run only. use --apply to execute."
  fi
}

sync_apply() { sync_dryrun yes; }

sync_seed_historical() {
  if ! gsd_sync_config_enabled; then
    echo "github_sync.enabled=false — nothing to do"; return 0
  fi
  if ! gsd_sync_preflight; then
    echo "preflight failed"; return 1
  fi

  local repo milestone
  repo="$(gsd_sync_config_repo)"
  milestone="$(roadmap_milestone_title)"
  [[ -z "$milestone" ]] && { echo "could not extract milestone from ROADMAP.md"; return 1; }

  echo "seed historical for ${repo} milestone=${milestone}"

  # 1. Create milestone if missing (and ensure labels)
  local existing_num
  existing_num="$(timeout 5 gh api "repos/${repo}/milestones?state=all" \
    --jq ".[] | select(.title == \"${milestone}\") | .number" 2>/dev/null | head -1)"
  if [[ -z "$existing_num" ]]; then
    gsd_sync_action_create_milestone "$milestone"
  else
    gsd_sync_registry_set "milestones.${milestone}" "{\"number\": ${existing_num}, \"state\": \"open\"}"
    gsd_sync_ensure_labels "$milestone"
  fi

  # Idempotency: skip if umbrella already registered
  local umbrella_key existing_umbrella
  umbrella_key="$(echo "$milestone" | tr '.' '_')"
  existing_umbrella="$(gsd_sync_registry_get "umbrella.${umbrella_key}.issue")"
  if [[ -n "$existing_umbrella" ]]; then
    echo "umbrella issue already exists (#${existing_umbrella}) — skip"
    return 0
  fi

  # 2. Build umbrella body
  local body dir id name state
  body="$(mktemp)"
  cat > "$body" <<EOF
<!-- gsd:managed -->

Umbrella issue for historical phases under milestone \`${milestone}\`.

Captures phases shipped before the GSD↔GitHub sync was enabled. Each line maps to a phase directory under \`.planning/phases/\`. Source of truth is the phase directory in the repo.

## Shipped phases

EOF
  while read -r dir; do
    [[ -z "$dir" ]] && continue
    id="$(phase_id_from_dir "$dir")"
    name="$(phase_name_from_dir "$dir")"
    state="$(phase_roadmap_state "$id")"
    [[ "$state" != "shipped" ]] && continue
    printf -- '- [x] **Phase %s** — %s\n' "$id" "$name" >> "$body"
  done <<< "$(list_phase_dirs)"

  cat >> "$body" <<EOF

## Open phases

EOF
  while read -r dir; do
    [[ -z "$dir" ]] && continue
    id="$(phase_id_from_dir "$dir")"
    name="$(phase_name_from_dir "$dir")"
    state="$(phase_roadmap_state "$id")"
    [[ "$state" == "shipped" ]] && continue
    printf -- '- [ ] **Phase %s** — %s\n' "$id" "$name" >> "$body"
  done <<< "$(list_phase_dirs)"

  cat >> "$body" <<EOF

<!-- /gsd:managed -->
EOF

  # 3. Create + close the umbrella issue
  local prefix title url num
  prefix="$(gsd_sync_config_value github_sync label_prefix gsd)"
  title="${milestone} — Historical Phases"
  url="$(gsd_sync_gh issue create --repo "$repo" --title "$title" \
    --label "${prefix}:phase,${prefix}:milestone:${milestone}" \
    --milestone "$milestone" \
    --body-file "$body" 2>/dev/null || echo "")"
  rm -f "$body"
  num="$(echo "$url" | grep -oE '[0-9]+$')"
  if [[ -n "$num" && -z "${GSD_SYNC_DRYRUN:-}" ]]; then
    gsd_sync_gh issue close "$num" --repo "$repo" --reason completed >/dev/null 2>&1 || true
    gsd_sync_registry_set "umbrella.${umbrella_key}" "{\"issue\": ${num}, \"state\": \"closed\"}"
  fi

  echo "done."
}

sync_repair() {
  if ! gsd_sync_config_enabled; then
    echo "github_sync.enabled=false — nothing to do"; return 0
  fi
  if ! gsd_sync_preflight; then
    echo "preflight failed"; return 1
  fi

  local repo prefix reg
  repo="$(gsd_sync_config_repo)"
  prefix="$(gsd_sync_config_value github_sync label_prefix gsd)"
  reg="$(gsd_sync_registry_path)"

  echo "rebuilding registry from GitHub state for ${repo}"
  rm -f "$reg"
  gsd_sync_registry_init

  local milestones_json
  milestones_json="$(timeout 10 gh api "repos/${repo}/milestones?state=all&per_page=100" 2>/dev/null)"
  echo "$milestones_json" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        JSON.parse(d).forEach(m => {
          console.log(JSON.stringify({title:m.title,number:m.number,state:m.state}));
        });
      } catch {}
    });
  " | while read -r line; do
    local title number state
    title="$(echo "$line" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).title))")"
    number="$(echo "$line" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(String(JSON.parse(d).number)))")"
    state="$(echo "$line" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).state))")"
    gsd_sync_registry_set "milestones.${title}" "{\"number\": ${number}, \"state\": \"${state}\"}"
  done

  local issues_json
  issues_json="$(timeout 15 gh issue list --repo "$repo" --label "${prefix}:phase" --state all --limit 500 \
    --json number,title,state,milestone 2>/dev/null)"
  echo "$issues_json" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        JSON.parse(d).forEach(i => {
          const m = i.title.match(/^Phase ([0-9]+(\\.[0-9]+)*):/);
          if (m) console.log(JSON.stringify({id:m[1],number:i.number,title:i.title,state:i.state.toLowerCase(),milestone:i.milestone?.title||''}));
        });
      } catch {}
    });
  " | while read -r line; do
    local id number state ms
    id="$(echo "$line" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).id))")"
    number="$(echo "$line" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(String(JSON.parse(d).number)))")"
    state="$(echo "$line" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).state))")"
    ms="$(echo "$line" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).milestone))")"
    gsd_sync_registry_set "phases.${id}" "{\"issue\": ${number}, \"milestone\": \"${ms}\", \"state\": \"${state}\"}"
  done

  echo "registry rebuilt at ${reg}"
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

case "$MODE" in
  --dry-run) sync_dryrun no ;;
  --apply) sync_apply ;;
  --seed-historical) sync_seed_historical ;;
  --repair) sync_repair ;;
  --help|-h)
    cat <<EOF
/gsd-sync-github — reconcile .planning/ with GitHub Issues + Milestones

  --dry-run          print structured diff (default, no writes)
  --apply            execute the diff
  --seed-historical  create milestone + umbrella issue listing shipped phases
  --repair           rebuild .planning/.github-sync.json from GitHub state

env:
  GSD_SYNC_DRYRUN=1   convert every gh write into an echo
  GSD_SYNC_SANDBOX=1  read .planning/config.local.json instead of config.json
  GSD_SYNC_VERBOSE=1  print debug traces on stderr
EOF
    ;;
  *) echo "unknown mode: $MODE (use --help)"; exit 1 ;;
esac
