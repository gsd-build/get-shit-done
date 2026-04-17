<purpose>
Collect structured feedback, attach diagnostics from the current GSD session, and file a GitHub issue against `gsd-build/get-shit-done`. Issue submission is delegated to the shared `file-issue.md` workflow so that `/gsd-feedback` and `/gsd-forensics` use one canonical filing path.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="collect_feedback">
Start from `$ARGUMENTS` if present.

If type is not already clear, ask the user to choose one:
- `bug`
- `feature`
- `question`

Then collect:
- `ISSUE_TITLE`
- `ISSUE_DESCRIPTION`

If `$ARGUMENTS` already contains enough detail, refine it instead of re-asking from scratch.

Keep the intake short. The goal is to get a fileable issue, not run a long interview.

### Optional forensics enrichment (bug type only)

If `ISSUE_TYPE` is `bug`, ask the user:

> "Want me to run a quick forensics investigation first? This checks git history, planning state, and artifacts for anomalies that might explain the bug. [Y/n]"

If yes:
1. Execute Steps 2â€“4 from `@~/.claude/get-shit-done/workflows/forensics.md` (Gather Evidence â†’ Detect Anomalies â†’ Generate Report). Skip Steps 5â€“8 (presentation, interactive investigation, issue creation, STATE update â€” those are handled here).
2. Read the most recently generated report from `.planning/forensics/report-*.md` (the file created by the just-completed run).
3. Set `INVESTIGATION_FINDINGS` to the redacted report contents.

If no (or if `ISSUE_TYPE` is `feature` or `question`):
- Set `INVESTIGATION_FINDINGS` to empty string.
</step>

<step name="gather_diagnostics">
Gather diagnostics from existing GSD helpers first.

**1. Version and runtime context**
Derive the invoking config dir from the execution context path when possible and prefer its sibling `get-shit-done/VERSION` file:

```bash
PREFERRED_CONFIG_DIR=""
case "$PWD" in
  *"/get-shit-done/workflows"*)
    PREFERRED_CONFIG_DIR="${PWD%/get-shit-done/workflows*}"
    ;;
esac

GSD_VERSION=""
for candidate in \
  "${CLAUDE_CONFIG_DIR:-}/get-shit-done/VERSION" \
  "$PREFERRED_CONFIG_DIR/get-shit-done/VERSION" \
  "$HOME/.claude/get-shit-done/VERSION" \
  "$HOME/.gemini/get-shit-done/VERSION" \
  "$HOME/.config/kilo/get-shit-done/VERSION" \
  "$HOME/.kilo/get-shit-done/VERSION" \
  "$HOME/.config/opencode/get-shit-done/VERSION" \
  "$HOME/.opencode/get-shit-done/VERSION" \
  "$HOME/.codex/get-shit-done/VERSION" \
  ".claude/get-shit-done/VERSION" \
  ".gemini/get-shit-done/VERSION" \
  ".config/kilo/get-shit-done/VERSION" \
  ".kilo/get-shit-done/VERSION" \
  ".config/opencode/get-shit-done/VERSION" \
  ".opencode/get-shit-done/VERSION" \
do
  if [ -n "$candidate" ] && [ -f "$candidate" ]; then
    GSD_VERSION="$(cat "$candidate")"
    break
  fi
done

if [ -z "$GSD_VERSION" ] && [ -f package.json ]; then
  GSD_VERSION=$(node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); console.log(pkg.version || '')" 2>/dev/null)
fi

NODE_VERSION=$(node -v 2>/dev/null || echo "unknown")
OS_NAME=$(uname -s 2>/dev/null || echo "$OS")
ARCH_NAME=$(uname -m 2>/dev/null || node -p "process.arch" 2>/dev/null || echo "unknown")
CURRENT_DIR=$(pwd)
ACTIVE_WORKSTREAM=${GSD_WORKSTREAM:-none}
```

**2. State and phase diagnostics**
```bash
STATE_JSON=$(gsd-sdk query state.json 2>/dev/null || echo "{}")
STATE_SNAPSHOT=$(gsd-sdk query state-snapshot 2>/dev/null || echo "{}")

CURRENT_PHASE=$(printf '%s' "$STATE_SNAPSHOT" | jq -r '.current_phase // "none"' 2>/dev/null || echo "none")
CURRENT_PHASE_NAME=$(printf '%s' "$STATE_SNAPSHOT" | jq -r '.current_phase_name // "none"' 2>/dev/null || echo "none")
STATUS=$(printf '%s' "$STATE_SNAPSHOT" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
LAST_ACTIVITY=$(printf '%s' "$STATE_SNAPSHOT" | jq -r '.last_activity // "unknown"' 2>/dev/null || echo "unknown")
LAST_ACTIVITY_DESC=$(printf '%s' "$STATE_SNAPSHOT" | jq -r '.last_activity_desc // "unknown"' 2>/dev/null || echo "unknown")
RESUME_FILE=$(printf '%s' "$STATE_SNAPSHOT" | jq -r '.session.resume_file // "none"' 2>/dev/null || echo "none")
```

**3. Small config excerpt**
Prefer direct GSD queries:

```bash
MODEL_PROFILE=$(gsd-sdk query config-get model_profile 2>/dev/null || echo "unset")
BASE_BRANCH=$(gsd-sdk query config-get git.base_branch 2>/dev/null || echo "unset")
USE_WORKTREES=$(gsd-sdk query config-get workflow.use_worktrees 2>/dev/null || echo "unset")
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "unset")
```

If `.planning/config.json` exists, include only a short relevant snippet rather than dumping the whole file.
</step>

<step name="render_diagnostics">
Render the gathered diagnostics into `DIAGNOSTICS_MARKDOWN`:

````markdown
- GSD version: {GSD_VERSION}
- Node: {NODE_VERSION}
- OS / arch: {OS_NAME} / {ARCH_NAME}
- Working directory: {CURRENT_DIR}
- Workstream: {ACTIVE_WORKSTREAM}
- Current phase: {CURRENT_PHASE} - {CURRENT_PHASE_NAME}
- Status: {STATUS}
- Last activity: {LAST_ACTIVITY}
- Last activity detail: {LAST_ACTIVITY_DESC}
- Resume file: {RESUME_FILE}
- Config excerpt:
  - model_profile: {MODEL_PROFILE}
  - git.base_branch: {BASE_BRANCH}
  - workflow.use_worktrees: {USE_WORKTREES}
  - commit_docs: {COMMIT_DOCS}

### State Snapshot (redacted)

```json
{STATE_SNAPSHOT_REDACTED}
```
````
</step>

<step name="file_issue">
Set the variables required by the shared issue-filing workflow, then delegate:

- `ISSUE_TYPE` â€” from step 1
- `ISSUE_TITLE` â€” from step 1
- `ISSUE_DESCRIPTION` â€” from step 1
- `DIAGNOSTICS_MARKDOWN` â€” from step 3
- `INVESTIGATION_FINDINGS` â€” from step 1 forensics enrichment (empty if skipped)
- `REPO` â€” `gsd-build/get-shit-done`

Execute `@~/.claude/get-shit-done/workflows/file-issue.md` end-to-end. It handles rendering the final issue body, `gh issue create`, URL fallback, and raw markdown fallback.
</step>

</process>

<success_criteria>
- Intake completes with type, title, and description
- Diagnostics come from `gsd-sdk query` helpers where available
- Bug-type issues offer optional forensics enrichment via `/gsd-forensics` steps 2â€“4
- Issue filing delegates to `@~/.claude/get-shit-done/workflows/file-issue.md`
- `DIAGNOSTICS_MARKDOWN` and `INVESTIGATION_FINDINGS` are set before delegation
</success_criteria>
