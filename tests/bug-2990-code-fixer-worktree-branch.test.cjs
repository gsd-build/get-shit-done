'use strict';

// allow-test-rule: source-text-is-the-product
// agents/gsd-code-fixer.md is the deployed agent definition the runtime
// loads. Parsing its bash code blocks into structured invocation records
// (extractCleanupGitInvocations + the recovery-block parsers below) IS
// testing the runtime contract — what command sequence the agent
// actually documents and executes. The .match() calls extract typed
// fields from a known-shape product file, then assertions go against
// those typed fields, not against the raw markdown text.

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2990: gsd-code-fixer worktree setup fails when current branch
 * is already checked out in the main repo.
 *
 * The original agent definition called `git worktree add "$wt" "$branch"`,
 * where `$branch` was the user's currently-checked-out branch. Git refuses
 * to check out the same branch in two worktrees by default, so the setup
 * failed before the agent could do any work.
 *
 * Fix: create a NEW branch `gsd-reviewfix/${padded_phase}-$$` and attach
 * the worktree to it via `git worktree add -b "$reviewfix_branch" "$wt"
 * "$branch"`. The cleanup tail then fast-forwards `$branch` to
 * `$reviewfix_branch` so the user's branch captures the agent's commits.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AGENT_PATH = path.join(__dirname, '..', 'agents', 'gsd-code-fixer.md');

function parseWorktreeAddInvocations(markdown) {
  // Pull `git worktree add ...` calls and classify each into structured
  // records: hasNewBranchFlag (uses -b $reviewfix_branch) vs attachesToBareBranch
  // ($wt $branch). Skip occurrences inside markdown inline code (backticks)
  // or bash comments -- those are documentation citations of the OLD broken
  // pattern, not executable instructions.
  const invocations = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const idx = line.indexOf('git worktree add');
    if (idx === -1) continue;
    // Skip if inside backticks: the substring up to the match has an odd
    // number of backticks, the call is inside an inline code span.
    const before = line.slice(0, idx);
    const backticksBefore = (before.match(/`/g) || []).length;
    if (backticksBefore % 2 === 1) continue;
    // Skip if the line is a bash comment (after stripping leading whitespace).
    if (line.trimStart().startsWith('#')) continue;
    const argstr = line.slice(idx + 'git worktree add'.length).trim();
    invocations.push({
      raw: argstr,
      hasNewBranchFlag: /(?:^|\s)-b\s+["']?\$reviewfix_branch["']?/.test(argstr),
      attachesToBareBranch: /^["']?\$wt["']?\s+["']?\$branch["']?\b/.test(argstr),
    });
  }
  return invocations;
}

describe('Bug #2990: gsd-code-fixer worktree attaches to a NEW branch, not the user-checked-out one', () => {
  const md = fs.readFileSync(AGENT_PATH, 'utf-8');
  const invocations = parseWorktreeAddInvocations(md);

  test('sanity: at least one git-worktree-add invocation exists in the agent definition', () => {
    assert.ok(invocations.length > 0,
      'expected gsd-code-fixer.md to document at least one git worktree add invocation');
  });

  test('every git-worktree-add invocation uses -b $reviewfix_branch (not bare $branch)', () => {
    const violations = invocations.filter(inv => inv.attachesToBareBranch);
    assert.deepEqual(
      violations.map(v => v.raw),
      [],
      `worktree-add invocations attaching to bare $branch (#2990): ${JSON.stringify(violations.map(v => v.raw), null, 2)}`,
    );
  });

  test('the canonical setup invocation uses -b "$reviewfix_branch" "$wt" "$branch"', () => {
    const setupInvocations = invocations.filter(inv => inv.hasNewBranchFlag);
    assert.ok(setupInvocations.length >= 1,
      `expected at least one git-worktree-add invocation with -b "$reviewfix_branch" -- found: ${JSON.stringify(invocations.map(i => i.raw), null, 2)}`);
  });
});

/**
 * Extract the cleanup-tail bash block from the agent .md, then parse it into
 * an ordered array of `git ...` invocation records. Per-record assertions go
 * against the structured records, not the raw markdown text. Anchor on the
 * "Cleanup tail" header to scope to the right block (the file has multiple
 * fenced bash blocks; we only want the cleanup one).
 */
function extractCleanupGitInvocations(markdown) {
  // Find the cleanup tail header and the fenced bash block that follows.
  const headerIdx = markdown.indexOf('**Cleanup tail (transactional');
  if (headerIdx === -1) return null;
  const fenceStart = markdown.indexOf('```bash', headerIdx);
  if (fenceStart === -1) return null;
  const fenceEnd = markdown.indexOf('```', fenceStart + '```bash'.length);
  if (fenceEnd === -1) return null;
  const block = markdown.slice(fenceStart + '```bash'.length, fenceEnd);

  // Tokenize each non-comment, non-blank line into structured records.
  const lines = block.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const records = [];
  for (const line of lines) {
    // Skip occurrences inside backticks (these would be inline-code
    // citations of the OLD pattern, not executable). The cleanup fenced
    // block is bash, but inline backticks can still appear inside echo
    // strings — guard anyway.
    const ticksBefore = (line.match(/`/g) || []).length;
    if (ticksBefore && ticksBefore % 2 === 1) continue;
    if (!line.includes('git ') && !line.startsWith('git ')) continue;
    records.push({
      raw: line,
      // Strip leading `git -C "..."`/`git -C $main_repo` so the verb-only
      // form stays comparable across direct and -C invocations.
      verb: (() => {
        const m = line.match(/^git\s+(?:-C\s+\S+\s+)?(\S+)/);
        return m ? m[1] : null;
      })(),
      // Did this line target the temp reviewfix branch by variable name?
      targetsReviewfixBranch: /\$reviewfix_branch\b/.test(line) || /"\$reviewfix_branch"/.test(line),
      // Is this the merge step? Captures the flag too.
      isMergeFfOnly: /\bmerge\s+--ff-only\b/.test(line),
      // Is this the branch-delete step?
      isBranchDelete: /\bbranch\s+-D\b/.test(line),
    });
  }
  return records;
}

describe('Bug #2990: cleanup tail fast-forwards $branch and deletes the temp branch on success', () => {
  const md = fs.readFileSync(AGENT_PATH, 'utf-8');
  const records = extractCleanupGitInvocations(md);

  test('cleanup tail bash block exists and is parseable', () => {
    assert.notEqual(records, null, 'expected to find a "Cleanup tail" bash block in agents/gsd-code-fixer.md');
    assert.ok(records.length > 0, 'expected at least one git invocation in the cleanup tail');
  });

  test('cleanup contains exactly one merge --ff-only against $reviewfix_branch', () => {
    const merges = records.filter(r => r.isMergeFfOnly);
    assert.equal(merges.length, 1, `expected exactly 1 ff-only merge, got ${merges.length}: ${JSON.stringify(merges, null, 2)}`);
    assert.equal(merges[0].targetsReviewfixBranch, true, 'merge --ff-only must target $reviewfix_branch');
  });

  test('cleanup contains exactly one git branch -D for $reviewfix_branch', () => {
    const deletes = records.filter(r => r.isBranchDelete);
    assert.equal(deletes.length, 1, `expected exactly 1 branch -D, got ${deletes.length}`);
    assert.equal(deletes[0].targetsReviewfixBranch, true, 'branch -D must target $reviewfix_branch');
  });

  test('merge --ff-only precedes branch -D in the cleanup ordering', () => {
    const mergeIdx = records.findIndex(r => r.isMergeFfOnly);
    const deleteIdx = records.findIndex(r => r.isBranchDelete);
    assert.ok(mergeIdx >= 0 && deleteIdx >= 0);
    assert.ok(mergeIdx < deleteIdx,
      `merge must run before branch delete (merge=${mergeIdx}, delete=${deleteIdx}); otherwise commits could be lost on merge failure`);
  });

  test('recovery sentinel JSON shape records reviewfix_branch alongside worktree_path', () => {
    // Find the writeFileSync call that constructs the sentinel JSON.
    // Parse the JSON.stringify argument list to extract the field names.
    const match = md.match(/fs\.writeFileSync\(sentinelPath,\s*JSON\.stringify\(\{([^}]+)\}/);
    assert.notEqual(match, null, 'expected JSON.stringify({...}) inside the sentinel write');
    const fields = match[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);
    assert.ok(fields.includes('reviewfix_branch'),
      `recovery sentinel must record reviewfix_branch alongside worktree_path; fields=${JSON.stringify(fields)}`);
    assert.ok(fields.includes('worktree_path'),
      `recovery sentinel must record worktree_path; fields=${JSON.stringify(fields)}`);
  });
});

describe('Bug #2990 (#3001 CR): recovery code reads reviewfix_branch from sentinel and deletes the orphan branch', () => {
  const md = fs.readFileSync(AGENT_PATH, 'utf-8');

  test('recovery node script extracts reviewfix_branch from parsed sentinel', () => {
    // Find the recovery `node -e '...'` block (NOT the sentinel-write one).
    // Anchor on "recovery sentinel from a prior interrupted run".
    const headerIdx = md.indexOf('Detected pre-existing recovery sentinel');
    assert.notEqual(headerIdx, -1);
    const nodeStart = md.indexOf("node -e '", headerIdx);
    assert.notEqual(nodeStart, -1);
    const nodeEnd = md.indexOf("' \"$sentinel\"", nodeStart);
    assert.notEqual(nodeEnd, -1);
    const nodeBlock = md.slice(nodeStart, nodeEnd);
    // Both fields must be referenced by parsed.<field>.
    assert.ok(nodeBlock.includes('parsed.reviewfix_branch'),
      'recovery node script must extract parsed.reviewfix_branch from the sentinel');
    assert.ok(nodeBlock.includes('parsed.worktree_path'),
      'recovery node script must extract parsed.worktree_path from the sentinel');
  });

  test('recovery shell deletes the orphan reviewfix branch when present', () => {
    // The recovery block (between sentinel detection and `rm -f "$sentinel"`)
    // must call `git branch -D "$prior_branch"` (best-effort, with || true).
    const sentinelIdx = md.indexOf('Detected pre-existing recovery sentinel');
    const rmIdx = md.indexOf('rm -f "$sentinel"', sentinelIdx);
    assert.notEqual(rmIdx, -1);
    const recoveryBlock = md.slice(sentinelIdx, rmIdx);
    assert.ok(/git\s+branch\s+-D\s+"\$prior_branch"/.test(recoveryBlock),
      `recovery block must contain \`git branch -D "$prior_branch"\`; got: ${recoveryBlock.slice(0, 500)}`);
  });
});
