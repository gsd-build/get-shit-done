# Pitfalls Research

**Domain:** Adding Copilot CLI as a 5th runtime to multi-runtime installer
**Researched:** 2025-03-02
**Confidence:** HIGH — based on direct analysis of `bin/install.js` (2376 lines), existing runtime patterns, and Copilot reference implementation in `.github/`

## Critical Pitfalls

### Pitfall 1: Copilot's `.github/` Target Directory Breaks the Global/Local Model

**What goes wrong:**
Every existing runtime follows the same model: `getDirName()` returns a dot-directory (`.claude`, `.opencode`, `.gemini`, `.codex`), and `getGlobalDir()` returns `~/.<runtime>` for global installs. The installer's core assumption is `targetDir = isGlobal ? getGlobalDir(...) : path.join(process.cwd(), dirName)`. Copilot breaks this completely — its target is always `.github/` in the project root, which is inherently project-local. There is no `~/.copilot/` global config directory. Forcing Copilot into the global/local model will either produce nonsensical paths or silently install to the wrong location.

**Why it happens:**
The installer was designed around runtimes that have both a global config dir (`~/<runtime>`) and a project-local dir (`./<runtime>`). Copilot doesn't follow this pattern — GitHub Copilot CLI reads `.github/agents/`, `.github/skills/`, and `.github/copilot-instructions.md` from the repository root. There's no user-level global equivalent.

**How to avoid:**
- Make `getDirName('copilot')` return `.github` (not `.copilot`)
- Make `getGlobalDir('copilot', ...)` return `null` or throw, since global install is meaningless for Copilot
- Gate the `--global` flag: if only `copilot` is selected and `--global` is passed, error early with a clear message ("Copilot only supports local installation — files go to .github/")
- When `--all --global` is used, install other runtimes globally but Copilot locally — handle the mixed mode gracefully
- Add a `supportsGlobal(runtime)` check function instead of scattering `if (runtime === 'copilot')` everywhere

**Warning signs:**
- `getGlobalDir('copilot')` called without a null check
- Copilot files appearing at `~/.github/` instead of `./.github/`
- `--all --global` silently skipping Copilot or erroring out
- Interactive prompt showing "Global (~/.github)" which is wrong

**Phase to address:**
Phase 1 (Core installer integration) — this is foundational; all other Copilot logic depends on correct directory resolution.

---

### Pitfall 2: Agent File Naming Convention Mismatch (`.md` vs `.agent.md`)

**What goes wrong:**
Source agents are `agents/gsd-executor.md`. All four existing runtimes copy these as `gsd-executor.md` to their respective `agents/` directory. But Copilot requires the `.agent.md` suffix: `.github/agents/gsd-executor.agent.md`. If the installer copies agents without renaming, Copilot won't discover them. If the rename is done incorrectly, the manifest hashing, uninstall cleanup, and local patch detection all break because they match on `file.startsWith('gsd-') && file.endsWith('.md')`.

**Why it happens:**
The existing agent copy loop (lines 1912-1952 of `install.js`) iterates `agentEntries` filtering for `.endsWith('.md')` and writes to `path.join(agentsDest, entry.name)` — preserving the source filename. For Copilot, the destination filename must be `gsd-*.agent.md` instead of `gsd-*.md`.

**How to avoid:**
- In the agent copy loop, when `runtime === 'copilot'`, transform the destination filename: `entry.name.replace('.md', '.agent.md')`
- Update the uninstall function to match `gsd-*.agent.md` pattern for Copilot agents (currently matches `gsd-*.md`)
- Update `writeManifest()` to use the `.agent.md` names for Copilot manifest entries
- Update `saveLocalPatches()` — the hash comparison must use the actual installed filenames
- Write a test that verifies agent filenames match Copilot's expected convention

**Warning signs:**
- Agent files installed but Copilot doesn't recognize them (no agents available)
- Uninstall leaves orphaned `.agent.md` files
- Manifest contains `.md` entries but files on disk are `.agent.md`
- `saveLocalPatches()` never detects modifications to Copilot agents

**Phase to address:**
Phase 1 (Core installer integration) — file naming is part of the basic copy mechanism.

---

### Pitfall 3: Copilot Skills Structure Differs from Codex Skills

**What goes wrong:**
Developers see that Codex already uses a `skills/` directory and assume they can reuse `copyCommandsAsCodexSkills()` for Copilot. But the structures differ significantly:
- **Codex:** `skills/gsd-new-project/SKILL.md` with Codex-specific adapter headers, `$gsd-new-project` invocation, `{{GSD_ARGS}}` placeholders
- **Copilot:** `skills/gsd-new-project/SKILL.md` with Claude-like frontmatter, `$ARGUMENTS` placeholders, `@path` file references, `allowed-tools:` YAML field

If you reuse the Codex skill converter, you get Codex adapter headers (`<codex_skill_adapter>`) and `{{GSD_ARGS}}` in Copilot skills, which Copilot doesn't understand.

**Why it happens:**
The Codex skill format was designed for Codex's specific capabilities (spawn_agent, request_user_input mapping). Copilot has its own conventions. The similarity of directory structure (`skills/gsd-*/SKILL.md`) creates a false equivalence.

**How to avoid:**
- Write a dedicated `convertClaudeToCopilotSkill()` function — do NOT reuse `convertClaudeCommandToCodexSkill()`
- The Copilot skill format is closer to the source Claude format than Codex: keep `allowed-tools:`, keep `$ARGUMENTS`, keep `@path` references
- Main transformations for Copilot skills: replace path references (`~/.claude/` → `.github/`), replace `/gsd:command` with `/gsd-command` (Copilot doesn't support colon-namespaced commands), convert tool references per Copilot tool mapping
- Compare against the reference implementation in `.github/skills/` to verify format correctness

**Warning signs:**
- `<codex_skill_adapter>` appearing in Copilot skills
- `{{GSD_ARGS}}` instead of `$ARGUMENTS` in Copilot skills
- Skills referencing `$gsd-new-project` (Codex mention syntax) instead of `/gsd-new-project`

**Phase to address:**
Phase 2 (Content conversion) — this is the Copilot-specific content transformation layer.

---

### Pitfall 4: `copilot-instructions.md` Clobbering User Content

**What goes wrong:**
Copilot uses `.github/copilot-instructions.md` as the global instruction file for the repository (similar to Claude's `CLAUDE.md`). The installer writes GSD instructions to this file. If a user already has custom instructions in this file, the installer overwrites them, destroying their configuration.

**Why it happens:**
Other runtimes append to `settings.json` (Claude/Gemini), `opencode.json` (OpenCode), or `config.toml` (Codex) — all structured formats that support merging. `copilot-instructions.md` is freeform markdown with no section markers, so there's no safe way to "merge" GSD content into existing instructions without risking corruption.

**How to avoid:**
- Follow the Codex `config.toml` pattern: use a GSD marker comment (like `GSD_CODEX_MARKER = '# GSD Agent Configuration — managed by get-shit-done installer'`)
- Add an HTML comment marker: `<!-- GSD Instructions — managed by get-shit-done installer -->` as section boundaries
- On install: if `copilot-instructions.md` exists, check for the GSD marker. If found, replace that section. If not found, append the GSD section with markers
- On uninstall: strip only the marked GSD section, preserve everything else
- NEVER truncate or overwrite the entire file

**Warning signs:**
- User reports "my Copilot instructions disappeared after install"
- Uninstall deletes the entire `copilot-instructions.md` instead of just the GSD section
- Re-running the installer duplicates the GSD instructions section

**Phase to address:**
Phase 2 (Content conversion) — the `copilot-instructions.md` management is a core Copilot-specific requirement.

---

### Pitfall 5: `--all` Flag Regression — Breaking Existing Runtime Installs

**What goes wrong:**
The `--all` flag is hardcoded to `['claude', 'opencode', 'gemini', 'codex']` (line 51). Adding `'copilot'` to this array changes behavior for all existing users who run `--all --global`. Since Copilot doesn't support global install, this either errors out (breaking the `--all` workflow) or silently installs Copilot locally while other runtimes go global (confusing behavior).

**Why it happens:**
The `--all` array and the `promptRuntime` function (lines 2218-2241) both hardcode the runtime list. The `installAllRuntimes` function iterates all selected runtimes with the same `isGlobal` flag, assuming all runtimes support both modes.

**How to avoid:**
- Add `copilot` to the `--all` array but handle it specially in `installAllRuntimes()`: skip Copilot if `isGlobal` is true, or always install Copilot locally regardless of the global flag
- Better: separate `--all` into "all that support this mode" — `installAllRuntimes()` should filter runtimes by `supportsGlobal(runtime)` when `isGlobal` is true
- Update `promptRuntime()` to add choice "6) Copilot" and update "5) All" to "6) All"
- Update `promptLocation()` path examples to handle Copilot's `.github/` path
- Write a regression test: `--all --global` should still install Claude/OpenCode/Gemini/Codex globally without errors

**Warning signs:**
- `npx get-shit-done-cc --all --global` errors out after adding Copilot
- `--all` prompt shows wrong numbering
- Users report "install worked before, now it fails"

**Phase to address:**
Phase 1 (Core installer integration) — this directly affects backward compatibility.

---

### Pitfall 6: Path Replacement Regex Doesn't Cover Copilot's Path Pattern

**What goes wrong:**
The installer's content transformation relies on two regex patterns to rewrite file references:
- `globalClaudeRegex = /~\/\.claude\//g` → replaces with `pathPrefix`
- `localClaudeRegex = /\.\/\.claude\//g` → replaces with `./${dirName}/`

For Copilot, `pathPrefix` would be `./.github/` and `dirName` would be `.github`. But the source files contain `~/.claude/` references which should become `.github/` (no `./` prefix needed for Copilot since `.github/` is already relative). If `pathPrefix` is `./.github/`, content like `@~/.claude/get-shit-done/workflows/` becomes `@./.github/get-shit-done/workflows/` — but the existing reference implementation uses `@.github/get-shit-done/workflows/` (no `./` prefix). This subtle difference may cause `@path` resolution failures in Copilot.

**Why it happens:**
Every other runtime uses `./.<runtime>/` for local paths (e.g., `./.claude/`, `./.opencode/`). Copilot uses `.github/` without the `./` prefix — it's a convention difference in how `@path` references work.

**How to avoid:**
- Set `pathPrefix` to `.github/` (not `./.github/`) for Copilot runtime
- Verify all `@path` references in generated skills match the reference implementation format
- Compare a diff of the generated executor agent against the reference `.github/agents/gsd-executor.agent.md` to catch path mismatches
- Add integration tests that grep for `./\.github` in Copilot output files — should find zero matches

**Warning signs:**
- `@./.github/get-shit-done/` in generated files (the `./` prefix shouldn't be there)
- Copilot unable to resolve `@path` references at runtime
- Inconsistency between generated files and the reference implementation

**Phase to address:**
Phase 2 (Content conversion) — path rewriting is part of content transformation.

---

### Pitfall 7: `get-shit-done` Parent Skill Not Generated by Installer

**What goes wrong:**
Copilot requires a parent skill at `.github/skills/get-shit-done/SKILL.md` that acts as the entry point — it tells Copilot how to dispatch `/gsd-*` commands to individual skills. This file doesn't exist for any other runtime (it's Copilot-specific). The installer only copies commands-to-skills and agents — it has no concept of generating this parent skill. If it's missing, Copilot users won't know how to use GSD.

**Why it happens:**
The `get-shit-done/` source directory contains workflows, templates, and references — not skills. The parent skill is a Copilot-specific bootstrapping file that doesn't map to any Claude/OpenCode/Gemini/Codex artifact. The reference implementation includes it but the installer has no logic to create it.

**How to avoid:**
- Create a source template for the parent skill (or embed it in the installer as a string constant, like `getCodexSkillAdapterHeader`)
- Include the parent skill generation in the Copilot install flow, after commands-to-skills conversion
- Also generate the `get-shit-done/gsd-SKILL` stub directory (which acts as a routing index)
- Verify during install that `.github/skills/get-shit-done/SKILL.md` exists

**Warning signs:**
- `.github/skills/` contains `gsd-*` skill directories but no `get-shit-done/` parent skill
- Users ask "how do I use GSD in Copilot?" because there's no discovery mechanism
- Copilot doesn't auto-suggest GSD when user types `/gsd`

**Phase to address:**
Phase 2 (Content conversion) — this is a Copilot-specific content artifact.

---

### Pitfall 8: Hooks and Settings.json Logic Executes for Copilot

**What goes wrong:**
The `install()` function (line 1823) has a large block after line 1975 that writes `package.json` (CommonJS mode), copies hooks, writes `settings.json`, configures statusline, configures SessionStart hooks, and configures PostToolUse hooks. This logic runs for all runtimes except when explicitly gated by `if (!isCodex)` checks. If Copilot isn't similarly gated, it will try to write `hooks/`, `package.json`, and `settings.json` into `.github/` — none of which Copilot uses, and which will clutter the `.github/` directory.

**Why it happens:**
Codex was the most recent runtime added and its exclusions were done surgically: `if (!isCodex)` at specific points. But the overall structure assumes "settings.json runtimes" vs "Codex". Adding Copilot requires another exemption layer. Missing even one guard means writing wrong files.

**How to avoid:**
- Add Copilot to all Codex exclusion guards: change `if (!isCodex)` to `if (!isCodex && !isCopilot)` at lines 1975, 2059, 2115, 2124
- Better: refactor to use a capability-based check: `if (runtimeSupports(runtime, 'hooks'))` or `if (runtimeSupports(runtime, 'settingsJson'))`
- The Copilot install path should return early from the settings/hooks section, similar to Codex (line 2030)
- Run an integration test that checks: after Copilot install, `.github/` should NOT contain `hooks/`, `package.json`, or `settings.json`

**Warning signs:**
- `.github/hooks/` directory created during Copilot install
- `.github/settings.json` created (would conflict with GitHub's own `.github/` conventions)
- `.github/package.json` with `{"type":"commonjs"}` appearing in the repo

**Phase to address:**
Phase 1 (Core installer integration) — this is about the install flow control.

---

### Pitfall 9: Uninstall Function Doesn't Know How to Clean Up Copilot

**What goes wrong:**
The `uninstall()` function (lines 1200-1492) has per-runtime cleanup logic for commands, agents, hooks, settings, and Codex-specific config.toml. There is no Copilot branch. If a user runs `--copilot --uninstall`, it will fall into the default Claude/Gemini branch, attempt to remove `commands/gsd/` (which doesn't exist for Copilot), miss the `skills/gsd-*/SKILL.md` directories, miss the `.agent.md` agents, miss the `copilot-instructions.md` cleanup, and leave the `get-shit-done/` parent skill behind.

**Why it happens:**
The uninstall function mirrors the install logic — each runtime has bespoke cleanup. Copilot's artifacts are unique (`.agent.md` naming, `.github/skills/` location, `copilot-instructions.md`). Without dedicated Copilot uninstall logic, cleanup is incomplete.

**How to avoid:**
- Add explicit `else if (isCopilot)` branch in uninstall for:
  1. Skills: remove `skills/gsd-*/` directories (like Codex)
  2. Parent skill: remove `skills/get-shit-done/` directory
  3. Agents: match `gsd-*.agent.md` pattern (not `gsd-*.md`)
  4. `copilot-instructions.md`: strip only the GSD-marked section
  5. `get-shit-done/`: remove the shared content directory
- Write tests: uninstall should return the `.github/` directory to its pre-GSD state
- Test that non-GSD files in `.github/` (workflows, templates, CODEOWNERS) are preserved

**Warning signs:**
- User runs uninstall and `.github/skills/gsd-*` directories remain
- `copilot-instructions.md` still contains GSD instructions after uninstall
- `.github/agents/gsd-*.agent.md` files survive uninstall

**Phase to address:**
Phase 3 (Uninstall & cleanup) — after install works, uninstall must be tested.

---

### Pitfall 10: Manifest and Local Patch System Breaks for `.github/` Root

**What goes wrong:**
The manifest system (`writeManifest`, `saveLocalPatches`, `reportLocalPatches`) writes `gsd-file-manifest.json` to the config directory. For Copilot, this means `.github/gsd-file-manifest.json`. This file would appear in `git status` for projects that don't gitignore it. Worse, `saveLocalPatches` creates a `gsd-local-patches/` directory inside the config dir — meaning `.github/gsd-local-patches/`, which pollutes the `.github/` directory and may confuse GitHub Actions or other tools that scan `.github/`.

**Why it happens:**
Other runtimes use hidden directories (`.claude/`, `.opencode/`) or user-level config dirs (`~/.gemini/`) where stray files are invisible to the project. `.github/` is a public, well-known directory scanned by GitHub's infrastructure.

**How to avoid:**
- Use a hidden or namespaced manifest file: `.github/get-shit-done/.gsd-install-manifest.json` (the reference implementation already does this — see the manifest at `.github/get-shit-done/.gsd-install-manifest.json`)
- Store local patches under `.github/get-shit-done/gsd-local-patches/` instead of `.github/gsd-local-patches/`
- Add both to `.gitignore` recommendations during install
- Or better: detect that the manifest path is `.github/` and nest it under `get-shit-done/` automatically

**Warning signs:**
- `gsd-file-manifest.json` appearing in `git status`
- `gsd-local-patches/` directory inside `.github/`
- GitHub Actions or tools scanning `.github/` picking up GSD metadata files

**Phase to address:**
Phase 1 (Core installer integration) — manifest location is determined during install.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Scattering `if (runtime === 'copilot')` across install.js | Quick to implement | Every new feature requires finding all copilot guards; easy to miss one | Never — use capability map instead |
| Reusing Codex skill converter for Copilot | Less code to write | Wrong adapter headers, wrong placeholders, confusing user experience | Never — formats are different enough to warrant a dedicated converter |
| Skipping `copilot-instructions.md` merge logic | Avoid complex string manipulation | Users lose custom instructions on install, incomplete uninstall | Only in initial prototype; must fix before any release |
| Hardcoding `.github/` path without config option | Simple implementation | Can't support monorepos or custom Copilot configs | Acceptable for MVP; revisit if user demand emerges |
| Not gitignoring GSD artifacts in `.github/` | Users see all files | GSD metadata clutters repos, confuses contributors | Never — installer should recommend/write `.gitignore` entries |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `.github/` directory | Writing files that conflict with GitHub Actions, CODEOWNERS, etc. | Only write to `agents/`, `skills/`, `get-shit-done/`, `copilot-instructions.md` — never touch `workflows/`, `ISSUE_TEMPLATE/`, etc. |
| `copilot-instructions.md` | Treating as GSD-owned file | Treat as shared file with marker-based sections; merge, don't overwrite |
| Copilot agent discovery | Assuming `.md` suffix works | Copilot requires `.agent.md` suffix for agents in `.github/agents/` |
| `@path` file references | Using `./` prefix for `.github/` paths | Copilot resolves `@.github/...` not `@./.github/...` — omit the `./` |
| Copilot tool names | Assuming Claude tool names work | Map tools: `Read`→`read`, `Write`→`edit`, `Bash`→`execute`, `Grep/Glob`→`search`, `AskUserQuestion`→`ask_user` (via chat), `Task`→agent delegation |
| `gsd-tools.cjs` path | Using `$HOME/.claude/` path | Copilot uses `.github/get-shit-done/bin/gsd-tools.cjs` (always project-relative) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Copying all 30+ skills individually without batching | Slow install on Windows (file-per-file I/O) | Not critical for 30 files; becomes issue at 100+ | Very unlikely — GSD skill count is bounded |
| Full directory tree diff for manifest on large `.github/` dirs | Slow hash computation during `saveLocalPatches` | Scope manifest to only GSD-prefixed files, not all of `.github/` | When `.github/` has many CI workflows |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Writing GSD content outside `.github/` during Copilot install | Installer bug creates files in unexpected locations | Validate `targetDir` starts with `.github` for Copilot before any writes |
| `copilot-instructions.md` containing user secrets after merge | GSD marker parsing grabs too much or too little | Use strict marker boundaries; never read/expose content outside markers |
| `.github/get-shit-done/bin/gsd-tools.cjs` with write access | GSD tools can modify project files when Copilot invokes them | This is by design (same as other runtimes); no additional risk |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent skip when `--copilot --global` is specified | User thinks Copilot was installed globally, doesn't find it | Error with message: "Copilot only supports local (project) installs. Use --local or omit location flag." |
| Interactive prompt shows "Global (~/.github)" for Copilot | Confusing — `.github` isn't a global config dir | Skip global option when only Copilot is selected; show "Project (.github/)" |
| No completion message showing Copilot-specific next steps | User doesn't know how to use GSD in Copilot CLI | Show: "Open this project in Copilot CLI and type /gsd-new-project" |
| Banner text says "Claude Code, OpenCode, Gemini, and Codex" | Copilot not mentioned despite being installed | Update banner to include "Copilot" when it's a selected runtime |
| Command invocation format differs from other runtimes | User tries `/gsd:new-project` (Claude) in Copilot | Skills use `/gsd-new-project` format; completion message must show correct syntax |

## "Looks Done But Isn't" Checklist

- [ ] **Agent naming:** Files are `.agent.md` not `.md` — verify `ls .github/agents/gsd-*.agent.md`
- [ ] **Parent skill:** `.github/skills/get-shit-done/SKILL.md` exists with routing instructions
- [ ] **Path references:** All `@` references use `.github/` (not `./. github/` or `~/.github/`)
- [ ] **Tool mapping:** Copilot skills use Copilot tool names (`read`, `edit`, `execute`, `search`) not Claude names (`Read`, `Write`, `Bash`, `Grep`)
- [ ] **`copilot-instructions.md`:** Contains GSD section with markers, doesn't destroy existing content
- [ ] **Slash command format:** Skills use `/gsd-new-project` (not `/gsd:new-project`)
- [ ] **No hooks dir:** `.github/hooks/` does NOT exist after Copilot install
- [ ] **No settings.json:** `.github/settings.json` does NOT exist after Copilot install
- [ ] **Manifest location:** Manifest is at `.github/get-shit-done/.gsd-install-manifest.json`, not `.github/gsd-file-manifest.json`
- [ ] **Uninstall clean:** After uninstall, no `gsd-*` artifacts remain in `.github/`
- [ ] **`--all` works:** `--all --global` installs 4 runtimes globally + Copilot locally without errors
- [ ] **`--all` interactive:** Runtime prompt includes Copilot as option 5, All as option 6

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong directory target (e.g., `~/.github/`) | LOW | Delete misplaced directory; re-run with `--copilot --local` |
| `copilot-instructions.md` overwritten | MEDIUM | Restore from git (`git checkout -- .github/copilot-instructions.md`); fix installer merge logic |
| Agent files without `.agent.md` suffix | LOW | Re-run installer (it cleans before installing); or manually rename |
| Hooks/settings.json written to `.github/` | LOW | Delete `.github/hooks/`, `.github/settings.json`, `.github/package.json`; fix guards |
| `--all` regression breaking existing users | HIGH | Hotfix release reverting `--all` to 4 runtimes; add Copilot separately with proper guards |
| Manifest in wrong location | LOW | Move file; update manifest path logic; re-run installer |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `.github/` target breaks global/local model | Phase 1: Core installer integration | Unit test: `getDirName('copilot')` returns `.github`; `getGlobalDir('copilot')` errors/returns null; `--copilot --global` shows helpful error |
| Agent `.agent.md` naming mismatch | Phase 1: Core installer integration | Integration test: all agents in `.github/agents/` match `gsd-*.agent.md` pattern |
| Copilot skill format ≠ Codex skill format | Phase 2: Content conversion | Diff test: compare generated skills against reference implementation in `.github/skills/` |
| `copilot-instructions.md` clobbering | Phase 2: Content conversion | Test: install with pre-existing instructions → original content preserved; re-install → no duplication |
| `--all` flag regression | Phase 1: Core installer integration | Regression test: `--all --global` succeeds for Claude/OpenCode/Gemini/Codex; Copilot installs locally |
| Path replacement regex | Phase 2: Content conversion | Grep test: zero `./\.github/` matches in generated output; all `@` references resolve correctly |
| Missing parent skill | Phase 2: Content conversion | File existence test: `.github/skills/get-shit-done/SKILL.md` exists after install |
| Hooks/settings leaking into `.github/` | Phase 1: Core installer integration | Negative test: `.github/hooks/`, `.github/settings.json`, `.github/package.json` must NOT exist |
| Uninstall incomplete | Phase 3: Uninstall & cleanup | Uninstall test: no `gsd-*` files in `.github/agents/`, `.github/skills/`; GSD section removed from `copilot-instructions.md` |
| Manifest in `.github/` root | Phase 1: Core installer integration | Path test: manifest written to `.github/get-shit-done/.gsd-install-manifest.json` |

## Sources

- Direct code analysis: `bin/install.js` (2376 lines, 4 existing runtime patterns)
- Reference implementation: `.github/` directory in repo (generated by v2.0.3 Copilot installer)
- Manifest: `.github/get-shit-done/.gsd-install-manifest.json` (confirms `"platform": "copilot"`, `"scope": "local"`)
- Copilot skill format: `.github/skills/gsd-*/SKILL.md` (observed frontmatter and content patterns)
- Copilot agent format: `.github/agents/gsd-*.agent.md` (observed `.agent.md` naming convention)
- Copilot instructions: `.github/copilot-instructions.md` (6-line routing file)
- Codex precedent: `convertClaudeCommandToCodexSkill()`, `installCodexConfig()`, `stripGsdFromCodexConfig()` — patterns to follow but not copy directly

---
*Pitfalls research for: Adding Copilot CLI as 5th runtime to multi-runtime GSD installer*
*Researched: 2025-03-02*
