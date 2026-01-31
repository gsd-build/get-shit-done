# Codebase Concerns

**Analysis Date:** 2026-01-31

## Tech Debt

**Install script complexity:**
- Issue: `bin/install.js` is 1445 lines with complex runtime conversion logic (Claude → OpenCode → Gemini)
- Files: `bin/install.js`
- Impact: Hard to maintain, risky to modify conversion logic, potential for runtime-specific bugs
- Fix approach: Extract conversion functions into separate modules (`lib/conversions/claude-to-opencode.js`, `lib/conversions/claude-to-gemini.js`), add unit tests for each conversion path

**Silent error handling in hooks:**
- Issue: Hooks use empty catch blocks (`catch (e) {}`), hiding failures
- Files: `hooks/gsd-check-update.js` (lines 41, 46), `hooks/gsd-statusline.js` (lines 61, 74, 84)
- Impact: Update checks and statusline can fail silently, users unaware of issues
- Fix approach: Add logging to catch blocks (console.error for failures), consider error reporting mechanism

**Path handling complexity:**
- Issue: Multiple path replacement patterns across different runtimes (`~/.claude/`, `~/.config/opencode/`, `~/.gemini/`)
- Files: `bin/install.js` (lines 559-600, 1081-1083)
- Impact: Easy to miss path replacements, inconsistent behavior across runtimes
- Fix approach: Centralize path replacement in utility function, add tests for all runtime combinations

**Frontmatter conversion fragility:**
- Issue: Complex YAML frontmatter parsing and conversion logic (lines 375-473, 305-373 in `bin/install.js`)
- Files: `bin/install.js`
- Impact: Conversion bugs break agent/command functionality, hard to debug malformed frontmatter
- Fix approach: Use YAML parser library instead of manual string parsing, add validation after conversion

**Large workflow markdown files:**
- Issue: Several markdown files exceed 1000 lines (execute-plan.md: 1844, execute-phase.md: 671, complete-milestone.md: 903)
- Files: `get-shit-done/workflows/execute-plan.md`, `get-shit-done/workflows/complete-milestone.md`
- Impact: Hard to navigate, potential performance issues when parsing, context bloat
- Fix approach: Split into smaller focused documents, use includes/references for shared content

## Known Bugs

**Update check hook silent failure:**
- Symptoms: Update notifications may not appear even when updates available
- Trigger: Network timeout or npm registry unavailability during background check
- Files: `hooks/gsd-check-update.js` (line 45 - execSync timeout, line 46 - empty catch)
- Workaround: Manual check via `npm view get-shit-done-cc version`
- Root cause: Background process failures are silently swallowed
- Fix: Add error logging, surface failures to user, add retry mechanism

**Statusline parse error handling:**
- Symptoms: Statusline may display incorrectly or not at all on malformed JSON input
- Trigger: Claude Code sends unexpected JSON structure to statusline hook
- Files: `hooks/gsd-statusline.js` (line 84 - silent catch)
- Workaround: Statusline silently fails, no visual indication
- Root cause: Empty catch block hides parse errors
- Fix: Add error logging, graceful degradation (show basic statusline on error)

## Security Considerations

**Child process execution:**
- Risk: `npm view` command executed via `execSync` could be vulnerable to command injection if npm registry is compromised
- Files: `hooks/gsd-check-update.js` (line 45)
- Current mitigation: Hardcoded package name, timeout set to 10s
- Recommendations: Validate npm registry response, add checksum verification for version strings, consider using npm API directly instead of CLI

**File system operations without validation:**
- Risk: Path traversal possible if user-provided paths not sanitized (though most paths are derived from env vars)
- Files: `bin/install.js` (path.join operations throughout)
- Current mitigation: Using path.join() which prevents some traversal, but no explicit validation
- Recommendations: Add path validation utility, reject paths outside expected directories

**Settings.json modification:**
- Risk: Install script modifies user's settings.json without backup
- Files: `bin/install.js` (lines 1146-1194)
- Current mitigation: Reads existing settings, merges changes
- Recommendations: Create backup before modification, add rollback mechanism on failure

## Performance Bottlenecks

**Large markdown file parsing:**
- Problem: Workflow files (1844+ lines) parsed repeatedly during agent execution
- Files: `get-shit-done/workflows/execute-plan.md`, `get-shit-done/workflows/complete-milestone.md`
- Measurement: Not measured, but likely impacts context window usage
- Cause: No caching of parsed content, full file read each time
- Improvement path: Consider splitting large files, add caching layer for frequently accessed workflows

**No caching for update checks:**
- Problem: Update check runs on every session start, makes network call each time
- Files: `hooks/gsd-check-update.js`
- Measurement: 10s timeout per session start
- Cause: Cache file exists but no TTL validation, always spawns background check
- Improvement path: Check cache age before spawning background process, respect cache TTL (e.g., 24 hours)

## Fragile Areas

**Runtime-specific conversion logic:**
- Files: `bin/install.js` (convertClaudeToOpencodeFrontmatter, convertClaudeToGeminiAgent, convertClaudeToGeminiToml)
- Why fragile: Each runtime has different frontmatter formats, conversion bugs break agent functionality, hard to test all combinations
- Common failures: Tool name mismatches, color format errors, missing required fields
- Safe modification: Add comprehensive test suite for each runtime conversion, validate output against runtime schemas

**Hook registration in settings.json:**
- Files: `bin/install.js` (lines 1168-1192)
- Why fragile: Complex nested structure (hooks.SessionStart array), easy to create duplicate entries, order matters
- Common failures: Duplicate hook registrations, malformed JSON structure, orphaned entries after uninstall
- Safe modification: Add deduplication logic, validate JSON structure after modification, add tests for install/uninstall cycle

**Path replacement regex patterns:**
- Files: `bin/install.js` (lines 559, 600, 1082)
- Why fragile: Multiple regex replacements, order-dependent, can miss edge cases
- Common failures: Paths not replaced in all contexts, incorrect replacements in comments/code examples
- Safe modification: Use single comprehensive replacement function, add tests for all path contexts

**Tool name mapping:**
- Files: `bin/install.js` (claudeToOpencodeTools, claudeToGeminiTools objects)
- Why fragile: Manual mapping dictionaries, must be kept in sync with runtime changes, no validation
- Common failures: Missing mappings for new tools, incorrect mappings break agent functionality
- Safe modification: Add validation against runtime tool registries, generate mappings from runtime schemas if possible

## Test Coverage Gaps

**No test suite:**
- What's not tested: Entire codebase has no visible test files
- Risk: Changes to install logic, conversions, or hooks could break functionality silently
- Priority: High
- Difficulty to test: Need to mock file system operations, test across multiple runtime environments

**Install/uninstall cycle:**
- What's not tested: Full install → verify → uninstall → verify cycle
- Risk: Orphaned files, broken settings.json, incomplete cleanup
- Priority: High
- Difficulty to test: Requires temporary directories, multiple runtime configs

**Frontmatter conversion:**
- What's not tested: Conversion accuracy for all agent/command files across runtimes
- Risk: Broken agents/commands after conversion, runtime errors
- Priority: Medium
- Difficulty to test: Need sample frontmatter files, validate against runtime schemas

**Hook execution:**
- What's not tested: Hook behavior with various input formats, error handling
- Risk: Hooks fail silently, statusline breaks, update checks don't work
- Priority: Medium
- Difficulty to test: Need to simulate Claude Code JSON input, test error paths

**Path handling edge cases:**
- What's not tested: Custom config directories, Windows paths, symlinked directories
- Risk: Installation fails on edge cases, incorrect path replacements
- Priority: Low
- Difficulty to test: Need cross-platform test environment

## Dependencies at Risk

**esbuild version:**
- Risk: Using esbuild ^0.24.0 (dev dependency), newer versions available
- Impact: Potential security vulnerabilities, missing features
- Migration plan: Update to latest version, verify build still works

**Node.js version requirement:**
- Risk: Requires Node.js >=16.7.0, some users may have older versions
- Impact: Installation fails for users on older Node.js
- Migration plan: Document minimum version clearly, add version check in install script

## Missing Critical Features

**Error reporting mechanism:**
- Problem: No way to report errors or failures to maintainers
- Current workaround: Users report issues via GitHub
- Blocks: Silent failures go unreported, harder to debug user issues
- Implementation complexity: Low (add error logging, optional telemetry)

**Rollback mechanism:**
- Problem: No way to undo installation if it breaks user's setup
- Current workaround: Manual cleanup, restore from backup
- Blocks: Users hesitant to install/update, fear of breaking existing setup
- Implementation complexity: Medium (backup before install, restore on failure)

**Configuration validation:**
- Problem: No validation of settings.json structure before modification
- Current workaround: Relies on JSON.parse() errors
- Blocks: Malformed settings.json could break Claude Code/OpenCode/Gemini
- Implementation complexity: Low (add schema validation before write)

---
*Concerns audit: 2026-01-31*
