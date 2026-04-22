<purpose>
Create a pull request from completed phase/milestone work, generate a rich PR body from planning artifacts, optionally run code review, and prepare for merge. Closes the plan → execute → verify → ship loop.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

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
Verify the work is ready to ship.

Detect the `--force` override once, before the checks. Set `FORCE=true` if `--force` appears in `$ARGUMENTS`, otherwise `FORCE=false`. The override applies to the "Pending handoff tasks?" check below; it does not skip the other preflight steps.

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

3. **Pending handoff tasks?**

   If `.planning/HANDOFF.json` exists, parse `remaining_tasks[]` and refuse when any entry's `status` is not in the terminal set `{done, cancelled, deferred_to_backend, wont_fix}`. The canonical pause/resume contract treats non-terminal statuses as "work still in progress on this branch" — `/gsd-ship` must not create a public PR while that signal is active.

   Missing `HANDOFF.json` is a no-op (preserves existing behavior for projects that don't use `/gsd-pause-work`). A malformed `HANDOFF.json` (non-parseable JSON) is a hard stop — the exit code from `node` is captured explicitly so a bad file can never fall through to a silent pass.

   ```bash
   HANDOFF_PATH=.planning/HANDOFF.json
   if [ -f "${HANDOFF_PATH}" ]; then
     BLOCKING=$(node -e "
       const fs = require('fs');
       const TERMINAL = new Set(['done','cancelled','deferred_to_backend','wont_fix']);
       let h;
       try { h = JSON.parse(fs.readFileSync('${HANDOFF_PATH}','utf8')); }
       catch (e) { console.error('HANDOFF.json is not valid JSON: ' + e.message); process.exit(2); }
       const tasks = Array.isArray(h.remaining_tasks) ? h.remaining_tasks : [];
       const blocking = tasks.filter(t => t && !TERMINAL.has(t.status));
       blocking.forEach(t => console.log('  • [' + (t.status || 'unknown') + ']  ' + (t.name || ('task ' + t.id))));
     ")
     HANDOFF_EXIT=$?
     if [ "${HANDOFF_EXIT}" -ne 0 ]; then
       echo ""
       echo "✗ Cannot ship: .planning/HANDOFF.json could not be parsed (node exited ${HANDOFF_EXIT})."
       echo "  Fix the JSON or delete the file, then retry. The parser error is printed above."
       exit 1
     fi
     if [ -n "${BLOCKING}" ]; then
       if [ "${FORCE}" = "true" ]; then
         echo "⚠ HANDOFF.json declares in-progress work — shipping anyway because --force was passed:"
         echo "${BLOCKING}"
       else
         cat <<EOF
   ✗ Cannot ship: HANDOFF.json declares in-progress work on this branch.

     Blocking tasks:
   ${BLOCKING}

     Options:
       1. Complete the remaining tasks, then run /gsd-pause-work or /gsd-verify-work to close them
       2. Mark each as terminal (done/cancelled/deferred_to_backend/wont_fix) in HANDOFF.json if they're no longer in scope for this branch
       3. Delete HANDOFF.json if it's stale from an earlier session (resume-project.md documents this as the one-shot cleanup)
       4. Pass --force to ship anyway (not recommended — the branch will land with declared-unfinished work)
   EOF
         exit 1
       fi
     fi
   fi
   ```

   Terminal statuses contract: see `references/artifact-types.md` (HANDOFF.json entry).

4. **On correct branch?**
   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   ```
   If on `${BASE_BRANCH}`: warn — should be on a feature branch.
   If branching_strategy is `none`: offer to create a branch now.

5. **Remote configured?**
   ```bash
   git remote -v | head -2
   ```
   Detect `origin` remote. If no remote: error — can't create PR.

6. **`gh` CLI available?**
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

<step name="track_shipping">
Update STATE.md to reflect the shipping action:

```bash
gsd-sdk query state.update "Last Activity" "$(date +%Y-%m-%d)"
gsd-sdk query state.update "Status" "Phase ${PHASE_NUMBER} shipped — PR #${PR_NUMBER}"
```

If `commit_docs` is true:
```bash
gsd-sdk query commit "docs(${padded_phase}): ship phase ${PHASE_NUMBER} — PR #${PR_NUMBER}" .planning/STATE.md
```
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
