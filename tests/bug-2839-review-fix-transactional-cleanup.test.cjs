/**
 * Regression test for bug #2839
 *
 * /gsd-code-review-fix cleanup tail is non-transactional. If the agent is
 * interrupted (system restart, OOM kill) AFTER the last fix commit but
 * BEFORE `git worktree remove`, the worktree is orphaned in
 * `git worktree list`, the agent's branch is left with unmerged commits,
 * and STATE.md is never advanced. To anyone reading main only, the phase
 * looks "ready to plan" while critical fixes sit on a dangling branch.
 *
 * Fix: introduce a recovery sentinel JSON at
 *   ${PHASE_DIR}/.review-fix-recovery-pending.json
 * The sentinel is written AFTER `git worktree add` succeeds and
 * REMOVED only after `git worktree remove` completes, so the cleanup
 * tail is transactional from the orchestrator's perspective. If the
 * process dies in between, the sentinel is left behind pointing at the
 * orphan worktree and branch — a future run, /gsd-resume-work, or
 * /gsd-progress can detect and complete the recovery.
 */

'use strict';

// allow-test-rule: source-text-is-the-product
// The gsd-code-fixer agent's working instructions ARE the product — Claude
// follows them at runtime. Structural assertions over the markdown source
// test the deployed contract. See bug-2686 for the same pattern.

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SENTINEL_NAME = '.review-fix-recovery-pending.json';

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const body = match[1];
  const out = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function extractStep(content, stepName) {
  const re = new RegExp(`<step\\s+name="${stepName}">([\\s\\S]*?)</step>`);
  const m = content.match(re);
  return m ? m[1] : null;
}

describe('bug-2839: /gsd-code-review-fix cleanup is transactional', () => {
  let agentPath;
  let agentContent;
  let frontmatter;

  before(() => {
    agentPath = path.join(__dirname, '..', 'agents', 'gsd-code-fixer.md');
    assert.ok(fs.existsSync(agentPath), 'agents/gsd-code-fixer.md must exist');
    agentContent = fs.readFileSync(agentPath, 'utf-8');
    frontmatter = parseFrontmatter(agentContent);
    assert.ok(frontmatter, 'agent must have YAML frontmatter');
  });

  test('agent declares a recovery sentinel filename', () => {
    assert.ok(
      agentContent.includes(SENTINEL_NAME),
      `gsd-code-fixer.md must reference the recovery sentinel ${SENTINEL_NAME} so an interrupted cleanup tail is discoverable (#2839)`
    );
  });

  test('sentinel is written inside setup_worktree, after git worktree add', () => {
    const setupStep = extractStep(agentContent, 'setup_worktree');
    assert.ok(setupStep, 'setup_worktree step must exist');

    assert.ok(
      setupStep.includes(SENTINEL_NAME),
      `setup_worktree must reference ${SENTINEL_NAME} so the sentinel is created at the start of the run (#2839)`
    );

    const addPos = setupStep.indexOf('git worktree add');
    assert.ok(addPos !== -1, 'setup_worktree must contain `git worktree add`');

    // The sentinel WRITE (not just a reference) must come after `git worktree add`.
    // Earlier references are allowed (e.g. recovery check for a stale sentinel
    // from a prior interrupted run). Look for an explicit write — either a
    // shell `>`/`>>` redirection, a `node -e` invocation that uses
    // `fs.writeFileSync(...sentinel...)`, or a `Write` tool reference.
    const writeIdx = (() => {
      const candidates = [
        /fs\.writeFileSync\([^)]*sentinel/,
        />\s*"?\$sentinel/,
        />\s*"?\$\{sentinel\}/,
        /Write the recovery sentinel/i,
      ];
      let earliest = -1;
      for (const re of candidates) {
        const m = re.exec(setupStep);
        if (m && (earliest === -1 || m.index < earliest)) earliest = m.index;
      }
      return earliest;
    })();
    assert.ok(
      writeIdx !== -1,
      'setup_worktree must explicitly describe writing the sentinel (#2839)'
    );
    assert.ok(
      addPos < writeIdx,
      'sentinel must be written AFTER `git worktree add` succeeds (#2839)'
    );
  });

  test('sentinel records worktree path, branch, and padded_phase as JSON fields', () => {
    for (const key of ['worktree_path', 'branch', 'padded_phase']) {
      assert.ok(
        agentContent.includes(key),
        `recovery sentinel must record \`${key}\` so a future /gsd-resume-work or /gsd-progress can locate the orphan state (#2839)`
      );
    }
  });

  test('sentinel removal happens only AFTER git worktree remove succeeds', () => {
    const setupStep = extractStep(agentContent, 'setup_worktree');
    assert.ok(setupStep, 'setup_worktree step must exist');

    const cleanupAnchor = setupStep.lastIndexOf('Cleanup tail (transactional');
    assert.ok(cleanupAnchor !== -1, 'setup_worktree must document cleanup-tail section');
    const cleanupSection = setupStep.slice(cleanupAnchor);

    const removeIdx = cleanupSection.indexOf('git worktree remove "$wt" --force');
    assert.ok(removeIdx !== -1, 'cleanup-tail must remove worktree');

    // Within the cleanup-tail section, accept either a literal-filename form
    // (`rm -f .../.review-fix-recovery-pending.json`) or a shell-variable form
    // referring to the previously-declared `sentinel` variable
    // (`rm -f "$sentinel"` / `rm -f "${sentinel}"`).
    const escapedName = SENTINEL_NAME.replace(/\./g, '\\.');
    const sentinelRemovalRe = new RegExp(
      `(rm\\s+(?:-f\\s+)?[^\\n]*(?:${escapedName}|\\$\\{?sentinel\\}?)|unlink[^\\n]*(?:${escapedName}|\\$\\{?sentinel\\}?))`
    );
    const sentinelRemovalMatch = sentinelRemovalRe.exec(cleanupSection);
    assert.ok(
      sentinelRemovalMatch,
      `agent must remove the sentinel file (rm or unlink ${SENTINEL_NAME}) as part of the cleanup tail (#2839)`
    );
    const sentinelRemovalIdx = sentinelRemovalMatch.index;

    assert.ok(
      removeIdx < sentinelRemovalIdx,
      'cleanup ordering must be: `git worktree remove` BEFORE sentinel removal (#2839)'
    );
  });

  test('agent documents detection of pre-existing sentinel from a prior interrupted run', () => {
    const lower = agentContent.toLowerCase();
    const mentionsRecovery =
      lower.includes('stale sentinel') ||
      lower.includes('existing sentinel') ||
      lower.includes('previous sentinel') ||
      lower.includes('prior run') ||
      lower.includes('pre-existing sentinel') ||
      lower.includes('recovery');
    assert.ok(
      mentionsRecovery,
      'agent must describe how it handles a pre-existing sentinel from a previous interrupted run (#2839)'
    );
  });

  test('cleanup-tail obligation is documented as transactional / atomic', () => {
    const lower = agentContent.toLowerCase();
    const mentionsTransactional =
      lower.includes('transactional') ||
      lower.includes('atomic cleanup') ||
      lower.includes('cleanup tail');
    assert.ok(
      mentionsTransactional,
      'agent must document the cleanup tail as transactional/atomic (#2839)'
    );
  });
});
