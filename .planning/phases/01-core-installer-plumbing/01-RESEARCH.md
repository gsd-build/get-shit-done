# Phase 1: Core Installer Plumbing - Research

**Researched:** 2026-03-02
**Domain:** Node.js CLI installer — argument parsing, directory resolution, interactive prompts, help text
**Confidence:** HIGH

## Summary

Phase 1 adds Copilot as the 5th runtime in the GSD installer's CLI layer. The work is entirely within `bin/install.js` — a single ~2400-line Node.js file that handles all runtimes. The file is well-structured with clear patterns: each runtime gets entries in arg parsing, `getDirName()`, `getGlobalDir()`, `getConfigDirFromHome()`, the interactive prompt, help text, banner, `--all` flag array, and runtime labels throughout `install()`, `uninstall()`, `finishInstall()`, and related functions.

The codebase follows a consistent pattern where adding a new runtime requires touching ~15-20 specific locations in `install.js`. The OpenCode runtime is the closest architectural match because it has **different local vs global paths** (local: `.opencode/`, global: `~/.config/opencode/`). Copilot follows this same model (local: `.github/`, global: `~/.copilot/`). The Codex runtime is the closest behavioral match for Phase 1 because Codex also skips hooks (no `settings.json`, no hook registration).

**Primary recommendation:** Follow the Codex addition pattern for skip-hooks behavior and the OpenCode pattern for different local/global paths. Work through `install.js` top-to-bottom, touching each runtime-aware location exactly once. No new files needed — this is purely modifying `install.js`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Copilot supports BOTH global and local installation** (REQUIREMENTS.md CLI-04 is outdated — CONTEXT.md is source of truth)
- Local installs go to `.github/` in the project directory
- Global installs go to `~/.copilot/` in the home directory
- `getDirName('copilot')` returns `.github` for local mode
- `getGlobalDir('copilot')` returns `~/.copilot/` for global mode
- This follows the OpenCode pattern which already has different local vs global paths
- Same as other runtimes: when user runs `--copilot` without `--global` or `--local`, prompt them to choose
- No special-casing for Copilot — consistent UX across all runtimes
- Copilot appears as option 5 (after Codex, before "All")
- Current order: 1) Claude Code, 2) OpenCode, 3) Gemini CLI, 4) Codex, 5) Copilot CLI, 6) All
- "All" renumbered from 5 to 6
- `--all` includes Copilot alongside existing 4 runtimes (5 total)
- `--all --global` installs all runtimes globally — Copilot goes to `~/.copilot/`, others to their respective global dirs
- `--all --local` installs all locally — Copilot goes to `.github/`, others to their respective local dirs
- Skip hook registration for Copilot runtime (same pattern as Codex currently)
- Generate `copilot-instructions.md` in both modes (deferred to Phase 3 — but directory plumbing must support it)
- The `--both` legacy flag currently maps to `['claude', 'opencode']` — do NOT modify this

### Claude's Discretion

- Exact error/warning messages for edge cases
- Banner formatting details
- Help text wording

### Deferred Ideas (OUT OF SCOPE)

- **Copilot hooks support** — Copilot CLI supports hooks but deferred to future milestone
- **AGENTS.md generation** — Copilot reads AGENTS.md from repo root, could be useful but not in this milestone
- **Path-specific instructions** — Copilot supports `.github/instructions/*.instructions.md`, could be useful for GSD context injection later

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLI-01 | Installer accepts `--copilot` flag to select Copilot runtime | Add `hasCopilot` arg parsing at line 43, add to `selectedRuntimes` logic at lines 50-59 |
| CLI-02 | Interactive runtime prompt includes Copilot as option (renumber "All") | Modify `promptRuntime()` at line 2202 — add option 5 for Copilot, renumber All to 6 |
| CLI-03 | `--all` flag includes Copilot alongside existing 4 runtimes | Change `selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex']` at line 51 to include `'copilot'` |
| CLI-04 | ~~`--copilot --global` rejected~~ **CORRECTED**: `--copilot --global` installs to `~/.copilot/` | Add `getGlobalDir('copilot')` case returning `~/.copilot/` — follows OpenCode pattern |
| CLI-05 | `getDirName('copilot')` returns `.github` | Add `if (runtime === 'copilot') return '.github'` to `getDirName()` at line 62 |
| CLI-06 | Banner, help text, and examples updated to include Copilot | Modify banner string at line 172, help text at line 206, add examples |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=16.7.0 | Runtime (per `engines` in package.json) | Project constraint |
| `node:fs` | built-in | File system operations | Used throughout install.js |
| `node:path` | built-in | Path manipulation | Used throughout install.js |
| `node:os` | built-in | Home directory resolution | `os.homedir()` for global paths |
| `node:readline` | built-in | Interactive prompts | Used for runtime/location selection |
| `node:test` | built-in | Test framework | Used by all 462 existing tests |
| `node:assert` | built-in | Test assertions | Paired with node:test |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `c8` | ^11.0.0 | Code coverage | `npm run test:coverage` |

### Alternatives Considered
None — this phase modifies an existing file using existing patterns. No new dependencies.

**Installation:** No new packages needed.

## Architecture Patterns

### File Structure (no changes needed)
```
bin/
└── install.js       # THE file to modify (~2400 lines, single monolith)
tests/
├── helpers.cjs      # Test utilities
├── codex-config.test.cjs  # Pattern for testing install.js exports
└── *.test.cjs       # 14 test files, node:test framework
```

### Pattern 1: Runtime Addition Checklist
**What:** Each runtime has entries in ~15-20 locations. Adding Copilot means touching each systematically.
**When to use:** This is the ONLY pattern for Phase 1.

**Exact locations to modify in `install.js`:**

| Line(s) | What | Change |
|---------|------|--------|
| 37-45 | Arg parsing | Add `const hasCopilot = args.includes('--copilot');` |
| 50-59 | Runtime selection | Add `'copilot'` to `--all` array; add `if (hasCopilot) selectedRuntimes.push('copilot');` |
| 62-67 | `getDirName()` | Add `if (runtime === 'copilot') return '.github';` |
| 75-89 | `getConfigDirFromHome()` | Add `if (runtime === 'copilot') return isGlobal ? "'.copilot'" : "'.github'"` |
| 121-160 | `getGlobalDir()` | Add `if (runtime === 'copilot') { ... return path.join(os.homedir(), '.copilot'); }` |
| 162-172 | Banner | Add "Copilot" to description text |
| 205-207 | Help text | Add `--copilot` option, add examples |
| 256-298 | `getCommitAttribution()` | Add `copilot` case (return `undefined` — no attribution setting) |
| 1823-1830 | `install()` — runtime checks | Add `const isCopilot = runtime === 'copilot';` |
| 1846-1850 | `install()` — runtimeLabel | Add `if (isCopilot) runtimeLabel = 'Copilot';` |
| 1862-1900 | `install()` — commands | Add Copilot branch (deferred to Phase 2 — but label must exist) |
| 1975-2011 | `install()` — hooks/settings | Skip for Copilot (same as Codex pattern `if (!isCodex)` → `if (!isCodex && !isCopilot)`) |
| 2025-2031 | `install()` — Codex config | Add similar early-return for Copilot |
| 2111-2146 | `finishInstall()` | Add `isCopilot` label and command format |
| 2205-2240 | `promptRuntime()` | Add option 5 for Copilot, renumber All to 6, update choice handling |
| 2268-2273 | `promptLocation()` | Path examples already derived from `getGlobalDir()`/`getDirName()` — auto-works |
| 2291-2298 | `installAllRuntimes()` | No change needed — iterates `runtimes` array |
| 2299 | Statusline runtimes | Copilot not in `statuslineRuntimes` — no change needed |
| 2323-2336 | Test exports | Add any new Copilot-specific exports if created |
| 2340-2374 | Main logic | No change needed — all dispatches via `selectedRuntimes` |

### Pattern 2: Codex "Skip Hooks" Pattern
**What:** Codex runtime skips settings.json, hooks, and statusline. Copilot follows same pattern.
**When to use:** Wherever the installer configures hooks/statusline/settings.json.

```javascript
// Current pattern (line 1975):
if (!isCodex) {
  // hooks, settings.json, package.json for CommonJS
}

// New pattern:
if (!isCodex && !isCopilot) {
  // hooks, settings.json, package.json for CommonJS
}
```

### Pattern 3: OpenCode "Different Paths" Pattern
**What:** OpenCode has different local (`.opencode/`) vs global (`~/.config/opencode/`) paths. Copilot follows: `.github/` local, `~/.copilot/` global.
**When to use:** `getDirName()`, `getGlobalDir()`, `getConfigDirFromHome()`.

```javascript
// getDirName — returns local directory name
function getDirName(runtime) {
  if (runtime === 'copilot') return '.github';
  if (runtime === 'opencode') return '.opencode';
  // ...
}

// getGlobalDir — returns global directory path
function getGlobalDir(runtime, explicitDir = null) {
  if (runtime === 'copilot') {
    if (explicitDir) return expandTilde(explicitDir);
    if (process.env.COPILOT_CONFIG_DIR) {
      return expandTilde(process.env.COPILOT_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.copilot');
  }
  // ...
}
```

### Pattern 4: Early Return for Copilot in install()
**What:** Codex returns early from `install()` before hooks/settings. Copilot does the same.
**When to use:** End of `install()` function.

```javascript
// After Codex early return (line 2025):
if (isCopilot) {
  return { settingsPath: null, settings: null, statuslineCommand: null, runtime };
}
```

### Anti-Patterns to Avoid
- **Special-casing Copilot in prompt flow:** Don't add Copilot-specific branching in the location prompt. It follows the same global/local choice as all runtimes.
- **Modifying `--both` flag:** The `--both` legacy flag maps to `['claude', 'opencode']` — do NOT touch this.
- **Adding content conversion in Phase 1:** The install function copies commands, agents, etc. Phase 1 only needs the plumbing (directory resolution, flags). Content conversion is Phase 2. In Phase 1, the install function will attempt to install content to `.github/` — this is fine, it just won't have Copilot-specific conversion yet.
- **Skipping uninstall:** The `uninstall()` function also has runtime-specific branches. Add Copilot handling there too (it will share the Claude/Gemini branch pattern initially).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path expansion | Custom `~` handling | Existing `expandTilde()` function | Already handles edge cases |
| Interactive prompts | New prompt library | Existing `readline` pattern | Consistent with 4 existing runtimes |
| Env var config dir | New config system | Follow `getGlobalDir()` env var pattern (e.g., `COPILOT_CONFIG_DIR`) | Consistent with CLAUDE_CONFIG_DIR, CODEX_HOME patterns |

**Key insight:** This phase is about consistency, not innovation. Every pattern already exists for 4 runtimes. Copilot is the 5th instance of each pattern.

## Common Pitfalls

### Pitfall 1: Missing a Runtime-Aware Location
**What goes wrong:** Copilot works for `--copilot --local` but crashes on `--copilot --global` because `getGlobalDir()` doesn't handle it.
**Why it happens:** `install.js` has ~15-20 locations where runtimes are handled. Missing one causes partial functionality.
**How to avoid:** Use the exact checklist in "Pattern 1" above. Search for every occurrence of `isCodex`, `codex`, `'codex'` and verify Copilot has corresponding handling.
**Warning signs:** Tests pass for some flags but not others; `undefined` appearing in paths.

### Pitfall 2: Forgetting the promptRuntime Choice Mapping
**What goes wrong:** User selects "5" in the prompt but gets Codex or nothing, because the choice-to-runtime mapping wasn't updated.
**Why it happens:** The `promptRuntime()` function uses a hard-coded if/else chain mapping numbers to runtimes.
**How to avoid:** After adding option 5 for Copilot, update both the display AND the choice handler: `if (choice === '6')` → all, `if (choice === '5')` → copilot, etc.
**Warning signs:** Interactive testing shows wrong runtime selected.

### Pitfall 3: `--all` Array Missing Copilot
**What goes wrong:** `--all` installs 4 runtimes instead of 5.
**Why it happens:** Line 51: `selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex']` — easy to forget adding `'copilot'`.
**How to avoid:** Search for the `--all` array literal and add `'copilot'`.
**Warning signs:** Running `--all` doesn't mention Copilot in output.

### Pitfall 4: `.github/` Local Path Collision
**What goes wrong:** Copilot's local path `.github/` may already exist (e.g., GitHub Actions). Unlike `.claude/` or `.codex/`, `.github/` is a shared directory.
**Why it happens:** `.github/` is used by GitHub for workflows, CODEOWNERS, etc. Copilot writes skills/agents INTO this directory, not as a separate tree.
**How to avoid:** The installer should create subdirectories inside `.github/` (skills/, agents/, get-shit-done/) WITHOUT removing the existing `.github/` directory. The `copyWithPathReplacement()` function already creates `destDir` with `recursive: true` and only removes subdirectories it owns.
**Warning signs:** Existing `.github/workflows/` disappearing after install.

### Pitfall 5: `getConfigDirFromHome()` Missing Copilot
**What goes wrong:** Hook path templating breaks because `getConfigDirFromHome()` doesn't handle Copilot.
**Why it happens:** Although Copilot skips hooks (like Codex), `getConfigDirFromHome()` may still be called during install for agent content templating.
**How to avoid:** Add the Copilot case to `getConfigDirFromHome()` returning `"'.copilot'"` for global and `"'.github'"` for local.
**Warning signs:** Agents referencing wrong path in hook commands.

### Pitfall 6: Uninstall Function Missing Copilot
**What goes wrong:** `--copilot --uninstall` doesn't clean up properly.
**Why it happens:** The `uninstall()` function has runtime-specific branches (OpenCode flat commands, Codex skills/toml, Claude/Gemini nested commands). Copilot needs its own branch.
**How to avoid:** Add Copilot handling to `uninstall()`. For Phase 1, it can share the Claude/Gemini pattern since content format is determined in Phase 2.
**Warning signs:** Uninstall leaves Copilot artifacts behind.

### Pitfall 7: Banner Line Length
**What goes wrong:** Adding "Copilot" makes the banner description text too long, wrapping awkwardly in narrow terminals.
**Why it happens:** The banner is hand-formatted with ANSI escape codes. Current text: "for Claude Code, OpenCode, Gemini, and Codex". Adding "Copilot" makes it: "for Claude Code, OpenCode, Gemini, Codex, and Copilot".
**How to avoid:** Test in an 80-column terminal. The banner description can be split across two lines if needed.
**Warning signs:** Visual inspection shows ugly wrapping.

## Code Examples

### Adding the --copilot flag (arg parsing)
```javascript
// After line 43 (const hasCodex = args.includes('--codex');)
const hasCopilot = args.includes('--copilot');

// In runtime selection (line 50-59):
if (hasAll) {
  selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex', 'copilot'];
} else if (hasBoth) {
  selectedRuntimes = ['claude', 'opencode'];
} else {
  if (hasOpencode) selectedRuntimes.push('opencode');
  if (hasClaude) selectedRuntimes.push('claude');
  if (hasGemini) selectedRuntimes.push('gemini');
  if (hasCodex) selectedRuntimes.push('codex');
  if (hasCopilot) selectedRuntimes.push('copilot');
}
```

### getDirName with Copilot
```javascript
function getDirName(runtime) {
  if (runtime === 'copilot') return '.github';
  if (runtime === 'opencode') return '.opencode';
  if (runtime === 'gemini') return '.gemini';
  if (runtime === 'codex') return '.codex';
  return '.claude';
}
```

### getGlobalDir with Copilot
```javascript
function getGlobalDir(runtime, explicitDir = null) {
  if (runtime === 'copilot') {
    // Copilot: --config-dir > COPILOT_CONFIG_DIR > ~/.copilot
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.COPILOT_CONFIG_DIR) {
      return expandTilde(process.env.COPILOT_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.copilot');
  }
  if (runtime === 'opencode') {
    // ... existing
  }
  // ...
}
```

### getConfigDirFromHome with Copilot
```javascript
function getConfigDirFromHome(runtime, isGlobal) {
  if (!isGlobal) {
    return `'${getDirName(runtime)}'`;
  }
  if (runtime === 'copilot') return "'.copilot'";
  if (runtime === 'opencode') {
    return "'.config', 'opencode'";
  }
  // ...
}
```

### Updated promptRuntime
```javascript
function promptRuntime(callback) {
  // ...
  console.log(`  ${yellow}Which runtime(s) would you like to install for?${reset}\n
  ${cyan}1${reset}) Claude Code ${dim}(~/.claude)${reset}
  ${cyan}2${reset}) OpenCode    ${dim}(~/.config/opencode)${reset} - open source, free models
  ${cyan}3${reset}) Gemini      ${dim}(~/.gemini)${reset}
  ${cyan}4${reset}) Codex       ${dim}(~/.codex)${reset}
  ${cyan}5${reset}) Copilot     ${dim}(~/.copilot)${reset}
  ${cyan}6${reset}) All
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    if (choice === '6') {
      callback(['claude', 'opencode', 'gemini', 'codex', 'copilot']);
    } else if (choice === '5') {
      callback(['copilot']);
    } else if (choice === '4') {
      callback(['codex']);
    } else if (choice === '3') {
      callback(['gemini']);
    } else if (choice === '2') {
      callback(['opencode']);
    } else {
      callback(['claude']);
    }
  });
}
```

### install() — Copilot early return (like Codex)
```javascript
// After existing Codex early return (line 2025-2031):
if (isCopilot) {
  // Copilot: no settings.json, no hooks, no statusline (like Codex)
  // Content conversion handled in Phase 2
  return { settingsPath: null, settings: null, statuslineCommand: null, runtime };
}
```

### finishInstall() — Copilot label and command
```javascript
function finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline, runtime = 'claude', isGlobal = true) {
  const isOpencode = runtime === 'opencode';
  const isCodex = runtime === 'codex';
  const isCopilot = runtime === 'copilot';

  // ... existing statusline logic (skip for copilot, already skipped for codex)

  // Write settings when runtime supports settings.json
  if (!isCodex && !isCopilot) {
    writeSettings(settingsPath, settings);
  }

  // ...
  let program = 'Claude Code';
  if (runtime === 'opencode') program = 'OpenCode';
  if (runtime === 'gemini') program = 'Gemini';
  if (runtime === 'codex') program = 'Codex';
  if (runtime === 'copilot') program = 'Copilot';

  let command = '/gsd:new-project';
  if (runtime === 'opencode') command = '/gsd-new-project';
  if (runtime === 'codex') command = '$gsd-new-project';
  if (runtime === 'copilot') command = '/gsd-new-project';
  // ...
}
```

### uninstall() — Copilot handling
```javascript
function uninstall(isGlobal, runtime = 'claude') {
  // ...
  const isCopilot = runtime === 'copilot';
  // ...
  if (runtime === 'copilot') runtimeLabel = 'Copilot';
  
  // Commands — Copilot uses skills (like Codex) but in .github/skills/ format
  // For Phase 1, just handle the directory cleanup pattern
  // Phase 2 will define the exact content format
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4 runtimes (claude, opencode, gemini, codex) | 5 runtimes (+copilot) | v1.23 (this work) | All runtime lists updated |
| "All" = option 5 | "All" = option 6 | v1.23 (this work) | Interactive prompt renumbered |
| Local-only assumption for Copilot | Both local AND global | During discuss-phase (2026-03-02) | `--copilot --global` targets `~/.copilot/` |

**Deprecated/outdated:**
- REQUIREMENTS.md CLI-04 text ("reject `--copilot --global`") — corrected by CONTEXT.md decisions

## Open Questions

1. **Copilot command invocation syntax**
   - What we know: Claude uses `/gsd:command`, OpenCode uses `/gsd-command`, Codex uses `$gsd-command`
   - What's unclear: What prefix does Copilot CLI use for skill invocation? Likely `/gsd-command` based on skill routing.
   - Recommendation: Use `/gsd-new-project` for the finishInstall message (consistent with OpenCode). Can be refined in Phase 2 if we discover the actual Copilot skill invocation syntax.

2. **`COPILOT_CONFIG_DIR` environment variable**
   - What we know: Other runtimes support env var overrides (CLAUDE_CONFIG_DIR, CODEX_HOME, etc.)
   - What's unclear: Whether Copilot CLI respects a `COPILOT_CONFIG_DIR` env var
   - Recommendation: Add `COPILOT_CONFIG_DIR` support in `getGlobalDir()` for consistency. Even if Copilot CLI doesn't use it natively, it gives users override capability through the installer.

3. **Content installation in Phase 1**
   - What we know: The `install()` function immediately tries to copy commands, agents, get-shit-done dir. Phase 1 is "plumbing only" but install() will still attempt content copy.
   - What's unclear: Should Phase 1 skip content installation for Copilot entirely, or let it install in Claude format (to be corrected in Phase 2)?
   - Recommendation: Let it install content in default (Claude) format. Phase 2 adds the Copilot-specific conversion. This way `--copilot --local` produces working output immediately (just not in ideal Copilot format yet). The early return before hooks is the clean boundary.

## Sources

### Primary (HIGH confidence)
- `bin/install.js` — direct source code analysis of all ~2400 lines
- `tests/codex-config.test.cjs` — test pattern for install.js exports via GSD_TEST_MODE
- `tests/helpers.cjs` — test helper utilities
- `scripts/run-tests.cjs` — test runner (node:test framework)
- `package.json` — project config, Node >=16.7.0, test scripts
- `.planning/phases/01-core-installer-plumbing/01-CONTEXT.md` — user decisions (source of truth)

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — requirements (CLI-04 text is outdated per CONTEXT.md correction)
- `.planning/ROADMAP.md` — phase structure (roadmap text about local-only is outdated)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all Node.js built-ins already in use
- Architecture: HIGH — direct analysis of install.js, patterns verified across 4 existing runtimes
- Pitfalls: HIGH — identified from actual code structure, verified each location exists
- Code examples: HIGH — derived from actual source with line number references

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable — install.js changes infrequently between versions)
