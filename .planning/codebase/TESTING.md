# Testing Patterns

**Analysis Date:** 2026-01-24

## Test Framework

**Status:**
- No automated test framework configured
- No test files found in codebase (`npm test` not implemented)
- Testing is manual/verification-based

**Configuration:**
- No jest.config.js, vitest.config.js, or similar
- No test runner in package.json scripts
- No test dependencies in devDependencies

## Run Commands

**Not applicable** — no automated test suite.

Manual verification approach:
```bash
# Test installation locally
npm link
npx get-shit-done-cc --help
npx get-shit-done-cc --claude --global [--dry-run if existed]

# Test with specific flags
npx get-shit-done-cc --both --local
npx get-shit-done-cc --opencode --global --uninstall
```

## Test File Organization

**Not applicable** — No test files in repository.

Current structure for reference:
```
.
├── bin/install.js           (main installation script)
├── hooks/gsd-*.js           (hook executables)
├── scripts/build-hooks.js   (build script)
└── [no test/ or __tests__/]
```

## Verification Approach

**Manual Integration Testing:**

Instead of automated tests, verification happens through:

1. **Installation verification** (from `install.js`):
   - `verifyInstalled(dirPath, description)` — checks directory exists and contains files
   - `verifyFileInstalled(filePath, description)` — checks file exists
   - Returns boolean, logs errors to console

   ```javascript
   function verifyInstalled(dirPath, description) {
     if (!fs.existsSync(dirPath)) {
       console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory not created`);
       return false;
     }
     try {
       const entries = fs.readdirSync(dirPath);
       if (entries.length === 0) {
         console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory is empty`);
         return false;
       }
     } catch (e) {
       console.error(`  ${yellow}✗${reset} Failed to install ${description}: ${e.message}`);
       return false;
     }
     return true;
   }
   ```

2. **Error Handling in install flow**:
   - Tracks failures array
   - Aborts if critical components fail
   - Clear error messages with recovery suggestions

   ```javascript
   if (failures.length > 0) {
     console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
     console.error(`  Try running directly: node ~/.npm/_npx/*/node_modules/get-shit-done-cc/bin/install.js --global\n`);
     process.exit(1);
   }
   ```

3. **Feature-specific validation**:
   - Settings.json parsing with graceful fallback
   - File content transformation validation
   - Path existence checks before operations

## Mocking

**Not applicable** — No test framework means no mocking framework.

**Pattern for mocking in manual testing:**
- Environment variables: Set before running script
  - `CLAUDE_CONFIG_DIR=/tmp/test-claude npx get-shit-done-cc`
  - `OPENCODE_CONFIG_DIR=/tmp/test-opencode npx get-shit-done-cc --opencode`
- Filesystem state: Create test directories with required structure before running

## Edge Cases Handled

**CLI Argument Parsing:**
- Validates flag combinations (e.g., cannot use `--global` and `--local` together)
- Supports both `--flag value` and `--flag=value` formats
- Handles missing arguments gracefully
- Example from `parseConfigDirArg()`:
  ```javascript
  if (!nextArg || nextArg.startsWith('-')) {
    console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
    process.exit(1);
  }
  ```

**Filesystem Operations:**
- Checks existence before reading: `fs.existsSync()` guard
- Creates parent directories recursively: `fs.mkdirSync(dir, { recursive: true })`
- Handles missing files gracefully (fallback to empty object for JSON reads)
- Example from `readSettings()`:
  ```javascript
  function readSettings(settingsPath) {
    if (fs.existsSync(settingsPath)) {
      try {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (e) {
        return {};
      }
    }
    return {};
  }
  ```

**Cross-Platform Compatibility:**
- Path handling using `path` module (not string concatenation)
- Home directory expansion: `os.homedir()` not `$HOME`
- Explicit forward slash conversion for commands: `path.replace(/\\/g, '/')`
- Handles stdin TTY detection for non-interactive environments:
  ```javascript
  if (!process.stdin.isTTY) {
    console.log(`  ${yellow}Non-interactive terminal detected, defaulting to global install${reset}\n`);
    installAllRuntimes(runtimes, true, false);
    return;
  }
  ```

**Interactive Input:**
- Tracks answer state to prevent double-execution on Ctrl+C
- Default values for all prompts
- Graceful cancellation handling:
  ```javascript
  let answered = false;
  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
      process.exit(0);
    }
  });
  ```

## Manual Testing Checklist

For new changes, verify:

1. **Installation**:
   - [ ] `npx get-shit-done-cc --global --claude` (global install)
   - [ ] `npx get-shit-done-cc --local --claude` (local install)
   - [ ] `npx get-shit-done-cc --global --both` (both runtimes)
   - [ ] All directories created correctly
   - [ ] All files present in destination

2. **Uninstallation**:
   - [ ] `npx get-shit-done-cc --global --claude --uninstall`
   - [ ] GSD files removed, user files preserved
   - [ ] Settings.json cleaned up

3. **Path Handling**:
   - [ ] Custom config dir: `npx get-shit-done-cc --global --config-dir ~/custom/.claude`
   - [ ] Tilde expansion works correctly
   - [ ] Windows UNC paths (if on Windows)

4. **Interactive Prompts**:
   - [ ] Runtime selection works
   - [ ] Location selection works
   - [ ] Ctrl+C cancellation works
   - [ ] Default selections (Enter key)

5. **File Transformation** (for OpenCode):
   - [ ] Frontmatter converted correctly
   - [ ] Path references updated
   - [ ] Tool names mapped
   - [ ] Content preserved

## Critical Functions with Built-in Verification

**`install(isGlobal, runtime)`** (`.planning/codebase/bin/install.js:834-1029`):
- Verifies each installation step
- Tracks failures array
- Validates directory creation and file presence
- Returns result object with metadata
- Exits with error if critical components fail

**`copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime)`** (`.planning/codebase/bin/install.js:439-471`):
- Validates source directory exists
- Creates destination with cleanup (removes old files first)
- Reads, transforms, and writes each file
- Preserves directory structure

**`convertClaudeToOpencodeFrontmatter(content)`** (`.planning/codebase/bin/install.js:274-372`):
- Validates YAML frontmatter parsing
- Handles missing frontmatter gracefully
- Converts array format to object format
- Preserves content outside frontmatter

## Test Coverage Gaps

**Uncovered areas** (would benefit from automated testing):

1. **Windows-specific path handling** — Tested manually only
   - UNC paths (\\\\server\\share)
   - Backslash path normalization
   - Drive letter handling

2. **OpenCode frontmatter conversion** — Complex transformation, no regression tests
   - Tool name mappings (AskUserQuestion → question, etc.)
   - Color name to hex conversion
   - Array to object conversion
   - Cross-reference path updates

3. **Settings.json mutation** — Modifies user config, high risk
   - Hook registration/cleanup
   - Statusline configuration
   - Orphaned hook removal

4. **Parallel installation** — Multiple runtimes installed simultaneously
   - Race conditions in file operations
   - Settings.json write conflicts

5. **Interactive flows** — Cannot test with automation
   - Prompt responses
   - Ctrl+C handling
   - TTY detection

**Recommendation:** Add test suite with Node.js built-in test runner or vitest. Start with `install()` and `copyWithPathReplacement()` as highest-value targets.

---

*Testing analysis: 2026-01-24*
