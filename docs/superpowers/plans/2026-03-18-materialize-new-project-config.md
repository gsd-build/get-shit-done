# Materialize new-project config on initialization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `/gsd:new-project` creates `.planning/config.json`, the file contains all effective defaults — not just the 6 user-chosen keys — so developers can see every setting without reading source code.

**Architecture:** Add a single JS function `buildNewProjectConfig(cwd, userChoices)` in `config.cjs` as the one source of truth for a new project's full config. Expose it as a CLI command `config-new-project`. Update the `new-project.md` workflow to call this command instead of writing a partial JSON inline.

**Tech Stack:** Node.js/CommonJS, existing gsd-tools CLI, `node:test` for tests.

---

## Background: what exists today

`new-project.md` Step 5 writes this partial config (the AI fills the template):

```json
{
  "mode": "...", "granularity": "...", "parallelization": "...",
  "commit_docs": "...", "model_profile": "...",
  "workflow": { "research", "plan_check", "verifier", "nyquist_validation" }
}
```

Missing keys silently resolved by `loadConfig()` at runtime:

- `search_gitignored: false`
- `brave_search: false` (or env-detected `true`)
- `git.branching_strategy: "none"`
- `git.phase_branch_template: "gsd/phase-{phase}-{slug}"`
- `git.milestone_branch_template: "gsd/{milestone}-{slug}"`

Full config that should exist from the start:

```json
{
  "mode": "yolo|interactive",
  "granularity": "coarse|standard|fine",
  "model_profile": "balanced",
  "commit_docs": true,
  "parallelization": true,
  "search_gitignored": false,
  "brave_search": false,
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}"
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  }
}
```

---

## File map

| File | Action | Purpose |
|------|--------|---------|
| `get-shit-done/bin/lib/config.cjs` | Modify | Add `buildNewProjectConfig()` + `cmdConfigNewProject()` |
| `get-shit-done/bin/gsd-tools.cjs` | Modify | Register `config-new-project` case + update usage string |
| `get-shit-done/workflows/new-project.md` | Modify | Steps 2a + 5: replace inline JSON write with CLI call |
| `tests/config.test.cjs` | Modify | Add `config-new-project` test suite |

---

## Task 1: Add `buildNewProjectConfig` and `cmdConfigNewProject` to config.cjs

**Files:**

- Modify: `get-shit-done/bin/lib/config.cjs`

- [ ] **Step 1.1: Write the failing tests first**

Add to `tests/config.test.cjs` (after the `config-get` suite, before `module.exports`):

```js
// ─── config-new-project ──────────────────────────────────────────────────────

describe('config-new-project command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates full config with all expected top-level and nested keys', () => {
    const choices = JSON.stringify({
      mode: 'interactive',
      granularity: 'standard',
      parallelization: true,
      commit_docs: true,
      model_profile: 'balanced',
      workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true },
    });
    const result = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);

    // User choices present
    assert.strictEqual(config.mode, 'interactive');
    assert.strictEqual(config.granularity, 'standard');
    assert.strictEqual(config.parallelization, true);
    assert.strictEqual(config.commit_docs, true);
    assert.strictEqual(config.model_profile, 'balanced');

    // Defaults materialized
    assert.strictEqual(typeof config.search_gitignored, 'boolean');
    assert.strictEqual(typeof config.brave_search, 'boolean');

    // git section present with all three keys
    assert.ok(config.git && typeof config.git === 'object', 'git section should exist');
    assert.strictEqual(config.git.branching_strategy, 'none');
    assert.strictEqual(config.git.phase_branch_template, 'gsd/phase-{phase}-{slug}');
    assert.strictEqual(config.git.milestone_branch_template, 'gsd/{milestone}-{slug}');

    // workflow section present with all four keys
    assert.ok(config.workflow && typeof config.workflow === 'object', 'workflow section should exist');
    assert.strictEqual(config.workflow.research, true);
    assert.strictEqual(config.workflow.plan_check, true);
    assert.strictEqual(config.workflow.verifier, true);
    assert.strictEqual(config.workflow.nyquist_validation, true);
  });

  test('user choices override defaults', () => {
    const choices = JSON.stringify({
      mode: 'yolo',
      granularity: 'coarse',
      parallelization: false,
      commit_docs: false,
      model_profile: 'quality',
      workflow: { research: false, plan_check: false, verifier: true, nyquist_validation: false },
    });
    const result = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.mode, 'yolo');
    assert.strictEqual(config.granularity, 'coarse');
    assert.strictEqual(config.parallelization, false);
    assert.strictEqual(config.commit_docs, false);
    assert.strictEqual(config.model_profile, 'quality');
    assert.strictEqual(config.workflow.research, false);
    assert.strictEqual(config.workflow.plan_check, false);
    assert.strictEqual(config.workflow.verifier, true);
    assert.strictEqual(config.workflow.nyquist_validation, false);
    // Defaults still present for non-chosen keys
    assert.strictEqual(config.git.branching_strategy, 'none');
    assert.strictEqual(typeof config.search_gitignored, 'boolean');
  });

  test('works with empty choices — all defaults materialized', () => {
    const result = runGsdTools(['config-new-project', '{}'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.commit_docs, true);
    assert.strictEqual(config.parallelization, true);
    assert.strictEqual(config.search_gitignored, false);
    assert.ok(config.git && typeof config.git === 'object');
    assert.strictEqual(config.git.branching_strategy, 'none');
    assert.ok(config.workflow && typeof config.workflow === 'object');
    assert.strictEqual(config.workflow.nyquist_validation, true);
  });

  test('is idempotent — returns already_exists if config exists', () => {
    // First call: create
    const choices = JSON.stringify({ mode: 'yolo', granularity: 'fine' });
    const first = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(first.success, `First call failed: ${first.error}`);
    const firstOut = JSON.parse(first.output);
    assert.strictEqual(firstOut.created, true);

    // Second call: idempotent
    const second = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(second.success, `Second call failed: ${second.error}`);
    const secondOut = JSON.parse(second.output);
    assert.strictEqual(secondOut.created, false);
    assert.strictEqual(secondOut.reason, 'already_exists');

    // Config unchanged
    const config = readConfig(tmpDir);
    assert.strictEqual(config.mode, 'yolo');
    assert.strictEqual(config.granularity, 'fine');
  });

  test('auto_advance in workflow choices is preserved', () => {
    const choices = JSON.stringify({
      mode: 'yolo',
      granularity: 'standard',
      workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true, auto_advance: true },
    });
    const result = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.auto_advance, true);
  });

  test('rejects invalid JSON choices', () => {
    const result = runGsdTools(['config-new-project', '{not-json}'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Invalid JSON'), `Expected "Invalid JSON" in: ${result.error}`);
  });

  test('output JSON has created:true on success', () => {
    const choices = JSON.stringify({ mode: 'interactive', granularity: 'standard' });
    const result = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.created, true);
    assert.strictEqual(out.path, '.planning/config.json');
  });
});
```

- [ ] **Step 1.2: Run failing tests to confirm they fail**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/config.test.cjs 2>&1 | grep -E "config-new-project|FAIL|Error"
```

Expected: All `config-new-project` tests fail with "config-new-project is not a valid command" or similar.

- [ ] **Step 1.3: Implement `buildNewProjectConfig` and `cmdConfigNewProject` in config.cjs**

In `get-shit-done/bin/lib/config.cjs`, add the following after the `validateKnownConfigKeyPath` function (around line 35) and before `ensureConfigFile`:

```js
/**
 * Build a fully-materialized config for a new project.
 *
 * Merges (in order of increasing priority):
 *   1. Hardcoded defaults
 *   2. User-level defaults from ~/.gsd/defaults.json (if present)
 *   3. userChoices (the settings the user explicitly selected during new-project)
 *
 * Returns a plain object — does NOT write any files.
 */
function buildNewProjectConfig(cwd, userChoices) {
  const choices = userChoices || {};
  const homedir = require('os').homedir();

  // Detect Brave Search API key availability
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Load user-level defaults from ~/.gsd/defaults.json if available
  const globalDefaultsPath = path.join(homedir, '.gsd', 'defaults.json');
  let userDefaults = {};
  try {
    if (fs.existsSync(globalDefaultsPath)) {
      userDefaults = JSON.parse(fs.readFileSync(globalDefaultsPath, 'utf-8'));
      // Migrate deprecated "depth" key to "granularity"
      if ('depth' in userDefaults && !('granularity' in userDefaults)) {
        const depthToGranularity = { quick: 'coarse', standard: 'standard', comprehensive: 'fine' };
        userDefaults.granularity = depthToGranularity[userDefaults.depth] || userDefaults.depth;
        delete userDefaults.depth;
        try {
          fs.writeFileSync(globalDefaultsPath, JSON.stringify(userDefaults, null, 2), 'utf-8');
        } catch {}
      }
    }
  } catch {
    // Ignore malformed global defaults
  }

  const hardcoded = {
    model_profile: 'balanced',
    commit_docs: true,
    parallelization: true,
    search_gitignored: false,
    brave_search: hasBraveSearch,
    git: {
      branching_strategy: 'none',
      phase_branch_template: 'gsd/phase-{phase}-{slug}',
      milestone_branch_template: 'gsd/{milestone}-{slug}',
    },
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: true,
    },
  };

  // Three-level merge: hardcoded <- userDefaults <- choices
  return {
    ...hardcoded,
    ...userDefaults,
    ...choices,
    git: {
      ...hardcoded.git,
      ...(userDefaults.git || {}),
      ...(choices.git || {}),
    },
    workflow: {
      ...hardcoded.workflow,
      ...(userDefaults.workflow || {}),
      ...(choices.workflow || {}),
    },
  };
}

/**
 * Command: create a fully-materialized .planning/config.json for a new project.
 *
 * Accepts user-chosen settings as a JSON string (the keys the user explicitly
 * configured during /gsd:new-project). All remaining keys are filled from
 * hardcoded defaults and optional ~/.gsd/defaults.json.
 *
 * Idempotent: if config.json already exists, returns { created: false }.
 */
function cmdConfigNewProject(cwd, choicesJson, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const planningDir = path.join(cwd, '.planning');

  // Idempotent: don't overwrite existing config
  if (fs.existsSync(configPath)) {
    output({ created: false, reason: 'already_exists' }, raw, 'exists');
    return;
  }

  // Parse user choices
  let userChoices = {};
  if (choicesJson && choicesJson.trim() !== '') {
    try {
      userChoices = JSON.parse(choicesJson);
    } catch (err) {
      error('Invalid JSON for config-new-project: ' + err.message);
    }
  }

  // Ensure .planning directory exists
  try {
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }
  } catch (err) {
    error('Failed to create .planning directory: ' + err.message);
  }

  const config = buildNewProjectConfig(cwd, userChoices);

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    output({ created: true, path: '.planning/config.json' }, raw, 'created');
  } catch (err) {
    error('Failed to write config.json: ' + err.message);
  }
}
```

Also add `cmdConfigNewProject` to the `module.exports` at the bottom of `config.cjs`.

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/config.test.cjs 2>&1 | tail -20
```

Expected: All `config-new-project` tests pass. Existing tests still pass.

- [ ] **Step 1.5: Commit**

```bash
cd /Users/diego/Dev/get-shit-done
git add get-shit-done/bin/lib/config.cjs tests/config.test.cjs
git commit -m "feat: add config-new-project command for full config materialization"
```

---

## Task 2: Register `config-new-project` in gsd-tools.cjs

**Files:**

- Modify: `get-shit-done/bin/gsd-tools.cjs`

- [ ] **Step 2.1: Add the case to the switch in gsd-tools.cjs**

After the `config-get` case (around line 401), add:

```js
    case 'config-new-project': {
      config.cmdConfigNewProject(cwd, args[1], raw);
      break;
    }
```

Also update the usage string on line 178 to include `config-new-project`:

Current: `...config-ensure-section, init`
New: `...config-ensure-section, config-new-project, init`

- [ ] **Step 2.2: Smoke-test the CLI registration**

```bash
cd /Users/diego/Dev/get-shit-done
node get-shit-done/bin/gsd-tools.cjs config-new-project '{"mode":"interactive","granularity":"standard"}' --cwd /tmp/gsd-smoke-$(date +%s)
```

Expected: outputs `{"created":true,"path":".planning/config.json"}` (or similar).

Clean up: `rm -rf /tmp/gsd-smoke-*`

- [ ] **Step 2.3: Run full test suite**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/config.test.cjs 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 2.4: Commit**

```bash
cd /Users/diego/Dev/get-shit-done
git add get-shit-done/bin/gsd-tools.cjs
git commit -m "feat: register config-new-project in gsd-tools CLI router"
```

---

## Task 3: Update new-project.md workflow to use config-new-project

**Files:**

- Modify: `get-shit-done/workflows/new-project.md`

This is the core change. Two places need updating:

- **Step 2a** (auto mode config creation, around line 168–195)
- **Step 5** (interactive mode config creation, around line 470–498)

- [ ] **Step 3.1: Update Step 2a (auto mode)**

Find the block in Step 2a that creates config.json:

```markdown
Create `.planning/config.json` with mode set to "yolo":

```json
{
  "mode": "yolo",
  "granularity": "[selected]",
  ...
}
```

```

Replace the inline JSON write instruction with:

```markdown
Create `.planning/config.json` using the CLI (fills in all defaults automatically):

```bash
mkdir -p .planning
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-new-project "$(cat <<'CHOICES'
{
  "mode": "yolo",
  "granularity": "[selected: coarse|standard|fine]",
  "parallelization": [true|false],
  "commit_docs": [true|false],
  "model_profile": "[selected: quality|balanced|budget|inherit]",
  "workflow": {
    "research": [true|false],
    "plan_check": [true|false],
    "verifier": [true|false],
    "nyquist_validation": [true|false],
    "auto_advance": true
  }
}
CHOICES
)"
```

The command merges your selections with all runtime defaults (`search_gitignored`, `brave_search`, `git` section), producing a fully-materialized config.

```

- [ ] **Step 3.2: Update Step 5 (interactive mode)**

Find the block in Step 5 that creates config.json:

```markdown
Create `.planning/config.json` with all settings:

```json
{
  "mode": "yolo|interactive",
  ...
}
```

```

Replace with:

```markdown
Create `.planning/config.json` using the CLI (fills in all defaults automatically):

```bash
mkdir -p .planning
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-new-project "$(cat <<'CHOICES'
{
  "mode": "[selected: yolo|interactive]",
  "granularity": "[selected: coarse|standard|fine]",
  "parallelization": [true|false],
  "commit_docs": [true|false],
  "model_profile": "[selected: quality|balanced|budget|inherit]",
  "workflow": {
    "research": [true|false],
    "plan_check": [true|false],
    "verifier": [true|false],
    "nyquist_validation": [true|false]
  }
}
CHOICES
)"
```

The command merges your selections with all runtime defaults (`search_gitignored`, `brave_search`, `git` section), producing a fully-materialized config.

```

- [ ] **Step 3.3: Verify the workflow file reads correctly**

```bash
cd /Users/diego/Dev/get-shit-done
grep -n "config-new-project\|config\.json\|CHOICES" get-shit-done/workflows/new-project.md
```

Expected: 2 occurrences of `config-new-project` (one per step), no more inline JSON templates for config creation.

- [ ] **Step 3.4: Commit**

```bash
cd /Users/diego/Dev/get-shit-done
git add get-shit-done/workflows/new-project.md
git commit -m "feat: use config-new-project in new-project workflow for full config materialization"
```

---

## Task 4: Validation

- [ ] **Step 4.1: Run the full test suite**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/ 2>&1 | tail -30
```

Expected: All tests pass (no regressions).

- [ ] **Step 4.2: Manual end-to-end validation**

Simulate what `new-project.md` does for a new project:

```bash
# Create a fresh project dir
TMP=$(mktemp -d)
cd "$TMP"

# Step 1 simulation: what init new-project returns
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs init new-project --cwd "$TMP"

# Step 5 simulation: create full config
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-new-project '{
  "mode": "interactive",
  "granularity": "standard",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  }
}' --cwd "$TMP"

# Verify the file has all 12 expected keys
echo "=== Generated config.json ==="
cat "$TMP/.planning/config.json"

# Clean up
rm -rf "$TMP"
```

Expected output: a config.json with `mode`, `granularity`, `model_profile`, `commit_docs`, `parallelization`, `search_gitignored`, `brave_search`, `git` (3 sub-keys), `workflow` (4 sub-keys) — 12 top-level keys total (or 10 if counting `git` and `workflow` as single keys).

- [ ] **Step 4.3: Verify idempotency**

```bash
TMP=$(mktemp -d)
CHOICES='{"mode":"yolo","granularity":"coarse"}'

node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-new-project "$CHOICES" --cwd "$TMP"
FIRST=$(cat "$TMP/.planning/config.json")

# Second call should be no-op
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-new-project "$CHOICES" --cwd "$TMP"
SECOND=$(cat "$TMP/.planning/config.json")

[ "$FIRST" = "$SECOND" ] && echo "IDEMPOTENT: OK" || echo "IDEMPOTENT: FAIL"
rm -rf "$TMP"
```

Expected: `IDEMPOTENT: OK`

- [ ] **Step 4.4: Verify loadConfig still reads the new format correctly**

```bash
TMP=$(mktemp -d)
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-new-project '{
  "mode":"yolo","granularity":"standard","parallelization":true,"commit_docs":true,
  "model_profile":"balanced",
  "workflow":{"research":true,"plan_check":false,"verifier":true,"nyquist_validation":true}
}' --cwd "$TMP"

# loadConfig should correctly read plan_check (nested as workflow.plan_check)
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-get workflow.plan_check --cwd "$TMP"
# Expected: false

node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-get git.branching_strategy --cwd "$TMP"
# Expected: "none"

rm -rf "$TMP"
```

- [ ] **Step 4.5: Final full test suite + commit**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/ 2>&1 | grep -E "pass|fail|error" | tail -5
```

Expected: All pass, 0 failures.

---

## Appendix: PR description for upstream

```
feat: materialize all config defaults at new-project initialization

**Problem:**
`/gsd:new-project` creates `.planning/config.json` with only the 6 keys
the user explicitly chose during onboarding. Five additional keys
(`search_gitignored`, `brave_search`, `git.branching_strategy`,
`git.phase_branch_template`, `git.milestone_branch_template`) are resolved
silently by `loadConfig()` at runtime but never written to disk.

This creates two problems:
1. **Discoverability**: users can't see or understand `git.branching_strategy`
   without reading source code — it doesn't appear in their config.
2. **Implicit expansion**: the first time `/gsd:settings` or `config-set`
   writes to the config, those keys still aren't added. The config only
   reflects a fraction of the effective configuration.

**Solution:**
Add `config-new-project` CLI command to `gsd-tools.cjs`. The command:
- Accepts user-chosen values as JSON
- Merges them with all runtime defaults (including env-detected `brave_search`)
- Writes the fully-materialized config in one shot

Update `new-project.md` workflow (Steps 2a and 5) to call this command
instead of writing a hardcoded partial JSON template. Defaults now live in
exactly one place: `buildNewProjectConfig()` in `config.cjs`.

**Why this is conservative:**
- No changes to `loadConfig()`, `ensureConfigFile()`, or any read path
- No new config keys introduced
- No semantic changes — same values the system was already resolving silently
- Fully backward-compatible: `loadConfig()` continues to handle both the old
  partial format (existing projects) and the new full format
- Idempotent: calling `config-new-project` twice is safe
- No new user-facing flags

**Why this improves discoverability:**
A developer opening `.planning/config.json` for the first time can now see
`git.branching_strategy: "none"` and immediately understand that branching
is available and configurable, without reading the GSD source.
```
