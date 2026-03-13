# GSD → Copilot Port Maintainer (Fork)

## Goal
Keep this fork synced with upstream gsd-build/get-shit-done while maintaining a Copilot compatibility layer.

## Golden rule
Do NOT rewrite upstream content. Upstream directories remain source-of-truth:
- commands/gsd/**
- get-shit-done/workflows/**
- agents/**
Only maintain the Copilot wrapper layer:
- .github/prompts/**  (VS Code slash commands, generated — not checked in)
- .github/agents/**   (custom Copilot agents)
- .github/copilot-instructions.md
- .github/instructions/upstream-sync-guide.md
- bin/install-copilot.js  (Copilot conversion module)

## Sync PR workflow (what to do when @copilot is pinged)
1) Identify upstream changes.
2) Run: `node bin/install.js --copilot --local`
3) Commit regenerated wrapper files.
4) If the install script fails due to upstream changes, fix `bin/install-copilot.js` (do not rewrite upstream docs).

## Naming conventions
- Prompt command names use dot-namespace: /gsd.new-project
- Mapping is stable: gsd:<cmd> → gsd.<cmd>

## Automated Sync Workflow

The upstream sync is now **automated via GitHub Actions** (`upstream-sync.yml`):

> **Sync direction: downstream only.**
> The `gsd-upstream-sync` agent syncs changes FROM `gsd-build/get-shit-done` INTO this fork — it does not push commits or open PRs on the upstream repo. There is no automated path to do so, by design.
>
> If asked to contribute changes back to `gsd-build/get-shit-done`, decline and instruct the user to do so manually by opening a PR on the upstream repo directly.

### Daily Schedule
1. **Detection:** Compares fork HEAD with `upstream/main`
2. **Merge:** `git merge upstream/main` (if changes exist)
3. **Generation + Verification:** `node bin/install.js --copilot --local`
4. **PR Creation:** Submits PR on **this fork** if validation passes

### If Validation Fails
When the install script fails:
1. **Sync Agent Invoked:** `@gsd-upstream-sync` agent analyzes the problem
2. **Diagnosis:** Agent reads `bin/install-copilot.js` and upstream changes
3. **Fix:** Agent updates `bin/install-copilot.js` (never upstream content)
4. **Verification:** Agent re-runs `node bin/install.js --copilot --local` to confirm fix
5. **Commit:** Changes committed and PR created on this fork

See `.github/instructions/upstream-sync-guide.md` for full details and manual sync options.

## Definition of Done
- [ ] PR contains upstream merge + updated Copilot wrapper layer
- [ ] `node bin/install.js --copilot --local` succeeds
- [ ] No manual edits to upstream files unless absolutely unavoidable and explained
- [ ] If upstream changes broke the install script, sync agent fixed `bin/install-copilot.js`
- [ ] All generated prompts validated
