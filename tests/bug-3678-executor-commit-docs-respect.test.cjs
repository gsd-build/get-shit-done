// allow-test-rule: source-text-is-the-product
// Three of the assertions in this file (A1, A2, C) inspect agent / workflow
// `.md` bodies. Those files ARE the runtime contract that GSD loads into agent
// prompts at run time, so source-text inspection is exactly what the
// `source-text-is-the-product` exception covers.
//
// The remaining assertions (B1, B2, B3) are behavioral — they invoke
// `gsd-tools commit` against a temp project and assert on its structured
// JSON return envelope plus the git index state. No raw-text matching on
// rendered output.

/**
 * Regression for #3678 — gsd-executor force-commits .planning/ files when
 * commit_docs is false.
 *
 * Root cause: the executor agent prompt (agents/gsd-executor.md) tells the
 * agent to call `gsd-sdk query commit "docs(...)" --files .planning/...`
 * in the per-plan final_commit block, but the prompt says nothing about
 * what to do when the SDK returns `{committed: false, skipped: true,
 * reason: 'skipped_commit_docs_false'}`. With no explicit instruction, the
 * agent improvises raw `git add` / `git commit` against `.planning/` paths
 * (and uses `-f` to bypass gitignore), which is exactly the leakage the
 * reporter observed.
 *
 * Fix surface:
 *   1. Agent prompt: explicit handling text in the final_commit section.
 *   2. SDK envelope: add `skipped: true` field so agents see "skipped" as a
 *      first-class success signal, not "committed is missing, must improvise."
 *   3. Structural guard: ban `git add -f` / `git add --force` from agent and
 *      workflow bodies entirely (no GSD-managed surface should force-stage
 *      gitignored content).
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createTempGitProject, cleanup, runGsdTools } = require('./helpers.cjs');

// Repo root resolution. This test file lives in `<repo>/tests/`. Use a single
// parent reference (the established repo-wide pattern, e.g. tests/helpers.cjs
// `path.resolve(__dirname, '..', 'get-shit-done', ...)`). A `.git`-anchored
// walker is not portable because the docker test mirror at `/work` strips the
// `.git/` directory before running tests.
const REPO_ROOT = path.resolve(__dirname, '..');

const EXECUTOR_AGENT = path.join(REPO_ROOT, 'agents', 'gsd-executor.md');

// Frozen reason enum mirrors the SDK source — keep in sync with
// `cmdCommit` in get-shit-done/bin/lib/commands.cjs.
const COMMIT_REASON = Object.freeze({
  SKIPPED_COMMIT_DOCS_FALSE: 'skipped_commit_docs_false',
  SKIPPED_GITIGNORED: 'skipped_gitignored',
});

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

describe('bug #3678 — executor must respect commit_docs:false', () => {

  describe('A — agent prompt teaches the agent how to handle commit_docs:false', () => {
    test('A1: agent body explicitly references the SDK skipped envelope', () => {
      const body = fs.readFileSync(EXECUTOR_AGENT, 'utf-8');
      // The prompt must contain at least one literal mention of the skipped
      // reason code OR the `committed: false` envelope so the agent knows
      // that skipping is an intentional control flow, not a failure to work
      // around.
      const mentionsSkipReason = body.includes(COMMIT_REASON.SKIPPED_COMMIT_DOCS_FALSE);
      const mentionsCommittedFalse = /committed:\s*false/i.test(body);
      const mentionsSkippedTrue = /skipped:\s*true/i.test(body);
      assert.ok(
        mentionsSkipReason || mentionsCommittedFalse || mentionsSkippedTrue,
        'agents/gsd-executor.md must teach the agent how to recognize the '
        + 'skipped envelope from `gsd-sdk query commit` (one of: '
        + `'${COMMIT_REASON.SKIPPED_COMMIT_DOCS_FALSE}', 'committed: false', `
        + "'skipped: true').",
      );
    });

    test('A2: agent body explicitly forbids raw git fallback when SDK skips', () => {
      const body = fs.readFileSync(EXECUTOR_AGENT, 'utf-8');
      // Look for an explicit instruction tying the SDK-skipped signal to the
      // forbidden-fallback rule. Accept any of three shapes the doc writer
      // might use: "do not", "must not", or "never" + a verb that names the
      // forbidden action.
      const forbidsFallbackText = /(do not|must not|never)\s+(fall back|fallback|use .*git add|run .*git commit|force[- ]?add)/i;
      assert.ok(
        forbidsFallbackText.test(body),
        'agents/gsd-executor.md must contain an explicit "do not fall back to '
        + 'raw git" instruction tied to the commit_docs:false / skipped envelope. '
        + 'Without it, the agent improvises raw `git add` / `git add -f` to '
        + 'fulfill its "complete plan" goal.',
      );
    });
  });

  describe('B — SDK behavior: commit_docs:false leaves repo state untouched', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = createTempGitProject();
      // .planning/ already exists from createTempGitProject's setup.
      // Set commit_docs to false on the config.
      const configPath = path.join(tmpDir, '.planning', 'config.json');
      let config = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
      config.commit_docs = false;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      // Make a token edit to .planning/STATE.md so there IS something the SDK
      // could in principle stage (or that an improvising agent could leak).
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');
      if (!fs.existsSync(statePath)) {
        fs.writeFileSync(statePath, '---\nproject: test\n---\n# State\n');
      }
      fs.appendFileSync(statePath, '\n<!-- token edit for #3678 repro -->\n');
    });

    afterEach(() => cleanup(tmpDir));

    test('B1: commit returns committed:false with skipped envelope', () => {
      const result = runGsdTools(
        'commit "docs(test): noop" --files .planning/STATE.md',
        tmpDir,
      );
      assert.ok(result.success, `gsd-tools commit should exit 0 even when skipped: ${result.error || ''}`);
      const envelope = JSON.parse(result.output);
      assert.strictEqual(envelope.committed, false, 'committed must be false when commit_docs is false');
      assert.strictEqual(
        envelope.skipped,
        true,
        'envelope must carry skipped:true so agents see skip as a first-class signal (envelope contract for #3678)',
      );
      assert.strictEqual(
        envelope.reason,
        COMMIT_REASON.SKIPPED_COMMIT_DOCS_FALSE,
        'reason must be the canonical skipped_commit_docs_false code (frozen enum)',
      );
    });

    test('B2: commit_docs:false leaves the git index empty (no .planning/ staged)', () => {
      runGsdTools(
        'commit "docs(test): noop" --files .planning/STATE.md',
        tmpDir,
      );
      const stagedAll = git(['diff', '--cached', '--name-only'], tmpDir);
      const stagedPlanning = stagedAll
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.startsWith('.planning/'));
      assert.deepStrictEqual(
        stagedPlanning,
        [],
        'no .planning/ files should be staged when commit_docs is false',
      );
    });

    test('B3: commit_docs:false produces no new commits', () => {
      const headBefore = git(['rev-parse', 'HEAD'], tmpDir).trim();
      runGsdTools(
        'commit "docs(test): noop" --files .planning/STATE.md',
        tmpDir,
      );
      const headAfter = git(['rev-parse', 'HEAD'], tmpDir).trim();
      assert.strictEqual(
        headAfter,
        headBefore,
        'HEAD must not advance when commit_docs is false',
      );
    });
  });

  test('checklist carve-out preserved for intentional skip', () => {
    const body = fs.readFileSync(EXECUTOR_AGENT, 'utf-8');
    const checklistLine = body
      .split('\n')
      .find(line => /Final metadata commit made/.test(line));
    assert.ok(
      checklistLine,
      'agents/gsd-executor.md must contain a "Final metadata commit made" checklist line',
    );
    assert.ok(
      checklistLine.includes('Final metadata commit'),
      'checklist line must reference "Final metadata commit"',
    );
    assert.ok(
      checklistLine.includes('skipped_commit_docs_false'),
      'checklist line must carve out the intentional-skip case by referencing '
      + '"skipped_commit_docs_false" — prevents executor from treating an '
      + 'unchecked mandatory box as a raw-git TODO (regression guard for #3679)',
    );
  });

  describe('C — structural ban on raw force-add in GSD-managed bodies', () => {
    function scanForForceAdd(rootDir) {
      const offenders = [];
      function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) { walk(full); continue; }
          if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
          const body = fs.readFileSync(full, 'utf-8');
          const lines = body.split('\n');
          const danger = lines.filter((line) => {
            if (!/git\s+add\s+(-f|--force)\b/.test(line)) return false;
            // Allow prohibition / warning sentences and code-fence prose that
            // frames `git add -f` AS the bug (so an audit comment doesn't
            // create a false positive).
            if (/(do not|don'?t|must not|never|forbidden|prohibited)/i.test(line)) return false;
            if (/(bug|wrong|incorrect|antipattern|anti-pattern|forces?\s+gitignored|leak)/i.test(line)) return false;
            return true;
          });
          if (danger.length > 0) {
            offenders.push({
              file: full.replace(REPO_ROOT + '/', ''),
              lines: danger.map(l => l.trim().slice(0, 120)),
            });
          }
        }
      }
      walk(rootDir);
      return offenders;
    }

    test('C1: no agent body contains `git add -f` / `git add --force`', () => {
      const offenders = scanForForceAdd(path.join(REPO_ROOT, 'agents'));
      assert.deepStrictEqual(
        offenders,
        [],
        'no agent body may use `git add -f` / `git add --force` outside a '
        + 'prohibition sentence — agents must never force-stage gitignored '
        + 'content (regression guard for #3678).',
      );
    });

    test('C2: no workflow body contains `git add -f` / `git add --force`', () => {
      const offenders = scanForForceAdd(path.join(REPO_ROOT, 'get-shit-done', 'workflows'));
      assert.deepStrictEqual(
        offenders,
        [],
        'no workflow body may use `git add -f` / `git add --force` outside a '
        + 'prohibition sentence (regression guard for #3678).',
      );
    });
  });
});
