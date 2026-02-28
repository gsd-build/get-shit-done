# Phase 6: Testing & Validation

## Objective
Verify the complete Roo integration works end-to-end: installer runs correctly, all commands appear in Roo's command palette, modes are registered, and the core workflow (map-codebase → new-project → plan-phase → execute-phase → verify-work) functions correctly in a test project.

## Test Scope

### 6.1 Installer Tests

#### Test 1: `--roo --global` install
```bash
cd c:/Users/sge20/go/src/github.com/harmony-ai-solutions/get-shit-done
node bin/install.js --roo --global
```
**Expected:**
- `~/.roo/commands/gsd-*.md` created (one per GSD command)
- `~/.roo/get-shit-done/workflows/*.md` deployed
- `~/.roo/get-shit-done/templates/` deployed
- `~/.roo/get-shit-done/references/` deployed
- `~/.roo/get-shit-done/bin/gsd-tools.cjs` deployed
- `~/.roo/get-shit-done/agents/` deployed
- Global `custom_modes.yaml` updated with 11 GSD modes

#### Test 2: `--roo --local` install (project-level)
```bash
cd /path/to/test-project
node bin/install.js --roo --local
```
**Expected:**
- `.roo/commands/gsd-*.md` created in project
- `.roo/get-shit-done/` deployed to project

#### Test 3: `--all` installs both Claude and Roo
```bash
node bin/install.js --all --global
```
**Expected:**
- Both `~/.claude/commands/gsd/` and `~/.roo/commands/gsd-*.md` created
- Both runtimes' support files deployed

#### Test 4: `--roo --global --uninstall`
```bash
node bin/install.js --roo --global --uninstall
```
**Expected:**
- All `~/.roo/commands/gsd-*.md` removed
- `~/.roo/get-shit-done/` removed
- GSD modes removed from `custom_modes.yaml`

### 6.2 Command File Validation

Verify each converted command file:

```bash
# Check all 25 command files exist in ~/.roo/commands/
ls ~/.roo/commands/gsd-*.md | wc -l  # Should be 25+

# Check frontmatter is Roo-format (no 'name:', no 'allowed-tools:')
grep -l "^name:" ~/.roo/commands/gsd-*.md  # Should return nothing
grep -l "^allowed-tools:" ~/.roo/commands/gsd-*.md  # Should return nothing
grep -l "^description:" ~/.roo/commands/gsd-*.md | wc -l  # Should be 25

# Check path replacements
grep -r "\.claude/get-shit-done" ~/.roo/commands/  # Should return nothing
grep -r "\.roo/get-shit-done" ~/.roo/commands/ | wc -l  # Should have entries
```

### 6.3 Mode Registration Validation

```bash
# Verify modes in custom_modes.yaml
grep "gsd-executor\|gsd-planner\|gsd-phase-researcher" \
  ~/.roo/custom_modes.yaml  # (or global path)
```

Or in VS Code: Open Roo settings → Modes → verify all 11 GSD modes appear.

### 6.4 Functional Workflow Test

Using a dedicated test project (`/tmp/gsd-roo-test`):

#### Step 1: Map codebase
```
/gsd-map-codebase
```
Verify: `.planning/codebase/` created with 7 documents

#### Step 2: New project
```
/gsd-new-project
```
Verify: `.planning/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json` created

#### Step 3: Discuss phase 1
```
/gsd-discuss-phase 1
```
Verify: `.planning/phases/01-*/CONTEXT.md` created

#### Step 4: Plan phase 1
```
/gsd-plan-phase 1
```
Verify: `.planning/phases/01-*/01-01-PLAN.md` created, `RESEARCH.md` created

#### Step 5: Execute phase 1
```
/gsd-execute-phase 1
```
Verify: Code changes committed, `SUMMARY.md` created, `STATE.md` updated

#### Step 6: Verify work
```
/gsd-verify-work 1
```
Verify: UAT session initiated, test results tracked

#### Step 7: Quick task
```
/gsd-quick
```
Verify: Ad-hoc task executes and commits

#### Step 8: Debug
```
/gsd-debug "test issue"
```
Verify: Debug session created in `.planning/debug/`

### 6.5 gsd-tools.cjs Validation

```bash
# Test gsd-tools self-resolution works from Roo path
node ~/.roo/get-shit-done/bin/gsd-tools.cjs --help
node ~/.roo/get-shit-done/bin/gsd-tools.cjs state load
```

### 6.6 Command Name Display Test

Open VS Code Command Palette → type `/gsd` → verify commands show as:
- `/gsd-new-project`
- `/gsd-plan-phase`
- `/gsd-execute-phase`
- etc. (NOT `/gsd:xxx` format)

## Known Limitations to Document

1. **Sequential execution**: Roo executes subagents one at a time. Multi-plan phases take longer than in Claude Code.

2. **No `AskUserQuestion` equivalent for subagents**: When a GSD agent-as-mode needs to ask the user something, it uses `ask_followup_question` — this works but the UX differs slightly from Claude Code's `AskUserQuestion`.

3. **Model profile resolution**: GSD's model profiles (Opus/Sonnet/Haiku per agent) map to whatever model is configured in the target Roo mode. The `gsd-tools.cjs resolve-model` command returns model names — in Roo, the model is set per-mode in settings rather than dynamically per-call. Document this difference.

4. **`SlashCommand` tool**: GSD uses `SlashCommand` in some orchestrators to call other GSD commands recursively. In Roo, this is handled by telling the AI to invoke the slash command directly (which it does by reading the command file). No special tool needed.

## Documentation Updates Required

### `README.md`
- Add Roo installation section:
  ```bash
  # Install for Roo Code
  npx get-shit-done-cc --roo --global
  ```
- Add Roo command reference (command names use dashes: `/gsd-map-codebase`)
- Add known limitations section for Roo

### `CHANGELOG.md`
- Entry: "Added Roo Code (VS Code Extension) support via `--roo` install flag"

### `docs/USER-GUIDE.md`
- Add Roo-specific section covering:
  - Installation steps
  - Command naming differences (`/gsd-xxx` vs `/gsd:xxx`)
  - Sequential execution behavior
  - Mode registration
  - Project-level vs global install

## Progress Checklist
- [ ] Installer test 1 passes (`--roo --global`)
- [ ] Installer test 2 passes (`--roo --local`)
- [ ] Installer test 3 passes (`--all --global`)
- [ ] Installer test 4 passes (uninstall)
- [ ] Command file validation passes (all 25+ files, correct format)
- [ ] Mode registration validation passes (11 modes in Roo)
- [ ] Functional workflow test passes (map → new-project → plan → execute → verify)
- [ ] gsd-tools.cjs works from `~/.roo/` path
- [ ] Command names display correctly in VS Code palette
- [ ] Known limitations documented
- [ ] README.md updated
- [ ] CHANGELOG.md updated
- [ ] USER-GUIDE.md Roo section added
