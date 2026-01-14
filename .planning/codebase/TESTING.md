# Testing Patterns

**Analysis Date:** 2025-01-14

## Test Framework

**Runner:**
- Custom test framework class (OpenCodeIntegrationTester)
- Config: No configuration file, manual test runner
- Location: `bin/test-opencode-integration.js`

**Assertion Library:**
- Custom assertion methods in test class
- Basic equality and existence checks
- Manual pass/fail tracking

**Run Commands:**
```bash
node bin/test-opencode-integration.js              # Run all tests
# No watch mode or single file execution supported
# No coverage reporting available
```

## Test File Organization

**Location:**
- Single test file in bin/ directory
- No separate tests/ directory structure
- Tests co-located with utilities

**Naming:**
- test-*.js for test files (test-opencode-integration.js)
- No distinction between unit/integration/e2e

**Structure:**
```
bin/
  test-opencode-integration.js    # All tests in one file
  (no other test files found)
```

## Test Structure

**Suite Organization:**
```javascript
class OpenCodeIntegrationTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  testEditorDetection() {
    // Test implementation
    const result = detectEditor();
    this.assert(result, 'Editor detection should work');
  }

  testConfigManager() {
    // Test implementation
    // Manual assertions
  }

  runAllTests() {
    this.testEditorDetection();
    this.testConfigManager();
    // ... more tests
    this.printSummary();
  }
}
```

**Patterns:**
- Class-based test organization
- Manual test method calling
- Custom assertion methods
- No setup/teardown lifecycle
- Console output for results

## Mocking

**Framework:**
- Manual mocking with property overrides
- No dedicated mocking library
- Runtime environment mocking

**Patterns:**
```javascript
// Manual file system mocking
const originalExistsSync = fs.existsSync;
fs.existsSync = (p) => p.includes('.opencode');

// Manual environment mocking
const originalEnv = process.env;
process.env = { ...process.env, OPENCODE_CONFIG_DIR: '/test/path' };

// Restore after test
fs.existsSync = originalExistsSync;
process.env = originalEnv;
```

**What to Mock:**
- File system operations (fs.existsSync, fs.readFileSync)
- Environment variables (process.env)
- External processes (child_process.execSync)

**What NOT to Mock:**
- Pure utility functions
- Internal logic (tested directly)

## Fixtures and Factories

**Test Data:**
- Manual test data creation in test methods
- Hardcoded test values
- No shared fixtures or factories

**Location:**
- Test data defined inline within test methods
- No separate fixtures directory

## Coverage

**Requirements:**
- No coverage targets defined
- Manual testing approach
- Basic functionality verification

**Configuration:**
- No coverage tools configured
- Test results logged manually
- No automated coverage reporting

**View Coverage:**
```bash
# No coverage command available
# Test output in console only
```

## Test Types

**Unit Tests:**
- Test individual functions and classes
- Mock external dependencies
- Examples: ConfigManager class tests, utility function tests

**Integration Tests:**
- Test multiple components together
- Mock file system and external processes
- Examples: Full installation flow simulation

**E2E Tests:**
- Not detected - no end-to-end user flow testing

## Common Patterns

**Async Testing:**
- No async testing patterns found
- All tests are synchronous

**Error Testing:**
- Manual error condition testing
- Assert expected failures

**Snapshot Testing:**
- Not used

---

*Testing analysis: 2025-01-14*
*Update when test patterns change*