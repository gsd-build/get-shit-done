# Codebase Concerns

**Analysis Date:** 2026-02-20

## Tech Debt

**Monolithic gsd-tools.cjs (5324 lines):**
- Issue: Single file contains all CLI functionality with no modular separation
- Files: `get-shit-done/bin/gsd-tools.cjs`
- Impact: Difficult to maintain, test individual functions, or navigate; high cognitive load
- Fix approach: Split into modules by concern (state/, verification/, roadmap/, etc.) with a main entry point

**Primitive YAML Parser:**
- Issue: Custom YAML frontmatter parser (`extractFrontmatter()`) is basic and may fail on edge cases
- Files: `get-shit-done/bin/gsd-tools.cjs` (lines 251-324)
- Impact: Complex nested YAML structures may not parse correctly; relies on regex patterns
- Fix approach: Consider using a proper YAML parser library (js-yaml) or document limitations

**Silent Failures in Array Operations:**
- Issue: Multiple `catch {}` blocks that silently swallow errors
- Files: `get-shit-done/bin/gsd-tools.cjs` (lines 553, 555, 750, 808, 1068, etc.)
- Impact: Debugging is difficult when operations fail silently; errors may propagate unexpectedly
- Fix approach: Add logging or return structured error information instead of empty catches

**Path Hardcoding in Markdown Files:**
- Issue: Many agent/command files contain hardcoded `~/.claude/` paths that require runtime replacement
- Files: All files in `agents/*.md`, `commands/gsd/*.md`
- Impact: Path replacement logic in `bin/install.js` is fragile; misses can cause runtime failures
- Fix approach: Use placeholder syntax that's explicitly defined (e.g., `{{GSD_PATH}}`) and validated

## Known Bugs

**No known critical bugs identified during analysis.**

Anti-pattern scans found template/documentation examples only (e.g., `// TODO` patterns in template files).

## Security Considerations

**Credential Exposure Risk in Hooks:**
- Risk: Hook scripts execute in user context and could potentially log sensitive data
- Files: `hooks/dist/*.js` (bundled hooks)
- Current mitigation: Hooks are bundled from source and only perform statusline/update-check operations
- Recommendations: Audit hook code paths to ensure no user secrets are logged; document that hooks run with user permissions

**Git Commit Automation:**
- Risk: `execGit()` function builds shell commands that could be vulnerable to injection
- Files: `get-shit-done/bin/gsd-tools.cjs` (lines 221-240)
- Current mitigation: Arguments are escaped via regex pattern check, single-quote wrapping
- Recommendations: Consider using `spawn` with array arguments instead of string interpolation

**Environment Variable Handling:**
- Risk: Brave API key read from environment could be exposed in error messages
- Files: `get-shit-done/bin/gsd-tools.cjs` (line 2114)
- Current mitigation: Key is only used in HTTP header, not logged
- Recommendations: Ensure error handling never logs the API key value

## Performance Bottlenecks

**Full File Manifest Generation on Every Install:**
- Problem: `generateManifest()` recursively hashes every file on install
- Files: `bin/install.js` (lines 1206-1260)
- Cause: SHA256 hash computed for every installed file to enable patch detection
- Improvement path: Cache manifest and only regenerate when version changes; use file modification times for quick checks

**Large JSON Output via gsd-tools:**
- Problem: Commands like `history-digest` can generate large JSON payloads exceeding 50KB
- Files: `get-shit-done/bin/gsd-tools.cjs` (lines 465-481)
- Cause: Full project history serialized as JSON
- Improvement path: Current mitigation writes to tmpfile for large payloads; consider streaming or pagination for very large projects

## Fragile Areas

**Frontmatter Parsing:**
- Files: `get-shit-done/bin/gsd-tools.cjs` (extractFrontmatter, reconstructFrontmatter, spliceFrontmatter)
- Why fragile: Custom YAML parsing doesn't handle all edge cases (multi-line strings, complex nesting, special characters)
- Safe modification: Add comprehensive test coverage before modifying; test with edge-case YAML structures
- Test coverage: Basic tests exist in `gsd-tools.test.cjs` but edge cases not thoroughly covered

**Runtime-Specific Frontmatter Conversion:**
- Files: `bin/install.js` (convertClaudeToOpencodeFrontmatter, convertClaudeToGeminiAgent)
- Why fragile: Three different runtimes (Claude, OpenCode, Gemini) require different frontmatter formats; conversion relies on regex patterns
- Safe modification: Test against all three runtimes after any change; maintain format parity tests
- Test coverage: No automated tests for format conversion

**State.md Field Updates:**
- Files: `get-shit-done/bin/gsd-tools.cjs` (stateReplaceField, stateExtractField)
- Why fragile: Relies on exact markdown formatting patterns (`**Field:**` format); user edits can break extraction
- Safe modification: Document expected STATE.md format; validate before update
- Test coverage: Minimal — state operations need more test coverage

## Scaling Limits

**Single-File Command Structure:**
- Current capacity: Works well for ~50 commands
- Limit: As command count grows, loading all command definitions may slow startup
- Scaling path: Lazy-load commands or split into multiple entry points by category

**History Digest Memory:**
- Current capacity: Works well for projects with <100 phases
- Limit: Large projects with many phases may hit memory limits when aggregating all SUMMARYs
- Scaling path: Stream processing or lazy loading of phase data

## Dependencies at Risk

**No External Runtime Dependencies:**
- The project has zero production dependencies (`"dependencies": {}` in package.json)
- This is intentional and reduces supply chain risk
- `esbuild` is a dev dependency used only for bundling hooks

**Node.js Version Requirement:**
- Risk: Minimum Node.js 16.7.0 requirement may exclude some users
- Impact: Users on older Node.js versions will fail at install
- Migration plan: Version is reasonable for modern projects; document requirement clearly

## Missing Critical Features

**No Validation of User-Edited Planning Files:**
- Problem: Users can edit STATE.md, ROADMAP.md, etc. in ways that break parsing
- Blocks: Robust error handling when planning files are malformed
- Recommendation: Add `validate health --repair` command to detect and fix common issues (exists but could be more comprehensive)

**No Rollback Mechanism:**
- Problem: If a phase execution fails partway through, there's no automated rollback
- Blocks: Recovery from failed executions without manual intervention
- Recommendation: Consider git-based checkpoints or atomic phase commits

## Test Coverage Gaps

**gsd-tools.cjs Command Coverage:**
- What's not tested: Most CLI commands (only `history-digest` has tests)
- Files: `get-shit-done/bin/gsd-tools.test.cjs` (200 lines for 5324-line file)
- Risk: Core workflow commands may have bugs that surface only in production use
- Priority: High — this is the central CLI utility

**Install Script Coverage:**
- What's not tested: `bin/install.js` (1816 lines, no tests)
- Files: `bin/install.js`
- Risk: Installation bugs are discovered by users after npm publish
- Priority: Medium — install is well-tested manually but lacks automation

**Agent/Command Markdown Validation:**
- What's not tested: No automated validation that agent files have correct frontmatter
- Files: All files in `agents/*.md`
- Risk: Malformed agent definitions may cause runtime failures
- Priority: Low — format is stable but validation would catch typos

**Cross-Runtime Parity:**
- What's not tested: No tests ensuring Claude, OpenCode, and Gemini versions behave identically
- Risk: Drift between runtimes causing inconsistent user experience
- Priority: Medium — as features diverge, parity testing becomes important

---

*Concerns audit: 2026-02-20*
