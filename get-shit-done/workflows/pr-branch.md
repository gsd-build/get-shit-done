<purpose>
Create a clean branch for pull requests by filtering out .planning/ commits.
The PR branch contains only code changes — reviewers don't see GSD artifacts
(PLAN.md, SUMMARY.md, STATE.md, CONTEXT.md, etc.).

Uses git cherry-pick with path filtering to rebuild a clean history.
</purpose>

<process>

<step name="detect_state">
Parse `$ARGUMENTS` for target branch (default: `main`).

```bash
CURRENT_BRANCH=$(git branch --show-current)
TARGET=${1:-main}
```

Check preconditions:
- Must be on a feature branch (not main/master)
- Must have commits ahead of target

```bash
AHEAD=$(git rev-list --count "$TARGET".."$CURRENT_BRANCH" 2>/dev/null)
if [ "$AHEAD" = "0" ]; then
  echo "No commits ahead of $TARGET — nothing to filter."
  exit 0
fi
```

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PR BRANCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Branch: {CURRENT_BRANCH}
Target: {TARGET}
Commits: {AHEAD} ahead
```
</step>

<step name="analyze_commits">
Classify commits:

```bash
# Get all commits ahead of target
git log --oneline "$TARGET".."$CURRENT_BRANCH" --no-merges
```

For each commit, check if it ONLY touches .planning/ files:

```bash
# For each commit hash
FILES=$(git diff-tree --no-commit-id --name-only -r $HASH)
ALL_PLANNING=$(echo "$FILES" | grep -v "^\.planning/" | wc -l)
```

Classify:
- **Code commits**: Touch at least one non-.planning/ file → INCLUDE
- **Planning-only commits**: Touch only .planning/ files → EXCLUDE
- **Mixed commits**: Touch both → INCLUDE (planning changes come along)

Display analysis:
```
Commits to include: {N} (code changes)
Commits to exclude: {N} (planning-only)
Mixed commits: {N} (code + planning — included)
```
</step>

<step name="create_pr_branch">
```bash
PR_BRANCH="${CURRENT_BRANCH}-pr"

# Create PR branch from target
git checkout -b "$PR_BRANCH" "$TARGET"
```

Cherry-pick only code commits (in order):

```bash
for HASH in $CODE_COMMITS; do
  git cherry-pick "$HASH" --no-commit
  # Remove any .planning/ files that came along in mixed commits
  git rm -r --cached .planning/ 2>/dev/null || true
  git commit -C "$HASH"
done
```

Return to original branch:
```bash
git checkout "$CURRENT_BRANCH"
```
</step>

<step name="verify">
```bash
# Verify no .planning/ files in PR branch
PLANNING_FILES=$(git diff --name-only "$TARGET".."$PR_BRANCH" | grep "^\.planning/" | wc -l)
TOTAL_FILES=$(git diff --name-only "$TARGET".."$PR_BRANCH" | wc -l)
PR_COMMITS=$(git rev-list --count "$TARGET".."$PR_BRANCH")
```

Display results:
```
✅ PR branch created: {PR_BRANCH}

Original: {AHEAD} commits, {ORIGINAL_FILES} files
PR branch: {PR_COMMITS} commits, {TOTAL_FILES} files
Planning files: {PLANNING_FILES} (should be 0)

Next steps:
  git push origin {PR_BRANCH}
  gh pr create --base {TARGET} --head {PR_BRANCH}

Or use /gsd-ship to create the PR automatically.
```
</step>

</process>

<success_criteria>
- [ ] PR branch created from target
- [ ] Planning-only commits excluded
- [ ] No .planning/ files in PR branch diff
- [ ] Commit messages preserved from original
- [ ] User shown next steps
</success_criteria>
