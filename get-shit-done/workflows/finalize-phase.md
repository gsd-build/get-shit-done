<purpose>
Finalize a completed phase: verify all gates pass (UAT, tests, verification), merge the phase branch to main, and clean up the git worktree.

This workflow ensures a phase is properly closed out before moving to the next phase.
</purpose>

<core_principle>
**Completion requires all gates:**
1. UAT must be passed (status: passed in UAT.md)
2. All tests must pass (if test suite exists)
3. Verification must be complete (status: passed in VERIFICATION.md)
4. Branch must be merged to main
5. Worktree must be cleaned up

If any gate fails, stop and report what needs to be fixed.
</core_principle>

<required_reading>
Read STATE.md and phase artifacts before any operation to load project context.
</required_reading>

<process>

<step name="initialize" priority="first">
Load phase context:

```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs init phase-op "${PHASE_ARG}")
```

Parse JSON for: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`.

**If `phase_found` is false:** Error — phase directory not found.

Determine current branch and worktree status:
```bash
CURRENT_BRANCH=$(git branch --show-current)
WORKTREE_PATH=$(pwd)
MAIN_REPO=$(git rev-parse --show-toplevel 2>/dev/null)
```
</step>

<step name="check_uat_status">
Check if UAT has passed for this phase:

```bash
UAT_FILE=$(ls "${PHASE_DIR}"/*-UAT.md 2>/dev/null | head -1)
```

**If no UAT file exists:**
- Check if verification passed (verification may be sufficient for infrastructure phases)
- If neither exists: "No UAT or verification found. Run `/gsd:verify-work ${PHASE_NUMBER}` first."

**If UAT file exists:**
```bash
UAT_STATUS=$(grep "^status:" "$UAT_FILE" | cut -d: -f2 | tr -d ' ')
```

| Status | Action |
|--------|--------|
| `passed` | → Continue to next step |
| `failed` | → "UAT failed. Fix issues and re-run `/gsd:verify-work ${PHASE_NUMBER}`" |
| `diagnosed` | → "UAT has unresolved gaps. Run `/gsd:plan-phase ${PHASE_NUMBER} --gaps` to address them" |
| other | → "UAT incomplete. Run `/gsd:verify-work ${PHASE_NUMBER}` first" |

**Gate enforcement (FLOW-03):**
- If UAT status is NOT "passed", the step MUST exit/stop workflow execution
- The Claude executor should NOT proceed to subsequent steps
- Report what needs to be done and exit

Example blocking pattern:
```bash
if [ "$UAT_STATUS" != "passed" ]; then
  echo "## X UAT Gate Failed"
  echo ""
  echo "UAT status: $UAT_STATUS"
  echo "Finalization blocked until UAT passes."
  echo ""
  echo "Next: /gsd:verify-work ${PHASE_NUMBER}"
  # FLOW-03: Must exit here, not continue
  exit 1
fi
```
</step>

<step name="check_verification_status">
Check if verification has passed:

```bash
VERIFY_FILE=$(ls "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1)
```

**If no verification file:**
- "Verification not found. Phase may not have been fully executed."
- "Run `/gsd:execute-phase ${PHASE_NUMBER}` to complete execution and verification."

**If verification exists:**
```bash
VERIFY_STATUS=$(grep "^status:" "$VERIFY_FILE" | cut -d: -f2 | tr -d ' ')
```

| Status | Action |
|--------|--------|
| `passed` | → Continue to next step |
| `gaps_found` | → "Verification found gaps. Run `/gsd:plan-phase ${PHASE_NUMBER} --gaps`" |
| `human_needed` | → "Human verification required. Complete manual testing first." |
| other | → "Verification incomplete. Re-run `/gsd:execute-phase ${PHASE_NUMBER}`" |

**Gate enforcement (FLOW-03):**
```bash
if [ "$VERIFY_STATUS" != "passed" ]; then
  echo "## X Verification Gate Failed"
  echo ""
  echo "Verification status: $VERIFY_STATUS"
  echo "Finalization blocked until verification passes."
  echo ""
  echo "Next: /gsd:execute-phase ${PHASE_NUMBER} (if incomplete)"
  echo "  or: /gsd:plan-phase ${PHASE_NUMBER} --gaps (if gaps_found)"
  # FLOW-03: Must exit here, not continue
  exit 1
fi
```
</step>

<step name="run_tests">
Check if a test suite exists and run it:

```bash
# Detect test framework
if [ -f "package.json" ]; then
  HAS_TEST=$(grep -c '"test"' package.json 2>/dev/null || echo "0")
  if [ "$HAS_TEST" -gt 0 ]; then
    echo "Running npm test..."
    npm test
    TEST_EXIT=$?
  fi
elif [ -f "pytest.ini" ] || [ -f "pyproject.toml" ]; then
  echo "Running pytest..."
  pytest
  TEST_EXIT=$?
elif [ -f "Cargo.toml" ]; then
  echo "Running cargo test..."
  cargo test
  TEST_EXIT=$?
elif [ -d "terraform" ]; then
  echo "Running terraform validate..."
  cd terraform && terraform validate
  TEST_EXIT=$?
  cd ..
fi
```

**If tests fail (TEST_EXIT != 0):**
```
## ✗ Tests Failed

Tests must pass before finalizing the phase.

Fix the failing tests and re-run `/gsd:finalize-phase ${PHASE_NUMBER}`
```

**If no test suite detected:**
- Log "No test suite detected, skipping test gate"
- Continue to next step
</step>

<step name="verify_branch_state">
Check git state before merge:

```bash
# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
EXPECTED_BRANCH="phase-${PHASE_NUMBER}-${PHASE_SLUG}"

# Check for uncommitted changes
UNCOMMITTED=$(git status --porcelain)

# Check if on expected branch
if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "WARNING: On branch $CURRENT_BRANCH, expected $EXPECTED_BRANCH"
fi
```

**If uncommitted changes exist:**
```bash
if [ -n "$UNCOMMITTED" ]; then
  echo "## X Uncommitted Changes"
  echo ""
  echo "The following files have uncommitted changes:"
  echo "$UNCOMMITTED"
  echo ""
  echo "Commit or stash these changes before finalizing."
  exit 1  # FLOW-03: Gate must block, not just warn
fi
```

**If on wrong branch:**
- Ask user to confirm they want to merge current branch instead
- Or switch to expected branch
</step>

<step name="merge_to_main">
Merge the phase branch to main:

```bash
# Store current location
WORK_DIR=$(pwd)
PHASE_BRANCH=$(git branch --show-current)

# Find main repo (worktree parent)
MAIN_REPO=$(git worktree list | grep -v "$PHASE_BRANCH" | head -1 | awk '{print $1}')

# If we're in a worktree, need to go to main repo
if [ -n "$MAIN_REPO" ] && [ "$MAIN_REPO" != "$WORK_DIR" ]; then
  cd "$MAIN_REPO"
fi

# Fetch latest
git fetch origin main 2>/dev/null || true

# Checkout main
git checkout main

# Merge with no-ff to preserve history
git merge "$PHASE_BRANCH" --no-ff -m "Merge phase ${PHASE_NUMBER} (${PHASE_NAME}) into main

Phase completed:
- UAT: passed
- Verification: passed
- Tests: passed (or skipped)

Closes phase ${PHASE_NUMBER}-${PHASE_SLUG}"

MERGE_EXIT=$?
```

**If merge fails (conflict):**
```
## ✗ Merge Conflict

Failed to merge ${PHASE_BRANCH} into main.

Resolve conflicts manually:
1. cd ${MAIN_REPO}
2. git status (see conflicts)
3. Resolve each conflict
4. git add <resolved files>
5. git commit
6. Re-run /gsd:finalize-phase ${PHASE_NUMBER}
```

**If merge succeeds:**
```
## ✓ Merged to Main

Branch ${PHASE_BRANCH} merged into main successfully.
```
</step>

<step name="cleanup_worktree">
Remove the git worktree and release lock **only if merge succeeded** (FLOW-05):

```bash
# Skip cleanup if merge failed - don't delete worktree with uncommitted conflict resolution
if [ "${MERGE_EXIT:-1}" != "0" ]; then
  echo "Skipping cleanup: merge did not complete successfully"
  echo "Worktree preserved at: ${WORK_DIR}"
  echo "Resolve merge issues and re-run finalize"
  exit 1
fi

# Locate phase-worktree.sh script
REPO_ROOT=$(git rev-parse --show-toplevel)
PHASE_WORKTREE="${REPO_ROOT}/get-shit-done/bin/phase-worktree.sh"

if [ ! -f "$PHASE_WORKTREE" ]; then
  PHASE_WORKTREE="${HOME}/.claude/get-shit-done/bin/phase-worktree.sh"
fi

if [ -f "$PHASE_WORKTREE" ]; then
  # Use phase-worktree.sh remove for proper cleanup (FLOW-05)
  # Handles: git worktree unlock, git worktree remove, git branch -d, registry update
  "$PHASE_WORKTREE" remove "${PHASE_NUMBER}"
  CLEANUP_EXIT=$?
else
  # Manual worktree cleanup (fallback if script not available)
  git worktree unlock "${WORK_DIR}" 2>/dev/null || true
  git worktree remove "${WORK_DIR}" --force 2>/dev/null || true
  git branch -d "${PHASE_BRANCH}" 2>/dev/null || true
  CLEANUP_EXIT=0
fi

if [ "${CLEANUP_EXIT:-0}" = "0" ]; then
  echo "## > Worktree Cleaned Up"
  echo ""
  echo "- Worktree removed: ${WORK_DIR}"
  echo "- Branch deleted: ${PHASE_BRANCH}"
  echo "- Lock released: phase-${PHASE_NUMBER}"
else
  echo "## ! Cleanup Warning"
  echo ""
  echo "Worktree cleanup had issues. Manual cleanup may be needed:"
  echo "  cd ${MAIN_REPO}"
  echo "  git worktree remove ${WORK_DIR} --force"
  echo "  git branch -d ${PHASE_BRANCH}"
fi
```
</step>

<step name="update_state">
Update STATE.md to reflect phase finalization:

Read current STATE.md and update:
- Phase status: "Complete" → "Finalized"
- Add finalization timestamp to Recent Activity
- Update Next Action to point to next phase

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs commit "docs(phase-${PHASE_NUMBER}): finalize phase - merged to main" --files .planning/STATE.md
```
</step>

<step name="report_completion">
Present final summary:

```markdown
## ✓ Phase ${PHASE_NUMBER}: ${PHASE_NAME} Finalized

### Gates Passed
| Gate | Status |
|------|--------|
| UAT | ✓ Passed |
| Verification | ✓ Passed |
| Tests | ✓ Passed (or N/A) |
| Merge | ✓ Complete |
| Cleanup | ✓ Done |

### What Happened
- Branch `${PHASE_BRANCH}` merged to `main`
- Worktree `${WORK_DIR}` removed
- Phase lock released

### Next Steps
- `cd ${MAIN_REPO}` to return to main repo
- `/gsd:progress` to see next phase
- `/gsd:plan-phase ${NEXT_PHASE}` to start planning next phase
```
</step>

</process>

<failure_handling>
- **UAT not passed:** Direct to `/gsd:verify-work`
- **Verification gaps:** Direct to `/gsd:plan-phase --gaps`
- **Tests fail:** Must fix tests before finalizing
- **Merge conflict:** Provide manual resolution steps
- **Worktree cleanup fails:** Provide manual cleanup commands
- **Not in worktree:** Can still merge and skip cleanup step
</failure_handling>

<success_criteria>
- [ ] UAT status is "passed" (or not required)
- [ ] Verification status is "passed"
- [ ] Tests pass (or none exist)
- [ ] Branch merged to main successfully
- [ ] Worktree removed (if applicable)
- [ ] Lock released (if applicable)
- [ ] STATE.md updated
- [ ] User knows how to proceed
</success_criteria>
