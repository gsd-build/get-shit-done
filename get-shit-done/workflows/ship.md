<purpose>
Create a pull request from completed phase/milestone work, generate a rich PR body from planning artifacts, optionally run code review, and prepare for merge. Closes the plan → execute → verify → ship loop.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_flags">
Parse $ARGUMENTS for the polling override flag:

```bash
IGNORE_PIPELINE=false
for arg in $ARGUMENTS; do
  if [ "$arg" = "--ignore-pipeline" ]; then
    IGNORE_PIPELINE=true
  fi
done
```

When `IGNORE_PIPELINE` is true, the `poll_post_push_pipeline` step records a `pipeline_override` block in the SUMMARY.md instead of refusing on a failed pipeline. Override is auditable.
</step>

<step name="initialize">
Parse arguments and load project state:

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse from init JSON: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `padded_phase`, `commit_docs`.

Also load config for branching strategy:
```bash
CONFIG=$(gsd-sdk query state.load)
```

Extract: `branching_strategy`, `branch_name`.

Detect base branch for PRs and merges:
```bash
BASE_BRANCH=$(gsd-sdk query config-get git.base_branch 2>/dev/null || echo "")
if [ -z "$BASE_BRANCH" ] || [ "$BASE_BRANCH" = "null" ]; then
  BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|^refs/remotes/origin/||')
  BASE_BRANCH="${BASE_BRANCH:-main}"
fi
```
</step>

<step name="preflight_checks">
Verify the work is ready to ship:

1. **Verification passed?**
   ```bash
   VERIFICATION=$(cat ${PHASE_DIR}/*-VERIFICATION.md 2>/dev/null)
   ```
   Check for `status: passed` or `status: human_needed` (with human approval).
   If no VERIFICATION.md or status is `gaps_found`: warn and ask user to confirm.

2. **Clean working tree?**
   ```bash
   git status --short
   ```
   If uncommitted changes exist: ask user to commit or stash first.

3. **On correct branch?**
   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   ```
   If on `${BASE_BRANCH}`: warn — should be on a feature branch.
   If branching_strategy is `none`: offer to create a branch now.

4. **Remote configured?**
   ```bash
   git remote -v | head -2
   ```
   Detect `origin` remote. If no remote: error — can't create PR.

5. **`gh` CLI available?**
   ```bash
   which gh && gh auth status 2>&1
   ```
   If `gh` not found or not authenticated: provide setup instructions and exit.
</step>

<step name="push_branch">
Push the current branch to remote:

```bash
git push origin ${CURRENT_BRANCH} 2>&1
```

If push fails (e.g., no upstream): set upstream:
```bash
git push --set-upstream origin ${CURRENT_BRANCH} 2>&1
```

Report: "Pushed `{branch}` to origin ({commit_count} commits ahead of ${BASE_BRANCH})"
</step>

<step name="generate_pr_body">
Auto-generate a rich PR body from planning artifacts:

**1. Title:**
```
Phase {phase_number}: {phase_name}
```
Or for milestone: `Milestone {version}: {name}`

**2. Summary section:**
Read ROADMAP.md for phase goal. Read VERIFICATION.md for verification status.

```markdown
## Summary

**Phase {N}: {Name}**
**Goal:** {goal from ROADMAP.md}
**Status:** Verified ✓

{One paragraph synthesized from SUMMARY.md files — what was built}
```

**3. Changes section:**
For each SUMMARY.md in the phase directory:
```markdown
## Changes

### Plan {plan_id}: {plan_name}
{one_liner from SUMMARY.md frontmatter}

**Key files:**
{key-files.created and key-files.modified from SUMMARY.md frontmatter}
```

**4. Requirements section:**
```markdown
## Requirements Addressed

{REQ-IDs from plan frontmatter, linked to REQUIREMENTS.md descriptions}
```

**5. Testing section:**
```markdown
## Verification

- [x] Automated verification: {pass/fail from VERIFICATION.md}
- {human verification items from VERIFICATION.md, if any}
```

**6. Decisions section:**
```markdown
## Key Decisions

{Decisions from STATE.md accumulated context relevant to this phase}
```
</step>

<step name="create_pr">
Create the PR using the generated body:

```bash
gh pr create \
  --title "Phase ${PHASE_NUMBER}: ${PHASE_NAME}" \
  --body "${PR_BODY}" \
  --base ${BASE_BRANCH}
```

If `--draft` flag was passed: add `--draft`.

Report: "PR #{number} created: {url}"
</step>

<step name="optional_review">

**External code review command (automated sub-step):**

Before prompting the user, check if an external review command is configured:

```bash
REVIEW_CMD=$(gsd-sdk query config-get workflow.code_review_command 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
```

If `REVIEW_CMD` is non-empty and not `"null"`, run the external review:

1. **Generate diff and stats:**
   ```bash
   DIFF=$(git diff ${BASE_BRANCH}...HEAD)
   DIFF_STATS=$(git diff --stat ${BASE_BRANCH}...HEAD)
   ```

2. **Load phase context from STATE.md:**
   ```bash
   STATE_STATUS=$(gsd-sdk query state.load 2>/dev/null | head -20)
   ```

3. **Build review prompt and pipe to command via stdin:**
   Construct a review prompt containing the diff, diff stats, and phase context, then pipe it to the configured command:
   ```bash
   REVIEW_PROMPT="You are reviewing a pull request.\n\nDiff stats:\n${DIFF_STATS}\n\nPhase context:\n${STATE_STATUS}\n\nFull diff:\n${DIFF}\n\nRespond with JSON: { \"verdict\": \"APPROVED\" or \"REVISE\", \"confidence\": 0-100, \"summary\": \"...\", \"issues\": [{\"severity\": \"...\", \"file\": \"...\", \"line_range\": \"...\", \"description\": \"...\", \"suggestion\": \"...\"}] }"
   REVIEW_OUTPUT=$(echo "${REVIEW_PROMPT}" | timeout 120 ${REVIEW_CMD} 2>/tmp/gsd-review-stderr.log)
   REVIEW_EXIT=$?
   ```

4. **Handle timeout (120s) and failure:**
   If `REVIEW_EXIT` is non-zero or the command times out:
   ```bash
   if [ $REVIEW_EXIT -ne 0 ]; then
     REVIEW_STDERR=$(cat /tmp/gsd-review-stderr.log 2>/dev/null)
     echo "WARNING: External review command failed (exit ${REVIEW_EXIT}). stderr: ${REVIEW_STDERR}"
     echo "Continuing with manual review flow..."
   fi
   ```
   On failure, warn with stderr output and fall through to the manual review flow below.

5. **Parse JSON result:**
   If the command succeeded, parse the JSON output and report the verdict:
   ```bash
   # Parse verdict and summary from REVIEW_OUTPUT JSON
   VERDICT=$(echo "${REVIEW_OUTPUT}" | node -e "
     let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
       try { const r=JSON.parse(d); console.log(r.verdict); }
       catch(e) { console.log('INVALID_JSON'); }
     });
   ")
   ```
   - If `verdict` is `"APPROVED"`: report approval with confidence and summary.
   - If `verdict` is `"REVISE"`: report issues found, list each issue with severity, file, line_range, description, and suggestion.
   - If JSON is invalid (`INVALID_JSON`): warn "External review returned invalid JSON" with stderr and continue.

   Regardless of the external review result, fall through to the manual review options below.

---

**Manual review options:**

Ask if user wants to trigger a code review:


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.

```
AskUserQuestion:
  question: "PR created. Run a code review before merge?"
  options:
    - label: "Skip review"
      description: "PR is ready — merge when CI passes"
    - label: "Self-review"
      description: "I'll review the diff in the PR myself"
    - label: "Request review"
      description: "Request review from a teammate"
```

**If "Request review":**
```bash
gh pr edit ${PR_NUMBER} --add-reviewer "${REVIEWER}"
```

**If "Self-review":**
Report the PR URL and suggest: "Review the diff at {url}/files"
</step>

<step name="poll_post_push_pipeline">
**Purpose (HK-04):** After `git push`, capture the new pipeline ID, poll until terminal, and refuse to mark the phase shipped if the pipeline ends in `failed` or `canceled`. Override available via `--ignore-pipeline` (parsed in `parse_flags`).

**Skip if:** the platform isn't GitLab, `glab` isn't authenticated, or no pipeline triggered (e.g., docs-only commit with `[ci skip]`).

```bash
# Pre-flight
if ! command -v glab >/dev/null 2>&1; then
  echo "glab not installed — skipping pipeline polling"
elif ! glab auth status >/dev/null 2>&1; then
  echo "glab not authenticated — skipping pipeline polling. Run \`glab auth login\` to enable."
else
  # Resolve URL-encoded project path from `git remote get-url origin`
  REMOTE_URL=$(git remote get-url origin)
  # Strip protocol + .git; URL-encode slashes
  PROJECT_PATH=$(echo "$REMOTE_URL" | sed -E 's|^https?://[^/]+/||; s|^git@[^:]+:||; s|\.git$||')
  ENCODED_PROJECT=$(echo "$PROJECT_PATH" | sed 's|/|%2F|g')

  # Capture the pipeline ID. Retry up to 3× because GitLab may not have created
  # the pipeline yet immediately after push.
  PIPELINE_ID=""
  for attempt in 1 2 3; do
    PIPELINE_ID=$(glab api "projects/${ENCODED_PROJECT}/pipelines?ref=${CURRENT_BRANCH}&order_by=id&sort=desc&per_page=1" \
      | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const r=JSON.parse(d);if(r[0])console.log(r[0].id)}catch(e){}})")
    if [ -n "$PIPELINE_ID" ]; then break; fi
    sleep 5
  done

  if [ -z "$PIPELINE_ID" ]; then
    echo "No pipeline triggered for ${CURRENT_BRANCH} — proceeding without polling."
  fi
fi
```

**Polling loop (only if PIPELINE_ID was captured):**

The polling uses `ScheduleWakeup` — never an in-context `sleep` loop. Each tick:

1. Query: `glab api "projects/${ENCODED_PROJECT}/pipelines/${PIPELINE_ID}"`.
2. Parse `status`. Branches:
   - `success` → exit polling, proceed to `track_shipping`.
   - `failed` or `canceled` → enter `surface_failed_traces` substep.
   - `pending`, `running`, `waiting_for_resource`, `preparing` → schedule next wakeup at 30s, increment tick counter.
3. Cap at 30 ticks (15-minute total). On cap reached:
   ```
   AskUserQuestion:
     question: "Pipeline ${PIPELINE_ID} still running after 15 minutes. Continue waiting, skip polling, or fail?"
     options: ["Continue another 15 min", "Skip — assume green", "Fail — refuse to ship"]
   ```

**ScheduleWakeup pattern:**

```
ScheduleWakeup({
  delaySeconds: 30,
  reason: "polling pipeline #${PIPELINE_ID} (tick ${tickN}/30) — current status: ${prevStatus}",
  prompt: "/gsd-ship --resume-poll-tick=${nextTick} --pipeline-id=${PIPELINE_ID} <original args>"
})
```

**`surface_failed_traces` substep (only on failed/canceled):**

```bash
JOBS=$(glab api "projects/${ENCODED_PROJECT}/pipelines/${PIPELINE_ID}/jobs")
# Filter status==failed and ALSO status==canceled (different from pipeline-cancelled)
FAILED_JOB_IDS=$(echo "$JOBS" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log(r.filter(j=>j.status==='failed').map(j=>j.id+':'+j.name).join('\\n'))}")
```

For each failed job ID:
```bash
echo "## Job: ${JOB_NAME} (failed)"
glab ci trace "${JOB_ID}" -p "${PIPELINE_ID}" 2>&1 | tail -50
```

Surface in user prompt:

```
## Pipeline #${PIPELINE_ID} failed

Branch: ${CURRENT_BRANCH}
Status: failed
Failed jobs (${count}):

[per-job ## blocks with last 50 lines of trace]

──────────────────────────────────────────────────────────────────
```

If `IGNORE_PIPELINE=true`:
- Skip the refusal; record an override block in the next `track_shipping` step's SUMMARY:
  ```yaml
  pipeline_override:
    pipeline_id: ${PIPELINE_ID}
    status: failed
    failed_jobs: [list]
    overridden_by: $(git config user.email)
    overridden_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
    reason: "user-supplied or 'unspecified'"
  ```

If `IGNORE_PIPELINE=false` (default):
- REFUSE: print "Phase NOT marked shipped. Pipeline #${PIPELINE_ID} ended in failed."
- Suggest options: "Fix the failure and re-push (recommended); rerun the failed jobs via GitLab UI; OR re-run /gsd-ship --ignore-pipeline (records audit trail)."
- Exit workflow.

**Backwards compatibility (D-10):** if no pipeline was triggered (e.g., `[ci skip]` commit, or platform isn't GitLab), the entire polling block becomes a no-op and the workflow proceeds to `track_shipping` as before.
</step>

<step name="track_shipping">
Update STATE.md to reflect the shipping action:

```bash
gsd-sdk query state.update "Last Activity" "$(date +%Y-%m-%d)"
gsd-sdk query state.update "Status" "Phase ${PHASE_NUMBER} shipped — PR #${PR_NUMBER}"
```

If `commit_docs` is true:
```bash
gsd-sdk query commit "docs(${padded_phase}): ship phase ${PHASE_NUMBER} — PR #${PR_NUMBER}" --files .planning/STATE.md
```

**If `IGNORE_PIPELINE=true`** (an override happened in `poll_post_push_pipeline`), append the `pipeline_override` block to the phase's SUMMARY.md as documented in that step. This block becomes a permanent audit record.
</step>

<step name="report">
```
───────────────────────────────────────────────────────────────

## ✓ Phase {X}: {Name} — Shipped

PR: #{number} ({url})
Branch: {branch} → ${BASE_BRANCH}
Commits: {count}
Verification: ✓ Passed
Requirements: {N} REQ-IDs addressed

Next steps:
- Review/approve PR
- Merge when CI passes
- /gsd-complete-milestone (if last phase in milestone)
- /gsd-progress (to see what's next)

───────────────────────────────────────────────────────────────
```
</step>

</process>

<offer_next>
After shipping:

- /gsd-complete-milestone — if all phases in milestone are done
- /gsd-progress — see overall project state
- /gsd-execute-phase {next} — continue to next phase
</offer_next>

<success_criteria>
- [ ] Preflight checks passed (verification, clean tree, branch, remote, gh)
- [ ] Branch pushed to remote
- [ ] PR created with rich auto-generated body
- [ ] STATE.md updated with shipping status
- [ ] User knows PR number and next steps
</success_criteria>
