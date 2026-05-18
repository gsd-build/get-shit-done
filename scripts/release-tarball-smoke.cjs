#!/usr/bin/env node
/**
 * scripts/release-tarball-smoke.cjs
 *
 * Release tarball smoke test for issue #3686.
 *
 * Guards against the class of bugs that can't be caught by working-tree tests:
 *   - #3684: maskIfSecret import/export mismatch shipped in v1.42.3 (runtime
 *     crash on installed package, invisible to unit tests)
 *   - #3668: 75/78 workflows call bare `gsd-sdk` without fallback; --local users
 *     see `command not found`
 *
 * Strategy: pack the working tree, install into a temp prefix, invoke the
 * installed binary, assert the version matches package.json. Exercises the
 * INSTALLED package, not the working tree.
 *
 * Exports:
 *   SMOKE  — frozen enum of result codes
 *   runSmoke({ tarballPath, installPrefix, expectedVersion, fixtureDir,
 *              lifecycleCommands, dryRun })
 *     → { code: SMOKE.*, details: { version, tarball, ... } }
 *
 * CLI entry: node scripts/release-tarball-smoke.cjs --json
 *   Packs working tree, installs to a temp prefix, checks version.
 *   Exits 0 on SMOKE.OK, 1 otherwise.
 *   Always prints JSON to stdout when --json flag is present.
 *
 * Lifecycle command checks (Cycle 2):
 *   For each command name (other than 'init') in lifecycleCommands:
 *     - Assert commands/gsd/<cmd>.md exists in the installed package
 *     - Parse the .md for a workflow @-import or inline reference
 *     - Assert the referenced workflow .md exists in the installed package
 *   If 'init' is in lifecycleCommands, runs `get-shit-done-cc --local --claude`
 *   in fixtureDir to verify the installer is callable (INIT_FAILED on crash).
 *   Non-interactive: --local --claude flags skip all prompts.
 *
 * Workflow-body checks (Cycle 3 — informational until #3668 is fixed):
 *   - Calls `gsd-sdk "query" state.json --project-dir <fixtureDir>` to verify
 *     the SDK binary is callable and produces parseable JSON (SDK_BINARY_NOT_CALLABLE).
 *   - Scans all installed get-shit-done/workflows/*.md for:
 *     (a) /gsd:<known-cmd> colon-namespace leaks (WORKFLOW_BODY_COLON_LEAK)
 *     (b) bare `gsd-sdk` query invocations in shell fences without a `command -v gsd-sdk`
 *         guard in the same fence (WORKFLOW_MISSING_SDK_FALLBACK — #3668).
 *   Both checks populate result.details with counters but do NOT return a failure
 *   code by default; they are informational until the upstream fixes land.
 */

'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const CHILD_TIMEOUT_MS = 120000;

// ---------------------------------------------------------------------------
// Frozen result-code enum
// ---------------------------------------------------------------------------

const SMOKE = Object.freeze({
  OK: 'ok',
  VERSION_MISMATCH: 'version_mismatch',
  PACK_FAILED: 'pack_failed',
  INSTALL_FAILED: 'install_failed',
  BIN_NOT_CALLABLE: 'bin_not_callable',
  // Cycle 2 codes
  COMMAND_FILE_MISSING: 'command_file_missing',
  WORKFLOW_FILE_MISSING: 'workflow_file_missing',
  INIT_FAILED: 'init_failed',
  // Cycle 3 codes
  SDK_BINARY_NOT_CALLABLE: 'sdk_binary_not_callable',
  WORKFLOW_BODY_COLON_LEAK: 'workflow_body_colon_leak',
  WORKFLOW_MISSING_SDK_FALLBACK: 'workflow_missing_sdk_fallback',
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Locate the lib/node_modules/get-shit-done-cc package root inside an
 * npm --prefix install directory.
 */
function pkgRoot(installPrefix) {
  // POSIX: <prefix>/lib/node_modules/get-shit-done-cc
  // Windows: <prefix>/node_modules/get-shit-done-cc
  const posix = path.join(installPrefix, 'lib', 'node_modules', 'get-shit-done-cc');
  const win = path.join(installPrefix, 'node_modules', 'get-shit-done-cc');
  return fs.existsSync(posix) ? posix : win;
}

/**
 * Locate the installed gsd-sdk binary (symlink in <prefix>/bin/).
 */
function findGsdSdkBin(installPrefix) {
  const binDir = process.platform === 'win32'
    ? path.join(installPrefix, 'node_modules', '.bin')
    : path.join(installPrefix, 'bin');

  const candidates = process.platform === 'win32'
    ? [path.join(binDir, 'gsd-sdk.cmd'), path.join(binDir, 'gsd-sdk')]
    : [path.join(binDir, 'gsd-sdk')];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Locate the get-shit-done-cc installer binary (the symlink in <prefix>/bin/).
 */
function findInstallerBin(installPrefix) {
  const binDir = process.platform === 'win32'
    ? path.join(installPrefix, 'node_modules', '.bin')
    : path.join(installPrefix, 'bin');

  const candidates = process.platform === 'win32'
    ? [path.join(binDir, 'get-shit-done-cc.cmd'), path.join(binDir, 'get-shit-done-cc')]
    : [path.join(binDir, 'get-shit-done-cc')];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Parse a command .md file and return the first workflow path it references.
 *
 * Structured parser — only inspects individual lines; never regexes on the
 * whole-file string. Two recognised forms (in priority order):
 *
 *   1. @-import line:  `@~/.claude/get-shit-done/workflows/<name>.md`
 *   2. Inline mention: any line containing `~/.claude/get-shit-done/workflows/<name>.md`
 *      (takes the LAST occurrence so conditional-dispatch files resolve to the
 *       default / unconditional branch, e.g. discuss-phase.md)
 *
 * Returns the bare workflow filename (e.g. `"discuss-phase.md"`) or null.
 */
function parseWorkflowRef(mdContent) {
  const WORKFLOW_PREFIX = 'get-shit-done/workflows/';
  let atImportResult = null;
  let lastInlineResult = null;

  const lines = mdContent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    // Form 1: @-import
    if (trimmed.startsWith('@') && trimmed.includes(WORKFLOW_PREFIX)) {
      const idx = trimmed.indexOf(WORKFLOW_PREFIX);
      const rest = trimmed.slice(idx + WORKFLOW_PREFIX.length);
      // rest is like "discuss-phase.md" or "discuss-phase.md end-to-end."
      const name = rest.split(/[\s`"]/)[0];
      if (name.endsWith('.md')) {
        atImportResult = name;
        break; // @-imports are authoritative; stop on first
      }
    }

    // Form 2: inline mention (collect last)
    if (trimmed.includes(WORKFLOW_PREFIX)) {
      const idx = trimmed.indexOf(WORKFLOW_PREFIX);
      const rest = trimmed.slice(idx + WORKFLOW_PREFIX.length);
      const name = rest.split(/[\s`"]/)[0];
      if (name.endsWith('.md')) {
        lastInlineResult = name;
      }
    }
  }

  return atImportResult !== null ? atImportResult : lastInlineResult;
}

/**
 * Read the list of known GSD command names from the installed package.
 * Returns an array of strings like `['init', 'discuss-phase', ...]`.
 */
function readInstalledCmdNames(pkg) {
  const commandsDir = path.join(pkg, 'commands', 'gsd');
  if (!fs.existsSync(commandsDir)) return [];
  return fs.readdirSync(commandsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3)); // strip .md
}

/**
 * Scan a single workflow .md file for /gsd:<cmd> colon-namespace leaks.
 *
 * Uses the word-boundary-safe regex shape from scripts/fix-slash-commands.cjs:
 *   /gsd-(<cmd1>|<cmd2>|...)(?=[^a-zA-Z0-9_-]|$)/g  — forward
 * We check the colon form: /gsd:<cmd> leaking in installed workflow bodies.
 *
 * Returns the first leaking { line, lineNumber } or null.
 */
function scanWorkflowColonLeak(filePath, cmdNames) {
  if (!cmdNames || cmdNames.length === 0) return null;
  const sorted = [...cmdNames].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`/gsd:(${sorted.join('|')})(?=[^a-zA-Z0-9_-]|$)`, 'g');

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    pattern.lastIndex = 0;
    if (pattern.test(lines[i])) {
      return { line: i + 1, content: lines[i].trim() };
    }
  }
  return null;
}

/**
 * Scan a single workflow .md file for bare `gsd-sdk` query invocations inside
 * shell fences that lack a `command -v gsd-sdk` guard in the same fence.
 *
 * Structured check: walks lines, tracks open/close shell fences (```bash /
 * ```sh / ``` alone), collects `gsd-sdk` query lines and the fence's guard
 * state, then emits findings per-fence.
 *
 * Returns the first unguarded { line, lineNumber } or null.
 */
function scanWorkflowMissingSdkFallback(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const FENCE_OPEN = /^```(?:bash|sh)?\s*$/;
  const FENCE_CLOSE = /^```\s*$/;
  const SDK_QUERY = /\bgsd-sdk\s+query\b/;
  const COMMAND_V = /\bcommand\s+-v\s+gsd-sdk\b/;

  let inFence = false;
  let fenceHasGuard = false;
  let firstSdkQueryLineInFence = null;
  let firstSdkQueryLineNumInFence = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inFence) {
      if (FENCE_OPEN.test(trimmed)) {
        inFence = true;
        fenceHasGuard = false;
        firstSdkQueryLineInFence = null;
        firstSdkQueryLineNumInFence = null;
      }
    } else {
      if (FENCE_CLOSE.test(trimmed)) {
        // Closing the fence — check if there were bare sdk query calls without a guard
        if (firstSdkQueryLineInFence !== null && !fenceHasGuard) {
          return { line: firstSdkQueryLineNumInFence, content: firstSdkQueryLineInFence.trim() };
        }
        inFence = false;
        fenceHasGuard = false;
        firstSdkQueryLineInFence = null;
        firstSdkQueryLineNumInFence = null;
      } else {
        if (COMMAND_V.test(line)) {
          fenceHasGuard = true;
        }
        if (SDK_QUERY.test(line) && firstSdkQueryLineInFence === null) {
          firstSdkQueryLineInFence = line;
          firstSdkQueryLineNumInFence = i + 1;
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pure function: runSmoke
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {string}   opts.tarballPath        - Absolute path to a pre-packed .tgz
 * @param {string}   opts.installPrefix      - Temp directory to use as npm --prefix
 * @param {string}   opts.expectedVersion    - semver string to assert (e.g. "1.50.0")
 * @param {string}   [opts.fixtureDir]       - Temp dir to run `init` into (must NOT be HOME)
 * @param {string[]} [opts.lifecycleCommands] - Commands to file-check (default: see below)
 * @param {boolean}  [opts.dryRun=false]     - If true, skip actual npm install; validate input only
 * @returns {{ code: string, details: object }}
 */
function runSmoke({
  tarballPath,
  installPrefix,
  expectedVersion,
  fixtureDir,
  lifecycleCommands = ['init', 'discuss-phase', 'plan-phase', 'execute-phase'],
  dryRun = false,
}) {
  const details = {
    tarball: tarballPath,
    prefix: installPrefix,
    expectedVersion,
  };

  if (dryRun) {
    return { code: SMOKE.OK, details: { ...details, version: expectedVersion, dryRun: true } };
  }

  // --- Install the tarball into the temp prefix ----------------------------
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const installResult = spawnSync(
    npmCmd,
    ['install', '-g', '--prefix', installPrefix, tarballPath],
    { encoding: 'utf-8', shell: process.platform === 'win32', timeout: CHILD_TIMEOUT_MS },
  );

  if (installResult.status !== 0) {
    return {
      code: SMOKE.INSTALL_FAILED,
      details: {
        ...details,
        stderr: installResult.stderr,
        stdout: installResult.stdout,
      },
    };
  }

  // --- Locate the installed gsd-sdk binary ---------------------------------
  const actualBin = findGsdSdkBin(installPrefix);

  if (!actualBin) {
    const binDir = process.platform === 'win32'
      ? path.join(installPrefix, 'node_modules', '.bin')
      : path.join(installPrefix, 'bin');
    return {
      code: SMOKE.BIN_NOT_CALLABLE,
      details: { ...details, binDir, searched: [] },
    };
  }

  // --- Invoke `gsd-sdk --version` ------------------------------------------
  const versionResult = spawnSync(
    process.execPath,
    [actualBin, '--version'],
    { encoding: 'utf-8', timeout: CHILD_TIMEOUT_MS },
  );

  if (versionResult.status !== 0) {
    return {
      code: SMOKE.BIN_NOT_CALLABLE,
      details: {
        ...details,
        bin: actualBin,
        stderr: versionResult.stderr,
        stdout: versionResult.stdout,
      },
    };
  }

  // Output format: "gsd-sdk v1.50.0-canary.0\n"
  const rawOutput = (versionResult.stdout || '').trim();
  const versionMatch = rawOutput.match(/v(.+)$/);
  const installedVersion = versionMatch ? versionMatch[1] : rawOutput;

  details.version = installedVersion;
  details.rawVersionOutput = rawOutput;
  details.bin = actualBin;

  if (installedVersion !== expectedVersion) {
    return {
      code: SMOKE.VERSION_MISMATCH,
      details: { ...details, installedVersion, expectedVersion },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cycle 2: lifecycle command file-resolution checks
  // ─────────────────────────────────────────────────────────────────────────

  const pkg = pkgRoot(installPrefix);
  const shouldRunInit = lifecycleCommands.includes('init');
  const commandsToCheck = lifecycleCommands.filter((c) => c !== 'init');

  // --- Run init if requested -----------------------------------------------
  if (shouldRunInit && fixtureDir) {
    const installerBin = findInstallerBin(installPrefix);

    if (!installerBin) {
      return {
        code: SMOKE.INIT_FAILED,
        details: {
          ...details,
          reason: 'get-shit-done-cc binary not found in installPrefix',
          installPrefix,
        },
      };
    }

    // Non-interactive: --local --claude installs to .claude/ in cwd (fixtureDir).
    // GSD_TEST_MODE must be cleared — install.js skips its main() block when
    // GSD_TEST_MODE is set, which would cause the installer to exit 0 silently
    // without actually creating any files.
    const initEnv = { ...process.env };
    delete initEnv.GSD_TEST_MODE;

    const initResult = spawnSync(
      process.execPath,
      [installerBin, '--local', '--claude'],
      {
        encoding: 'utf-8',
        cwd: fixtureDir,
        // Ensure no TTY so the installer's non-interactive fallback fires
        stdio: ['pipe', 'pipe', 'pipe'],
        env: initEnv,
        timeout: CHILD_TIMEOUT_MS,
      },
    );

    if (initResult.status !== 0) {
      return {
        code: SMOKE.INIT_FAILED,
        details: {
          ...details,
          fixtureDir,
          stderr: initResult.stderr,
          stdout: initResult.stdout,
        },
      };
    }

    // Verify expected dirs were created
    const expectedDirs = [
      path.join(fixtureDir, '.claude', 'commands'),
      path.join(fixtureDir, '.claude', 'get-shit-done'),
    ];
    for (const dir of expectedDirs) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return {
          code: SMOKE.INIT_FAILED,
          details: {
            ...details,
            fixtureDir,
            reason: `expected dir not created: ${dir}`,
          },
        };
      }
    }
  }

  // --- Check command files and workflow references -------------------------
  const lifecycleResolved = [];

  for (const cmd of commandsToCheck) {
    const cmdFilePath = path.join(pkg, 'commands', 'gsd', `${cmd}.md`);

    if (!fs.existsSync(cmdFilePath) || !fs.statSync(cmdFilePath).isFile()) {
      return {
        code: SMOKE.COMMAND_FILE_MISSING,
        details: {
          ...details,
          command: cmd,
          path: cmdFilePath,
        },
      };
    }

    // Parse workflow reference
    const mdContent = fs.readFileSync(cmdFilePath, 'utf-8');
    const workflowName = parseWorkflowRef(mdContent);

    let workflowPath = null;
    if (workflowName) {
      // Workflow files live at get-shit-done/workflows/<name> in the package.
      // Some live in subdirectories; try flat first then scan once.
      const flat = path.join(pkg, 'get-shit-done', 'workflows', workflowName);
      workflowPath = fs.existsSync(flat) ? flat : null;

      if (!workflowPath) {
        return {
          code: SMOKE.WORKFLOW_FILE_MISSING,
          details: {
            ...details,
            command: cmd,
            path: flat,
          },
        };
      }
    }

    lifecycleResolved.push({
      command: cmd,
      commandPath: cmdFilePath,
      workflowPath,
    });
  }

  details.lifecycleResolved = lifecycleResolved;

  // ─────────────────────────────────────────────────────────────────────────
  // Cycle 3: SDK binary callable + workflow-body validation (informational)
  // ─────────────────────────────────────────────────────────────────────────

  // --- Verify `gsd-sdk` query is callable and returns parseable JSON -------
  const sdkQueryDir = fixtureDir || os.tmpdir();
  const sdkQueryResult = spawnSync(
    process.execPath,
    [actualBin, 'query', 'state.json', '--project-dir', sdkQueryDir],
    { encoding: 'utf-8', timeout: CHILD_TIMEOUT_MS },
  );

  if (sdkQueryResult.status !== 0) {
    return {
      code: SMOKE.SDK_BINARY_NOT_CALLABLE,
      details: {
        ...details,
        sdkBin: actualBin,
        sdkQueryStderr: sdkQueryResult.stderr,
        sdkQueryStdout: sdkQueryResult.stdout,
      },
    };
  }

  let sdkQueryParsed = false;
  try {
    JSON.parse(sdkQueryResult.stdout);
    sdkQueryParsed = true;
  } catch {
    // leave sdkQueryParsed = false
  }

  if (!sdkQueryParsed) {
    return {
      code: SMOKE.SDK_BINARY_NOT_CALLABLE,
      details: {
        ...details,
        sdkBin: actualBin,
        reason: 'gsd-sdk query-state output is not valid JSON',
        sdkQueryStdout: sdkQueryResult.stdout,
      },
    };
  }

  details.sdkQueryResult = sdkQueryResult.stdout;
  details.sdkQueryParsed = true;

  // --- Workflow-body checks (informational — #3668 not yet fixed) ----------
  const workflowsDir = path.join(pkg, 'get-shit-done', 'workflows');
  const installedCmdNames = readInstalledCmdNames(pkg);

  let workflowsScanned = 0;
  let colonLeakCount = 0;
  let missingFallbackCount = 0;
  // Store first finding per check type (for future enforcement mode)
  let firstColonLeak = null;
  let firstMissingFallback = null;

  if (fs.existsSync(workflowsDir)) {
    // Collect all .md files (flat only — subdirs contain sub-workflows that
    // follow the same contract, but the top-level .md files are the primary surface)
    const entries = fs.readdirSync(workflowsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = path.join(workflowsDir, entry.name);
      workflowsScanned++;

      const leak = scanWorkflowColonLeak(filePath, installedCmdNames);
      if (leak) {
        colonLeakCount++;
        if (!firstColonLeak) {
          firstColonLeak = { file: filePath, line: leak.line };
        }
      }

      const missingFallback = scanWorkflowMissingSdkFallback(filePath);
      if (missingFallback) {
        missingFallbackCount++;
        if (!firstMissingFallback) {
          firstMissingFallback = { file: filePath, line: missingFallback.line };
        }
      }
    }
  }

  details.workflowsScanned = workflowsScanned;
  details.colonLeakCount = colonLeakCount;
  details.missingFallbackCount = missingFallbackCount;
  if (firstColonLeak) details.firstColonLeak = firstColonLeak;
  if (firstMissingFallback) details.firstMissingFallback = firstMissingFallback;

  // NOTE: colonLeakCount and missingFallbackCount are informational here.
  // They will be non-zero against current main per #3668 and the /gsd: leak
  // backlog. Once those issues are fixed, a future enforcement mode can be
  // enabled (e.g. SMOKE_ENFORCE_WORKFLOW_BODY=1) to fail here.

  return { code: SMOKE.OK, details };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function cliMain() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');

  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const expectedVersion = process.env.SMOKE_FORCE_EXPECTED_VERSION || pkg.version;

  // Pack the working tree into a temp directory
  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-smoke-pack-'));
  const installPrefix = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-smoke-prefix-'));
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-smoke-fixture-'));

  let tarballPath;
  try {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const packOutput = execFileSync(
      npmCmd,
      ['pack', '--pack-destination', packDir],
      {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf-8',
        shell: process.platform === 'win32',
        timeout: CHILD_TIMEOUT_MS,
      },
    ).trim();
    // npm pack outputs the filename on stdout (last line when verbose)
    const lines = packOutput.split(/\r?\n/).filter(Boolean);
    const tgzName = lines[lines.length - 1];
    tarballPath = path.join(packDir, tgzName);
    if (!fs.existsSync(tarballPath)) {
      // npm 7+ may print just the filename without .tgz extension on some platforms
      const found = fs.readdirSync(packDir).find((f) => f.endsWith('.tgz'));
      if (found) {
        tarballPath = path.join(packDir, found);
      } else {
        const result = {
          code: SMOKE.PACK_FAILED,
          details: { packDir, packOutput, reason: 'no .tgz in pack destination' },
        };
        if (isJson) process.stdout.write(JSON.stringify(result) + '\n');
        cleanup(packDir, installPrefix, fixtureDir);
        process.exit(1);
      }
    }
  } catch (err) {
    const result = {
      code: SMOKE.PACK_FAILED,
      details: { error: err.message, stderr: err.stderr },
    };
    if (isJson) process.stdout.write(JSON.stringify(result) + '\n');
    cleanup(packDir, installPrefix, fixtureDir);
    process.exit(1);
  }

  const result = runSmoke({ tarballPath, installPrefix, expectedVersion, fixtureDir });
  if (isJson) process.stdout.write(JSON.stringify(result) + '\n');
  cleanup(packDir, installPrefix, fixtureDir);
  process.exit(result.code === SMOKE.OK ? 0 : 1);
}

function cleanup(...dirs) {
  for (const dir of dirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { SMOKE, runSmoke };

if (require.main === module) {
  cliMain();
}
