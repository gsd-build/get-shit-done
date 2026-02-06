# Codebase Concerns

**Analysis Date:** 2026-02-06

## Critical Issues - Fixed

### 1. ✅ API Key Exposure Prevention (RESOLVED in v1.11.2)

**Issue:** `/gsd:map-codebase` command could accidentally commit API keys to `.planning/codebase/` documents through code exploration
**Files:** `agents/gsd-codebase-mapper.md` (now includes forbidden_files section)
**Impact:** Security risk - credentials would be committed to git
**Fix Applied:** Added explicit list of file patterns to never read (`.env*`, `*.key`, `id_rsa*`, `credentials.*`, etc.)
**Status:** ✅ Fixed in commit f53011c

---

## High Priority Issues - Remaining

### 1. Fragile JSON Configuration Parsing

**Issue:** Multiple workflows use grep/sed patterns instead of proper JSON parsing
**Files:**
- `get-shit-done/workflows/execute-phase.md` (lines 20, 62, 76-77)
- `commands/gsd/execute-phase.md` (lines 45, 100)
- `agents/gsd-executor.md` (line 47)

**Current problematic pattern:**
```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Failures:**
- Fails if JSON is minified (no spaces)
- Fails if values aren't quoted (e.g., `true` vs `"true"`)
- Fails if there are escaped quotes in values
- Fails if spacing differs from expected pattern

**Impact:** Configuration settings silently fall back to defaults even when explicitly configured, leading to unexpected workflow behavior

**Recommended Fix:**
```bash
# Use jq for robust JSON parsing
MODEL_PROFILE=$(jq -r '.model_profile // "balanced"' .planning/config.json 2>/dev/null || echo "balanced")
BRANCHING_STRATEGY=$(jq -r '.branching_strategy // "none"' .planning/config.json 2>/dev/null || echo "none")
```

**Dependency Note:** Requires either:
- Adding `jq` as a system requirement dependency (already widely available)
- Creating a Node.js helper script for JSON parsing
- Documenting strict JSON formatting requirements for users

---

### 2. Inconsistent Error Handling Patterns

**Issue:** Error handling is inconsistent across the codebase
**Files:** Throughout `bin/install.js`, `hooks/gsd-statusline.js`, `hooks/gsd-check-update.js`

**Patterns observed:**
- `gsd-statusline.js` (lines 51-66): Try-catch wraps only JSON.parse, not filesystem operations
- `install.js`: Mix of existence checks and error handling
- Some operations fail silently, others propagate errors

**Example from `gsd-statusline.js`:**
```javascript
if (session && fs.existsSync(todosDir)) {
  try {  // ✅ Fixed in v1.11.2 - now wraps directory operations
    const files = fs.readdirSync(todosDir)
      .filter(...)
      .map(f => ({ name: f, mtime: fs.statSync(...).mtime }))
    // ... rest of logic
  } catch (e) {
    // Silently fail on file system errors
  }
}
```

**Impact:** Race conditions and permission issues can cause crashes; inconsistency makes debugging harder

**Recommendation:** Establish and document consistent error handling patterns:
- File system operations: Always wrap in try-catch
- JSON parsing: Use safe parsing with defaults
- External commands: Always capture and handle errors
- Silent failures: Document why they're silent

---

## Medium Priority Issues - Remaining

### 3. TypeScript Type Safety

**Issue:** Excessive use of `unknown` type without proper narrowing
**Files:**
- `gsd-memory/src/index.ts` (line 210)
- `gsd-memory/src/extractors/summary.ts` (multiple lines)
- `gsd-memory/src/extractors/frontmatter.ts` (line export)

**Example:**
```typescript
// gsd-memory/src/index.ts:210
let result: unknown;

// Later used in JSON.stringify without type narrowing
JSON.stringify(result, null, 2)

// gsd-memory/src/extractors/summary.ts
function extractKeyFiles(keyFiles: unknown): KeyFiles {
  const kf = keyFiles as Record<string, unknown>;
  // ... dangerous type casting
}
```

**Impact:** Type safety is reduced; potential runtime errors with incorrect data shapes; difficult to track data flow

**Recommendation:**
- Define specific interfaces for all data structures
- Use proper type guards instead of `as` casting
- Add runtime validation for parsed frontmatter data

---

### 4. Complex Installation Script

**File:** `bin/install.js` (1,664 lines)
**Issue:** Very large, monolithic file handling multiple installation strategies

**Complexity breakdown:**
- Claude Code installation (lines ~200-800)
- OpenCode installation (lines ~800-1200)
- Gemini installation (lines ~1200-1400)
- Configuration management (scattered)
- Color palette installation (lines ~400-450)

**Impact:** Difficult to maintain, hard to test individual features, risk of regressions

**Recommendation:** Consider refactoring into modules:
- `lib/installers/claude.js`
- `lib/installers/opencode.js`
- `lib/installers/gemini.js`
- `lib/config.js`
- `lib/colors.js`

---

### 5. Hardcoded Paths in Multiple Locations

**Files:**
- `hooks/gsd-statusline.js` (line 49): `~/.claude/todos`
- `hooks/gsd-check-update.js` (line 12): `~/.claude/`
- `bin/install.js` (multiple lines): Various `.claude/`, `.opencode/`, `.gemini/` paths
- Workflow files: Many references to `.planning/`

**Example:**
```javascript
const todosDir = path.join(homeDir, '.claude', 'todos');
```

**Impact:**
- Changes to directory structure require updates in many files
- Increases coupling between components
- Makes it harder to support custom config directories

**Recommendation:**
- Create a `lib/paths.js` module exporting all path constants
- Use environment variables for overrides (`CLAUDE_CONFIG_DIR`, `GSD_PLANNING_DIR`)
- Document the path layout clearly

---

## Low Priority Issues

### 6. Git Staging Rules Violations (MIXED STATUS)

**Status:** Partially fixed in v1.11.2

**Fixed:**
- ✅ `commands/gsd/execute-phase.md` - now uses individual file staging

**Remaining violations:**
- `agents/gsd-research-synthesizer.md`: Uses `git add .planning/research/` (directory staging allowed if intentional)
- `agents/gsd-debugger.md`: Uses `git add -A` (violates stated rules)
- `MAINTAINERS.md` (line in example): Shows `git add .` as example

**GSD-STYLE.md rule:** "Stage files individually (never `git add .`)"

**Recommendation:**
- Audit all markdown files for `git add -A`, `git add .`, `git add -u` patterns
- Document when directory-level staging is intentional vs problematic
- Update examples in documentation

---

### 7. Silent Failures in Configuration

**Files:**
- Multiple workflow files with `2>/dev/null` suppressing actual errors
- `gsd-statusline.js` (lines 78): Silently fails on cache read errors

**Example:**
```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep ... || echo "balanced")
# If file is missing, malformed, or unreadable, we get no feedback
```

**Impact:**
- Hard to debug why configuration isn't working
- Users won't know if their config is invalid
- Masks real errors (permissions, file corruption)

**Recommendation:**
- Log configuration parsing errors to stderr when in debug mode
- Provide clear feedback when config falls back to defaults
- Add config validation command to verify `.planning/config.json` structure

---

### 8. Incomplete Documentation of Edge Cases

**Issue:** Several documented edge cases lack complete implementation details

**Examples:**
- QMD fallback to grep search (`gsd-memory/src/qmd.ts`): Works but performance characteristics not documented
- Environment variable precedence in `bin/install.js` (lines 53-106): Complex precedence rules need clearer documentation

**Recommendation:**
- Document QMD performance expectations and fallback behavior
- Add diagrams showing environment variable precedence
- Document all supported directory structures

---

## Security Considerations

### Path Traversal Risk

**Issue:** Some path handling could be vulnerable if user input isn't sanitized
**Files:** `bin/install.js` (path handling with user inputs)
**Current Mitigation:** Uses `path.join()` and `path.normalize()` which prevent basic traversal
**Recommendation:** Audit custom path operations with special characters or symlinks

### Environment Variables

**Issue:** Multiple environment variables used for configuration
**Files:** `bin/install.js` (lines 55-105), various workflow files
**Current Mitigation:** Uses `expandTilde()` and proper path libraries
**Recommendation:** Continue using libraries for path handling; avoid raw string manipulation

---

## Test Coverage Gaps

### 1. Critical Functionality Under-tested

**File:** `gsd-memory/tests/`
**What's tested:** MCP server integration, extractors, search tools
**What's NOT tested:**
- QMD availability detection failure scenarios
- Grep fallback search with edge cases
- Concurrent file access patterns
- Large file handling (1000+ documents)

**Impact:** Potential failures in production not caught by tests

**Recommendation:**
- Add tests for QMD fallback scenarios
- Test with large datasets (1000+ documents)
- Add concurrency tests for file access
- Test with malformed/incomplete markdown files

### 2. Bash Workflow Testing

**Files:** All `.md` workflow files in `get-shit-done/workflows/`, `commands/gsd/`
**Issue:** Bash code embedded in markdown is not systematically tested
**Impact:** Regressions in git operations, file handling, JSON parsing can go undetected

**Recommendation:**
- Extract shell commands to testable scripts
- Create integration tests for critical workflows
- Test config parsing with various JSON formats

---

## Dependency Risks

### 1. Unmaintained or Pinned Versions

**File:** `gsd-memory/package.json`
- `@modelcontextprotocol/sdk: ^1.0.0` - Young dependency, monitor for API changes
- `gray-matter: ^4.0.3` - Last updated 2023, but stable
- `yaml: ^2.3.0` - Active maintenance

**Recommendation:**
- Keep `@modelcontextprotocol/sdk` updated as protocol evolves
- Monitor TypeScript for breaking changes (currently `^5.3.0`)

### 2. Optional Dependency: QMD

**Issue:** QMD availability is optional; graceful degradation to grep means users may not realize they're not getting semantic search
**Files:** `gsd-memory/src/qmd.ts`

**Recommendation:**
- Log when falling back to grep so users know
- Document QMD as optional but recommended for better search
- Consider providing pre-built binaries for QMD

---

## Performance Bottlenecks

### 1. Grep-based Search Scalability

**File:** `gsd-memory/src/qmd.ts` (lines 94-150)
**Issue:** When QMD unavailable, uses grep which is O(n) for all files
**Impact:** Slow search on large projects (100+ planning documents)

**Recommendation:**
- Provide caching mechanism for grep results
- Implement incremental indexing for grep fallback
- Document performance expectations

### 2. Repeated File System Operations

**File:** `gsd-statusline.js` (line 52-54)
**Issue:** Calls `fs.readdirSync()` and `fs.statSync()` on each statusline render
**Impact:** Repeated system calls on every prompt render
**Current Status:** ✅ Wrapped in try-catch but not optimized

**Recommendation:**
- Cache todo file list with expiration (e.g., 5 seconds)
- Use `fs.watch()` to invalidate cache on changes

---

## Fragile Areas Requiring Careful Changes

### 1. Environment Variable Resolution Chain

**File:** `bin/install.js` (lines 53-106, 78-106)
**Complexity:** Four levels of precedence for each runtime
**Example (OpenCode):**
1. OPENCODE_CONFIG_DIR env var
2. OPENCODE_CONFIG env var (use its directory)
3. XDG_CONFIG_HOME env var
4. Default ~/.config/opencode

**Safe Modification:**
- Change only one precedence level at a time
- Add tests for each combination
- Document why each level exists
- Consider creating a test matrix covering all 24 combinations

### 2. Git Staging Logic in Workflows

**Files:** Any `.md` file with `git add ...` commands
**Fragility:** Multiple places, inconsistent patterns, rules documented in GSD-STYLE.md

**Safe Modification:**
- Update all instances simultaneously using search-and-replace
- Verify against GSD-STYLE.md rules
- Test end-to-end workflow execution

### 3. JSON Configuration Parsing

**Files:** Multiple workflow files
**Fragility:** Grep/sed patterns are brittle and interdependent

**Safe Modification:**
- Create centralized parsing function first
- Migrate one workflow at a time
- Add validation tests for each pattern

---

## Known Limitations

### 1. QMD Optional Dependency

**Limitation:** gsd-memory works without QMD but with degraded search quality
**Workaround:** Users must manually install QMD for semantic search
**Status:** Documented but users may not be aware

### 2. Grep Fallback Performance

**Limitation:** Grep search is linear and can be slow on large document collections (100+)
**Workaround:** Install QMD or limit search scope with project/domain filters
**Status:** Not documented in user-facing docs

### 3. JSON Config Format Strict Requirements

**Limitation:** Due to grep/sed parsing, JSON must be well-formatted
**Workaround:** Keep .planning/config.json clean; avoid special characters in values
**Status:** Not documented anywhere

---

## Recommendations by Priority

### Immediate (Before Next Release)
1. Document JSON configuration format requirements clearly
2. Add debug mode output for configuration parsing fallbacks
3. Create integration tests for core workflow execution

### Short Term (This Quarter)
1. Replace grep/sed JSON parsing with jq throughout workflows
2. Add QMD fallback warnings to statusline when grep is being used
3. Refactor install.js into smaller modules
4. Centralize path constants

### Medium Term (This Year)
1. Add comprehensive test suite for all workflow bash code
2. Implement caching for statusline todos
3. Add config validation command
4. Performance optimization for grep-based search
5. Better documentation of edge cases and environment variable precedence

### Long Term (Future)
1. Consider TypeScript/Node.js rewrite of critical bash workflows
2. Semantic versioning for MCP protocol changes
3. Official QMD distribution with GSD

---

*Concerns audit: 2026-02-06*
