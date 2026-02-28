# Phase 7: Post-Installation Review & Fixes

## Objective

Fix all implementation drifts identified during post-installation review of the Roo integration. All fixes are changes to [`bin/install.js`](c:/Users/sge20/go/src/github.com/harmony-ai-solutions/get-shit-done/bin/install.js) — specifically the `convertCommandForRoo()`, `replacePathsForRoo()`, `installRooModes()`, and support file copy pipeline. After fixing the installer, re-run `node bin/install.js --roo --local` to regenerate the `.roo/` folder.

## Drift Summary

| # | Severity | Root Cause Location | Issue |
|---|---|---|---|
| 1 | 🔴 Critical | `convertCommandForRoo()` | Frontmatter fields `name:`, `allowed-tools:`, `argument-hint:` not stripped |
| 2 | 🔴 Critical | `convertCommandForRoo()` | `Glob`/`Grep` survive in `allowed-tools:` YAML list — regex misses frontmatter format |
| 3 | 🔴 Critical | `convertCommandForRoo()` | `/gsd:xxx` not converted to `/gsd-xxx` in command bodies |
| 4 | 🔴 Critical | Support file copy pipeline | `.claude` paths survive in deployed workflow files |
| 5 | 🔴 Critical | Agent copy pipeline | Agent role definitions retain `/gsd:xxx` and Claude tool names |
| 6 | 🟡 Medium | `installRooModes()` | `custom_modes.yaml` format is JSON not YAML — plan docs misleading |
| 7 | 🟡 Medium | `installRooModes()` | Missing `whenToUse`, `source`; mode `name` is slug not human-readable |
| 8 | 🟡 Medium | `installRooModes()` | `roo-modes-generated.yaml` fallback artifact not created |
| 9 | 🟡 Medium | (same as #1) | `argument-hint:` survives — already fixed by fix for #1 |
| 10 | 🟡 Medium | (same as #4) | Workflow `@` links resolve correctly but target files have wrong paths — fixed by fix for #4 |
| 11 | 🟠 Low | Documentation | README, CHANGELOG, USER-GUIDE not updated |
| 12 | ⚪ Info | Source `agents/` dir | Verify agent count: plan says 11, spot-check source directory |

---

## Fix 1 + 2 + 3 + 9: `convertCommandForRoo()` — Frontmatter Stripping + Tool Names + Command References

### What needs to change

The [`convertCommandForRoo()`](c:/Users/sge20/go/src/github.com/harmony-ai-solutions/get-shit-done/bin/install.js:1036) function must:

1. **Strip the entire frontmatter** and rebuild it with only `description:` (extracted from the existing `description:` field).
2. **Convert `/gsd:xxx` to `/gsd-xxx`** everywhere in the body text (prose, process steps, context blocks).
3. The `allowed-tools:` tool name conversion in the body already works for body content — but since `allowed-tools:` is being removed from the frontmatter entirely, fix #1 makes fix #2 moot for frontmatter.

### Implementation

Replace the frontmatter handling section of `convertCommandForRoo()` with:

```js
function convertCommandForRoo(content, pathPrefix) {
  // --- Step 1: Parse and rebuild frontmatter ---
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) {
    const fmRaw = fmMatch[1];

    // Extract only the description value
    const descMatch = fmRaw.match(/^description:\s*["']?(.*?)["']?\s*$/m);
    let description = descMatch ? descMatch[1].trim() : 'GSD slash command';

    // Reconstruct frontmatter with only description
    const newFrontmatter = `---\ndescription: "${description}"\n---\n`;
    content = content.replace(/^---\n[\s\S]*?\n---\n/, newFrontmatter);
  }

  // --- Step 2: Convert tool names in body (existing logic) ---
  const toolMap = {
    'Read':              'read_file',
    'Write':             'write_to_file',
    'Edit':              'apply_diff',
    'Bash':              'execute_command',
    'Glob':              'list_files',
    'Grep':              'search_files',
    'Task':              'new_task',
    'AskUserQuestion':   'ask_followup_question',
    'TodoWrite':         'update_todo_list',
  };
  for (const [claude, roo] of Object.entries(toolMap)) {
    const regex = new RegExp(`(?<=- )${claude}\\b`, 'g');
    content = content.replace(regex, roo);
  }

  // --- Step 3: Convert /gsd:xxx → /gsd-xxx in body text ---
  content = content.replace(/\/gsd:([a-z][a-z0-9-]*)/g, '/gsd-$1');

  // --- Step 4: Path replacement ---
  content = replacePathsForRoo(content, pathPrefix);

  // --- Step 5: Project instructions update ---
  content = updateProjectInstructionsForRoo(content);

  return content;
}
```

**Key points:**
- The regex `\/gsd:([a-z][a-z0-9-]*)` matches `/gsd:map-codebase`, `/gsd:plan-phase 1` etc. The replacement `'/gsd-$1'` produces `/gsd-map-codebase`, `/gsd-plan-phase` (the argument `1` after a space is not captured and remains).
- The frontmatter rebuild removes `name:`, `allowed-tools:`, `argument-hint:` entirely.
- If no `description:` is found in the original frontmatter, a sensible default is used.

---

## Fix 4 + 10: Apply Path + Command Reference Conversion to Workflow Files

### What needs to change

The support file copy pipeline (the function that copies `get-shit-done/workflows/`, `get-shit-done/templates/`, `get-shit-done/references/`, and `get-shit-done/bin/` to `.roo/get-shit-done/`) currently copies files verbatim. It must apply two conversions to **every `.md` file** during copy:

1. `replacePathsForRoo()` — converts `.claude` paths to `.roo` paths
2. A `/gsd:xxx` → `/gsd-xxx` replacement — same regex as Fix #3 above

### Locate the support file copy pipeline

Find the section in [`bin/install.js`](c:/Users/sge20/go/src/github.com/harmony-ai-solutions/get-shit-done/bin/install.js) that copies `get-shit-done/` support files to the Roo target dir (around lines 1282–1290 where `isRoo` branch is used for content conversion). The issue is that this conversion branch may only be invoked for command files but **not** for workflow/template/reference files.

### Implementation

In the `copyDirRecursive` (or equivalent) function called for Roo support files, add a per-file content transform for `.md` files:

```js
function copyGsdSupportFilesForRoo(srcDir, destDir, pathPrefix) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    
    if (entry.isDirectory()) {
      copyGsdSupportFilesForRoo(srcPath, destPath, pathPrefix);
    } else if (entry.isFile()) {
      let content = fs.readFileSync(srcPath, 'utf8');
      
      // Apply Roo conversions to all .md files
      if (entry.name.endsWith('.md')) {
        content = replacePathsForRoo(content, pathPrefix);
        // Convert /gsd:xxx → /gsd-xxx in workflow/template prose
        content = content.replace(/\/gsd:([a-z][a-z0-9-]*)/g, '/gsd-$1');
      }
      
      fs.writeFileSync(destPath, content);
    }
  }
}
```

Then in the Roo install branch, replace any existing `copyDirRecursive(sourceGsdDir, gsdDir)` call with `copyGsdSupportFilesForRoo(sourceGsdDir, gsdDir, pathPrefix)`.

---

## Fix 5: Apply Conversions to Agent Files Before Embedding in `custom_modes.yaml`

### What needs to change

The [`installRooModes()`](c:/Users/sge20/go/src/github.com/harmony-ai-solutions/get-shit-done/bin/install.js:720) function reads agent files and sets their content as `roleDefinition`. It calls `replacePathsForRoo()`, but **does not apply the `/gsd:xxx` → `/gsd-xxx` conversion** or the **tool name prose references**.

### Implementation

In `installRooModes()`, after reading each agent file:

```js
let roleDefinition = fs.readFileSync(agentPath, 'utf8');

// Apply path conversion
roleDefinition = replacePathsForRoo(roleDefinition);

// Apply /gsd:xxx → /gsd-xxx conversion for prose references
roleDefinition = roleDefinition.replace(/\/gsd:([a-z][a-z0-9-]*)/g, '/gsd-$1');

// Apply CLAUDE.md → .roo/rules reference update
roleDefinition = updateProjectInstructionsForRoo(roleDefinition);

// Note: do NOT mechanically replace tool names in prose (Read, Write, etc.)
// These appear in explanatory prose and the AI understands them contextually.
// EXCEPTION: explicit tool invocation instructions like "use the `Read` tool" 
// should be updated:
roleDefinition = roleDefinition.replace(/`Read` tool/g, '`read_file` tool');
roleDefinition = roleDefinition.replace(/`Write` tool/g, '`write_to_file` tool');
roleDefinition = roleDefinition.replace(/`Edit` tool/g, '`apply_diff` tool');
roleDefinition = roleDefinition.replace(/`Bash` tool/g, '`execute_command` tool');
```

---

## Fix 6: Document JSON vs YAML Format in Plan

### What needs to change

The plan (Phase 4) describes Roo custom modes as YAML, but Roo actually uses JSON stored in a `.yaml`-named file. This is not a code fix — it's a plan documentation correction.

Update [`.current_work/roo-integration/4-AgentModeMapping.md`](.current_work/roo-integration/4-AgentModeMapping.md) to add a note to the **Background** section:

```markdown
> **Important:** Despite the `.yaml` file extension, Roo stores `custom_modes.yaml`
> as **JSON** internally. The installer must write valid JSON, not YAML syntax.
> The `formatModesAsYaml()` function should actually produce `JSON.stringify(...)` output.
> The filename `.yaml` is kept for compatibility with Roo's file detection.
```

---

## Fix 7: `installRooModes()` — Add `whenToUse`, `source`, and Human-Readable `name`

### What needs to change

The generated mode objects in [`installRooModes()`](c:/Users/sge20/go/src/github.com/harmony-ai-solutions/get-shit-done/bin/install.js:720) must include:
- `whenToUse` — a human-readable description of when this mode is invoked by GSD
- `source: "global"` (or `"project"` for local install)
- `name` — formatted as `"GSD Executor"` (title-case words), not `"gsd-executor"`

### Implementation

Update the `agentModeMap` lookup object in `installRooModes()` to ensure all fields are correct. Additionally update the object construction to include `whenToUse` and `source`:

```js
const agentModeMap = {
  'gsd-executor.md':             { slug: 'gsd-executor',            name: 'GSD Executor',            groups: ['read','edit','command','mcp'], whenToUse: 'Executes GSD PLAN.md files atomically with per-task commits. Spawned by /gsd-execute-phase.' },
  'gsd-planner.md':              { slug: 'gsd-planner',             name: 'GSD Planner',             groups: ['read','edit','command','mcp'], whenToUse: 'Creates PLAN.md files for GSD phases. Spawned by /gsd-plan-phase.' },
  'gsd-phase-researcher.md':     { slug: 'gsd-phase-researcher',    name: 'GSD Phase Researcher',    groups: ['read','edit','command','mcp'], whenToUse: 'Researches domain knowledge before phase planning. Spawned by /gsd-plan-phase.' },
  'gsd-project-researcher.md':   { slug: 'gsd-project-researcher',  name: 'GSD Project Researcher',  groups: ['read','edit','command','mcp'], whenToUse: 'Researches project domain during new project initialization. Spawned by /gsd-new-project.' },
  'gsd-research-synthesizer.md': { slug: 'gsd-research-synthesizer',name: 'GSD Research Synthesizer',groups: ['read','edit'],               whenToUse: 'Synthesizes parallel research findings into a single RESEARCH.md. Spawned by /gsd-plan-phase.' },
  'gsd-codebase-mapper.md':      { slug: 'gsd-codebase-mapper',     name: 'GSD Codebase Mapper',     groups: ['read','edit','command'],      whenToUse: 'Maps an existing codebase into structured .planning/codebase/ documents. Spawned by /gsd-map-codebase.' },
  'gsd-roadmapper.md':           { slug: 'gsd-roadmapper',          name: 'GSD Roadmapper',          groups: ['read','edit'],               whenToUse: 'Generates ROADMAP.md from project requirements. Spawned by /gsd-new-project.' },
  'gsd-debugger.md':             { slug: 'gsd-debugger',            name: 'GSD Debugger',            groups: ['read','edit','command'],      whenToUse: 'Performs systematic debugging using scientific method. Spawned by /gsd-debug.' },
  'gsd-verifier.md':             { slug: 'gsd-verifier',            name: 'GSD Verifier',            groups: ['read','command'],            whenToUse: 'Verifies that a phase achieved its goal after execution. Spawned by /gsd-execute-phase and /gsd-verify-work.' },
  'gsd-plan-checker.md':         { slug: 'gsd-plan-checker',        name: 'GSD Plan Checker',        groups: ['read'],                      whenToUse: 'Verifies PLAN.md quality and completeness before execution. Spawned by /gsd-plan-phase.' },
  'gsd-integration-checker.md':  { slug: 'gsd-integration-checker', name: 'GSD Integration Checker', groups: ['read','command'],            whenToUse: 'Validates integration completeness across milestone phases. Spawned by /gsd-audit-milestone.' },
};

// When constructing each mode entry, include all required fields:
modesEntries.push({
  slug:           meta.slug,
  name:           meta.name,           // Human-readable: "GSD Executor"
  roleDefinition: roleDefinition,
  whenToUse:      meta.whenToUse,      // Descriptive usage context
  groups:         meta.groups,
  source:         isGlobal ? 'global' : 'project'
});
```

The JSON serialization for `custom_modes.yaml` must include these fields in the output object.

---

## Fix 8: Generate `roo-modes-generated.yaml` Fallback Artifact

### What needs to change

After writing `custom_modes.yaml`, the installer should also write a human-readable reference file at `<rooConfigDir>/get-shit-done/roo-modes-generated.json` that lists all mode definitions. This is the "manual merge fallback" for users who need to inspect or manually add modes.

### Implementation

At the end of `installRooModes()`, add:

```js
// Write human-readable fallback reference
const fallbackPath = path.join(targetDir, 'get-shit-done', 'roo-modes-generated.json');
fs.writeFileSync(fallbackPath, JSON.stringify({ customModes: modesEntries }, null, 2));
console.log(`  ${green}✓${reset} Mode reference written to: ${cyan}${fallbackPath}${reset}`);
console.log(`  If custom_modes.yaml was not auto-updated, copy entries from this file.`);
```

---

## Fix 11: Documentation Updates

### `README.md`

Add a new section after the existing installation instructions:

````markdown
### Install for Roo Code (VS Code Extension)

```bash
npx get-shit-done-cc --roo --global
```

Commands install to `~/.roo/commands/` as `gsd-{name}.md` files.
In Roo, commands use **dash separators**: `/gsd-map-codebase`, `/gsd-plan-phase`, etc.

GSD agents are registered as custom Roo modes in your Roo settings.
````

### `CHANGELOG.md`

Add entry at the top:

```markdown
## [Unreleased]
### Added
- Roo Code (VS Code Extension) support via `--roo` install flag
- Commands install as `gsd-{name}.md` in `~/.roo/commands/`  
- GSD agents registered as Roo custom modes in `custom_modes.yaml`
- Support files deployed to `~/.roo/get-shit-done/`
```

### `docs/USER-GUIDE.md`

Add a "Roo Code" section covering:
- Installation (`node bin/install.js --roo --global` or `--local`)
- Command naming difference (`/gsd-xxx` vs `/gsd:xxx`)
- Sequential execution behavior (no parallel subagents)
- Mode registration in Roo settings
- Known limitation: model profiles set per-mode in Roo settings, not dynamically per-agent-call

---

## Fix 12: Verify Agent Count

Run the following to confirm the source `agents/` directory has exactly 11 agent files:

```bash
ls agents/*.md | wc -l
# Expected: 11
```

Expected files:
1. `gsd-codebase-mapper.md`
2. `gsd-debugger.md`
3. `gsd-executor.md`
4. `gsd-integration-checker.md`
5. `gsd-phase-researcher.md`
6. `gsd-plan-checker.md`
7. `gsd-planner.md`
8. `gsd-project-researcher.md`
9. `gsd-research-synthesizer.md`
10. `gsd-roadmapper.md`
11. `gsd-verifier.md`

If all 11 are present in source and in `.roo/agents/`, this item is resolved.

---

## Re-install After Fixes

After all code changes to [`bin/install.js`](c:/Users/sge20/go/src/github.com/harmony-ai-solutions/get-shit-done/bin/install.js) are complete:

```bash
# Remove existing local install
rm -rf .roo/

# Re-run local install
node bin/install.js --roo --local

# Verify: check frontmatter of a converted command
head -10 .roo/commands/gsd-map-codebase.md
# Expected: only ---\ndescription: "..."\n---

# Verify: no .claude paths in workflow files  
grep -r "\.claude" .roo/get-shit-done/workflows/ | wc -l
# Expected: 0

# Verify: no /gsd: colon format anywhere in .roo/
grep -r "/gsd:" .roo/ | wc -l
# Expected: 0

# Verify: custom_modes.yaml has whenToUse field
grep "whenToUse" .roo/custom_modes.yaml | wc -l
# Expected: 11 (one per mode)

# Verify: mode names are human-readable
grep '"name"' .roo/custom_modes.yaml | head -3
# Expected: "name": "GSD Executor", etc.
```

## Progress Checklist

- [ ] Fix `convertCommandForRoo()` — strip frontmatter, rebuild with only `description:`
- [ ] Fix `convertCommandForRoo()` — add `/gsd:xxx` → `/gsd-xxx` body conversion
- [ ] Fix support file copy pipeline — apply path + command ref conversion to `.md` workflow/template/reference files
- [ ] Fix `installRooModes()` — apply `/gsd:xxx` → `/gsd-xxx` conversion to agent role definitions
- [ ] Fix `installRooModes()` — add explicit tool name updates in agent role definitions (`Read` → `read_file` etc.)
- [ ] Fix `installRooModes()` — add `whenToUse`, `source`, human-readable `name` to mode entries
- [ ] Fix `installRooModes()` — write `roo-modes-generated.json` fallback artifact
- [ ] Document JSON-vs-YAML format reality in Phase 4 plan doc
- [ ] Update `README.md` with Roo installation section
- [ ] Update `CHANGELOG.md` with Roo entry
- [ ] Update `docs/USER-GUIDE.md` with Roo section
- [ ] Verify agent count: 11 source files in `agents/`
- [ ] Re-run `node bin/install.js --roo --local` and run verification checks
- [ ] Re-run `node bin/install.js --roo --global` for production install
