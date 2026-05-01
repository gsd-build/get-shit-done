/**
 * Regression test for bug #2966
 *
 * The release-sdk hotfix workflow's auto_cherry_pick loop aborts when a
 * `fix:`/`chore:` commit's patch is rooted in code that doesn't exist at
 * the hotfix's base tag (e.g. the surrounding block was added later in a
 * feat/refactor commit excluded by the filter). The conflict is
 * unresolvable — the patch literally cannot be applied to a tree that
 * lacks the surrounding infrastructure — but the workflow treats it as
 * an operator-resolvable conflict and exits.
 *
 * Fix: after `git cherry-pick` exits non-zero, inspect each unmerged
 * file's conflict markers. If every conflict block in every file has an
 * empty `<<<<<<< HEAD ... =======` HEAD section, run `git cherry-pick
 * --skip` and add the SHA to the skipped list with reason
 * "context absent at base". Else, fall through to the existing abort/
 * push-partial/error path.
 *
 * This test asserts both:
 *   1. Static — the auto_cherry_pick loop in release-sdk.yml carries the
 *      context-missing detection (matching `git cherry-pick --skip` and
 *      `context absent at base` semantics) so the no-source-grep static
 *      check is still meaningful for future edits.
 *   2. Behavioral — using a synthetic git repo that reproduces the exact
 *      shape of the failure on origin/main:
 *        a. A patch whose target context doesn't exist at base produces
 *           empty-HEAD conflict markers AND a non-zero exit from
 *           cherry-pick. (Proves the bug premise.)
 *        b. The `awk` predicate in the workflow correctly classifies the
 *           empty-HEAD case as "context-missing" (skippable) and the
 *           both-sides-have-content case as "real" (must abort).
 */

'use strict';

// allow-test-rule: source-text-is-the-product
// release-sdk.yml IS the product for hotfix automation; GitHub Actions
// executes the YAML's shell verbatim. The static check uses structured
// extraction (extractStepRun) rather than raw-text grep, scoped to the
// "Prepare hotfix branch" step's run block.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'release-sdk.yml');

/**
 * Extract the `run:` literal block of a named step from a GitHub Actions
 * workflow using indentation-aware parsing — no raw-text grep across the
 * whole document. Walks lines once, recognises `- name:` step headers and
 * `run: |` literal-block markers, and returns the unindented script body.
 *
 * No YAML library is used; the repo has none in dependencies and adding
 * one for a single test isn't justified.
 */
function extractStepRun(workflowText, stepName) {
  const lines = workflowText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)- name:\s*(.+?)\s*$/);
    if (!m || m[2] !== stepName) continue;
    const stepIndent = m[1].length;
    let j = i + 1;
    while (j < lines.length) {
      const peek = lines[j];
      if (/^\s*- /.test(peek)) {
        const peekIndent = peek.match(/^(\s*)/)[1].length;
        if (peekIndent <= stepIndent) break;
      }
      const runMatch = peek.match(/^(\s*)run:\s*\|(?:[+-])?\s*$/);
      if (runMatch) {
        const blockIndent = runMatch[1].length + 2;
        const body = [];
        for (let k = j + 1; k < lines.length; k++) {
          const bodyLine = lines[k];
          if (bodyLine.length === 0) {
            body.push('');
            continue;
          }
          const lead = bodyLine.match(/^(\s*)/)[1].length;
          if (lead < blockIndent && bodyLine.trim() !== '') break;
          body.push(bodyLine.slice(blockIndent));
        }
        return body.join('\n');
      }
      j++;
    }
    throw new Error(`step "${stepName}" found but no run: | block before step end`);
  }
  throw new Error(`step "${stepName}" not found in workflow`);
}

function git(cwd, args) {
  // Force-disable signing inline — a developer's global gpgsign config
  // can't be allowed to fail commits in this throwaway repo. Also pin
  // merge.conflictStyle=merge so the cherry-pick reproducer below sees
  // the same marker shape the workflow guards against (diff3/zdiff3 in
  // the developer or CI runner's global config would inject `|||||||`
  // sections and break the empty-HEAD assertion).
  const inlineConfig = [
    '-c', 'commit.gpgsign=false',
    '-c', 'tag.gpgsign=false',
    '-c', 'gpg.format=openpgp',
    '-c', 'user.signingkey=',
    '-c', 'merge.conflictStyle=merge',
  ];
  return spawnSync('git', [...inlineConfig, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 't@t' },
  });
}

describe('bug-2966: release-sdk hotfix cherry-pick classifies context-missing vs real conflicts for skip-reason annotation', () => {
  test('Prepare hotfix branch step classifies and annotates context-missing conflicts', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    // The loop must detect unmerged paths after a failed cherry-pick.
    assert.match(
      script,
      /git diff --name-only --diff-filter=U/,
      'auto_cherry_pick must read the unmerged path list after a failed cherry-pick to classify the conflict (#2966)'
    );
    // The empty-HEAD-section detector must be present.
    assert.match(
      script,
      /<<<<<<< /,
      'auto_cherry_pick must inspect conflict markers to classify context-missing vs real conflicts (#2966)'
    );
    // The skip path must call `git cherry-pick --skip` so the loop continues
    // past commits whose target context doesn't exist at the base tag.
    assert.match(
      script,
      /git cherry-pick --skip/,
      'auto_cherry_pick must invoke `git cherry-pick --skip` for context-missing conflicts so they don\'t brick the run (#2966)'
    );
    // The skipped list must annotate the reason so operators see it in the
    // run summary (not silently disappear).
    assert.match(
      script,
      /context absent at base/,
      'auto_cherry_pick must annotate skipped picks with "context absent at base" so the run summary surfaces them (#2966)'
    );
    // The cherry-pick must pin merge.conflictStyle=merge so the awk
    // classifier sees deterministic marker shapes regardless of the
    // runner's git config (diff3/zdiff3 would inject `||||||| ancestor`
    // lines into the HEAD section and misclassify context-missing
    // conflicts as real ones).
    assert.match(
      script,
      /git -c merge\.conflictStyle=merge cherry-pick/,
      'auto_cherry_pick must pin `merge.conflictStyle=merge` on the cherry-pick command so marker parsing is deterministic across runner git configs (#2966)'
    );
  });

  test('cherry-pick of a patch whose target section is absent at base produces empty-HEAD conflict markers and exits non-zero', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-2966-ctx-missing-'));
    try {
      assert.equal(git(tmp, ['init', '-q', '-b', 'main']).status, 0, 'git init');

      // Base — file exists but does NOT contain the section the patch will modify.
      fs.mkdirSync(path.join(tmp, '.github', 'workflows'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.github/workflows/x.yml'), 'name: base\njobs:\n  release:\n    runs-on: ubuntu-latest\n');
      assert.equal(git(tmp, ['add', '.']).status, 0, 'git add base');
      assert.equal(git(tmp, ['commit', '-q', '-m', 'base']).status, 0, 'commit base');
      assert.equal(git(tmp, ['tag', 'v0.0.0']).status, 0, 'tag base');

      // feat (excluded by fix/chore filter) — adds the prepare block.
      fs.writeFileSync(path.join(tmp, '.github/workflows/x.yml'),
        'name: base\njobs:\n  prepare:\n    run: |\n      git cherry-pick -x "$SHA"\n  release:\n    runs-on: ubuntu-latest\n');
      assert.equal(git(tmp, ['commit', '-qam', 'feat: add prepare block']).status, 0, 'commit feat');

      // fix — modifies the line inside the prepare block.
      const yaml = fs.readFileSync(path.join(tmp, '.github/workflows/x.yml'), 'utf8')
        .replace('git cherry-pick -x "$SHA"', 'git cherry-pick -x --allow-empty "$SHA"');
      fs.writeFileSync(path.join(tmp, '.github/workflows/x.yml'), yaml);
      assert.equal(git(tmp, ['commit', '-qam', 'fix: tweak cherry-pick']).status, 0, 'commit fix');
      const fixSha = git(tmp, ['rev-parse', 'HEAD']).stdout.trim();

      // Cherry-pick fix onto v0.0.0 — must conflict because target context isn't there.
      assert.equal(git(tmp, ['checkout', '-q', '-b', 'hotfix', 'v0.0.0']).status, 0, 'checkout hotfix');
      const pick = git(tmp, ['cherry-pick', '-x', '--allow-empty', '--keep-redundant-commits', fixSha]);
      assert.notEqual(
        pick.status,
        0,
        'cherry-pick of a patch whose target section is absent at base MUST exit non-zero (the bug premise: workflow currently treats this as a real conflict and aborts) (#2966)'
      );

      // Confirm conflict markers exist and the HEAD section is empty in every block.
      const conflicted = fs.readFileSync(path.join(tmp, '.github/workflows/x.yml'), 'utf8');
      assert.match(conflicted, /<<<<<<< /, 'conflict markers must be written to the file');
      // Every <<<<<<< HEAD ... ======= block must have empty HEAD content.
      const blocks = [];
      let inHead = false;
      let head = '';
      for (const line of conflicted.split('\n')) {
        if (/^<<<<<<< /.test(line)) { inHead = true; head = ''; continue; }
        if (/^=======$/.test(line) && inHead) { inHead = false; continue; }
        if (/^>>>>>>> /.test(line)) { blocks.push(head); head = ''; continue; }
        if (inHead) head += line + '\n';
      }
      assert.ok(blocks.length > 0, 'expected at least one conflict marker block');
      for (const b of blocks) {
        assert.equal(b.trim(), '', `expected every HEAD section to be empty (context-missing signal), got: ${JSON.stringify(b)}`);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('the awk predicate from the workflow classifies empty-HEAD as skippable and non-empty-HEAD as real', () => {
    // Pull the awk script out of the deployed workflow so this test
    // exercises the exact predicate that runs in CI — not a copy.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const awkMatch = script.match(/awk '\n([\s\S]+?)' "\$CONFLICTED"/);
    assert.ok(awkMatch, 'expected to find the conflict-classifying awk script in the workflow');
    const awkProgram = awkMatch[1];

    function classify(conflictText) {
      const tmpFile = path.join(os.tmpdir(), `bug-2966-awk-${process.pid}-${Date.now()}-${Math.random()}.txt`);
      fs.writeFileSync(tmpFile, conflictText);
      try {
        const r = spawnSync('awk', [awkProgram, tmpFile], { encoding: 'utf8' });
        // Fail loudly on awk execution errors — silently consuming an
        // empty stdout from a crashed/missing awk would let context-missing
        // assertions falsely pass.
        assert.ok(!r.error, `awk failed to launch: ${r.error && r.error.message}`);
        assert.equal(r.status, 0, `awk predicate exited non-zero: ${r.stderr || '(no stderr)'}`);
        return r.stdout.trim();
      } finally {
        fs.rmSync(tmpFile, { force: true });
      }
    }

    // Empty HEAD section → context-missing → no "real" emitted.
    const ctxMissing = [
      'unrelated line',
      '<<<<<<< HEAD',
      '=======',
      'patch wants this content',
      'and this',
      '>>>>>>> sha (msg)',
      'tail',
    ].join('\n');
    assert.equal(classify(ctxMissing), '', 'awk must classify empty-HEAD blocks as context-missing (no "real" emitted) (#2966)');

    // Non-empty HEAD section → real conflict.
    const realConflict = [
      '<<<<<<< HEAD',
      'VALUE=existing',
      '=======',
      'VALUE=patched',
      '>>>>>>> sha (msg)',
    ].join('\n');
    assert.equal(classify(realConflict), 'real', 'awk must classify non-empty-HEAD blocks as real conflicts (#2966)');

    // Mixed — first block empty-HEAD, second block real → real wins (overall classification).
    const mixed = [
      '<<<<<<< HEAD',
      '=======',
      'patch content',
      '>>>>>>> sha (msg)',
      'spacer',
      '<<<<<<< HEAD',
      'something existing',
      '=======',
      'something patched',
      '>>>>>>> sha (msg)',
    ].join('\n');
    assert.equal(classify(mixed), 'real', 'awk must report "real" if any conflict block has non-empty HEAD content (#2966)');

    // Whitespace-only HEAD section → context-missing (the awk predicate
    // treats blank/whitespace HEAD content the same as empty).
    const whitespaceHead = [
      '<<<<<<< HEAD',
      '   ',
      '\t',
      '=======',
      'patch content',
      '>>>>>>> sha (msg)',
    ].join('\n');
    assert.equal(classify(whitespaceHead), '', 'awk must classify whitespace-only HEAD blocks as context-missing (#2966)');
  });
});
