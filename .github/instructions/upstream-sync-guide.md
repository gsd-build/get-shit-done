# Upstream Sync Guide

This fork automatically syncs with `gsd-build/get-shit-done` using GitHub Actions and the gsd-upstream-sync agent.

## How It Works

### Automatic Sync (Daily)
1. **GitHub Action triggers** (`upstream-sync.yml`): daily at 6 AM UTC (or on manual dispatch)
2. **Detects upstream changes** by comparing with `upstream/main`
3. **Merges upstream** using `git merge upstream/main`
4. **Regenerates wrappers** using `node bin/install.js --copilot --local`
5. **Creates PR** for human review if everything passes

### If Validation Fails
1. GitHub Action detects that `node bin/install.js --copilot --local` fails
2. **gsd-upstream-sync agent is invoked** (via manual invocation)
3. Agent:
   - Analyzes upstream changes
   - Diagnoses what broke in `bin/install-copilot.js`
   - **Fixes `bin/install-copilot.js`** (not upstream content)
   - Re-runs `node bin/install.js --copilot --local`
   - Commits changes
4. Human reviews and merges PR

## Key Invariant

**Never rewrite upstream content.** The golden rule from `AGENTS.md`:

```
Upstream directories remain source-of-truth:
- commands/gsd/**
- get-shit-done/workflows/**
- agents/**

Only maintain the Copilot wrapper layer:
- .github/prompts/**  (generated from commands/gsd/)
- .github/agents/**   (custom Copilot profiles)
- bin/install-copilot.js  (conversion logic that maintains wrapper layer)
```

## Manual Sync (If Needed)

### Option 1: Trigger GitHub Action
```bash
# Go to Actions > Upstream Sync > Run workflow
```

### Option 2: Manual Merge + Regenerate

```bash
# Add upstream remote (one-time setup)
git remote add upstream https://github.com/gsd-build/get-shit-done.git

# Fetch latest from upstream
git fetch upstream main

# Merge
git merge upstream/main

# Regenerate Copilot layer (prompts + agents)
node bin/install.js --copilot --local

# If it fails, invoke the sync agent:
# > @gsd-upstream-sync analyze why the install script broke and fix bin/install-copilot.js
```

### Option 3: Invoke Sync Agent Directly

If invoking the agent manually:

```
@gsd-upstream-sync 

The upstream merge succeeded but node bin/install.js --copilot --local failed. 
Diagnose and fix bin/install-copilot.js.
```

Agent will:
1. Read the failing scripts
2. Analyze upstream changes
3. Identify what broke
4. Fix the generator or verifier
5. Verify the fix works
6. Commit and report

## Common Scenarios

### Scenario: New Commands Added Upstream
- ✅ `node bin/install.js --copilot --local` automatically discovers new files in `commands/gsd/`
- ✅ New prompts generated in `.github/prompts/`
- ✅ Prompt count is verified after generation
- → PR created automatically

### Scenario: Command Metadata Format Changed
- ❌ `node bin/install.js --copilot --local` fails because parser expects old format
- → Sync agent invoked
- → Agent fixes parsing logic in `bin/install-copilot.js`
- → Script re-runs and passes
- → PR created

### Scenario: Upstream Agent Removed/Renamed
- ✅ `node bin/install.js --copilot --local` only processes `commands/gsd/` for prompts (not affected by upstream agents)
- ✅ Prompt count check confirms no regression
- → No validation failure
- → PR created normally

### Scenario: Merge Conflict (Rare)
- ❌ `git merge upstream/main` fails with conflicts
- → Workflow aborts (merge reverted)
- → Manual intervention required
- → Resolve conflict locally, then re-run workflow

**To resolve manually:**
```bash
git fetch upstream main
git merge upstream/main
# Resolve conflicts in tracked files (.github/prompts/ is generated, not checked in)
git add .
git commit -m "merge(upstream): resolve conflicts"
git push
# Trigger workflow again
```

## Monitoring

### Check Sync Status
```bash
# Last sync
git log --oneline | grep "merge(upstream)"

# Compare with upstream
git log --oneline HEAD..upstream/main

# Check for uncommitted changes
git status
```

### View Workflow Logs
- Go to Actions > Upstream Sync > [latest run]
- Look for:
  - ✅ "No upstream changes" — already in sync
  - ✅ "wrapper_changed=true" — PR was created
  - ❌ "validation_failed=true" — sync agent was invoked
  - ❌ Merge failure — manual intervention needed

## Troubleshooting

### Generator Fails: "No command files found"
- **Cause:** `commands/gsd/` directory structure changed in upstream
- **Fix:** Sync agent updates the file listing logic in generator

### Verifier Fails: "Missing generated prompt files"
- **Cause:** New commands added, but generator didn't create prompts
- **Fix:** Sync agent debugs why generator skipped them

### Verifier Fails: "Prompt naming mismatch"
- **Cause:** Upstream changed command naming convention
- **Fix:** Sync agent updates `normalizeName()` function

### PR Has Too Many Changes
- **Cause:** Generator output changed (formatting, path normalization, etc.)
- **Audit:** Review `.github/prompts/` diff to ensure it's expected
- **If unexpected:** Check what upstream changed that caused it

## Maintenance Tasks

### Annual Code Review
Once a year, review the generator and verifier for:
- [ ] Are there edge cases in YAML parsing?
- [ ] Could path normalization fail on edge cases?
- [ ] Does `normalizeName()` correctly pass through upstream `gsd:<cmd>` colon syntax?
- [ ] Are error messages helpful?

### Update Cron Schedule
Edit `.github/workflows/upstream-sync.yml` if sync frequency needs to change:
```yaml
schedule:
  - cron: '0 6 * * *'  # ← Change this (day of week, time, etc.)
```

Cron format: `minute hour day month day-of-week`
- `0 6 * * *` = daily 6 AM
- `0 6 * * 1` = every Monday 6 AM (weekly)
- `0 0 1 * *` = monthly on 1st at midnight

## Questions?

- **How do I customize sync behavior?** Edit `.github/workflows/upstream-sync.yml`
- **How do I prevent a sync?** Disable the workflow in GitHub Actions
- **How do I sync a specific commit?** Use `git merge <commit-hash>` manually
- **How do I revert a sync?** `git revert <sync-commit-hash>`

