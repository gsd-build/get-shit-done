/**
 * GSD Test Discovery Module
 *
 * Discovers and runs tests for files that have changed relative to upstream.
 * Used for post-merge verification to catch regressions in fork-specific customizations.
 * Part of the GSD Upstream Sync feature (v1.1).
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_TIMEOUT_MS = 30000; // 30 second timeout per test run
const DEFAULT_REMOTE_NAME = 'upstream';
const DEFAULT_BRANCH = 'main';

// Test file patterns (in order of preference)
const TEST_SUFFIXES = ['.test.cjs', '.spec.cjs', '.test.js', '.spec.js', '.test.mjs', '.spec.mjs'];

// Supported source file extensions
const SOURCE_EXTENSIONS = ['.cjs', '.js', '.mjs'];

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Execute a git command and return structured result.
 * @param {string} cwd - Working directory
 * @param {string[]} args - Git command arguments
 * @returns {{ success: boolean, stdout?: string, stderr?: string }}
 */
function execGit(cwd, args) {
  try {
    // Quote arguments containing special shell characters
    const quotedArgs = args.map(arg => {
      if (/[%|&;<>()$`\\"\s]/.test(arg)) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    });
    const stdout = execSync(`git ${quotedArgs.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { success: true, stdout };
  } catch (err) {
    return {
      success: false,
      stderr: err.stderr ? err.stderr.toString().trim() : err.message,
    };
  }
}

/**
 * Escape special regex characters in a string.
 * @param {string} str - String to escape
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a path is a JavaScript source file.
 * @param {string} filePath - File path to check
 * @returns {boolean}
 */
function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

/**
 * Check if a path is a test file.
 * @param {string} filePath - File path to check
 * @returns {boolean}
 */
function isTestFile(filePath) {
  return TEST_SUFFIXES.some(suffix => filePath.endsWith(suffix));
}

/**
 * Find all files matching a pattern recursively.
 * @param {string} dir - Directory to search
 * @param {RegExp} pattern - Pattern to match
 * @param {string[]} [results=[]] - Accumulated results
 * @returns {string[]}
 */
function findFilesRecursive(dir, pattern, results = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        findFilesRecursive(fullPath, pattern, results);
      } else if (pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory not accessible, skip
  }

  return results;
}

// ─── Test Discovery Functions ─────────────────────────────────────────────────

/**
 * Find tests by naming convention.
 * Tries common patterns like foo.cjs -> foo.test.cjs.
 *
 * @param {string} cwd - Working directory
 * @param {string} srcFile - Source file path (relative to cwd)
 * @returns {string[]} - Array of test file paths (relative to cwd)
 */
function findByNamingConvention(cwd, srcFile) {
  const tests = [];
  const parsed = path.parse(srcFile);
  const baseName = parsed.name;
  const ext = parsed.ext;

  // Pattern 1: Same directory - foo.cjs -> foo.test.cjs, foo.spec.cjs
  for (const suffix of TEST_SUFFIXES) {
    // Match extension family (cjs with cjs, js with js)
    if (suffix.includes(ext) ||
        (ext === '.cjs' && suffix.includes('.cjs')) ||
        (ext === '.js' && suffix.includes('.js')) ||
        (ext === '.mjs' && suffix.includes('.mjs'))) {
      const testPath = path.join(parsed.dir, `${baseName}${suffix}`);
      const fullPath = path.join(cwd, testPath);
      if (fs.existsSync(fullPath)) {
        tests.push(testPath);
      }
    }
  }

  // Pattern 2: __tests__ directory
  for (const suffix of TEST_SUFFIXES) {
    const testPath = path.join(parsed.dir, '__tests__', `${baseName}${suffix}`);
    const fullPath = path.join(cwd, testPath);
    if (fs.existsSync(fullPath)) {
      tests.push(testPath);
    }
  }

  // Pattern 3: GSD-specific - lib/foo.cjs -> ../foo.test.cjs (test in parent bin/)
  // Example: get-shit-done/bin/lib/upstream.cjs -> get-shit-done/bin/upstream.test.cjs
  if (srcFile.includes('/lib/')) {
    for (const suffix of TEST_SUFFIXES) {
      const testPath = srcFile
        .replace(/\/lib\/([^/]+)$/, `/${baseName}${suffix}`);
      const fullPath = path.join(cwd, testPath);
      if (fs.existsSync(fullPath)) {
        tests.push(testPath);
      }
    }
  }

  return [...new Set(tests)]; // Deduplicate
}

/**
 * Find tests by analyzing imports.
 * Scans test files for require/import of the source file.
 *
 * @param {string} cwd - Working directory
 * @param {string} srcFile - Source file path (relative to cwd)
 * @returns {string[]} - Array of test file paths (relative to cwd)
 */
function findByImportAnalysis(cwd, srcFile) {
  const tests = [];

  // Find all test files in the project
  const testPattern = /\.(test|spec)\.[cm]?js$/;
  const allTestFiles = findFilesRecursive(cwd, testPattern);

  // Get basename and variations to search for
  const srcBasename = path.basename(srcFile);
  const srcBasenameNoExt = path.parse(srcFile).name;
  const srcRelative = srcFile.replace(/^\.?\/?/, '');

  for (const testFilePath of allTestFiles) {
    try {
      const content = fs.readFileSync(testFilePath, 'utf-8');

      // Build patterns to check for require/import
      const patterns = [
        // Direct require of file path
        new RegExp(`require\\s*\\(['"]\\.?\\/?[^'"]*${escapeRegex(srcBasenameNoExt)}(?:\\.c?js)?['"]\\)`, 'g'),
        // Import statement
        new RegExp(`import\\s+.*\\s+from\\s+['"]\\.?\\/?[^'"]*${escapeRegex(srcBasenameNoExt)}(?:\\.c?js)?['"]`, 'g'),
        // Require with full relative path
        new RegExp(`require\\s*\\(['"]\\.?\\/?[^'"]*${escapeRegex(srcRelative)}['"]\\)`, 'g'),
      ];

      // Check if any pattern matches
      const hasImport = patterns.some(pattern => pattern.test(content));

      if (hasImport) {
        // Convert absolute path back to relative
        const relativePath = path.relative(cwd, testFilePath);
        tests.push(relativePath);
      }
    } catch {
      // File not readable, skip
    }
  }

  return tests;
}

/**
 * Discover tests for a set of changed files.
 * Uses three-tier approach:
 * 1. Naming conventions (fast)
 * 2. Import analysis (medium)
 * 3. Coverage data (optional, not implemented - future enhancement)
 *
 * @param {string} cwd - Working directory
 * @param {string[]} changedFiles - Array of changed file paths (relative to cwd)
 * @returns {{ tests: string[], unmapped: string[], coverage: { mapped: number, total: number } }}
 */
function discoverTestsForFiles(cwd, changedFiles) {
  const testFiles = new Set();
  const unmapped = [];
  let sourceFileCount = 0;

  for (const file of changedFiles) {
    // Skip non-JS files
    if (!isSourceFile(file)) continue;

    // Skip test files themselves
    if (isTestFile(file)) continue;

    sourceFileCount++;

    // Tier 1: Naming conventions (fast)
    const conventionTests = findByNamingConvention(cwd, file);
    if (conventionTests.length > 0) {
      conventionTests.forEach(t => testFiles.add(t));
      continue;
    }

    // Tier 2: Import analysis (slower but more comprehensive)
    const importTests = findByImportAnalysis(cwd, file);
    if (importTests.length > 0) {
      importTests.forEach(t => testFiles.add(t));
      continue;
    }

    // No tests found for this file
    unmapped.push(file);
  }

  return {
    tests: Array.from(testFiles),
    unmapped,
    coverage: {
      mapped: sourceFileCount - unmapped.length,
      total: sourceFileCount,
    },
  };
}

// ─── Git-based File Discovery ─────────────────────────────────────────────────

/**
 * Get files that differ between fork and upstream.
 * These are the files with fork-specific customizations.
 *
 * @param {string} cwd - Working directory
 * @returns {string[]} - Array of file paths that have fork modifications
 */
function getForkModifiedFiles(cwd) {
  // Get files that differ from upstream (fork modifications)
  const result = execGit(cwd, [
    'diff',
    '--name-only',
    `${DEFAULT_REMOTE_NAME}/${DEFAULT_BRANCH}..HEAD`,
  ]);

  if (!result.success || !result.stdout) {
    return [];
  }

  // Filter to JS/CJS files only
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .filter(isSourceFile);
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

/**
 * Run verification tests with progressive output.
 *
 * @param {string} cwd - Working directory
 * @param {string[]} testFiles - Array of test file paths to run
 * @param {object} [options] - Options
 * @param {number} [options.timeout=30000] - Timeout in ms
 * @param {boolean} [options.progressive=true] - Show progressive output
 * @param {NodeJS.WriteStream} [options.stdout=process.stdout] - Output stream
 * @returns {Promise<{ passed: boolean, total: number, passed_count: number, failed_count: number, failures: string[], output: string }>}
 */
async function runVerificationTests(cwd, testFiles, options = {}) {
  const timeout = options.timeout || TEST_TIMEOUT_MS;
  const progressive = options.progressive !== false;
  const stdout = options.stdout || process.stdout;

  if (testFiles.length === 0) {
    return {
      passed: true,
      total: 0,
      passed_count: 0,
      failed_count: 0,
      failures: [],
      output: 'No test files to run',
    };
  }

  return new Promise((resolve) => {
    const args = [
      '--test',
      `--test-timeout=${timeout}`,
      ...testFiles,
    ];

    let output = '';
    let passed_count = 0;
    let failed_count = 0;
    const failures = [];

    // Show spinner if progressive
    let spinnerInterval;
    const spinnerFrames = ['|', '/', '-', '\\'];
    let spinnerIndex = 0;

    if (progressive && stdout.isTTY) {
      stdout.write(`\nRunning ${testFiles.length} test file(s)... `);
      spinnerInterval = setInterval(() => {
        stdout.write(`\r${spinnerFrames[spinnerIndex]} Running ${testFiles.length} test file(s)... `);
        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
      }, 100);
    }

    const nodeProcess = spawn('node', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    nodeProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    nodeProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    // Set overall timeout
    const timeoutId = setTimeout(() => {
      nodeProcess.kill('SIGTERM');
      if (spinnerInterval) clearInterval(spinnerInterval);
      resolve({
        passed: false,
        total: testFiles.length,
        passed_count,
        failed_count: testFiles.length - passed_count,
        failures: ['Test run timed out'],
        output: output + '\n[TIMEOUT: Test run exceeded time limit]',
      });
    }, timeout * testFiles.length + 5000); // Extra buffer for overall run

    nodeProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      if (spinnerInterval) clearInterval(spinnerInterval);

      // Parse output to count passes/failures
      // Node test runner output format: "ok N - description" or "not ok N - description"
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.match(/^ok \d+/)) {
          passed_count++;
        } else if (line.match(/^not ok \d+/)) {
          failed_count++;
          // Extract test name
          const match = line.match(/^not ok \d+ - (.+)/);
          if (match) {
            failures.push(match[1]);
          }
        }
        // Also check for "# pass N" and "# fail N" summary lines
        const passMatch = line.match(/^# pass (\d+)/);
        const failMatch = line.match(/^# fail (\d+)/);
        if (passMatch) passed_count = parseInt(passMatch[1], 10);
        if (failMatch) failed_count = parseInt(failMatch[1], 10);
      }

      const passed = code === 0 && failed_count === 0;

      if (progressive && stdout.isTTY) {
        if (passed) {
          stdout.write(`\r\u2705 All tests passed (${passed_count} tests)\n`);
        } else {
          stdout.write(`\r\u274C Tests failed (${passed_count} passed, ${failed_count} failed)\n`);
          // Expand full output on failure
          stdout.write('\n--- Test Output ---\n');
          stdout.write(output);
          stdout.write('\n--- End Test Output ---\n');
        }
      }

      resolve({
        passed,
        total: passed_count + failed_count,
        passed_count,
        failed_count,
        failures,
        output,
      });
    });

    nodeProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      if (spinnerInterval) clearInterval(spinnerInterval);
      resolve({
        passed: false,
        total: testFiles.length,
        passed_count: 0,
        failed_count: testFiles.length,
        failures: [err.message],
        output: `Failed to run tests: ${err.message}`,
      });
    });
  });
}

// ─── Module Exports ───────────────────────────────────────────────────────────

module.exports = {
  // Constants
  TEST_TIMEOUT_MS,
  TEST_SUFFIXES,
  SOURCE_EXTENSIONS,

  // Test discovery functions
  findByNamingConvention,
  findByImportAnalysis,
  discoverTestsForFiles,

  // Git-based functions
  getForkModifiedFiles,

  // Test runner
  runVerificationTests,

  // Utility functions (exported for testing)
  isSourceFile,
  isTestFile,
  findFilesRecursive,
  escapeRegex,
};
