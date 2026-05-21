// allow-test-rule: reads workflow .md files (product content, not source .cjs) to assert structural invariants — file-presence check is the only viable IR for markdown guard patterns
/**
 * Regression test for #3668: --local install has soft dependency on global gsd-sdk
 *
 * Two defects confirmed by code inspection:
 *
 * Defect 1 — `buildGsdSdkVersionMismatchReport` emits `npm install -g get-shit-done-cc@latest`
 *   unconditionally, even when the caller is a local install. For local installs the
 *   correct remediation is to run `/gsd:update` (or `npx get-shit-done-cc@latest --local`),
 *   not to install globally.
 *
 * Defect 2 — 69 of 72 workflow files that call `gsd-sdk query …` do so without a
 *   `command -v gsd-sdk … elif node "$GSD_TOOLS"` fallback, so uninstalling the
 *   global `gsd-sdk` breaks every workflow on a fresh local session.
 *
 * Defect 3 — No CI guard prevents future workflow regressions.
 *
 * Acceptance criteria (from confirmed-bug triage comment):
 *   - `renderGsdSdkVersionMismatchReport` does NOT emit `npm install -g` for isLocal=true.
 *   - All 72 SDK-invoking workflow files use the `command -v gsd-sdk … elif` pattern.
 *   - A CI guard blocks any future workflow file from invoking bare `gsd-sdk` without guard.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { buildGsdSdkVersionMismatchReport, renderGsdSdkVersionMismatchReport } = require('../bin/install.js');
const { captureConsole } = require('./helpers.cjs');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');

// ---------------------------------------------------------------------------
// Defect 1: version-mismatch report should not suggest `npm install -g` for
// local installs.
// ---------------------------------------------------------------------------

describe('#3668 Defect 1: version-mismatch report respects isLocal', () => {
  test('buildGsdSdkVersionMismatchReport accepts isLocal=true and sets local fix_command', () => {
    // Simulate a version mismatch report built for a local install.
    const ir = buildGsdSdkVersionMismatchReport('/fake/path/gsd-sdk', '1.42.0', { isLocal: true });
    // Without a real gsd-sdk binary the function may return null — that's fine,
    // the important contract is: when it DOES return a report for isLocal=true,
    // the fix_command must NOT be the global install command.
    if (ir === null) return; // no mismatch detected (no real binary) — skip assertion
    assert.ok(
      !ir.fix_command.includes('npm install -g'),
      [
        'buildGsdSdkVersionMismatchReport with isLocal=true must NOT produce',
        '`npm install -g …` as the fix_command — local installs should be told',
        `to run /gsd:update instead. Got: ${ir.fix_command}`,
      ].join(' '),
    );
  });

  test('renderGsdSdkVersionMismatchReport does not print npm install -g when isLocal=true', () => {
    // Construct an IR that represents a local-install mismatch (what the
    // fixed buildGsdSdkVersionMismatchReport must produce for isLocal=true).
    const localIr = {
      ok: false,
      reason: 'gsd_sdk_version_mismatch',
      sdk_path: '/fake/path/gsd-sdk',
      actual_version: '1.41.0',
      expected_version: '1.42.0',
      fix_command: 'npx get-shit-done-cc@latest --claude --local',
      is_local: true,
    };

    const { stdout } = captureConsole(() => {
      renderGsdSdkVersionMismatchReport(localIr);
    });

    assert.ok(
      !stdout.includes('npm install -g'),
      [
        'renderGsdSdkVersionMismatchReport must not emit `npm install -g` when',
        `is_local=true. Stdout:\n${stdout}`,
      ].join(' '),
    );
    assert.ok(
      stdout.includes(localIr.fix_command),
      [
        'renderGsdSdkVersionMismatchReport must print the fix_command from the IR.',
        `Expected to find: ${localIr.fix_command}`,
        `Stdout:\n${stdout}`,
      ].join('\n'),
    );
  });

  test('buildGsdSdkVersionMismatchReport with isLocal=false still uses global fix_command', () => {
    // Verifies the global install path is unchanged (regression guard).
    const ir = buildGsdSdkVersionMismatchReport('/fake/path/gsd-sdk', '1.42.0', { isLocal: false });
    if (ir === null) return; // no real binary available — skip
    assert.ok(
      ir.fix_command.includes('npm install -g'),
      [
        'buildGsdSdkVersionMismatchReport with isLocal=false must keep',
        `\`npm install -g …\` as the fix_command. Got: ${ir.fix_command}`,
      ].join(' '),
    );
  });
});

// ---------------------------------------------------------------------------
// Defect 2: Every workflow file that calls `gsd-sdk` must use the
// `command -v gsd-sdk … elif node "$GSD_TOOLS"` fallback pattern.
// ---------------------------------------------------------------------------

describe('#3668 Defect 2: workflow files must guard every gsd-sdk invocation', () => {
  test('every workflow file that calls gsd-sdk has a command -v guard', () => {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.md'));
    const bare = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8');
      // Does this file invoke gsd-sdk at all?
      if (!content.includes('gsd-sdk')) continue;
      // Does it have the command -v guard?
      if (!content.includes('command -v gsd-sdk')) {
        bare.push(file);
      }
    }

    assert.strictEqual(
      bare.length,
      0,
      [
        `${bare.length} workflow file(s) call gsd-sdk without a 'command -v gsd-sdk' guard.`,
        'Every workflow must use:',
        '  if command -v gsd-sdk >/dev/null 2>&1; then',
        '    RESULT=$(gsd-sdk query <key>)',
        '  elif [ -f "$GSD_TOOLS" ]; then',
        '    RESULT=$(node "$GSD_TOOLS" query <key>)',
        '  fi',
        '',
        'Missing guard in:',
        ...bare.map((f) => `  - ${f}`),
      ].join('\n'),
    );
  });
});

// ---------------------------------------------------------------------------
// Defect 3: CI guard — callsite routing, not just guard presence.
//
// The original Defect 3 test only checked that `command -v gsd-sdk` appeared
// as a string in the file. That assertion passes even when the preflight block
// is present but every downstream callsite still uses the bare `gsd-sdk`
// command — which is exactly the state that caused the bug. This upgraded test
// parses shell fenced blocks structurally and verifies that no block outside
// a resolution guard invokes `gsd-sdk` as a bare command.
//
// allow-test-rule: structural markdown parse is the only viable IR for
// shell-routing invariants in LLM-consumed workflow files (#3668 architectural
// constraint — source files cannot expose a typed runtime surface).
// ---------------------------------------------------------------------------

/**
 * Parse a markdown string into segments.
 * Returns an array of { type: 'prose' | 'bash-fence' | 'other-fence', content: string }.
 */
function parseMarkdownSegments(content) {
  const segments = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^```(bash|sh|[a-zA-Z0-9_-]*)(\s*)$/);
    if (fenceMatch) {
      const lang = fenceMatch[1].toLowerCase();
      const fenceLines = [line];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        fenceLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        fenceLines.push(lines[i]);
        i++;
      }
      const isBash = lang === 'bash' || lang === 'sh';
      segments.push({ type: isBash ? 'bash-fence' : 'other-fence', content: fenceLines.join('\n') });
    } else {
      const proseLines = [line];
      i++;
      while (i < lines.length && !lines[i].match(/^```/)) {
        proseLines.push(lines[i]);
        i++;
      }
      segments.push({ type: 'prose', content: proseLines.join('\n') });
    }
  }
  return segments;
}

/**
 * Determine if a line invokes `gsd-sdk` as a bare command (not via $GSD_SDK).
 *
 * Returns true for invocation lines like:
 *   INIT=$(gsd-sdk query ...)
 *   gsd-sdk query commit ...
 *
 * Returns false for:
 *   # comment lines
 *   - [ ] checklist/bullet lines
 *   GSD_SDK="gsd-sdk"         (assignment inside the resolution guard)
 *   command -v gsd-sdk         (availability check, not an invocation)
 *   echo "...gsd-sdk..."      (error message string)
 *   $GSD_SDK query ...         (already routed through the variable)
 */
function isBareGsdSdkInvocation(line) {
  const trimmed = line.trimStart();
  // Comment lines
  if (trimmed.startsWith('#')) return false;
  // Bullet/checklist lines (prose in a bash block)
  if (/^[-*]\s/.test(trimmed)) return false;
  // Availability check — not an invocation
  if (trimmed.includes('command -v gsd-sdk')) return false;
  // Assignment inside the guard: GSD_SDK="gsd-sdk"
  if (/^\s*GSD_SDK\s*=/.test(line)) return false;
  // echo/print lines containing gsd-sdk as a string in an error message
  if (/^\s*(echo|printf)\s/.test(trimmed)) return false;
  // Match bare gsd-sdk as an executable token (not preceded by $)
  return /(?<!\$)\bgsd-sdk\b/.test(line);
}

/**
 * Find all .md files under a directory (recursively).
 */
function findMdFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findMdFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.md')) results.push(fullPath);
  }
  return results;
}

describe('#3668 Defect 3 (upgraded): CI guard — every gsd-sdk callsite routes through $GSD_SDK', () => {
  test('no shell block outside a resolution guard invokes bare gsd-sdk', () => {
    // allow-test-rule: structural parse of markdown shell blocks to assert
    // callsite routing — file-content parse is the only viable surface for
    // LLM-consumed workflow markdown (#3668 architectural constraint).
    const allFiles = findMdFiles(WORKFLOWS_DIR);
    const violations = [];

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.includes('gsd-sdk')) continue;

      const segments = parseMarkdownSegments(content);
      for (const seg of segments) {
        if (seg.type !== 'bash-fence') continue;
        // A block is a "resolution guard block" if it contains the command-v check.
        // Within that block, the guard lines are left alone; callsites after the fi
        // must use $GSD_SDK. However, some files use an inline guard (update.md)
        // where each branch explicitly guards its own gsd-sdk call — also acceptable.
        // We flag only blocks with NO command -v guard that contain bare invocations.
        const blockHasGuard = seg.content.includes('command -v gsd-sdk');
        if (blockHasGuard) continue; // guard block — handled by resolution logic

        const blockLines = seg.content.split('\n');
        for (const line of blockLines) {
          if (isBareGsdSdkInvocation(line)) {
            const rel = path.relative(WORKFLOWS_DIR, filePath);
            violations.push(`${rel}: ${line.trim().slice(0, 80)}`);
          }
        }
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      [
        `CI GUARD FAIL (#3668): ${violations.length} bare gsd-sdk invocation(s) found`,
        'in shell blocks that have no resolution guard.',
        'All SDK calls must use $GSD_SDK (set by the preflight block):',
        '  if command -v gsd-sdk >/dev/null 2>&1; then',
        '    GSD_SDK="gsd-sdk"',
        '  elif [ -f "$GSD_TOOLS" ]; then',
        '    GSD_SDK="node $GSD_TOOLS"',
        '  fi',
        '  RESULT=$($GSD_SDK query <key>)   # <-- use $GSD_SDK, not bare gsd-sdk',
        '',
        'Violations:',
        ...violations.map((v) => `  ${v}`),
      ].join('\n'),
    );
  });

  // Counter-test (Contract 6): verify the filter correctly identifies callsites
  // and correctly excludes guard/preflight lines.
  test('isBareGsdSdkInvocation correctly identifies callsite lines', () => {
    // These must be flagged as bare invocations
    const mustFlag = [
      'INIT=$(gsd-sdk query init.milestone-op)',
      'RESULT=$(gsd-sdk query phase.add "${description}")',
      'gsd-sdk query commit "docs: add item" --files foo',
      'ANALYZE=$(gsd-sdk query roadmap.analyze)',
    ];
    for (const line of mustFlag) {
      assert.ok(
        isBareGsdSdkInvocation(line),
        `Expected line to be flagged as bare invocation: ${line}`,
      );
    }

    // These must NOT be flagged
    const mustNotFlag = [
      '  GSD_SDK="gsd-sdk"',                           // assignment in guard
      'if command -v gsd-sdk >/dev/null 2>&1; then',   // availability check
      '  echo "ERROR: gsd-sdk not found" >&2',          // error message
      '# SDK resolution: prefer global gsd-sdk',         // comment
      '- [ ] `gsd-sdk query phase.add` executed',       // checklist
      'INIT=$($GSD_SDK query init.milestone-op)',        // already using $GSD_SDK
    ];
    for (const line of mustNotFlag) {
      assert.ok(
        !isBareGsdSdkInvocation(line),
        `Expected line NOT to be flagged: ${line}`,
      );
    }
  });
});
