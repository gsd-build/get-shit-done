# Testing Patterns

**Analysis Date:** 2026-01-31

## Current State

**No Testing Framework Configured**

This codebase has:
- No test framework (Jest, Vitest, Mocha, etc.)
- No test files (.test.js, .spec.js)
- No test configuration
- No test scripts in package.json
- No assertions library
- No coverage tooling

The project is a CLI installer and command system with no automated test suite.

## Development Scripts

**Available Commands (from `package.json`):**
```bash
pnpm install                # Install dependencies
pnpm dev:local             # Local development: install + link globally + run installer
pnpm build:hooks           # Build hooks (copy JS to hooks/dist/)
pnpm publish               # Publish to npm (auto-runs build:hooks)
```

**No Test Commands**
- No `test` script
- No `test:watch` script
- No `coverage` script

## Manual Testing Approach

Based on codebase structure, testing is currently manual:

**Installation Testing:**
- Local install: `pnpm dev:local` (installs to `./.claude/` in project directory)
- Tests installer logic for Claude Code, OpenCode, Gemini CLI
- Verifies frontmatter conversion between runtimes
- Validates file copying and path replacement

**Verification Functions:**
The code includes built-in verification:
```javascript
// From bin/install.js
function verifyInstalled(dirPath, description) {
  if (!fs.existsSync(dirPath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory not created`);
    return false;
  }
  if (fs.readdirSync(dirPath).length === 0) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory is empty`);
    return false;
  }
  return true;
}

function verifyFileInstalled(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: file not created`);
    return false;
  }
  return true;
}
```

These verify installation success but are not test cases — they're runtime checks.

## Areas Without Test Coverage

**Critical Logic (No Tests):**

1. **Frontmatter Conversion Functions:**
   - `convertToolName()` — Tool name mapping logic
   - `convertClaudeToOpencodeFrontmatter()` — Multi-line YAML parsing
   - `convertClaudeToGeminiAgent()` — Complex YAML-to-TOML conversion
   - `convertClaudeToGeminiToml()` — Markdown to TOML conversion

2. **Path Handling:**
   - `expandTilde()` — Home directory expansion
   - `getGlobalDir()` — Runtime-specific directory selection
   - `getOpencodeGlobalDir()` — XDG Base Directory compliance

3. **File Operations:**
   - `copyFlattenedCommands()` — Recursive directory copying with path replacement
   - `copyWithPathReplacement()` — Path substitution in copied files
   - `cleanupOrphanedFiles()` — Orphaned file detection and removal

4. **Hook Management:**
   - `gsd-statusline.js` — Context window calculation, status bar rendering
   - `gsd-check-update.js` — Version checking, background process management

5. **Configuration:**
   - `readSettings()` / `writeSettings()` — JSON I/O
   - OpenCode permissions configuration
   - Settings hook registration

## Recommended Testing Strategy

### Phase 1: Unit Tests (If Implementing)

**Test Framework:** Vitest or Jest (both support CommonJS)

**Conversion Functions:**
```javascript
describe('convertToolName', () => {
  test('maps AskUserQuestion to question', () => {
    expect(convertToolName('AskUserQuestion')).toBe('question');
  });

  test('lowercases standard tools', () => {
    expect(convertToolName('Read')).toBe('read');
  });

  test('preserves MCP tools', () => {
    expect(convertToolName('mcp__anthropic_web_search')).toBe('mcp__anthropic_web_search');
  });
});

describe('convertClaudeToOpencodeFrontmatter', () => {
  test('converts allowed-tools to tools object', () => {
    const input = `---\nname: test\nallowed-tools:\n  - Read\n  - Write\n---\nBody`;
    const result = convertClaudeToOpencodeFrontmatter(input);
    expect(result).toContain('tools:');
    expect(result).toContain('read: true');
  });
});
```

**Path Handling:**
```javascript
describe('expandTilde', () => {
  test('expands ~ to home directory', () => {
    const result = expandTilde('~/.claude');
    expect(result).toBe(path.join(os.homedir(), '.claude'));
  });

  test('leaves non-tilde paths unchanged', () => {
    const result = expandTilde('/absolute/path');
    expect(result).toBe('/absolute/path');
  });
});
```

### Phase 2: Integration Tests

**Installation Tests:**
```javascript
describe('Installation', () => {
  test('installs commands to Claude Code', async () => {
    // Create temp directory
    // Run install process
    // Verify files copied
    // Verify settings.json updated
  });

  test('converts frontmatter for OpenCode', async () => {
    // Copy files with OpenCode runtime
    // Verify YAML converted to tools object
    // Verify paths converted from ~/.claude to ~/.config/opencode
  });

  test('uninstalls completely', async () => {
    // Install
    // Run uninstall
    // Verify all files removed
    // Verify settings cleaned up
  });
});
```

### Phase 3: Snapshot Tests

**Frontmatter Conversion:**
```javascript
describe('Frontmatter conversion snapshots', () => {
  test('converts sample command for OpenCode', () => {
    const input = fs.readFileSync('commands/gsd/help.md', 'utf8');
    const output = convertClaudeToOpencodeFrontmatter(input);
    expect(output).toMatchSnapshot();
  });
});
```

## Design for Testability

**Current Code Quality:**
- Functions are small and focused (good for testing)
- Few external dependencies (only Node built-ins)
- File operations are concentrated (easier to mock)
- No global state

**Improvements for Testing:**
1. Export functions from modules for testing
   ```javascript
   module.exports = {
     expandTilde,
     convertToolName,
     getGlobalDir,
     // ...
   };
   ```

2. Separate pure logic from I/O
   ```javascript
   // Pure: testable
   function convertFrontmatter(content) { ... }

   // I/O: can be mocked
   function installCommand(srcPath, destPath) {
     const content = fs.readFileSync(srcPath, 'utf8');
     const converted = convertFrontmatter(content);
     fs.writeFileSync(destPath, converted);
   }
   ```

3. Use dependency injection for file operations
   ```javascript
   function copyFiles(srcDir, destDir, fs = require('fs')) {
     // fs can be mocked in tests
   }
   ```

## Build Script Testing

**Current Build Process:**
`scripts/build-hooks.js` is simple and verifiable:
1. Checks if source files exist
2. Copies to `hooks/dist/`
3. Outputs status

**Manual Verification:**
```bash
pnpm build:hooks
# Check that hooks/dist/gsd-statusline.js exists and matches hooks/gsd-statusline.js
ls -la hooks/dist/
```

## Package Script Testing

**Installation Testing Manual Steps:**
```bash
# Test local install
node bin/install.js --claude --local

# Verify installation
ls ~/.claude-test/commands/gsd/
ls ~/.claude-test/get-shit-done/

# Test OpenCode conversion
node bin/install.js --opencode --local

# Verify OpenCode structure (different from Claude)
cat ~/.config/opencode-test/skills/gsd.json

# Test uninstall
node bin/install.js --claude --local --uninstall
ls ~/.claude-test/  # Should be mostly gone
```

## Test Data Files

**If Tests Were Implemented, Would Need:**

1. Sample markdown files with various frontmatter formats
2. Sample settings.json files (empty, populated, malformed)
3. Sample hook configurations
4. Environment variable fixtures
5. Path fixtures for different runtimes

**Location (Proposed):**
```
tests/
├── fixtures/
│   ├── commands/
│   │   ├── minimal.md          # Only frontmatter
│   │   ├── full.md             # Complete command
│   │   └── malformed.md        # Edge cases
│   ├── settings/
│   │   ├── empty.json
│   │   ├── with-gsd.json
│   │   └── malformed.json
│   └── environments/
│       ├── claude.env
│       ├── opencode.env
│       └── gemini.env
├── unit/
│   ├── convert.test.js
│   ├── paths.test.js
│   └── io.test.js
├── integration/
│   └── install.test.js
└── helpers.js                  # Shared test utilities
```

## Coverage Targets (If Implemented)

**If Tests Were Added, Priority Order:**

1. **Critical (>95% coverage):**
   - `convertToolName()` — Tool mapping is core
   - `expandTilde()` — Path handling affects all runtimes
   - `readSettings()` / `writeSettings()` — Configuration I/O

2. **High (>85% coverage):**
   - Frontmatter conversion functions
   - Installation verification
   - Cleanup logic

3. **Medium (>70% coverage):**
   - UI/output formatting (less critical)
   - Optional flags and arguments
   - Edge case handling

4. **Low Priority:**
   - Color code validation (decorative)
   - Help text display (documented in README)

---

*Testing analysis: 2026-01-31*
