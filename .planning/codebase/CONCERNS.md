# Codebase Concerns

**Analysis Date:** 2026-01-31

## Tech Debt

**Silent Error Handling in Critical Functions:**
- Issue: Multiple catch blocks ignore errors without logging or recovery
- Files: `bin/install.js` (lines 185, 871, 904, 965)
- Impact: When JSON parsing fails, silent fallback to empty object. If settings.json is corrupted, users lose configuration silently
- Fix approach: Log errors to stderr, provide recovery instructions, add error reporting to user-facing messages

**Recursive File Deletion Without Error Handling:**
- Issue: `fs.rmSync(destDir, { recursive: true })` called without try-catch at lines 586, 739, 748
- Files: `bin/install.js` (copyWithPathReplacement, uninstall functions)
- Impact: If rmSync fails (permissions, in-use files, readonly filesystem), the installer crashes without recovery. Could leave system in inconsistent state with partially deleted directories
- Fix approach: Wrap in try-catch with user-friendly error messages, implement rollback mechanism, validate directory exists and is writable before deletion

**No Transaction/Rollback on Install Failure:**
- Issue: Installer makes 18+ file operations sequentially with no atomic guarantee
- Files: `bin/install.js` (install function, lines 1014-1196)
- Impact: If install fails mid-way (disk full, permission denied), system is left with partial installation. User must manually clean up or reinstall
- Fix approach: Create temp directory, perform all writes there, validate before moving to final location. Implement cleanup on process.exit for graceful failure

## Known Bugs

**Readline Double-Close in Interactive Prompts:**
- Symptoms: Potential for "close" event firing twice if user closes stdin while readline is open
- Files: `bin/install.js` (promptRuntime, promptLocation, handleStatusline functions, lines 1288-1323, 1328-1368, 1236-1282)
- Trigger: Close stdin while prompt is waiting for input
- Workaround: `answered` flag prevents duplicate execution, but pattern suggests underlying issue with readline event handling

**Non-TTY Handling May Fail in CI:**
- Symptoms: When `process.stdin.isTTY` is false, defaults to Claude global install without validation
- Files: `bin/install.js` (lines 1329-1332, 1439-1441)
- Trigger: Running in CI/Docker with no terminal (GitHub Actions, GitLab CI, Docker)
- Workaround: Use `--claude --global` flags to skip interactive prompt. Problem is discovery - users expect installer to work in CI

## Security Considerations

**Unvalidated npm Package Fetch:**
- Risk: `npm view get-shit-done-together version` in gsd-check-update.js executes without validation
- Files: `hooks/gsd-check-update.js` (line 45)
- Current mitigation: timeout of 10 seconds, stdio ignored
- Recommendations: Add checksum validation of fetched version, use npm registry API with authentication, add retry logic with backoff

**Path Traversal via Regex Replacement:**
- Risk: Path replacement using global regex could match unintended paths if user has ~/.claude in multiple locations
- Files: `bin/install.js` (lines 561-564, 600-602)
- Current mitigation: Regex is specific (`~\/\.claude\/`), but no path canonicalization
- Recommendations: Use path.resolve() instead of regex, validate all paths before file operations

**No Backup Before Overwriting Config:**
- Risk: writeFileSync overwrites settings.json without backup, losing user customizations if JSON structure is unexpected
- Files: `bin/install.js` (lines 196, 830, 867, 947, 1214)
- Current mitigation: readSettings returns empty object on parse failure
- Recommendations: Create backup of settings.json before modification, version the config format, add schema validation

**Sensitive File Permissions Not Set:**
- Risk: VERSION file and config files written without explicit mode (uses umask)
- Files: `bin/install.js` (line 1116 - VERSION), hooks configuration
- Current mitigation: None
- Recommendations: Use fs.writeFileSync with mode: 0o644 for public files, add validation of installed file permissions

## Performance Bottlenecks

**Synchronous File Operations During Install:**
- Problem: All file copying uses synchronous API (readFileSync, writeFileSync, copyFileSync)
- Files: `bin/install.js` (lines 560-616)
- Cause: Installer loads entire agent/command files into memory before writing
- Improvement path: Use async file operations with Promise.all for parallel copying. Could reduce install time 50% for large installations

**Regex Replacement on Every File:**
- Problem: Path replacement regex run on every markdown file during install (~27 files)
- Files: `bin/install.js` (lines 601-602, 1084-1085)
- Cause: Global regex on file content multiple times per file
- Improvement path: Pre-compile regex, batch replacements, consider template system instead of regex

**Update Check Spawns Full Node Process:**
- Problem: gsd-check-update.js spawns separate Node process just to check npm registry
- Files: `hooks/gsd-check-update.js` (lines 25-59)
- Cause: Avoids blocking statusline, but process overhead is high
- Improvement path: Use native fetch API (Node 18+), cache results for longer period (current cache has no TTL check)

## Fragile Areas

**Frontmatter Conversion Logic:**
- Files: `bin/install.js` (convertClaudeToOpencodeFrontmatter, convertClaudeToGeminiAgent, convertClaudeToGeminiToml)
- Why fragile: 350+ lines of complex YAML parsing without library, error-prone state machine for array parsing (inAllowedTools flag)
- Safe modification: Add YAML parser library, add comprehensive test suite for all frontmatter variations, test with actual command files
- Test coverage: No automated tests for frontmatter conversion across 27 command files

**OpenCode Permission Configuration:**
- Files: `bin/install.js` (configureOpencodePermissions, lines 891-949)
- Why fragile: Assumes specific OpenCode config directory structure (XDG Base Directory spec), OpenCode's JSON config format may change
- Safe modification: Add OpenCode version check, validate config schema, test on different XDG configurations
- Test coverage: No tests for custom OPENCODE_CONFIG_DIR or XDG_CONFIG_HOME variations

**Multi-Runtime Installation Callback Chain:**
- Files: `bin/install.js` (installAllRuntimes, lines 1373-1410)
- Why fragile: Complex callback nesting for statusline handling, can cause state inconsistency if one runtime install fails
- Safe modification: Refactor to use Promise-based flow, add error boundaries per runtime
- Test coverage: No tests for partial installation (e.g., Claude succeeds, Gemini fails)

**Gemini Agent Conversion:**
- Files: `bin/install.js` (convertClaudeToGeminiAgent, lines 307-375)
- Why fragile: Excludes MCP tools and Task tool without documentation. If Gemini adds native Task support, this will break
- Safe modification: Add configuration for tool filtering, document tool mapping strategy, version the conversion logic
- Test coverage: No tests with actual Gemini agents

## Scaling Limits

**Single-Threaded Install with No Progress Reporting:**
- Current capacity: Works fine for 27 command files + agents
- Limit: Would become unresponsive if GSD commands grow beyond 100+ files or on slow filesystems
- Scaling path: Implement streaming file operations, add progress callback for large installations

**Hook Process Spawning:**
- Current capacity: gsd-check-update spawns once per session
- Limit: If multiple projects run GSD simultaneously, could spawn many processes contending for npm registry
- Scaling path: Implement shared process pool, add mutex for npm registry access, cache results per system

## Dependencies at Risk

**Node.js Version Requirement (>=16.7.0):**
- Risk: Minimum version is from 2021, may drop support before EOL
- Impact: Blocks users on LTS versions < 16 (Node 14 still in maintenance)
- Migration plan: Already set in package.json, consider bumping to 18+ for native fetch API and better TypeScript support

**npm Availability for Update Checks:**
- Risk: gsd-check-update depends on npm CLI being installed and in PATH
- Impact: Docker containers without npm, npm outages, registry unavailability all break update checking
- Migration plan: Use npm registry API directly, add graceful degradation if npm unavailable

**esbuild as Dev Dependency (Not Actually Used):**
- Risk: esbuild listed in devDependencies but hooks aren't bundled - just copied as-is
- Impact: Confusing to maintainers, suggests bundling is planned but not implemented
- Migration plan: Remove esbuild from devDependencies, simplify build script to just copy

## Missing Critical Features

**Installation Verification:**
- Problem: Install completes without verifying all files were actually written
- Blocks: Users don't know if installation was successful until trying to use it
- Needed: Checksum validation of key files, post-install verification step

**Recovery/Rollback Mechanism:**
- Problem: No way to recover from failed install
- Blocks: Users must manually delete partial installation and retry
- Needed: Automatic cleanup on error, backup of previous installation

**Multi-Platform Testing Infrastructure:**
- Problem: No CI tests for Windows/Mac/Linux path handling
- Blocks: Path-related bugs only discovered after release
- Needed: GitHub Actions matrix testing for all platforms, all runtimes, all install modes

## Test Coverage Gaps

**Installer Core Logic (bin/install.js):**
- What's not tested: Frontmatter conversion, path replacement, error handling, file operations, settings.json manipulation
- Files: `bin/install.js` (1447 lines, 0 tests)
- Risk: Fundamental functionality has zero test coverage. Changes can silently break for specific runtimes or paths
- Priority: **High** - installer is single point of failure for all users

**Hook Functionality (hooks/*.js):**
- What's not tested: Statusline rendering logic, JSON parsing, file operations, cache handling
- Files: `hooks/gsd-statusline.js` (87 lines), `hooks/gsd-check-update.js` (61 lines)
- Risk: Hooks run in background every session. Failures affect user experience but hard to debug
- Priority: **High** - affects user experience every time Claude Code starts

**Build Script (scripts/build-hooks.js):**
- What's not tested: Hook copying, directory creation, error handling
- Files: `scripts/build-hooks.js` (42 lines)
- Risk: If build fails, npm publish succeeds but installation will fail
- Priority: **Medium** - only runs during publish

**Runtime-Specific Paths:**
- What's not tested: OpenCode XDG path handling, Gemini config directory, environment variable overrides
- Files: `bin/install.js` (getOpencodeGlobalDir, getGlobalDir functions, lines 54-107)
- Risk: Each runtime has different path logic, only tested manually
- Priority: **High** - path errors cause install to wrong location

**Interactive Prompts:**
- What's not tested: Readline interaction, TTY detection, input handling, callback firing
- Files: `bin/install.js` (promptRuntime, promptLocation, lines 1287-1368)
- Risk: Complex state machine with readline, potential for edge cases in CI environments
- Priority: **Medium** - affects interactive installs, less critical than non-interactive

---

*Concerns audit: 2026-01-31*
