---
name: upstream-sync-agent
description: "Sync fork with upstream, regenerate wrapper layer, and open/update a PR safely."

on:
  schedule:
    - cron: "every 4h"
  workflow_dispatch:

# Agentic workflows are markdown + frontmatter, compiled to .lock.yml. [1](https://cicube.io/blog/github-actions-outputs/)
# Use strict + safe outputs so the agent itself stays read-only and requests mutations via validated outputs. [2](https://github.github.io/gh-aw/reference/safe-outputs/)[3](https://github.github.com/gh-aw/patterns/data-ops/)
strict: true

permissions:
  contents: read
  issues: read
  pull-requests: read
  actions: read

# Tools: GitHub MCP toolsets + bash for deterministic data extraction steps (DataOps pattern). [3](https://github.github.com/gh-aw/patterns/data-ops/)[2](https://github.github.io/gh-aw/reference/safe-outputs/)
tools:
  github:
    toolsets: ["default", "repos", "issues", "pull_requests"]
  bash: ["*"]

# Deterministic pre-processing steps (optional but recommended): gather data into /tmp for the agent to reason over. [3](https://github.github.com/gh-aw/patterns/data-ops/)
steps:
  - name: Preflight - record repo context
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/upstream-sync
      echo "${GITHUB_REPOSITORY}" > /tmp/gh-aw/upstream-sync/repo.txt
      echo "${GITHUB_REF}" > /tmp/gh-aw/upstream-sync/ref.txt
      echo "${GITHUB_SHA}" > /tmp/gh-aw/upstream-sync/sha.txt

  - name: Fetch upstream release + compare snapshot (API only)
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/upstream-sync

      # Hard-code upstream + fork defaults (matches your current intent)
      UPSTREAM_REPO="gsd-build/get-shit-done"
      UPSTREAM_BRANCH="main"
      UPSTREAM_OWNER="${UPSTREAM_REPO%%/*}"
      FORK_REPO="${GITHUB_REPOSITORY}"
      FORK_BRANCH="main"

      # Upstream HEAD SHA
      gh api "repos/${UPSTREAM_REPO}/commits/${UPSTREAM_BRANCH}" --jq '{sha: .sha, commit: .commit.message, author: .commit.author.name, date: .commit.author.date}' \
        > /tmp/gh-aw/upstream-sync/upstream-head.json

      # Fork HEAD SHA
      gh api "repos/${FORK_REPO}/commits/${FORK_BRANCH}" --jq '{sha: .sha, commit: .commit.message, author: .commit.author.name, date: .commit.author.date}' \
        > /tmp/gh-aw/upstream-sync/fork-head.json

      # Compare fork main..upstream main (what's behind)
      # Note: compare endpoint is a standard GitHub API surface; we store the JSON for the agent. [3](https://github.github.com/gh-aw/patterns/data-ops/)
      gh api "repos/${FORK_REPO}/compare/${FORK_BRANCH}...${UPSTREAM_OWNER}:${UPSTREAM_BRANCH}" \
        > /tmp/gh-aw/upstream-sync/compare.json || true

# Safe outputs declare validated GitHub write operations that happen *after* the agent finishes. [2](https://github.github.io/gh-aw/reference/safe-outputs/)[5](https://deepwiki.com/github/gh-aw/7.4-safe-outputs-configuration)
safe-outputs:
  # Reporting/escalations
  create-issue:
    title-prefix: "[upstream-sync] "
    labels: ["upstream-sync", "automated"]
    max: 3
    close-older-issues: false

  add-comment:
    max: 3
    target: "*"

  close-issue:
    max: 2
    target: "*"

  # PR lifecycle
  create-pull-request:
    max: 1
    labels: ["upstream-sync", "automated"]
    draft: false
    auto-merge: true

  jobs:
    merge-clean-sync-pr:
      description: "Merge latest open upstream-sync PR when auto-merge is not armed and PR is already clean."
      runs-on: ubuntu-latest
      needs:
        - safe_outputs
      permissions:
        pull-requests: write
      inputs:
        base:
          description: "Base branch to target"
          required: false
          type: string
          default: "main"
      steps:
        - name: Merge clean sync PR fallback
          env:
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
            BASE_INPUT: ${{ inputs.base }}
          run: |
            set -euo pipefail

            REPO="${GITHUB_REPOSITORY}"
            BASE="${BASE_INPUT:-main}"
            PR_JSON=$(gh pr list \
              --repo "$REPO" \
              --state open \
              --base "$BASE" \
              --json number,headRefName,autoMergeRequest,mergeStateStatus,url \
              --jq 'map(select(.headRefName | startswith("automated/upstream-sync-"))) | sort_by(.number) | last')

            if [ -z "$PR_JSON" ] || [ "$PR_JSON" = "null" ]; then
              echo "No open upstream-sync PR found for fallback merge."
              exit 0
            fi

            PR_NUMBER=$(echo "$PR_JSON" | jq -r '.number')
            PR_URL=$(echo "$PR_JSON" | jq -r '.url')
            PR_STATE=$(echo "$PR_JSON" | jq -r '.mergeStateStatus')
            AUTO_MERGE_SET=$(echo "$PR_JSON" | jq -r '.autoMergeRequest != null')

            echo "Found sync PR #$PR_NUMBER ($PR_URL), mergeStateStatus=$PR_STATE, autoMergeSet=$AUTO_MERGE_SET"

            if [ "$AUTO_MERGE_SET" = "true" ]; then
              echo "Auto-merge already configured."
              exit 0
            fi

            if [ "$PR_STATE" = "CLEAN" ]; then
              gh pr merge "$PR_NUMBER" --repo "$REPO" --merge --delete-branch=false
              echo "Merged clean sync PR #$PR_NUMBER directly."
              exit 0
            fi

            gh pr merge "$PR_NUMBER" --repo "$REPO" --auto --merge --delete-branch=false
            echo "Enabled auto-merge for sync PR #$PR_NUMBER."

  update-pull-request:
    max: 3
    target: "*"

  close-pull-request:
    max: 5
    target: "*"

  # Optional: labeling / reviewer ops
  add-labels:
    max: 3
    target: "*"

  add-reviewer:
    max: 2
    target: "*"
---

# Upstream Sync Adaptation + Repair Agent

You are the autonomous maintenance agent for this fork repository.

## Your Mission
Detect upstream changes from `gsd-build/get-shit-done` and keep the fork’s wrapper layer compatible without touching upstream-owned code.

## Non‑Negotiable Safety / Ownership Rules
1. **Never modify upstream-owned directories:**
   - `commands/gsd/**`
   - `agents/**`
   - `get-shit-done/**`

2. You MAY modify only:
   - `.github/prompts/**`
   - `.github/agents/**`
   - `.github/instructions/**`
   - `.github/workflows/**` (fork workflows only)
   - `scripts/generate-prompts.mjs`
   - `scripts/verify-prompts.mjs`
   - `scripts/tools.json`
   - `README.md`, `FORK-CHANGELOG.md`, `AGENTS.md`

3. **Never push directly to `main`.**  
   All changes must be delivered by a PR. (Use safe outputs `create-pull-request` / `update-pull-request`.)

## Inputs You Must Use (already collected for you)
Read the files in:
- `/tmp/gh-aw/upstream-sync/upstream-head.json`
- `/tmp/gh-aw/upstream-sync/fork-head.json`
- `/tmp/gh-aw/upstream-sync/compare.json`

## Required Workflow Behavior

### Phase 1 — Decide if work is needed
- If upstream has **no commits** the fork doesn’t have, do nothing and emit a `noop` conclusion (no safe outputs).

### Phase 2 — Merge plan (do NOT execute direct git pushes)
You do not directly push branches in the agent phase. Instead:
- Determine the required changes to the wrapper layer based on upstream delta.
- Make the wrapper-layer edits in the workspace (allowed files only).
- Run:
  - `node scripts/generate-prompts.mjs`
  - `node scripts/verify-prompts.mjs`

If verification fails:
- Request `create-issue` with:
  - Upstream head SHA (short)
  - Summary of verifier output
  - What file(s) likely need changes (only allowed files)
- Stop.

### Phase 3 — PR creation/update
If generation + verification pass:
- Ensure your commit(s) include:
  - a clear message: what changed and why
  - no modifications in upstream-owned paths
- Use safe output `create-pull-request` if there is no open sync PR.
- Otherwise use `update-pull-request` to refresh title/body.
- After creating/updating the sync PR, invoke safe output `merge_clean_sync_pr` with `{ "base": "main" }`.
  - This is required to handle the GitHub API edge case where auto-merge is not armed because the PR is already in clean state.
- PR title format:
  `sync: upstream changes from <short_sha>`
- PR body MUST include:
  - upstream head SHA + compare range
  - what wrapper adaptations were needed
  - confirmation you did not edit upstream-owned dirs

### Phase 4 — Merge conflicts / dead ends
If you detect that compatibility cannot be restored without modifying upstream-owned paths:
- Request `create-issue` titled:
  `sync-escalation: autonomous maintenance dead-end`
  with label `escalation` plus `upstream-sync`.
- Include: what upstream change caused the dead end and what a human must decide.
- Stop immediately.

## Definition of Done
- Wrapper layer regenerates cleanly
- Verifier passes
- PR exists (or updated) to merge changes safely into `main`
- No upstream-owned content modified
``