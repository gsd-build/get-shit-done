---
name: release-mirror-agent
description: "Mirror upstream releases into the fork. Auto-runs after successful upstream-sync-agent; can be run manually with force."

on:
  workflow_run:
    workflows:
      - upstream-sync-agent
    types:
      - completed
    branches:
      - main

  workflow_dispatch:
    inputs:
      force:
        description: "Force mirror in isolation even if upstream sync did not run or failed"
        required: false
        default: "false"
      upstream_tag:
        description: "Optional: mirror this exact upstream tag (blank = latest)"
        required: false
        default: ""

strict: true

permissions:
  contents: read
  issues: read
  pull-requests: read
  actions: read

tools:
  github:
    toolsets: ["default", "repos", "actions"]
  bash: ["*"]

# Optional deterministic data collection. [3](https://github.github.com/gh-aw/patterns/data-ops/)
steps:
  - name: Fetch upstream latest release + fork latest release snapshot
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/release-mirror
      UPSTREAM_REPO="gsd-build/get-shit-done"
      FORK_REPO="${GITHUB_REPOSITORY}"

      # Upstream latest release
      gh api "repos/${UPSTREAM_REPO}/releases/latest" > /tmp/gh-aw/release-mirror/upstream-latest.json || true

      # Fork latest release (may not exist)
      gh api "repos/${FORK_REPO}/releases/latest" > /tmp/gh-aw/release-mirror/fork-latest.json || true

safe-outputs:
  # Trigger a deterministic worker workflow that performs tag push + release creation using the appropriate token.
  # dispatch-workflow is a listed safe output type. [2](https://github.github.io/gh-aw/reference/safe-outputs/)
  dispatch-workflow:
    max: 1
    workflows: ["release-mirror-worker"]

  # Optional: if worker fails or lockstep gap is detected, we can create an issue.
  create-issue:
    title-prefix: "[upstream-mirror] "
    labels: ["upstream-mirror", "automated"]
    max: 2
---

# Release Mirror Agent

## Execution Guard (MANDATORY)

Determine how you were triggered:

### A) workflow_run trigger
- If the triggering workflow conclusion is NOT `success`, **exit immediately** and emit no safe outputs.

### B) workflow_dispatch (manual) trigger
- If `inputs.force` is not `"true"`:
  - Require that the latest upstream-sync-agent run completed successfully recently enough to be trusted.
  - If you cannot establish that, exit with no writes.
- If `inputs.force` is `"true"`:
  - Proceed, but add a warning in any issue/report you create:
    "⚠️ Forced manual release mirror run — upstream sync not verified."

This ensures automatic mirroring only happens after successful upstream sync, while still allowing break-glass manual runs.

## Mission
Mirror upstream releases from `gsd-build/get-shit-done` into this fork repository, but do so safely:

- Detect upstream latest release tag (or use `inputs.upstream_tag` if provided).
- Determine whether the fork already mirrored it.
- If not mirrored, request a deterministic worker workflow run via safe output `dispatch-workflow`.

## How Mirroring Works (IMPORTANT)
This agent **does not push tags or create releases directly**.
Instead it dispatches a worker workflow named `release-mirror-worker` which should:
- push the fork tag using the appropriate token (PAT / GitHub App as needed)
- create the fork release and copy upstream release notes

### Worker workflow inputs (REQUIRED)
When dispatching `release-mirror-worker`, pass:
- `upstream_repo`: `gsd-build/get-shit-done`
- `upstream_tag`: resolved tag to mirror
- `force`: `true|false` from manual input

## Required Logic

1. Read `/tmp/gh-aw/release-mirror/upstream-latest.json` and resolve:
   - Upstream tag to mirror:
     - If `inputs.upstream_tag` is non-empty, use it.
     - Else use upstream latest release tag if available.
   - If no upstream tag can be determined, exit with no writes.

2. Check whether the fork already has a release/tag containing `upstream-<UPSTREAM_TAG>`.
   - If mirrored, exit with no writes.

3. If NOT mirrored:
   - Request a `dispatch-workflow` safe output to run `release-mirror-worker`
     with the inputs above.

4. If you detect the fork is >1 upstream release behind (persistent failure signal):
   - Request `create-issue` titled:
     "[upstream-mirror] Release lockstep gap"
     including upstream latest tag, fork latest tag, and the observed gap.

## Definition of Done
- If mirroring was needed: a worker workflow run has been dispatched
- If mirroring was not needed: no safe outputs emitted
- If lockstep is violated: an alert issue exists
``