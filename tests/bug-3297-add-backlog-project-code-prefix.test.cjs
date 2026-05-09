// allow-test-rule: source-text-is-the-product — workflow .md files ARE what the
// runtime loads; asserting their behavioral contract tests the deployed skill
// surface, not implementation internals.

'use strict';

// Regression tests for bug #3297.
//
// `get-shit-done/workflows/add-backlog.md` (Step 4 — "Create the phase
// directory") creates the backlog phase directory inline:
//
//   SLUG=$(gsd-sdk query generate-slug "$ARGUMENTS" --raw)
//   mkdir -p ".planning/phases/${NEXT}-${SLUG}"
//
// This does NOT apply the `project_code` prefix from .planning/config.json,
// unlike phase.add / phase.insert (sdk/src/query/phase-lifecycle.ts:126,266,396
// and phase-lifecycle-policy.ts:114-122). For projects with project_code set,
// backlog dirs end up `999.1-foo` while active phases are `CK-01-foo`.
//
// This is the partial-fix-across-call-sites regression pattern uncovered by the
// PRED.k015 audit on top of #3287.
//
// Fix: read project_code via gsd-sdk and include the prefix in the mkdir path.
// When project_code is empty/null, the path is unchanged (no-op default).

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WORKFLOW = path.join(ROOT, 'get-shit-done', 'workflows', 'add-backlog.md');

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the body of every fenced code block from a markdown file.
 * Returns an array of { lang, body } in document order.
 */
function extractFencedCodeBlocks(md) {
  const blocks = [];
  const lines = md.split('\n');
  let inFence = false;
  let lang = '';
  let buf = [];
  for (const line of lines) {
    const fenceMatch = line.match(/^```(\S*)\s*$/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        lang = fenceMatch[1] || '';
        buf = [];
      } else {
        blocks.push({ lang, body: buf.join('\n') });
        inFence = false;
        lang = '';
        buf = [];
      }
      continue;
    }
    if (inFence) buf.push(line);
  }
  return blocks;
}

/** Concatenate all bash/shell code blocks into one string for path-construction analysis. */
function concatShellBlocks(md) {
  return extractFencedCodeBlocks(md)
    .filter((b) => b.lang === 'bash' || b.lang === 'sh' || b.lang === 'shell' || b.lang === '')
    .map((b) => b.body)
    .join('\n');
}

// ─── #3297: project_code prefix parity ───────────────────────────────────────

describe('#3297: add-backlog.md applies project_code prefix to phase directory', () => {
  test('workflow exists', () => {
    assert.ok(fs.existsSync(WORKFLOW), `${WORKFLOW} not found`);
  });

  test('reads project_code from config (config-get project_code)', () => {
    const md = fs.readFileSync(WORKFLOW, 'utf8');
    const shell = concatShellBlocks(md);
    // The workflow must read the project_code value from .planning/config.json
    // via the SDK. We accept any of the canonical config-get spellings.
    const reads =
      /gsd-sdk\s+query\s+config-get\s+project_code/.test(shell) ||
      /gsd-sdk\s+query\s+config\.get\s+project_code/.test(shell);
    assert.ok(
      reads,
      'add-backlog.md must read project_code via `gsd-sdk query config-get project_code` ' +
        'so the resulting phase directory matches phase.add / phase.insert prefixing.',
    );
  });

  test('every mkdir/touch path under .planning/phases includes the project_code prefix variable', () => {
    const md = fs.readFileSync(WORKFLOW, 'utf8');
    const shell = concatShellBlocks(md);

    // Find every line that builds a path under .planning/phases. We look for
    // either mkdir or touch operations that touch a phase directory.
    const phasePathLines = shell
      .split('\n')
      .map((l) => l.trim())
      .filter((l) =>
        /(mkdir|touch)\s.*\.planning\/phases\//.test(l) ||
          /(mkdir|touch)\s.*"\.planning\/phases\//.test(l),
      );

    assert.ok(
      phasePathLines.length > 0,
      'expected at least one mkdir/touch under .planning/phases in add-backlog.md',
    );

    // The path on each such line must reference some prefix variable that is
    // populated from project_code. We accept any shell-y spelling
    // (${PREFIX}, ${PROJECT_CODE_PREFIX}, ${PC_PREFIX}, etc.) — what matters
    // is that the literal "${NEXT}-${SLUG}" form (which omits the prefix) is gone.
    const offending = phasePathLines.filter((l) => {
      // Match the path inside the (optional) quotes on this line
      const pathMatch = l.match(/\.planning\/phases\/([^"\s]+)/);
      if (!pathMatch) return false;
      const dirExpr = pathMatch[1];
      // Must contain a $-expansion before ${NEXT} that represents the prefix.
      // Approve patterns like:
      //   ${PREFIX}${NEXT}-${SLUG}
      //   ${PREFIX:+${PREFIX}-}${NEXT}-${SLUG}
      //   ${PROJECT_CODE_PREFIX}${NEXT}-${SLUG}
      // Reject the bare `${NEXT}-${SLUG}` form.
      const startsWithPrefixVar = /^\$\{[A-Z_]*PREFIX[A-Z_]*[^}]*\}/.test(dirExpr);
      return !startsWithPrefixVar;
    });

    assert.deepEqual(
      offending,
      [],
      'add-backlog.md has phase-directory paths that do NOT prepend a project_code prefix variable. ' +
        'Each mkdir/touch under .planning/phases must use a path like ' +
        '"${PREFIX}${NEXT}-${SLUG}" (or equivalent) so projects with project_code set ' +
        "produce CK-999.1-foo, matching phase.add / phase.insert. " +
        `Offending lines:\n  ${offending.join('\n  ')}`,
    );
  });

  test('commit step files list also references prefixed phase path', () => {
    const md = fs.readFileSync(WORKFLOW, 'utf8');
    const shell = concatShellBlocks(md);

    // The commit step passes `--files` with the phase dir path; it must use
    // the same prefixed form as the mkdir, or the commit will fail to stage
    // the .gitkeep when project_code is set.
    const commitLines = shell
      .split('\n')
      .filter((l) => /gsd-sdk\s+query\s+commit/.test(l));
    assert.ok(commitLines.length > 0, 'expected a `gsd-sdk query commit` invocation in add-backlog.md');

    const offending = commitLines.filter((l) => {
      const m = l.match(/\.planning\/phases\/([^"\s]+)/);
      if (!m) return false;
      return !/^\$\{[A-Z_]*PREFIX[A-Z_]*[^}]*\}/.test(m[1]);
    });

    assert.deepEqual(
      offending,
      [],
      'commit step in add-backlog.md must reference the prefixed phase-dir path. ' +
        `Offending lines:\n  ${offending.join('\n  ')}`,
    );
  });
});
