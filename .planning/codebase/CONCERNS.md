# Codebase Concerns

**Analysis Date:** 2026-02-05

## Tech Debt

### Fragile JSON Parsing in Workflows (HIGH IMPACT)

**Issue:** Multiple workflow files use fragile grep/sed patterns to extract JSON configuration values instead of proper JSON parsing.

**Files:**
- `get-shit-done/workflows/execute-phase.md:20, 62, 76-87`
- `commands/gsd/execute-phase.md:45, 100`
- `agents/gsd-executor.md:47`

**Current pattern (fails silently):**
```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
BRANCHING_STRATEGY=$(cat .planning/config.json 2>/dev/null | grep -o '"branching_strategy"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:.*"\([^"]*\)"/\1/' || echo "none")
```

**Problems:**
- Fails if JSON is minified (no spaces between key and colon)
- Fails if boolean values aren't quoted (`true` vs `"true"`)
- Fails on escaped quotes in values
- Falls back to defaults silently instead of erroring, masking configuration issues
- Different patterns used across files create inconsistency and maintenance burden

**Impact:** Configuration settings silently fall back to defaults even when explicitly configured, leading to unexpected behavior during planning and execution phases.

**Fix approach:**
- Replace all grep/sed patterns with `jq` for robust JSON parsing
- Example: `jq -r '.model_profile // "balanced"' .planning/config.json 2>/dev/null || echo "balanced"`
- Requires `jq` as a dependency or create a Node.js helper script for workflows to call

---

### Hardcoded Paths Scattered Across Codebase (MEDIUM IMPACT)

**Issue:** Directory paths like `~/.claude/`, `.planning/`, `~/.claude/todos` are hardcoded in multiple locations.

**Files:**
- `hooks/gsd-statusline.js:49` - hardcoded `~/.claude/todos`
- `hooks/gsd-check-update.js:12` - hardcoded `~/.claude/`
- `bin/install.js:99, 105, etc.` - multiple runtime-specific paths
- Multiple workflow files reference `.planning/`

**Impact:** Changes to directory structure would require updates in 10+ locations, increasing risk of inconsistency and bugs.

**Fix approach:** Centralize path constants in a shared configuration module that all tools import from.

---

### Inconsistent Error Handling Patterns (MEDIUM IMPACT)

**Issue:** Error handling is inconsistent across the codebase:
- Some functions have comprehensive try-catch blocks (e.g., `hooks/gsd-statusline.js:51-66`)
- Others rely on optional chaining or silent failures
- Some fail gracefully with messages, others fail silently

**Files:**
- `hooks/gsd-statusline.js` - comprehensive try-catch
- `hooks/gsd-check-update.js` - relies on existence checks
- `bin/install.js` - mixed patterns
- Various workflow files - silent fallbacks

**Impact:** Unpredictable error behavior makes debugging harder and obscures issues.

**Fix approach:** Establish consistent error handling patterns and document them:
- File system operations: always wrap in try-catch
- JSON parsing: validate before use
- Git operations: exit with error code on failure
- External commands: handle stderr separately

---

## Known Bugs

### Missing Error Handling in File System Operations (FIXED in latest)

**Status:** ✅ Fixed in FIXES_APPLIED.md

**Files:** `hooks/gsd-statusline.js:51-66`

**What was fixed:** Added try-catch wrapper around directory reading operations to prevent crashes from permission issues or race conditions.

---

### Hex Color Validation Missing (FIXED in latest)

**Status:** ✅ Fixed in FIXES_APPLIED.md

**Files:** `bin/install.js` (color processing section)

**What was fixed:** Added regex validation for hex color format (#RGB or #RRGGBB) before accepting colors.

---

### Git Staging Rules Violation (FIXED in latest)

**Status:** ✅ Fixed in FIXES_APPLIED.md

**Files:** `commands/gsd/execute-phase.md`

**What was fixed:** Replaced `git add -u` (violates stated rules) with individual file staging pattern.

---

## Security Considerations

### Process Spawning Without Input Validation (MEDIUM RISK)

**Issue:** Bash workflows accept user-provided values (phase names, branch names, etc.) and use them in command execution without sufficient validation.

**Files:**
- `get-shit-done/workflows/execute-phase.md:108-115` - phase name used in sed commands
- `commands/gsd/execute-phase.md:100-115` - branch template substitution

**Current approach:**
```bash
PHASE_SLUG=$(echo "$PHASE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
BRANCH_NAME=$(echo "$PHASE_BRANCH_TEMPLATE" | sed "s/{phase}/$PADDED_PHASE/g")
```

**Risk:** If phase name contains special characters or quotes, could cause sed injection or unexpected variable expansion.

**Mitigation:** Already mostly mitigated by restrictive slug transformation and quoting, but should be documented as a known constraint.

**Recommendation:** Document that phase names must be alphanumeric with hyphens/underscores, or add explicit validation.

---

### NPM Package Publishing Out of Sync (HIGH RISK)

**Issue:** Published npm package version 1.11.1 is stale and missing updates from GitHub main branch.

**Files:** Related to `bin/install.js` and distributed files

**Impact:** Users installing via `npx get-shit-done-cc` get outdated code with known bugs already fixed on main.

**Workaround:** Users must install from GitHub source for latest fixes.

**Recommendation:** Sync npm publish with main branch or document that npm package is no longer maintained.

---

## Performance Bottlenecks

### JSON Parsing with Multiple Grep/Sed Invocations (LOW-MEDIUM IMPACT)

**Issue:** Each config value extraction spawns a new grep/sed process. With multiple values extracted in sequence, this causes unnecessary overhead.

**Files:** `get-shit-done/workflows/execute-phase.md:20-87`

**Current approach:** Reads `.planning/config.json` multiple times with separate processes:
```bash
MODEL_PROFILE=$(cat .planning/config.json | grep ... | grep ... | tr ...)
COMMIT_PLANNING_DOCS=$(cat .planning/config.json | grep ... | grep ...)
PARALLELIZATION=$(cat .planning/config.json | grep ...)
# ... multiple more invocations
```

**Impact:** For workflows that execute frequently (e.g., during phase execution), cumulative overhead adds up.

**Improvement path:**
1. Parse JSON once with `jq` into variables
2. Cache result in memory for workflow lifetime
3. Example: `CONFIG=$(jq . .planning/config.json 2>/dev/null)` then `MODEL_PROFILE=$(echo "$CONFIG" | jq -r '.model_profile')`

---

## Fragile Areas

### Agent Spawning and Session State Management (HIGH FRAGILITY)

**Files:**
- `agents/gsd-executor.md` - executes plans in waves
- `get-shit-done/workflows/execute-phase.md` - manages parallel execution
- `.planning/STATE.md` - tracks project state across executions

**Why fragile:**
- Wave-based parallel execution depends on correct dependency analysis
- Agent spawn timing and result collection is complex
- Session state must be synchronized across multiple agents
- Issues reported: race conditions in parallel execution (#380), executor spawn failures (#315)

**Safe modification:**
1. Always test with small project first
2. Run serially before adding parallelization
3. Add extensive logging to STATE.md for debugging
4. Verify dependency graph is complete before executing waves
5. Test with projects that have circular or undefined dependencies

**Test coverage gaps:**
- No tests for parallel execution edge cases
- No tests for race conditions in wave synchronization
- No tests for state recovery if agent crashes mid-execution

---

### Configuration File Parsing Chain (FRAGILE)

**Files:**
- `hooks/gsd-statusline.js:50-79` - reads cache files
- `bin/install.js` - processes config during installation
- Multiple workflows - read .planning/config.json

**Why fragile:**
- Each tool reinvents JSON parsing logic
- No schema validation
- Silently ignores malformed JSON
- Cache invalidation logic unclear

**Safe modification:**
1. Always validate config files exist before reading
2. Test with invalid JSON to verify error handling
3. Check cache timestamps before using stale data
4. Document config.json schema

**Test coverage gaps:**
- No tests for malformed .planning/config.json
- No tests for stale cache files
- No tests for permission errors reading config files

---

### Bash Workflow Parsing (MEDIUM FRAGILITY)

**Files:**
- `get-shit-done/workflows/*.md` - define execution steps
- Parsed and executed by various orchestrators

**Why fragile:**
- Markdown embedded bash is untyped
- No schema validation of workflow structure
- Variable name collisions possible
- Escaping edge cases with special characters

**Safe modification:**
1. Test workflows with edge cases (paths with spaces, special chars in names)
2. Verify variable substitution in branching logic
3. Check sed patterns with all possible input values
4. Test on both Linux and macOS (bash versions differ)

**Test coverage gaps:**
- No automated tests for workflow parsing
- No tests for special characters in phase/milestone names
- No cross-platform compatibility tests

---

## Scaling Limits

### Parallel Agent Execution (BLOCKING ISSUE)

**Current capacity:** Parallel execution works in theory but has reported race conditions.

**Reported issues:**
- #380: "Hitting `Sibling tool call errored`" — parallel tool calls fail unpredictably
- #366: PR exists for race condition fixes
- #315: Executor agent spawn failure blocking all phase execution

**Limit:** Parallel execution becomes unreliable beyond ~5 concurrent agents.

**Scaling path:**
1. Fix race condition in agent spawn logic (see PR #366)
2. Implement explicit synchronization between waves (use STATE.md as lock file)
3. Add timeout handling for agents that hang
4. Test with projects having 10+ parallel plans per phase

---

### Large Project Planning Performance (ONBOARDING ISSUE)

**Current issue:** #228 "Taking HOURS to initiate new project and map codebase"

**Limit:** Projects with 10K+ files or deeply nested structures cause:
- Map-codebase phase takes hours
- Planner gets stuck thinking (issue #246)
- User never sees initial plan

**Scaling path:**
1. Implement incremental codebase mapping (sample instead of full scan)
2. Add progress reporting to map-codebase workflow
3. Cache mapping results to avoid re-scanning
4. Consider splitting large projects into subprojects

---

## Dependencies at Risk

### No Runtime Dependencies (POSITIVE FINDING)

**Status:** ✅ Project has zero runtime dependencies (only esbuild for build).

**Note:** This is good for security and stability, but means all functionality must be implemented in-house.

---

### esbuild as Single Build Tool (MEDIUM CONSIDERATION)

**Dependency:** `esbuild: ^0.24.0` in devDependencies

**Risk:** esbuild is young and may have breaking changes. The `^0.24.0` allows 0.25+.

**Current usage:** Compiles hook files from source to dist/

**Mitigation:** Already has dist/ committed, so broken builds just block new hook releases, not runtime functionality.

**Recommendation:** Consider pinning to exact version `0.24.0` if build stability is concern.

---

## Missing Critical Features

### Model Recognition for Non-Anthropic Providers (BLOCKING)

**Issue:** #403 "gsd-debugger fails to recognize openai/gpt-5.2-codex-xhigh"

**Problem:** Model lookup hardcoded for specific Anthropic models. Non-Anthropic models fail agent spawning.

**Files:** Agent spawn logic in workflows

**Impact:** Completely blocks users on non-Anthropic models.

**Blocks:** Using GSD with OpenAI, Gemini, or other providers.

---

### Health Check Command Missing (ENHANCEMENT)

**Issue:** #338 `/gsd:health` — Planning directory health check

**Problem:** No way to verify project state is correct before executing phase.

**Impact:** Silent failures when .planning/ directory is corrupted or partially initialized.

**Recommendation:** Add `health-check.md` workflow to verify:
- .planning/ directory exists
- config.json is valid JSON
- STATE.md can be parsed
- All required directories exist
- No circular dependencies in planning

---

## Test Coverage Gaps

### No Tests for Critical Paths (HIGH PRIORITY)

**Untested areas:**

1. **JSON config parsing** - workflows depend on this, but no tests verify it works with edge cases
   - Files: `get-shit-done/workflows/execute-phase.md`
   - Risk: Silent configuration failures in production
   - Priority: HIGH

2. **Statusline error handling** - crashes would break user terminal experience
   - Files: `hooks/gsd-statusline.js`
   - Risk: User's editor becomes unusable
   - Priority: HIGH

3. **Parallel execution synchronization** - race conditions reported (#380)
   - Files: `agents/gsd-executor.md`, `get-shit-done/workflows/execute-phase.md`
   - Risk: Unpredictable execution failures
   - Priority: HIGH

4. **Git operations** - stage/commit operations could lose work
   - Files: Multiple workflow files
   - Risk: Data loss
   - Priority: CRITICAL

5. **Codebase mapping for large projects** - timeouts and performance issues (#228)
   - Files: `agents/gsd-codebase-mapper.md`
   - Risk: Users give up on onboarding
   - Priority: HIGH

---

### Agent Interaction Testing (MEDIUM PRIORITY)

**Untested:**
- Multi-agent execution with dependencies
- Subagent resume across sessions
- Context propagation between agents

**Files:**
- `agents/gsd-executor.md`
- `agents/gsd-planner.md`
- `agents/gsd-verifier.md`

**Risk:** Complex orchestration issues only appear in production use.

---

## Process Quality Concerns

### Console.log Statements in Production Code (CODE QUALITY)

**Issue:** Multiple files have console.log calls that should be using structured logging.

**Files:** `bin/install.js:51`, `scripts/build-hooks.js:4`, `agents/gsd-debugger.md:11`

**Impact:** Low - mostly informational. But inconsistent with professional logging standards.

**Recommendation:** Use consistent logging approach (could be simple if just for CLI output).

---

### Version Sync Issue Between Code and npm (PROCESS ISSUE)

**Issue:** Version in `package.json` (1.11.1) doesn't match GitHub latest code.

**Files:** `package.json:3` vs actual distributed files

**Impact:** Users getting stale code from npm, forcing them to use GitHub source for fixes.

**Recommendation:**
1. Either sync npm publish to main automatically via GitHub Actions, OR
2. Document that npm package is no longer maintained and direct users to GitHub install

---

## Architectural Concerns

### Tight Coupling Between Workflows and Config Parsing (MEDIUM CONCERN)

**Issue:** Multiple workflow files independently implement config reading logic.

**Files:**
- `get-shit-done/workflows/execute-phase.md`
- `commands/gsd/execute-phase.md`
- `agents/gsd-executor.md`
- Other workflow files

**Problem:** Changes to config.json schema require updates in multiple places.

**Fix approach:** Create a shared config parsing utility that all workflows call:
1. Single source of truth for config handling
2. Consistent error messages
3. Easier to test
4. Better caching potential

---

### Markdown-Based Workflow Execution (ARCHITECTURAL RISK)

**Issue:** Critical workflow logic is embedded in markdown files that are parsed at runtime.

**Files:** All files in `get-shit-done/workflows/`, `commands/gsd/`, `agents/`

**Concern:**
- No schema validation
- Bash code embedded in markdown is untyped
- Version compatibility unclear
- Testing difficult
- IDE support nonexistent

**Mitigation:** This is the intended design (self-describing workflows), but adds maintenance burden.

**Recommendation:** Document markdown schema and create validation tools to catch syntax errors before execution.

---

## Summary

**Critical issues blocking users:**
1. JSON config parsing failures (silent, hard to debug)
2. Parallel execution race conditions (#380, #366)
3. Agent spawn failures (#315)
4. Model recognition for non-Anthropic providers (#403)
5. npm package out of sync with main branch (#412)

**High-impact tech debt:**
1. Fragile JSON parsing throughout workflows
2. Hardcoded paths scattered across codebase
3. Inconsistent error handling patterns
4. No automated tests for critical paths

**Fragile areas requiring careful modification:**
1. Agent spawning and parallel execution orchestration
2. Configuration file parsing
3. Bash workflow parsing with special characters
4. State synchronization across agent boundaries

**Priority recommendations:**
1. Replace all grep/sed JSON parsing with `jq`
2. Add comprehensive tests for JSON parsing and parallel execution
3. Centralize path constants and config parsing
4. Fix race conditions in parallel execution (merge PR #366)
5. Sync npm package version or document that it's no longer maintained

---

*Concerns audit: 2026-02-05*
