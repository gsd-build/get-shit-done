# Phase 2: Installer - Roo Runtime Support

## Objective
Extend `bin/install.js` to support `--roo` as a new runtime target, with interactive prompting, correct directory paths, and the same update/uninstall lifecycle as existing runtimes.

## Files to Modify
- [`bin/install.js`](c:/Users/sge20/go/src/github.com/harmony-ai-solutions/get-shit-done/bin/install.js)

## Implementation Steps

### Step 1: Add `--roo` flag parsing

In the args section (around line 40-58), add:

```js
const hasRoo = args.includes('--roo');
```

In the `selectedRuntimes` logic:
```js
if (hasAll) {
  selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex', 'roo'];
} else {
  // existing...
  if (hasRoo) selectedRuntimes.push('roo');
}
```

### Step 2: Add `getDirName()` case for Roo

```js
function getDirName(runtime) {
  if (runtime === 'opencode') return '.opencode';
  if (runtime === 'gemini') return '.gemini';
  if (runtime === 'codex') return '.codex';
  if (runtime === 'roo') return '.roo';  // ADD THIS
  return '.claude';
}
```

### Step 3: Add `getConfigDirFromHome()` case for Roo

```js
function getConfigDirFromHome(runtime, isGlobal) {
  if (!isGlobal) {
    return `'${getDirName(runtime)}'`;
  }
  if (runtime === 'opencode') { ... }
  if (runtime === 'gemini') return "'.gemini'";
  if (runtime === 'codex') return "'.codex'";
  if (runtime === 'roo') return "'.roo'";  // ADD THIS
  return "'.claude'";
}
```

### Step 4: Add `getGlobalDir()` case for Roo

```js
function getGlobalDir(runtime, explicitDir = null) {
  // ... existing cases ...
  if (runtime === 'roo') {
    // Roo: --config-dir > ROO_CONFIG_DIR > ~/.roo
    if (explicitDir) return expandTilde(explicitDir);
    if (process.env.ROO_CONFIG_DIR) return expandTilde(process.env.ROO_CONFIG_DIR);
    return path.join(os.homedir(), '.roo');
  }
  // Claude Code: existing default
  return path.join(os.homedir(), '.claude');
}
```

### Step 5: Add Roo to the interactive runtime prompt

In the interactive section where the user is asked which runtimes to install for, add `'roo'` as an option with label `"Roo Code (VS Code Extension)"`.

### Step 6: Add Roo command install function

The key difference for Roo vs Claude is:
- **Claude Code commands** go to `~/.claude/commands/gsd/{name}.md`
- **Roo commands** go to `~/.roo/commands/gsd-{name}.md`

The installer's `installCommands(runtime, configDir)` function needs a Roo-specific branch:

```js
function installCommandsForRoo(configDir) {
  const commandsDir = path.join(configDir, 'commands');
  ensureDir(commandsDir);
  
  const sourceCommandsDir = path.join(__dirname, '..', 'commands', 'gsd');
  const files = fs.readdirSync(sourceCommandsDir).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const commandName = file.replace('.md', '');  // e.g. "map-codebase"
    const rooFileName = `gsd-${commandName}.md`;  // e.g. "gsd-map-codebase.md"
    const sourcePath = path.join(sourceCommandsDir, file);
    const destPath = path.join(commandsDir, rooFileName);
    
    let content = fs.readFileSync(sourcePath, 'utf8');
    content = convertCommandForRoo(content, configDir);
    
    fs.writeFileSync(destPath, content);
    console.log(`  Installed: ${rooFileName}`);
  }
}
```

### Step 7: Add Roo support files install function

GSD workflows, templates, references, and bin must be copied to `~/.roo/get-shit-done/`:

```js
function installSupportFilesForRoo(configDir) {
  const gsdDir = path.join(configDir, 'get-shit-done');
  const sourceGsdDir = path.join(__dirname, '..', 'get-shit-done');
  
  // Copy all subdirectories: workflows, templates, references, bin
  copyDirRecursive(sourceGsdDir, gsdDir);
  
  // Also copy agents (for mode registration)
  const agentsDir = path.join(configDir, 'get-shit-done', 'agents');
  copyDirRecursive(path.join(__dirname, '..', 'agents'), agentsDir);
}
```

### Step 8: Path replacement during Roo install

When copying files for Roo, replace all `.claude` path references:

```js
function replacePathsForRoo(content) {
  return content
    .replace(/\$HOME\/\.claude\/get-shit-done\//g, '$HOME/.roo/get-shit-done/')
    .replace(/~\/\.claude\/get-shit-done\//g, '~/.roo/get-shit-done/')
    .replace(/["']\.claude\/skills\/["']/g, '".roo/skills/"');
}
```

### Step 9: Add Roo custom modes registration

After installing support files, update `~/.roo/custom_modes.yaml` (or the appropriate Roo settings location) to register GSD agents as custom modes. The global Roo settings are at:
`C:/Users/{user}/AppData/Roaming/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/custom_modes.yaml`

However, since this path is OS/user-specific, the installer should detect it via an env var or known OS paths, similar to how it finds Claude settings. 

**Alternative (simpler):** Write a `.roo/custom_modes.yaml` or `.roo/modes.yaml` file in the config dir. Roo picks up modes from project-level `.roo/` directories.

Actually, Roo supports project-level modes at `.rooconfig/` or through global settings. The installer should provide clear instructions about registering modes rather than trying to auto-patch the global YAML.

### Step 10: Update help text

Add Roo to the usage/examples section in the help output:
```
--roo                     Install for Roo Code (VS Code Extension)
```

### Step 11: Update interactive install prompts

Add Roo to the multi-select runtime list with label `"Roo Code"`.

### Step 12: Uninstall support for Roo

Add `roo` to the uninstall logic that removes:
- `~/.roo/commands/gsd-*.md`
- `~/.roo/get-shit-done/`

## Progress Checklist
- [ ] `--roo` flag added to arg parsing
- [ ] `getDirName()` updated with `'roo'` case
- [ ] `getConfigDirFromHome()` updated with `'roo'` case
- [ ] `getGlobalDir()` updated with `'roo'` case
- [ ] Roo added to interactive prompt
- [ ] `installCommandsForRoo()` implemented
- [ ] `installSupportFilesForRoo()` implemented
- [ ] Path replacement function `replacePathsForRoo()` implemented
- [ ] Custom modes registration handled (instructions or automation)
- [ ] Help text updated
- [ ] Uninstall support for Roo added
- [ ] `package.json` description updated to mention Roo
