# Codebase Concerns

**Analysis Date:** 2026-02-05

## Tech Debt

**Fragile JSON Parsing in Bash Workflows:**
- Issue: Uses grep/sed patterns to extract JSON values instead of proper JSON parsing
- Files: 
  - `agents/gsd-executor.md:47`
  - `commands/gsd/execute-phase.md:45, 100`
  - `get-shit-done/workflows/execute-phase.md:20, 62, 76-77`
- Impact: Silent configuration failures when JSON formatting varies (minified, different spacing, escaped quotes)
- Fix approach: Replace with `jq` for robust JSON parsing:
  ```bash
  # Current fragile approach
  MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
  
  # Recommended fix
  MODEL_PROFILE=$(jq -r '.model_profile // "balanced"' .planning/config.json 2>/dev/null || echo "balanced")
  ```

**Silent Error Swallowing in Hooks:**
- Issue: Empty catch blocks hide errors completely
- Files:
  - `hooks/gsd-statusline.js:62, 78`
  - `hooks/gsd-check-update.js:41, 46`
- Impact: Debugging difficulties when things fail silently
- Fix approach: Add minimal error logging or structured error tracking

**Code Duplication Between Main and cursor-gsd:**
- Issue: Near-complete duplication of all agents, commands, workflows, and templates
- Files: `cursor-gsd/src/` mirrors structure of `agents/`, `commands/`, `get-shit-done/`
- Impact: 
  - Changes must be made in 2+ places
  - Risk of drift between versions
  - Maintenance burden doubles
- Fix approach: Consider:
  1. Single source of truth with build-time transformation
  2. Symlinks where platforms support them
  3. Automated sync tooling with diff validation

**Hardcoded Path References:**
- Issue: Paths like `~/.claude/`, `.planning/` scattered throughout codebase
- Files:
  - `hooks/gsd-statusline.js:49` - hardcoded `~/.claude/todos`
  - `hooks/gsd-check-update.js:12` - hardcoded `~/.claude/`
  - Multiple workflow files reference `.planning/`
- Impact: Changes to directory structure require updates in multiple files
- Fix approach: Centralize path constants in a shared configuration module

## Known Bugs

**Documented but not fixed - JSON parsing failures:**
- Symptoms: Configuration settings silently fall back to defaults
- Files: `BUG_REPORT.md:56-101`, `FIXES_APPLIED.md:93-124`
- Trigger: JSON config with minified format, different spacing, or escaped quotes
- Workaround: Ensure `.planning/config.json` is properly formatted with consistent spacing

**Git add rules violation (documented as fixed):**
- Symptoms: Original code used `git add -u` which violates stated rules
- Files: `commands/gsd/execute-phase.md:94` (fix applied per FIXES_APPLIED.md)
- Status: Fix implemented - now uses individual file staging

## Security Considerations

**Environment Variable Exposure:**
- Risk: Environment variables used for config paths could be manipulated
- Files:
  - `bin/install.js:55-66` - `OPENCODE_CONFIG_DIR`, `XDG_CONFIG_HOME`
  - `bin/install.js:92-103` - `GEMINI_CONFIG_DIR`, `CLAUDE_CONFIG_DIR`
- Current mitigation: `expandTilde()` function handles path expansion
- Recommendations: Add path validation to prevent directory traversal attacks

**Network Requests in Update Check:**
- Risk: npm registry queries expose version information
- Files: `hooks/gsd-check-update.js:45`
- Current mitigation: 10-second timeout, runs in background
- Recommendations: Consider rate limiting or user opt-out option

## Performance Bottlenecks

**Large Agent Files:**
- Problem: Some agent files are very large (1000+ lines)
- Files:
  - `agents/gsd-planner.md` - ~1400+ lines
  - `agents/gsd-executor.md` - ~780+ lines
  - `agents/gsd-verifier.md` - ~700+ lines
- Cause: Comprehensive documentation and examples inline
- Improvement path: Consider splitting into smaller, composable modules or extracting examples to separate reference files

**File System Operations on Every Statusline Update:**
- Problem: Statusline reads files on every invocation
- Files: `hooks/gsd-statusline.js:49-67`
- Cause: Synchronous file reads for todo list
- Improvement path: Consider caching or reducing read frequency

## Fragile Areas

**Frontmatter Parsing in install.js:**
- Files: `bin/install.js:370-540`
- Why fragile: Hand-rolled YAML-like parsing for tool name conversions
- Safe modification: Add tests before modifying; many edge cases in YAML parsing
- Test coverage: None (no test files exist)

**Tool Name Mapping:**
- Files:
  - `bin/install.js:287-308` - Claude to OpenCode/Gemini tool mappings
  - `bin/install.js:315-350` - Conversion functions
- Why fragile: Mappings hardcoded; new tools require manual updates
- Safe modification: Consider generating from a single mapping definition
- Test coverage: None

## Scaling Limits

**Context Window Management:**
- Current capacity: Plans designed for ~50% context usage
- Limit: Claude degrades at 70%+ context (documented in `agents/gsd-planner.md:83-94`)
- Scaling path: Already addressed via aggressive plan atomicity (2-3 tasks per plan)

**Todo File Accumulation:**
- Current capacity: Unknown upper limit
- Limit: Large number of todos could slow statusline
- Scaling path: Consider pagination or archiving completed todos

## Dependencies at Risk

**esbuild (dev dependency):**
- Risk: Low - well-maintained, used only for build
- Impact: Build process for hooks
- Migration plan: N/A - no immediate concern

**No Runtime Dependencies:**
- Note: `package.json` shows `"dependencies": {}`
- This is positive for stability but means all functionality is hand-rolled

## Missing Critical Features

**Test Suite:**
- Problem: No test files found (`*.test.*`, `*.spec.*`)
- Blocks: Confident refactoring, CI/CD quality gates
- Impact: Changes to critical paths (install.js, hooks) untested

**Input Validation:**
- Problem: Limited validation on user inputs
- Files: `bin/install.js:437-441` - hex color validation added, but other inputs may lack validation
- Impact: Invalid configurations could cause silent failures

**Error Reporting:**
- Problem: No structured error reporting or telemetry
- Impact: Debugging user issues requires manual investigation

## Test Coverage Gaps

**No Automated Tests:**
- What's not tested: Entire codebase
- Files: All JavaScript files (`bin/install.js`, `hooks/*.js`)
- Risk: Regressions undetected, refactoring risky
- Priority: High

**Critical Paths Untested:**
- Installer logic (`bin/install.js` - 1530 lines)
- Statusline hook (`hooks/gsd-statusline.js`)
- Update check hook (`hooks/gsd-check-update.js`)
- Frontmatter conversion functions
- Tool name mapping functions

**Recommended Test Priorities:**
1. `bin/install.js` - core installation logic
2. JSON config parsing workflows
3. Frontmatter parsing and conversion
4. Tool name mappings (Claude → OpenCode/Gemini)
5. Error handling in hooks

---

*Concerns audit: 2026-02-05*
