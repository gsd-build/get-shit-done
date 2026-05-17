'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Asserts that every `run:` step whose command begins with `npm ` in any
 * .github/workflows/*.yml file has an effective `shell:` directive.
 *
 * "Effective shell" is resolved as:
 *   step.shell ?? job.defaults.run.shell ?? workflow.defaults.run.shell
 *
 * Without an effective shell, GitHub Actions defaults to pwsh on
 * windows-latest.  The npm.cmd → node.exe → npm-cli.js child-process chain
 * under pwsh can swallow stderr, making `npm ci` / `npm run` failures
 * invisible in CI logs.
 *
 * Scope: only workflow files that reference windows-latest (directly as a
 * literal `runs-on:` value, or as a member of a `strategy.matrix.os` list).
 * Steps in jobs that cannot run on Windows cannot trigger the class of failure
 * described above, but the file must still be scanned once any job in it
 * includes a windows target (to catch unshelled npm steps in sibling jobs that
 * could be copy-pasted to a windows context).
 *
 * Acceptable shell values: bash, pwsh, sh, cmd.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const WORKFLOWS_DIR = path.join(REPO_ROOT, '.github', 'workflows');

/**
 * Collect all .yml / .yaml files under the workflows directory.
 *
 * Only files that reference "windows-latest" (as a literal runs-on value or
 * inside a matrix.os list) are returned — the pwsh-stderr-swallow failure
 * class can only manifest in workflows that target Windows runners.
 */
function listWorkflowFiles() {
  const entries = fs.readdirSync(WORKFLOWS_DIR);
  const all = entries
    .filter((e) => /\.ya?ml$/.test(e))
    .map((e) => path.join(WORKFLOWS_DIR, e));

  // Filter to files that have at least one windows-latest reference.
  // allow-test-rule: file-scope prefilter, not a test assertion — we need to
  // detect whether a workflow file targets Windows runners at all. The pwsh
  // stderr-swallow class is windows-only, so files that never mention
  // windows-latest are out of scope. Exposing a typed IR from production
  // code is not appropriate here because the source-of-truth is the YAML
  // itself; the actual test assertions below ARE structural (parse runs-on,
  // strategy.matrix.os, defaults.run.shell, etc.).
  return all.filter((f) => {
    const raw = fs.readFileSync(f, 'utf8');
    return raw.indexOf('windows-latest') !== -1;
  });
}

/**
 * Return the number of leading spaces in a line.
 */
function indentOf(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

/**
 * Parse a workflow YAML file with a line-based scanner.
 *
 * Returns an array of violation objects:
 *   { file, job, stepIndex, stepName, runLine }
 *
 * A violation is a `run:` step whose command starts with `npm ` and that
 * does NOT have an effective `shell:` directive.  Effective shell is:
 *   step.shell ?? job.defaults.run.shell ?? workflow.defaults.run.shell
 *
 * Strategy:
 * 1. Walk lines top-to-bottom tracking workflow-level defaults.run.shell.
 * 2. Track job keys (jobs.<key>) and their defaults.run.shell.
 * 3. Detect step boundaries: a line matching /^\s+-\s+(name:|uses:|run:)/ at
 *    "step list" indentation (8 spaces for most workflows, detected
 *    dynamically) opens a new step context.
 * 4. Within a step context, collect all keys (name, run, shell, uses, …).
 * 5. At the END of each step context (next step boundary or end-of-job),
 *    emit a violation if `run` starts with `npm ` and effective shell is null.
 */
function findViolations(filePath) {
  const relFile = path.relative(REPO_ROOT, filePath);
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const violations = [];

  // Workflow-level defaults.run.shell
  let workflowDefaultShell = null;

  // ── State machine ─────────────────────────────────────────────────────────
  let inJobs = false;
  let currentJob = null;
  let jobDefaultShell = null;   // job-level defaults.run.shell

  // Section tracking for defaults blocks
  // We need to detect:
  //   defaults:         (at col 0 = workflow level, or col 2 = job level)
  //     run:
  //       shell: bash
  let inDefaultsBlock = false;    // currently inside a `defaults:` mapping
  let inDefaultsRunBlock = false; // currently inside `defaults: run:`
  let defaultsBlockOwner = null;  // 'workflow' or 'job'
  let defaultsBlockCol = null;    // column of the `defaults:` key

  // Strategy/matrix tracking
  let inStrategyBlock = false;
  let inMatrixBlock = false;
  let inMatrixOsBlock = false;
  let strategyCol = null;
  let matrixCol = null;

  // Step tracking
  let stepIndent = null;      // indent level of the `- name:/run:/uses:` items
  let inStep = false;
  let stepIndex = -1;
  let stepProps = null;       // { name, run, shell }

  /**
   * Flush the current step: emit a violation if it qualifies.
   * Effective shell = step.shell ?? jobDefaultShell ?? workflowDefaultShell
   */
  function flushStep() {
    if (!inStep || stepProps === null) return;
    const { name, run, shell } = stepProps;
    const effectiveShell = shell !== null ? shell
      : jobDefaultShell !== null ? jobDefaultShell
      : workflowDefaultShell;
    if (run !== null && /^\s*(?:npm|npx)(\s|$)/.test(run) && effectiveShell === null) {
      violations.push({
        file: relFile,
        job: currentJob,
        stepIndex,
        stepName: name || '(unnamed)',
      });
    }
    inStep = false;
    stepProps = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const col = indentOf(line);

    // Skip blank lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    // ── Workflow-level `defaults:` block (col 0) ──────────────────────────
    // Detect `defaults:` at the root level (before `jobs:`)
    if (!inJobs && /^defaults\s*:/.test(line)) {
      inDefaultsBlock = true;
      inDefaultsRunBlock = false;
      defaultsBlockOwner = 'workflow';
      defaultsBlockCol = 0;
      continue;
    }

    if (inDefaultsBlock && defaultsBlockOwner === 'workflow') {
      // A key at col 0 that isn't blank/comment ends the defaults block
      if (col === 0 && !/^\s/.test(line)) {
        inDefaultsBlock = false;
        inDefaultsRunBlock = false;
      } else if (/^\s+run\s*:/.test(line) && col === 2) {
        inDefaultsRunBlock = true;
      } else if (inDefaultsRunBlock && /^\s+shell\s*:\s*(\S+)/.test(line)) {
        const m = line.match(/^\s+shell\s*:\s*(\S+)/);
        if (m) workflowDefaultShell = m[1];
      }
    }

    // ── `jobs:` section ───────────────────────────────────────────────────
    if (/^jobs\s*:/.test(line)) {
      inJobs = true;
      inDefaultsBlock = false;
      inDefaultsRunBlock = false;
      continue;
    }

    if (!inJobs) continue;

    // ── Job-level keys at indent 2 ────────────────────────────────────────
    if (col === 2 && /^[a-zA-Z0-9_-]+\s*:/.test(trimmed)) {
      flushStep();
      currentJob = trimmed.replace(/\s*:.*/, '');
      stepIndent = null;
      inStep = false;
      stepIndex = -1;
      jobDefaultShell = null;
      // Reset sub-section tracking
      inDefaultsBlock = false;
      inDefaultsRunBlock = false;
      inStrategyBlock = false;
      inMatrixBlock = false;
      inMatrixOsBlock = false;
      continue;
    }

    if (currentJob === null) continue;

    // ── Job-level `defaults:` block (col 4) ──────────────────────────────
    if (col === 4 && /^defaults\s*:/.test(trimmed)) {
      inDefaultsBlock = true;
      inDefaultsRunBlock = false;
      defaultsBlockOwner = 'job';
      defaultsBlockCol = 4;
      continue;
    }

    if (inDefaultsBlock && defaultsBlockOwner === 'job') {
      if (col <= 4 && !/^\s{5}/.test(line)) {
        // Back to job level or above — end defaults block
        inDefaultsBlock = false;
        inDefaultsRunBlock = false;
      } else if (col === 6 && /^run\s*:/.test(trimmed)) {
        inDefaultsRunBlock = true;
      } else if (inDefaultsRunBlock && col === 8 && /^shell\s*:\s*(\S+)/.test(trimmed)) {
        const m = trimmed.match(/^shell\s*:\s*(\S+)/);
        if (m) jobDefaultShell = m[1];
      }
    }

    // ── Step list detection ───────────────────────────────────────────────
    const stepStartMatch = line.match(
      /^(\s+)-\s+(name|run|uses|shell|if|id|env|with|continue-on-error|timeout-minutes|working-directory)\s*[:\|]/,
    );
    if (stepStartMatch) {
      const thisIndent = stepStartMatch[1].length;

      if (stepIndent === null) {
        stepIndent = thisIndent;
      }

      if (thisIndent === stepIndent) {
        // New step boundary
        flushStep();
        stepIndex += 1;
        inStep = true;
        stepProps = { name: null, run: null, shell: null };
        // Reset defaults sub-tracking when we enter the steps section
        inDefaultsBlock = false;
        inDefaultsRunBlock = false;

        // Parse the key on this same line
        const keyMatch = line.match(/^\s+-\s+(name|run|shell|uses)\s*:\s*(.*)/);
        if (keyMatch) {
          const key = keyMatch[1];
          const val = keyMatch[2].trim();
          if (key === 'name') stepProps.name = val || null;
          else if (key === 'run') stepProps.run = val || null;
          else if (key === 'shell') stepProps.shell = val || null;
        }
        continue;
      }
    }

    // ── Inside a step: parse continuation key-value pairs ─────────────────
    if (inStep && stepIndent !== null && col > stepIndent) {
      const kvMatch = line.match(/^\s+(name|run|shell|uses)\s*:\s*(.*)/);
      if (kvMatch) {
        const key = kvMatch[1];
        const val = kvMatch[2].trim();
        if (key === 'run') {
          if (val && val !== '|') {
            stepProps.run = val;
          } else {
            // Multi-line run block — find first non-empty continuation line
            let j = i + 1;
            while (j < lines.length) {
              const contLine = lines[j];
              const contTrimmed = contLine.trimStart();
              if (contTrimmed === '' || contTrimmed.startsWith('#')) { j++; continue; }
              if (indentOf(contLine) <= col) break;
              stepProps.run = contTrimmed;
              break;
            }
          }
        } else if (key === 'shell') {
          stepProps.shell = val || null;
        } else if (key === 'name') {
          stepProps.name = val || null;
        }
      }
    }
  }

  // Flush the last step
  flushStep();

  return violations;
}

// ── Unit helper: scanner exercised against a synthetic YAML string ──────────

/**
 * Parse violation list from a raw YAML string (written to a temp file).
 * Used by the defaults.run.shell unit test below.
 */
function findViolationsInString(yamlContent) {
  const tmpPath = path.join(require('os').tmpdir(), `gsd-shell-test-${process.pid}.yml`);
  fs.writeFileSync(tmpPath, yamlContent, 'utf8');
  try {
    return findViolations(tmpPath);
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

// ── Test suite ──────────────────────────────────────────────────────────────

describe('GitHub Actions workflow shell pinning', () => {
  test('npm ci/run steps in workflow files must pin shell', () => {
    const workflowFiles = listWorkflowFiles();
    assert.ok(workflowFiles.length > 0, 'No windows-targeting workflow files found — check WORKFLOWS_DIR path');

    const allViolations = [];
    for (const wf of workflowFiles) {
      const v = findViolations(wf);
      allViolations.push(...v);
    }

    if (allViolations.length > 0) {
      const details = allViolations.map(
        (v) => `  jobs.${v.job}.steps[${v.stepIndex}].name = ${v.stepName}  (${v.file})`,
      ).join('\n');
      assert.fail(
        `${allViolations.length} npm run/ci step(s) are missing an explicit shell: directive.\n` +
        `On windows-latest, steps without shell: default to pwsh, which can swallow npm stderr.\n` +
        `Add  shell: bash  (or another explicit shell) to each listed step:\n\n` +
        details,
      );
    }
  });

  test('workflow-level defaults.run.shell satisfies shell requirement', () => {
    // A workflow with defaults.run.shell: bash at the root level should NOT
    // produce violations for npm steps that lack their own shell: directive.
    const yaml = `
name: Test
on: push
defaults:
  run:
    shell: bash
jobs:
  build:
    runs-on: windows-latest
    steps:
      - name: Install
        run: npm ci
      - name: Build
        run: npm run build
`.trimStart();
    const violations = findViolationsInString(yaml);
    assert.strictEqual(
      violations.length,
      0,
      `Expected 0 violations when workflow-level defaults.run.shell is set, got:\n` +
        violations.map((v) => `  steps[${v.stepIndex}] ${v.stepName}`).join('\n'),
    );
  });

  test('job-level defaults.run.shell satisfies shell requirement', () => {
    // A job with defaults.run.shell: bash should NOT produce violations for
    // npm steps in that job that lack their own shell: directive.
    const yaml = `
name: Test
on: push
jobs:
  build:
    runs-on: windows-latest
    defaults:
      run:
        shell: bash
    steps:
      - name: Install
        run: npm ci
      - name: Build
        run: npm run build
`.trimStart();
    const violations = findViolationsInString(yaml);
    assert.strictEqual(
      violations.length,
      0,
      `Expected 0 violations when job-level defaults.run.shell is set, got:\n` +
        violations.map((v) => `  steps[${v.stepIndex}] ${v.stepName}`).join('\n'),
    );
  });
});
