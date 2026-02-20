# Codebase Concerns

**Analysis Date:** 2026-01-24

## Tech Debt

**Installation Directory Deletion on Update:**
- Issue: `copyWithPathReplacement()` in `bin/install.js` (lines 439-471) recursively deletes destination directories with `fs.rmSync(destDir, { recursive: true })` before copying new files. This is necessary to prevent orphaned files but is destructive and risky if paths are misconfigured.
- Files: `bin/install.js` (lines 444-445), similar deletion in `copyFlattenedCommands()` (lines 390-396)
- Impact: Accidental directory name miscalculation could delete unrelated user files. Mitigated by strict path validation in main flow, but no guardrail against programmatic errors.
- Fix approach: Add path validation assertions before deletion (verify destDir is under expected GSD installation location). Consider dry-run mode for debugging.

**Callback-Based Asynchronous Flow:**
- Issue: Installation flow uses callback-based patterns (`promptRuntime()`, `promptLocation()`, `handleStatusline()` in `bin/install.js`) instead of async/await, creating callback nesting and harder error handling.
- Files: `bin/install.js` (lines 1127-1291)
- Impact: Error propagation is manual; if a callback throws, it may not be caught. Debugging async issues is harder with callbacks.
- Fix approach: Refactor to async/await for readability and better error handling with try/catch blocks.

**Error Handling Gaps in Background Hook:**
- Issue: `gsd-check-update.js` uses `child.unref()` without error listener setup. Background processes spawned with `stdio: 'ignore'` fail silently.
- Files: `hooks/gsd-check-update.js` (lines 24-61)
- Impact: If the update check process crashes, no error is logged; user never knows check failed. Cache file may never be written, causing stale update status to persist.
- Fix approach: Add explicit error handler on spawned process before `unref()`. Log to debug file or stderr if available.

**Silent Failure in Statusline Parsing:**
- Issue: `gsd-statusline.js` catches all exceptions with empty catch (line 81-83), preventing visibility into JSON parse or file read failures.
- Files: `hooks/gsd-statusline.js` (lines 81-83)
- Impact: If CONTEXT or state file is corrupted, statusline disappears without warning. User has no way to diagnose why their statusline stopped working.
- Fix approach: Log failures to stderr or a debug log file instead of silent fail. Include error type so users can report issues.

**Hardcoded Path Construction:**
- Issue: Multiple functions use string concatenation for path construction (e.g., `path.join(homeDir, '.claude', 'todos')` in `gsd-statusline.js` line 46) rather than computed paths.
- Files: `hooks/gsd-statusline.js` (lines 46, 64), `hooks/gsd-check-update.js` (lines 12-17)
- Impact: Changes to path conventions require updating multiple locations. No single source of truth for GSD config paths.
- Fix approach: Create a `paths.js` utility module exporting functions like `getGsdCacheDir()`, `getGsdTodosDir()` for reuse across hooks.

## Known Issues

**Claude Code Bug #13898 - Subagent MCP Tool Access:**
- Symptoms: Subagents cannot directly access MCP tools (like Context, Bash, Read) when spawned via SlashCommand without explicit tool declarations.
- Files: Referenced in `CHANGELOG.md` (v1.9.5), implemented workaround in agent definitions (agents/*.md)
- Trigger: Using a subagent with `SlashCommand` tool without explicitly adding MCP tools to agent manifest
- Workaround: GSD agents now explicitly declare all required tools in frontmatter. Orchestrators call agents with full tool set available.
- Status: External (Claude Code limitation), monitored in changelog

**OpenCode Path Configuration Complexity:**
- Symptoms: OpenCode uses XDG Base Directory spec with multiple fallback paths (`OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG`, `XDG_CONFIG_HOME`, then default `~/.config/opencode`).
- Files: `bin/install.js` (lines 47-65, 72-89, 737-795)
- Trigger: Users with non-standard OpenCode config locations or custom XDG settings
- Workaround: Priority order in `getOpencodeGlobalDir()` handles most cases, but edge cases with symlinks or remote home dirs may fail. Use explicit `--config-dir` flag to override.
- Status: Documented in README Non-interactive Install section

**Windows Hook Path Handling:**
- Symptoms: Hook commands must use forward slashes for Node.js compatibility; backslashes cause parsing issues.
- Files: `bin/install.js` (lines 196-199)
- Trigger: Installation on Windows with backslash path separators
- Workaround: `buildHookCommand()` converts all paths to forward slashes before insertion into settings.json. Fixed in v1.5.29.
- Status: Fixed but requires vigilance when modifying hook installation

## Security Considerations

**Settings.json Mutation Without Backup:**
- Risk: `cleanupOrphanedHooks()` and uninstall operations modify `settings.json` directly without creating a backup. If mutation fails mid-process, settings can become corrupted.
- Files: `bin/install.js` (lines 494-534, 634-679)
- Current mitigation: `readSettings()` returns empty object on JSON parse error, allowing recovery from corrupted state. No file-level lock prevents concurrent modifications.
- Recommendations: Create `.backup` before mutation. Use atomic write (write to temp, rename) to prevent partial writes. Add file locking if concurrent installations are possible.

**Environment Variable Exposure in Cache Files:**
- Risk: `gsd-update-check.json` is created with `fs.writeFileSync()` without explicit permissions. World-readable cache could expose API responses if they contained sensitive data.
- Files: `hooks/gsd-check-update.js` (line 55)
- Current mitigation: Cache only stores version strings and timestamps, not secrets.
- Recommendations: Set restrictive permissions (`0600`) on cache files. Document that cache files should never contain sensitive data.

**Installer Path Injection via `--config-dir`:**
- Risk: User-supplied `--config-dir` path is expanded and used directly in file operations without validation.
- Files: `bin/install.js` (lines 104-127, 185-189)
- Current mitigation: Paths are expanded but only used for standard GSD installation (commands/, agents/, hooks/). No arbitrary directory creation.
- Recommendations: Validate that `--config-dir` points to an existing directory or can be safely created. Warn user if path is outside home directory.

## Performance Bottlenecks

**Synchronous File Operations in Hook:**
- Problem: `gsd-statusline.js` performs synchronous file reads on session startup (lines 47-59 perform `fs.readdirSync()` and `fs.readFileSync()`), blocking statusline output.
- Files: `hooks/gsd-statusline.js` (lines 47-59)
- Cause: Must return synchronous output for statusline pipe; async not possible in current architecture.
- Impact: If todo files are on slow storage (network mounts, slow HDD), statusline will hang for 100ms+.
- Improvement path: Cache todo state in memory during session, invalidate on explicit updates. Use async update mechanism for background refresh.

**Inefficient Orphaned Hook Search:**
- Problem: `cleanupOrphanedHooks()` iterates all hook event types and entries multiple times to find and remove orphaned patterns.
- Files: `bin/install.js` (lines 494-534)
- Cause: Linear search through settings structure without index.
- Impact: With 100+ hook entries, cleanup is O(n*m); negligible now but degrades if hook system grows.
- Improvement path: Build hook index map before search. Pre-compile orphaned patterns as regex.

## Fragile Areas

**Path Replacement Regex in OpenCode Conversion:**
- Files: `bin/install.js` (lines 274-371)
- Why fragile: Three separate regex replacements for path conversions (lines 277-283). Different patterns for `~/.claude` vs custom paths. Tool name conversion has hardcoded mapping (lines 248-254) that breaks if new tool names are added.
- Safe modification: When adding new tools or changing path schemes, update all three locations and test OpenCode conversion end-to-end. Add test cases for tool mappings.
- Test coverage: No unit tests for `convertClaudeToOpencodeFrontmatter()`. Manual testing required for each OpenCode release.

**Directory Flattening Logic:**
- Files: `bin/install.js` (lines 385-429)
- Why fragile: `copyFlattenedCommands()` recursively renames nested directories to flat structure (e.g., `gsd/debug/start.md` → `gsd-debug-start.md`). Depth of nesting affects naming. If subdirectory names contain hyphens, flattened names can become ambiguous.
- Safe modification: Do not add new nested command directories. If subdirectory adds must be made, update prefix logic to handle collisions (e.g., use underscore separator for nested levels).
- Test coverage: No test suite; manual verification of flattened command names required before each release.

**Settings.json Hook Registration:**
- Files: `bin/install.js` (lines 1001-1026)
- Why fragile: Checks for existing GSD hooks by string matching on command path (lines 1011-1012). If user manually modifies hook paths in settings.json, duplicate hooks can be registered.
- Safe modification: When referencing existing hooks, use exact command string matching with path normalization (e.g., resolve symlinks).
- Test coverage: No automated tests for hook registration. Risk of duplicate hooks if installer run twice with different paths.

## Scaling Limits

**In-Memory Session State (Statusline):**
- Current capacity: Reads up to 100 todo files per session; scans file list every statusline render
- Limit: If a single session accumulates 1000+ todo files, statusline file scan becomes slow (O(n) per render)
- Scaling path: Implement session-scoped todo index file updated only on new task addition, not per-render

**Single-File Installation Manifest:**
- Current capacity: `package.json` files list (~12 entries) covers current installation scope
- Limit: Adding 50+ more GSD commands will require nested directory traversal, making installation slower
- Scaling path: Move file manifest to directory scanning with glob patterns instead of explicit file lists

## Dependencies at Risk

**Node.js Version Requirement (16.7.0+):**
- Risk: Installed as `engines: node >= 16.7.0` in `package.json`. Node 16 reached EOL in September 2023; security updates no longer available.
- Impact: Users on Node 16 receive no security patches. esbuild dependency (v0.24.0) still supports Node 16 but may drop support in next major.
- Migration plan: Bump minimum to Node 18 LTS (EOL April 2025) or Node 20 LTS (EOL April 2026). Test installer on Node 18+ before next major version. Update CI to test against Node 18, 20.

**esbuild Dependency (0.24.0):**
- Risk: Single build dependency; critical for bundling hooks. No version constraint (uses `^0.24.0`). Breaking changes in 0.25+ may require script updates.
- Impact: `npm install` could pull 0.25+ unexpectedly, breaking build if API changed.
- Recommendations: Lock esbuild to exact version (`0.24.0` not `^0.24.0`). Add integration test that runs `npm run build:hooks` and verifies output files exist.

**No Lock File Tracking in Git:**
- Risk: `package-lock.json` exists but dependency versions are not pinned. Inconsistent installs across environments if lock file diverges.
- Impact: CI installs different versions than local development.
- Recommendations: Commit `package-lock.json` and include in `npm ci` (clean install) in any CI pipeline.

## Missing Critical Features

**No Automated Tests:**
- Problem: Zero unit or integration tests exist for installer (`bin/install.js`), hooks, or path conversion logic.
- Blocks: Cannot safely refactor installer or add new runtimes without manual testing. Risk of regression when modifying path handling.
- Impact: High (installer is critical path for all users)
- Recommendation: Add Jest test suite with tests for:
  - Path flattening logic (CLI commands with nested dirs)
  - OpenCode conversion (Claude → OpenCode format)
  - Hook registration (no duplicates after multiple installs)
  - Orphaned file cleanup

**No Installation Dry-Run Mode:**
- Problem: Installer performs actual file operations with no preview or rollback option.
- Blocks: Users cannot verify what will be installed before committing changes. No recovery if mistake is made.
- Recommendation: Add `--dry-run` flag that prints plan without modifying files.

**No Hook Debugging Mode:**
- Problem: Background hooks (update-check, statusline) fail silently with `stdio: 'ignore'`.
- Blocks: Users cannot diagnose why update checking or statusline stopped working.
- Recommendation: Add `DEBUG_GSD` env var that enables logging to `~/.claude/debug/gsd-hooks.log`.

## Test Coverage Gaps

**Installer Argument Parsing:**
- What's not tested: `parseConfigDirArg()`, flag combinations, interactive prompts
- Files: `bin/install.js` (lines 104-127, 1253-1291)
- Risk: Flag parsing changes could silently break non-interactive installs (Docker, CI)
- Priority: High (installer is user-facing)

**Frontmatter Conversion (Claude ↔ OpenCode):**
- What's not tested: Color name to hex conversion, tool name mappings, allowed-tools array to tools object
- Files: `bin/install.js` (lines 274-371)
- Risk: Missing tool conversions cause silent failures; users don't know OpenCode install is incomplete
- Priority: High (OpenCode support is advertised feature)

**Error Recovery in JSON Mutations:**
- What's not tested: Corrupted settings.json recovery, partial hook registration, concurrent installs
- Files: `bin/install.js` (lines 494-534, 634-679)
- Risk: Settings corruption not easily recoverable without manual intervention
- Priority: Medium (rare but high-impact when it happens)

**Path Normalization Across Platforms:**
- What's not tested: Windows path handling, symlinks, non-ASCII directory names
- Files: `bin/install.js` (path operations throughout)
- Risk: Windows users encounter broken hook paths; symlinks break path matching
- Priority: Medium (Windows/macOS parity expected)

---

*Concerns audit: 2026-01-24*
