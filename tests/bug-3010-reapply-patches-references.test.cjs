// allow-test-rule: source-text-is-the-product
// Reads .md and .js product files whose deployed text IS what the user
// sees — testing text content tests the deployed contract.

/**
 * Regression test for bug #3010
 *
 * After PR #2824 consolidated 86 skills into ~58, the standalone slash
 * command `/gsd-reapply-patches` was removed and folded into a flag on
 * `/gsd-update` (i.e. `/gsd-update --reapply`). The 1.39.1 hotfix (#2954)
 * fixed `help.md` to reflect the consolidated commands, but missed two
 * other surfaces that still printed/recommended the removed command:
 *
 *   1. `bin/install.js` — the post-install message (`reportLocalPatches`)
 *      told every runtime to "Run /gsd-reapply-patches", which is no
 *      longer a registered command and prints "Unknown command".
 *   2. `get-shit-done/workflows/update.md` Step 4 — the auto-commit text
 *      appended at the end of the `/gsd-update` flow recommended the
 *      same dead command.
 *   3. English `docs/USER-GUIDE.md`, `docs/manual-update.md`,
 *      `docs/ARCHITECTURE.md`, `docs/FEATURES.md`, `docs/INVENTORY.md`
 *      and the translated docs under `docs/{zh-CN,ja-JP,ko-KR}/` carried
 *      stale references in the same recommendation positions.
 *
 * Fix: every user-facing recommendation now points at `/gsd-update --reapply`.
 *
 * This test verifies the user-facing contract:
 * 1. `bin/install.js` source emits the consolidated form for every runtime.
 * 2. No file under `get-shit-done/workflows/` recommends running
 *    `/gsd-reapply-patches` (the historical "replaces the former" mention
 *    in `help.md` is allowed because it's the deprecation notice itself).
 * 3. No file under `docs/` recommends running `/gsd-reapply-patches`
 *    (CHANGELOG history references are excluded — they document the
 *    past and must not be rewritten).
 *
 * Defensive scope: the workflow file `reapply-patches.md` and code
 * comments naming the workflow file (`scripts/verify-reapply-patches.cjs`,
 * comments in `bin/install.js`) are NOT user-facing recommendations —
 * those reference the workflow's *implementation name*, which is
 * unchanged. Only strings that prompt the user to *run* the command
 * are in scope here.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const INSTALL_JS = path.join(ROOT, 'bin', 'install.js');
const WORKFLOWS_DIR = path.join(ROOT, 'get-shit-done', 'workflows');
const DOCS_DIR = path.join(ROOT, 'docs');

// Files that are allowed to mention the dead command for legitimate reasons:
//   - help.md   — explicitly documents that --reapply *replaces* the former
//                 standalone command. Removing this would erase the deprecation
//                 trail for users who still type the old form.
//   - CHANGELOG.md — historical entries describing past bugs/fixes referencing
//                 the old command name. Rewriting history would falsify
//                 release notes.
const ALLOWED_HISTORICAL_MENTIONS = new Set([
  path.join(WORKFLOWS_DIR, 'help.md'),
  path.join(ROOT, 'CHANGELOG.md'),
]);

function walkMd(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMd(full));
    else if (entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

describe('bug-3010: post-install message and docs recommend /gsd-update --reapply', () => {
  test('bin/install.js emits /gsd-update --reapply (no /gsd-reapply-patches recommendations)', () => {
    const src = fs.readFileSync(INSTALL_JS, 'utf-8');

    // Locate the reportLocalPatches function — that is the runtime emitter
    // a user sees after every install. Scope the assertion to that function
    // body only so historical doc-comments (e.g. JSDoc explaining the
    // verifier history) are not flagged. The function body runs from the
    // declaration line to the next top-level `function ` declaration.
    const fnStart = src.indexOf('function reportLocalPatches');
    assert.ok(fnStart >= 0, 'reportLocalPatches function must exist in bin/install.js');
    const afterFn = src.indexOf('\nfunction ', fnStart + 1);
    const fnBody = afterFn > 0 ? src.slice(fnStart, afterFn) : src.slice(fnStart);

    // The body must reference the consolidated command for every runtime
    // path. The negative assertion is what catches drift — adding a
    // forgotten `/gsd-reapply-patches` literal here regresses #3010.
    assert.ok(
      fnBody.includes('/gsd-update --reapply'),
      'reportLocalPatches must emit the consolidated /gsd-update --reapply form',
    );
    assert.ok(
      !fnBody.includes('/gsd-reapply-patches'),
      'reportLocalPatches must NOT emit the removed /gsd-reapply-patches command',
    );
    assert.ok(
      !fnBody.includes('/gsd:reapply-patches'),
      'reportLocalPatches must NOT emit the removed /gsd:reapply-patches Gemini-style command',
    );
    assert.ok(
      !fnBody.includes('$gsd-reapply-patches'),
      'reportLocalPatches must NOT emit the removed $gsd-reapply-patches Codex-style command',
    );
  });

  test('no workflow file recommends running /gsd-reapply-patches', () => {
    const workflowFiles = walkMd(WORKFLOWS_DIR);
    assert.ok(workflowFiles.length > 0, `expected workflow markdown files under ${WORKFLOWS_DIR}`);

    const offenders = [];
    for (const file of workflowFiles) {
      if (ALLOWED_HISTORICAL_MENTIONS.has(file)) continue;

      const src = fs.readFileSync(file, 'utf-8');
      // Strip HTML comments to avoid matching commented-out examples
      // and prose that quotes the old command for context.
      const stripped = src.replace(/<!--[\s\S]*?-->/g, '');
      // Match "/gsd-reapply-patches" with surrounding boundaries so we
      // don't false-positive on the workflow filename "reapply-patches.md"
      // or the script "verify-reapply-patches.cjs". The leading slash is
      // the slash-command marker — only command invocations carry it.
      const matches = stripped.match(/\/gsd-reapply-patches\b/g);
      if (matches) offenders.push(`${path.relative(ROOT, file)}: ${matches.length} mention(s)`);
    }

    assert.deepStrictEqual(
      offenders,
      [],
      'workflow files must not recommend the removed /gsd-reapply-patches command:\n  ' +
        offenders.join('\n  '),
    );
  });

  test('no doc under docs/ recommends running /gsd-reapply-patches (excluding CHANGELOG history)', () => {
    const docFiles = walkMd(DOCS_DIR);
    assert.ok(docFiles.length > 0, `expected docs under ${DOCS_DIR}`);

    const offenders = [];
    for (const file of docFiles) {
      if (ALLOWED_HISTORICAL_MENTIONS.has(file)) continue;

      const src = fs.readFileSync(file, 'utf-8');
      const stripped = src.replace(/<!--[\s\S]*?-->/g, '');
      // Match the slash-command form anchored on the slash. Bare
      // "reapply-patches" without the slash is not a user-typable
      // command and is allowed (e.g., file path references).
      const matches = stripped.match(/\/gsd-reapply-patches\b/g);
      if (matches) offenders.push(`${path.relative(ROOT, file)}: ${matches.length} mention(s)`);
    }

    assert.deepStrictEqual(
      offenders,
      [],
      'docs must not recommend the removed /gsd-reapply-patches command:\n  ' +
        offenders.join('\n  '),
    );
  });

  test('reportLocalPatches output text includes the consolidated form for every runtime branch', () => {
    // Functional check: dynamically require the installer, capture
    // console.log, and assert each runtime branch emits the new form.
    // This guards against future refactors that could re-introduce a
    // runtime-specific stale string the static text scan would miss.
    const { reportLocalPatches } = require(INSTALL_JS);
    assert.ok(typeof reportLocalPatches === 'function', 'reportLocalPatches must be exported');

    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-bug-3010-'));
    try {
      const patchesDir = path.join(tmpDir, 'gsd-local-patches');
      fs.mkdirSync(patchesDir, { recursive: true });
      fs.writeFileSync(
        path.join(patchesDir, 'backup-meta.json'),
        JSON.stringify({ from_version: '1.0', files: ['skills/gsd-test/SKILL.md'] }),
      );

      // Cover every runtime branch in the conditional. If a future refactor
      // splits or merges runtimes, this list must be updated alongside.
      // The runtime list intentionally enumerates each branch explicitly —
      // a parametric loop over an inferred runtime list could mask a
      // missing branch by silently skipping it.
      const runtimes = ['claude', 'opencode', 'kilo', 'copilot', 'gemini', 'codex', 'cursor'];
      for (const runtime of runtimes) {
        const logs = [];
        const originalLog = console.log;
        console.log = (...args) => logs.push(args.join(' '));
        try {
          reportLocalPatches(tmpDir, runtime);
        } finally {
          console.log = originalLog;
        }
        const output = logs.join('\n');
        assert.ok(
          output.includes('update --reapply'),
          `runtime ${runtime}: output must include the consolidated "update --reapply" form, got:\n${output}`,
        );
        assert.ok(
          !output.includes('/gsd-reapply-patches'),
          `runtime ${runtime}: output must not reference the removed /gsd-reapply-patches command, got:\n${output}`,
        );
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
