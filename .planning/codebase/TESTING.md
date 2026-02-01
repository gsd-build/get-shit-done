# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework Status

**Framework:** Not detected

**Current State:**
- No test runner configured (Jest, Vitest, Mocha, etc.)
- No .test.* or .spec.* files present in codebase
- No test configuration files (.eslintrc, .prettierrc, tsconfig, jest.config, vitest.config)
- package.json has no test script defined
- No testing dependencies in package.json

**What exists:**
- Manual verification patterns documented in workflows
- Verification scripts in agent/workflow documentation
- Shell-based validation in build scripts

## Testing Strategy (Current)

The codebase uses **documentation-driven verification** rather than automated tests:

**Testing tools used:**
- Bash scripts with exit code verification
- File system checks (fs.existsSync)
- Manual verification documented in workflows
- Checkpoint protocols in plans for user verification

## Verification Patterns (Used Instead of Tests)

The GSD system documents extensive verification patterns in `get-shit-done/references/verification-patterns.md` and `get-shit-done/workflows/verify-phase.md`.

### Bash-Based Verification

**Pattern in build-hooks.js:**
```javascript
function build() {
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Copy hooks to dist
  for (const hook of HOOKS_TO_COPY) {
    const src = path.join(HOOKS_DIR, hook);
    const dest = path.join(DIST_DIR, hook);

    if (!fs.existsSync(src)) {
      console.warn(`Warning: ${hook} not found, skipping`);
      continue;
    }

    console.log(`Copying ${hook}...`);
    fs.copyFileSync(src, dest);
    console.log(`  → ${dest}`);
  }

  console.log('\nBuild complete.');
}

build();
```

**Pattern in gsd-check-update.js:**
```javascript
// Runtime check: version file exists and is readable
if (fs.existsSync(projectVersionFile)) {
  installed = fs.readFileSync(projectVersionFile, 'utf8').trim();
} else if (fs.existsSync(globalVersionFile)) {
  installed = fs.readFileSync(globalVersionFile, 'utf8').trim();
}

// Runtime check: npm registry is accessible
try {
  latest = execSync('npm view get-shit-done-cc version', {
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true
  }).trim();
} catch (e) {}
```

### Workflow-Based Verification

**From `get-shit-done/workflows/verify-phase.md`:**

Verification checks look for:
- Stub detection via grep patterns
- Code quality metrics (line counts, complexity)
- Incomplete implementations (empty returns, no-ops)
- Missing critical features
- Environment configuration validation

**Example verification command pattern:**
```bash
# Check for unimplemented features
grep -E "(TODO|FIXME|XXX|HACK|PLACEHOLDER)" "$file"

# Validate environment vars exist and are not placeholder values
grep -E "^VAR_NAME=" .env .env.local 2>/dev/null | grep -v placeholder

# Count stubs in file
stubs=$(grep -c "TODO|FIXME|placeholder|not implemented" "$file" 2>/dev/null || echo 0)
```

## Test Organization (Proposed Pattern)

While tests are not currently present, the codebase structure would support:

**Recommended test location pattern:**
- Unit tests co-located with implementation
- Integration tests in separate `tests/` directory
- Test naming: `[filename].test.js` or `[filename].spec.js`

**Current structure for reference:**
```sql
bin/
  install.js          # Main install logic
hooks/
  gsd-check-update.js # Update check hook
  gsd-statusline.js   # Statusline hook
scripts/
  build-hooks.js      # Build script (has internal verification)
```

## Manual Testing Checklist (Currently Used)

From observed patterns in agents and workflows, manual verification includes:

**Installation verification:**
- `npm link` — Test local installation
- `npx get-shit-done-cc` — Test command execution
- Verify --help output
- Test argument parsing (--global, --local, --claude, --opencode, --gemini)
- Test --config-dir flag with explicit path

**Hook verification:**
- Verify hooks copy to dist directory
- Check file permissions (executable)
- Test SessionStart hook runs without errors
- Verify version check caches correctly

**Path handling verification:**
- Test on macOS/Linux paths (forward slashes)
- Test on Windows UNC paths (backward slashes)
- Test tilde expansion (~)
- Test relative and absolute paths

**Environment variable verification:**
- Verify OPENCODE_CONFIG_DIR detection
- Verify CLAUDE_CONFIG_DIR detection
- Verify GEMINI_CONFIG_DIR detection
- Verify XDG_CONFIG_HOME fallback

## Error Scenarios (Currently Tested Manually)

From bin/install.js argument validation:
```javascript
// Invalid --config-dir usage
if (!nextArg || nextArg.startsWith('-')) {
  console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
  process.exit(1);
}

// Empty --config-dir=value
if (!value) {
  console.error(`  ${yellow}--config-dir requires a non-empty path${reset}`);
  process.exit(1);
}
```

**Error scenarios to test:**
- Missing argument when required
- Invalid flag combinations
- Missing config directories
- Version file not found (graceful default to '0.0.0')
- npm registry unreachable during update check
- File permission issues
- Disk space constraints

## Mocking Patterns (If Tests Were Written)

**Pattern for mocking file system:**
- Mock fs.existsSync() to test path resolution fallbacks
- Mock fs.readFileSync() to test version file parsing
- Mock execSync() to test npm registry responses

**Pattern for mocking spawned processes:**
- Mock child_process.spawn() for background processes
- Test stdio: 'ignore' configuration
- Test timeout handling

**Approach for Windows testing:**
- Mock path.join() with backslash paths
- Mock os.homedir() to return Windows paths
- Verify path expansion works with UNC paths (\\server\share)

## Coverage Targets (Not Currently Enforced)

Based on GSD philosophy (solo developer + Claude workflow), testing would focus on:

**High priority (critical path):**
- Argument parsing (CLI correctness)
- Path resolution for all three runtimes (claude, opencode, gemini)
- Environment variable detection logic
- File system operations (copy, read, exists)
- Error handling in spawned processes

**Medium priority:**
- Version check logic
- Tilde expansion
- Config directory detection

**Lower priority:**
- Console output formatting (color codes)
- Banner display

## CI/CD Testing (Current)

**Framework:** Not explicitly configured in main repo

**What exists:**
- `.github/workflows/` directory exists (content not reviewed in this analysis)
- Testing would likely be npm-based given package.json structure
- Branch protection on main (implied by contributing guidelines)

**Suggested CI checks (documented in CONTRIBUTING.md):**
- Must pass CI before merge to main (mentioned in branch strategy)
- Catches Windows/path issues (mentioned in PR guidelines)

## Testing Documentation

Key references for verification patterns:
- `get-shit-done/references/verification-patterns.md` — Comprehensive verification examples
- `get-shit-done/workflows/verify-phase.md` — Phase verification workflow
- `agents/gsd-verifier.md` — Verification agent implementation

**Verification checklist from agents includes:**
- Code quality (no stubs, complete implementations)
- Type checking (where applicable)
- Error handling validation
- Integration points validated
- User-facing output verified
- Performance baselines met

## What to Test When Adding Features

**For new CLI commands/flags:**
1. Verify argument parsing handles all combinations
2. Test with missing/invalid arguments (error cases)
3. Test help output is generated correctly
4. Verify feature works on Windows and Unix paths

**For config directory logic:**
1. Test environment variable detection order
2. Test tilde expansion works
3. Test file existence checks
4. Test fallback chain (explicit > env > default)

**For spawned processes:**
1. Verify stdio configuration prevents output pollution
2. Test timeout handling
3. Test error-on-fail vs. silent-fail behavior

**For file operations:**
1. Test copy succeeds when source exists
2. Test graceful skip when source missing
3. Test directory creation (recursive)
4. Test permission handling

## Testing Recommendations

**If adding a test suite:**

1. **Start with Jest or Vitest** (modern, minimal setup)
2. **Focus on critical path first:**
   - Argument parsing logic
   - Path resolution functions
   - Config directory detection
3. **Use snapshots cautiously** (good for version strings, help output)
4. **Mock file system operations** to avoid disk dependencies
5. **Test Windows paths explicitly** (common failure point in this codebase)

**Structure for new tests:**
- Place test files adjacent to implementation files
- Group related tests with describe() blocks
- Use consistent naming: describe module first, then function
- Include both success and error cases

## Known Testing Gaps

**No automated verification for:**
- Windows-specific path handling (only documented in CONTRIBUTING.md)
- Cross-platform compatibility (macOS, Linux, Windows)
- Permission errors (file read/write failures)
- Network failures in version check
- Edge cases in argument parsing (empty strings, special characters)
- Interactive prompts and user input

**Risk areas for manual regression:**
- `bin/install.js` — Complex argument parsing, config directory logic
- `hooks/gsd-check-update.js` — Process spawning, JSON parsing
- Path expansion functions — Tilde handling, relative paths

## Manual Verification Commands

Commands to run before release:

```bash
# Install locally
npm link

# Test basic execution
npx get-shit-done-cc

# Test with different runtimes
npx get-shit-done-cc --claude
npx get-shit-done-cc --opencode
npx get-shit-done-cc --gemini

# Test help output
npx get-shit-done-cc --help

# Test build script
npm run build:hooks

# Verify hooks were copied
ls -la hooks/dist/

# Test on Windows (if applicable)
# Test UNC paths: get-shit-done-cc --config-dir \\server\share\config
```

---

*Testing analysis: 2026-02-01*
