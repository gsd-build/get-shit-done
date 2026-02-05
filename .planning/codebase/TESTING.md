# Testing Patterns

**Analysis Date:** 2026-02-05

## Test Framework

**Runner:**
- Not detected. No test framework is configured or in use.

**Assertion Library:**
- Not applicable. No automated testing infrastructure present.

**Run Commands:**
- `npm test` — Not configured in package.json
- No test scripts defined in package.json

## Test File Organization

**Status:** Not detected

This codebase does not include automated tests. The project is an installation/configuration utility where:
- Core behavior is file I/O and process spawning
- Integration testing is manual (install to development environment)
- Validation is done through installation verification functions

## Testing Strategy

### Manual Verification Pattern

The codebase includes built-in verification functions instead of unit tests:

**Verification Functions:**

`verifyInstalled(dirPath, description)` in `bin/install.js`:
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

`verifyFileInstalled(filePath, description)` in `bin/install.js`:
```javascript
function verifyFileInstalled(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: file not created`);
    return false;
  }
  return true;
}
```

**Usage Pattern:**
These verification functions are called immediately after installation of each component:
```javascript
if (verifyInstalled(gsdDest, 'commands/gsd')) {
  console.log(`  ${green}✓${reset} Installed commands/gsd`);
} else {
  failures.push('commands/gsd');
}
```

### Integration Testing (Manual)

Testing is performed by:
1. Running the installation in various modes (global, local, interactive)
2. Checking file placement and content transformation
3. Validating settings.json modifications
4. Testing on multiple platforms (Windows, Linux, macOS)

**Test Checklist from CONTRIBUTING.md:**
```markdown
### Review Checklist
- [ ] Works on Windows (test paths with backslashes)
```

## Mocking

**Framework:** Not applicable — no test framework present

**Patterns:** Not applicable

**File System Mocking:** Not used. File operations are performed directly on disk.

## Test Coverage

**Requirements:** None enforced

**Current Status:** No test coverage metrics defined

**Why No Tests?**
This is a bootstrap installer with:
- Single entry point (`bin/install.js`)
- Pure file I/O operations
- Manual verification through real installation
- Small codebase (1,530 lines in main install script)
- Integration tests are more valuable than unit tests for this use case

## Testing Approach by Component

### `bin/install.js` — Manual End-to-End Testing

**What's tested manually:**
1. CLI argument parsing (`--global`, `--local`, `--claude`, `--opencode`, etc.)
2. Interactive prompts (runtime selection, location selection)
3. Installation to different locations (global ~/.claude, local ./.claude)
4. Settings.json modification and backup handling
5. File copying with path replacement
6. Different runtime conversions (Claude → OpenCode, Claude → Gemini)
7. Uninstall functionality
8. Error cases (invalid arguments, missing files)

**Manual test procedure:**
```bash
# Interactive install
npx get-shit-done-cc

# Non-interactive install
npx get-shit-done-cc --claude --global

# Test uninstall
npx get-shit-done-cc --claude --global --uninstall

# Test with custom config dir
npx get-shit-done-cc --claude --global --config-dir ~/.claude-test
```

**Platform Testing:**
- Windows (backslash paths, UNC paths, PowerShell)
- Linux/macOS (forward slashes, home expansion)

### `hooks/gsd-statusline.js` — Integration Testing

**What's tested:**
1. JSON input parsing from stdin
2. File system reads (todos, cache files)
3. Context window percentage calculation
4. Progress bar rendering
5. Silent failures on missing files
6. Output to stdout

**Manual verification:**
```bash
# Simulate Claude Code input
echo '{"model":{"display_name":"Claude 3.5"},"workspace":{"current_dir":"/home/user"},"context_window":{"remaining_percentage":50}}' | node hooks/gsd-statusline.js
```

### `hooks/gsd-check-update.js` — Integration Testing

**What's tested:**
1. npm version check (network operation)
2. VERSION file reading (project and global)
3. Cache file creation and parsing
4. Background process spawning
5. Timeout handling

**Manual verification:**
```bash
# Run and check cache file creation
node hooks/gsd-check-update.js
sleep 2
cat ~/.claude/cache/gsd-update-check.json
```

### `scripts/build-hooks.js` — File Copy Testing

**What's tested:**
1. Directory creation (hooks/dist)
2. File copying
3. Warning on missing source files

**Manual verification:**
```bash
npm run build:hooks
ls -la hooks/dist/
```

## Test Types

### Unit Tests
Not used. Functions that could benefit from unit testing are instead validated through end-to-end manual testing of the installation process.

### Integration Tests
Primary testing method. Performed manually by:
1. Running installation in different modes
2. Verifying file placement and content
3. Checking settings.json modifications
4. Testing on multiple platforms

### End-to-End Tests
Implicit through the installation process itself:
- User runs `npx get-shit-done-cc`
- Script validates itself during execution
- Built-in `verify*` functions check success
- Failed installation exits with error code

## Error Testing

**Pattern:** Try/catch with silent failures on non-critical operations

```javascript
try {
  const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
  const inProgress = todos.find(t => t.status === 'in_progress');
  if (inProgress) task = inProgress.activeForm || '';
} catch (e) {}
// Silent fail - don't break statusline on parse errors
```

**What's tested manually:**
1. Missing environment variables (fallback to defaults)
2. Corrupted JSON files (return empty object)
3. Missing directories (skip silently or use defaults)
4. Invalid file permissions (error with message)
5. Network timeouts (timeout flag set)

## Quality Assurance Process

**Code Review (from CONTRIBUTING.md):**
```markdown
### Review Checklist
- [ ] Follows GSD style (no enterprise patterns, no filler)
- [ ] Updates CHANGELOG.md for user-facing changes
- [ ] Doesn't add unnecessary dependencies
- [ ] Works on Windows (test paths with backslashes)
```

**CI/CD Testing:**
From CONTRIBUTING.md:
```markdown
| Rule | Why |
|------|-----|
| Must pass CI | Catches Windows/path issues |
```

CI validates that changes work on multiple platforms before merge.

## Testing Recommendations

### For New Features

1. **Manual E2E:** Install to clean development environment
   ```bash
   rm -rf ~/.claude-test
   npx get-shit-done-cc --claude --global --config-dir ~/.claude-test
   ```

2. **Verify file structure:**
   ```bash
   find ~/.claude-test -type f | sort
   ```

3. **Test on target platform:** Windows developers must test Windows path handling

4. **Update CHANGELOG.md** before merge

### For Bug Fixes

1. Create test case that reproduces the bug
2. Verify fix resolves it
3. Test on affected platform(s)
4. Add to manual test checklist if it's a regression risk

### For Installation Process Changes

1. Test both interactive and non-interactive modes
2. Test all runtimes (claude, opencode, gemini)
3. Test both locations (global, local)
4. Test uninstall after install
5. Test upgrade from previous version

## Known Testing Gaps

**Not Covered by Manual Testing:**
- Race conditions in file operations (unlikely to occur in practice)
- Very large file sizes (not applicable to configuration files)
- Concurrent installations (single user per config directory)
- Complex YAML parsing edge cases (simple frontmatter only)

**Why Gaps Exist:**
These scenarios are either:
- Statistically unlikely in normal usage
- Protected by error handling and silent failures
- Harder to test than to prevent through design

---

*Testing analysis: 2026-02-05*
