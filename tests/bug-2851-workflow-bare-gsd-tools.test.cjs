/**
 * Bug #2851: plan-phase.md §13e calls bare `gsd-tools` — incomplete fix of #2245
 *
 * `gsd-tools` is NOT a published bin entry. The shipped invocation pattern is:
 *
 *   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" <subcommand> [args]
 *
 * Some workflow markdown files leaked the bare `gsd-tools <subcommand>` form,
 * which fails with `command not found` at runtime.
 *
 * This test parses every markdown file in get-shit-done/workflows/ structurally:
 * it tokenizes the content into fenced code blocks, then on each shell-block
 * line checks whether `gsd-tools` appears as a bare command (not preceded by
 * `node `, not part of the filename `gsd-tools.cjs`, not inside a comment).
 *
 * Per project rule: this test does NOT use grep/regex .includes() on raw file
 * content as the assertion surface. Instead, it splits into code-fenced blocks
 * and tokenizes each line — only command-position tokens count as violations.
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');

/**
 * Extract shell-fenced code blocks from a markdown file.
 * Returns an array of { startLine, lines } where lines are the contents
 * between the ```bash / ```sh / ```shell fence markers.
 */
function extractShellBlocks(content) {
  const allLines = content.split('\n');
  const blocks = [];
  let inBlock = false;
  let blockLang = null;
  let blockStart = 0;
  let blockLines = [];

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const fenceOpen = line.match(/^```(\w+)?/);
    if (!inBlock && fenceOpen) {
      inBlock = true;
      blockLang = (fenceOpen[1] || '').toLowerCase();
      blockStart = i + 2; // 1-indexed line number of first content line
      blockLines = [];
      continue;
    }
    if (inBlock && /^```\s*$/.test(line)) {
      if (['bash', 'sh', 'shell', 'zsh', ''].includes(blockLang)) {
        blocks.push({ startLine: blockStart, lines: blockLines });
      }
      inBlock = false;
      blockLang = null;
      blockLines = [];
      continue;
    }
    if (inBlock) {
      blockLines.push(line);
    }
  }
  return blocks;
}

/**
 * Check a single shell-block line for a bare `gsd-tools` command-position token.
 * Returns true if the line is a violation.
 */
function lineHasBareGsdTools(line) {
  // Strip leading whitespace and any prompt prefix ($ , > , # )
  let l = line.replace(/^\s*[$>]\s*/, '');
  // Skip pure comment lines
  if (/^\s*#/.test(l)) return false;
  // Strip inline comment (# preceded by whitespace, not inside a string)
  // Conservative: only strip if # appears after whitespace and outside quotes —
  // we just look for the first ` #` outside of quoted context. For our needs,
  // splitting on `^[^"']*?(\s#)` is good enough.
  const hashIdx = l.search(/(?:^|[^"'\w])#/);
  if (hashIdx > 0) l = l.slice(0, hashIdx);

  // Unwrap command-substitution forms so the substituted command is in
  // command position. `$(cmd …)` and `` `cmd …` `` both run the inner string
  // as a fresh command, so a bare `gsd-tools` inside them is just as broken
  // as one at the start of the line. Iterate until stable for nested forms.
  let prev;
  do {
    prev = l;
    l = l.replace(/\$\(([^()]*)\)/g, ' $1 ').replace(/`([^`]*)`/g, ' $1 ');
  } while (l !== prev);

  // Tokenize on whitespace, semicolons, pipes, and && / ||
  // Then walk tokens — a violation is a token that starts with `gsd-tools`
  // followed by a word boundary (so `gsd-tools.cjs` does NOT match), and the
  // preceding token is NOT `node`.
  const segments = l.split(/(?:\s*(?:&&|\|\||;|\|)\s*)/);
  for (const seg of segments) {
    const tokens = seg.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    // Skip env var assignments at the start (FOO=bar gsd-tools …, tmp=1 gsd-tools …).
    // POSIX shell variable names are [A-Za-z_][A-Za-z0-9_]*; lowercase is valid.
    let cmdIdx = 0;
    while (cmdIdx < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[cmdIdx])) {
      cmdIdx++;
    }
    if (cmdIdx >= tokens.length) continue;
    const cmd = tokens[cmdIdx];
    // Match `gsd-tools` exactly (no extension), as command position.
    if (cmd === 'gsd-tools') return true;
  }
  return false;
}

describe('bug-2851: workflow files must not call bare `gsd-tools` (#2245 sweep regression)', () => {
  test('no get-shit-done/workflows/*.md file contains a bare gsd-tools command', () => {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.md'));
    assert.ok(files.length > 0, 'expected workflow files to exist');

    const violations = [];
    for (const f of files) {
      const full = path.join(WORKFLOWS_DIR, f);
      const content = fs.readFileSync(full, 'utf-8');
      const blocks = extractShellBlocks(content);
      for (const blk of blocks) {
        for (let i = 0; i < blk.lines.length; i++) {
          if (lineHasBareGsdTools(blk.lines[i])) {
            violations.push(`${f}:${blk.startLine + i}: ${blk.lines[i].trim()}`);
          }
        }
      }
    }

    assert.deepStrictEqual(
      violations,
      [],
      'Bare `gsd-tools` invocations found in workflow shell blocks. ' +
        'Use `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" <subcommand>` instead.\n' +
        violations.join('\n'),
    );
  });

  test('plan-phase.md §13e gap-analysis uses canonical absolute-path invocation', () => {
    const planPhase = fs.readFileSync(path.join(WORKFLOWS_DIR, 'plan-phase.md'), 'utf-8');
    const blocks = extractShellBlocks(planPhase);
    let foundGapAnalysisCall = false;
    for (const blk of blocks) {
      for (const line of blk.lines) {
        if (/gap-analysis/.test(line) && !/^\s*#/.test(line)) {
          foundGapAnalysisCall = true;
          assert.match(
            line,
            /\bnode\s+["']?\$HOME\/\.claude\/get-shit-done\/bin\/gsd-tools\.cjs["']?\s+gap-analysis\b/,
            `gap-analysis call must use canonical absolute-path invocation, got: ${line.trim()}`,
          );
        }
      }
    }
    assert.ok(foundGapAnalysisCall, 'expected at least one gap-analysis invocation in plan-phase.md');
  });
});
