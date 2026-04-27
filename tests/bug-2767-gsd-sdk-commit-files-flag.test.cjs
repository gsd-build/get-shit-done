/**
 * Bug #2767: Workflows pass paths positionally to `gsd-sdk query commit`
 *
 * The SDK `commit` handler (sdk/src/query/commit.ts) requires `--files` to
 * separate paths from the commit message. Without it:
 *   1. positional path tokens are concatenated into the commit subject; and
 *   2. the handler falls back to staging `.planning/` wholesale (commit.ts:136).
 *
 * This is a regression of #733/#798. This lint scans every .md file the
 * package ships and asserts each `gsd-sdk query commit` invocation either
 * uses `--files` or carries no path arguments at all (message-only commits
 * are valid — they exercise the `.planning/` fallback intentionally only when
 * the call site explicitly wants that behavior, marked by `# message-only`).
 *
 * `gsd-sdk query commit-to-subrepo` already enforces `--files` at runtime
 * (commit.ts:258) but is also covered here for defense in depth.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');

// Directories that ship in the npm package and contain workflow markdown.
// Sourced from package.json `files` plus docs/.
const SCAN_DIRS = [
  'agents',
  'commands',
  'get-shit-done',
  'docs',
  'scripts',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Collect every full `gsd-sdk query commit[-to-subrepo]` invocation from a
 * markdown file, joining shell line-continuations so a multi-line invocation
 * is evaluated as one logical command.
 */
function extractInvocations(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);
  const invocations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip prose mentions inside markdown text — only scan code-fence content
    // and bare commands. We don't track fences strictly; instead require the
    // invocation to be the first non-whitespace token (typical bash usage)
    // OR appear after a `$ ` prompt or pipe.
    const m = line.match(/(gsd-sdk\s+query\s+commit(?:-to-subrepo)?\b.*)$/);
    if (!m) continue;

    // Skip prose-mode mentions — when the very next char after the matched
    // command name is a backtick (markdown inline code closing), this is
    // documentation prose, not an invocation.
    const tailAfterCmd = m[1].match(/^gsd-sdk\s+query\s+commit(?:-to-subrepo)?(.?)/);
    if (tailAfterCmd && tailAfterCmd[1] === '`') continue;

    // Reconstruct the full logical command across `\` line continuations.
    let cmd = m[1];
    let j = i;
    while (cmd.endsWith('\\') && j + 1 < lines.length) {
      cmd = cmd.slice(0, -1).trimEnd() + ' ' + lines[j + 1].trim();
      j++;
    }
    invocations.push({ line: i + 1, cmd, file: filePath });
  }
  return invocations;
}

/**
 * Decide whether an invocation is well-formed.
 *
 * Well-formed = uses `--files`, OR has no path arguments after the message.
 *
 * Heuristic: tokenize the args after `commit[-to-subrepo]`. After the first
 * quoted message arg (or unquoted single message token), any remaining
 * tokens that are not in the known-flag set indicate positional paths.
 */
const KNOWN_FLAGS = new Set(['--force', '--amend', '--no-verify', '--files']);

function isWellFormed(cmd) {
  // Strip trailing pipe/redirect tails so we only look at the commit args.
  // Truncate at first unquoted `|`, `&&`, `||`, `>`, `<`, `;`, `#`.
  const truncated = stripTail(cmd);

  // Split: `gsd-sdk query commit[-to-subrepo] <args...>`
  const parts = tokenize(truncated);
  // parts[0]=gsd-sdk parts[1]=query parts[2]=commit|commit-to-subrepo
  if (parts.length < 3) return true;
  const args = parts.slice(3);
  if (args.length === 0) return true;
  if (args.includes('--files')) return true;

  // No --files. Determine if there are non-flag args beyond the message.
  // The first token is the message (quoted or single word). Everything after
  // that which is NOT a known flag is a positional path → broken.
  let sawMessage = false;
  for (const tok of args) {
    if (KNOWN_FLAGS.has(tok)) continue;
    if (!sawMessage) { sawMessage = true; continue; }
    // Extra positional arg with no --files → bug.
    return false;
  }
  return true;
}

function stripTail(cmd) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (c === '#' && (i === 0 || /\s/.test(cmd[i - 1]))) return cmd.slice(0, i);
      if (c === '|' || c === ';' || c === '>' || c === '<') return cmd.slice(0, i);
      if ((c === '&' && cmd[i + 1] === '&')) return cmd.slice(0, i);
    }
  }
  return cmd;
}

function tokenize(cmd) {
  const out = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (c === "'" && !inDouble) { inSingle = !inSingle; cur += c; continue; }
    if (c === '"' && !inSingle) { inDouble = !inDouble; cur += c; continue; }
    if (/\s/.test(c) && !inSingle && !inDouble) {
      if (cur) { out.push(cur); cur = ''; }
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

describe('bug #2767: gsd-sdk query commit must use --files for path args', () => {
  const allFiles = SCAN_DIRS.flatMap(d => walk(path.join(REPO_ROOT, d)));
  const allInvocations = allFiles.flatMap(extractInvocations);

  test('scan picked up at least one invocation (sanity)', () => {
    assert.ok(allInvocations.length > 0,
      'lint scanned 0 invocations — scan globs are wrong');
  });

  test('every gsd-sdk query commit invocation either uses --files or has no path args', () => {
    const broken = allInvocations.filter(({ cmd }) => !isWellFormed(cmd));
    if (broken.length > 0) {
      const detail = broken
        .map(({ file, line, cmd }) => {
          const rel = path.relative(REPO_ROOT, file);
          return `  ${rel}:${line}\n    ${cmd}`;
        })
        .join('\n');
      assert.fail(
        `${broken.length} \`gsd-sdk query commit\` invocation(s) pass paths positionally. ` +
        `The SDK requires \`--files <path> [<path>...]\` to separate paths from the commit ` +
        `subject; without it, paths are concatenated into the message and the handler ` +
        `silently stages \`.planning/\` wholesale (sdk/src/query/commit.ts:136).\n${detail}`
      );
    }
  });
});
