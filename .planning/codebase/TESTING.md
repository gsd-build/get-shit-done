# Testing Patterns

**Analysis Date:** 2026-02-05

## Test Framework

**Runner:**
- Not configured
- No test framework installed

**Assertion Library:**
- Not configured

**Run Commands:**
```bash
npm test                    # Not configured (no test script in package.json)
```

## Test File Organization

**Location:**
- No test files exist in the codebase
- No `*.test.js`, `*.spec.js`, or `__tests__/` directories found

**Naming:**
- Not established

**Structure:**
- Not applicable

## Current Test Status

**Test Files Found:** 0

**Test Configuration Files Found:** 0
- No `jest.config.js`
- No `vitest.config.js`
- No `mocha.rc`
- No test-related entries in `package.json`

## Why No Tests

This project is primarily a **meta-prompting system** consisting of:
- 196 markdown files (commands, workflows, templates, references, agents)
- 6 JavaScript files (installer, hooks, build script)

**Testing approach for markdown documentation:**
- Manual validation via Claude Code execution
- User feedback via GitHub issues
- No automated testing framework for prompt engineering

**JavaScript code testing status:**
- `bin/install.js` (1529 lines) - Untested, integration tested manually via `npx get-shit-done-cc`
- `hooks/gsd-statusline.js` (92 lines) - Untested, tested manually in Claude Code
- `hooks/gsd-check-update.js` (62 lines) - Untested, tested manually
- `scripts/build-hooks.js` (43 lines) - Untested, build script

## Recommended Testing Approach

**If tests are added, recommended framework:**
- Vitest (modern, fast, ESM-compatible)
- Or Jest (widely adopted, CommonJS-friendly)

**Priority areas for testing:**
1. `bin/install.js` - Path handling, frontmatter conversion, file copying
2. `hooks/gsd-statusline.js` - JSON parsing, output formatting
3. `hooks/gsd-check-update.js` - Version comparison, cache handling

**Suggested test structure:**
```
tests/
├── install.test.js
│   ├── copyWithPathReplacement
│   ├── convertClaudeToOpencodeFrontmatter
│   ├── convertClaudeToGeminiToml
│   └── processAttribution
├── hooks/
│   ├── statusline.test.js
│   └── check-update.test.js
└── fixtures/
    └── sample-commands/
```

## Mocking Considerations

**What would need mocking:**
- File system operations (`fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync`)
- Process environment (`process.env`, `process.cwd()`, `os.homedir()`)
- Child process (`spawn`, `execSync`)
- stdin/stdout for interactive prompts

**Mock patterns (if tests added):**
```javascript
import { vi } from 'vitest';
import * as fs from 'fs';

vi.mock('fs');

it('reads settings file', () => {
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readFileSync).mockReturnValue('{"key": "value"}');
  
  const result = readSettings('/path/to/settings.json');
  expect(result).toEqual({ key: 'value' });
});
```

## Coverage

**Requirements:**
- Not enforced
- Not tracked

**If implemented:**
- Target: 70%+ for JavaScript utilities
- Focus: Path handling, conversion logic, error cases

## Test Types (If Implemented)

**Unit Tests:**
- Test individual functions in `bin/install.js`
- Mock file system and environment

**Integration Tests:**
- Test full installation flow with temporary directories
- Verify file copying, path replacement, settings updates

**Manual Testing:**
- Current approach: run `npx get-shit-done-cc` in test directories
- Verify commands work in Claude Code, OpenCode, Gemini

## Verification Approach

**Current verification method (manual):**
1. Run `npx get-shit-done-cc` locally
2. Verify files copied to correct locations
3. Launch Claude Code and test `/gsd:help`
4. Test on Windows, macOS, Linux

**From CONTRIBUTING.md:**
```bash
# Test locally
npm link
npx get-shit-done-cc

# Run tests (not currently implemented)
npm test
```

---

*Testing analysis: 2026-02-05*
*Update when test infrastructure is added*
