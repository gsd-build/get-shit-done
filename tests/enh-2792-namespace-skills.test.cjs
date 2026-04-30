'use strict';

// allow-test-rule: source-text-is-the-product
// commands/gsd/*.md files ARE what the runtime loads — testing their
// frontmatter content tests the deployed system-prompt contract.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

const NAMESPACE_SKILLS = [
  { file: 'ns-workflow.md', name: 'gsd-workflow' },
  { file: 'ns-project.md',  name: 'gsd-project' },
  { file: 'ns-review.md',   name: 'gsd-review' },
  { file: 'ns-context.md',  name: 'gsd-context' },
  { file: 'ns-manage.md',   name: 'gsd-manage' },
  { file: 'ns-ideate.md',   name: 'gsd-ideate' },
];

// Route targets named in any namespace body. The cross-reference test below
// asserts that every one of these resolves to a surviving command file or to
// a known consolidated parent (which absorbs flag-form invocations of folded
// skills, e.g. `gsd-map-codebase --fast` for the former `gsd-scan`).
const FLAG_FORM_PARENTS = new Set([
  'gsd-code-review',     // --fix absorbs former gsd-code-review-fix
  'gsd-map-codebase',    // --fast absorbs scan, --query absorbs intel
]);

/**
 * Parse the leading YAML frontmatter block of a markdown file into a
 * shallow `{ key: value }` map plus the trailing body. Splits on `\r?\n`
 * for CRLF tolerance and uses trimmed-line equality for the `---`
 * delimiters so whitespace-padded delimiter lines are accepted.
 */
function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  let openIdx = -1;
  let closeIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      if (openIdx === -1) openIdx = i;
      else { closeIdx = i; break; }
    }
  }
  assert.ok(openIdx !== -1 && closeIdx !== -1, 'frontmatter block must be delimited by --- on its own lines');
  const fm = {};
  for (const line of lines.slice(openIdx + 1, closeIdx)) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    const value = raw.trim().replace(/^["']|["']$/g, '');
    fm[key] = value;
  }
  fm._body = lines.slice(closeIdx + 1).join('\n');
  return fm;
}

function readNamespaceFile(file) {
  const filePath = path.join(COMMANDS_DIR, file);
  assert.ok(fs.existsSync(filePath), `${file} must exist at ${filePath}`);
  return { filePath, ...parseFrontmatter(fs.readFileSync(filePath, 'utf-8')) };
}

// ── Frontmatter contract ───────────────────────────────────────────────

describe('Namespace skill files exist with correct name', () => {
  for (const { file, name } of NAMESPACE_SKILLS) {
    test(`${file} — name field is hyphen-form ${name}`, () => {
      const fm = readNamespaceFile(file);
      assert.strictEqual(
        fm.name,
        name,
        `name: in ${file} must be ${name} (hyphen form per #2858), got: ${fm.name}`,
      );
    });
  }
});

describe('Namespace skill descriptions are keyword-tag format', () => {
  for (const { file } of NAMESPACE_SKILLS) {
    test(`${file} — description ≤ 60 chars`, () => {
      const fm = readNamespaceFile(file);
      assert.ok(
        fm.description.length <= 60,
        `${file} description must be ≤ 60 chars, got ${fm.description.length}: ${fm.description}`,
      );
    });

    test(`${file} — description contains a pipe separator`, () => {
      const fm = readNamespaceFile(file);
      assert.ok(
        fm.description.includes('|'),
        `${file} description must contain | pipe separator, got: ${fm.description}`,
      );
    });

    test(`${file} — description does not start with prose ("Use " / "This skill")`, () => {
      const { description } = readNamespaceFile(file);
      assert.ok(
        !description.startsWith('Use ') && !description.startsWith('This skill'),
        `${file} description must not start with "Use " or "This skill", got: ${description}`,
      );
    });
  }
});

// ── allowed-tools must include Skill ──────────────────────────────────

describe('Namespace skills permit Skill execution', () => {
  for (const { file } of NAMESPACE_SKILLS) {
    test(`${file} — allowed-tools includes Skill`, () => {
      const filePath = path.join(COMMANDS_DIR, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const lines = raw.split(/\r?\n/);
      const startIdx = lines.findIndex((l) => l.trim() === 'allowed-tools:');
      assert.ok(startIdx !== -1, `${file} must declare an allowed-tools block`);
      const tools = [];
      for (let i = startIdx + 1; i < lines.length; i += 1) {
        const m = lines[i].match(/^\s+-\s+(\S+)/);
        if (!m) break;
        tools.push(m[1]);
      }
      assert.ok(
        tools.includes('Skill'),
        `${file} body invokes the Skill tool but allowed-tools does not include Skill (got: ${tools.join(', ')})`,
      );
    });
  }
});

// ── Body contains routing table ───────────────────────────────────────

describe('Namespace skill bodies carry a routing table', () => {
  for (const { file } of NAMESPACE_SKILLS) {
    test(`${file} — body contains "| User wants" table header`, () => {
      const fm = readNamespaceFile(file);
      const lines = fm._body.split('\n');
      const hasHeader = lines.some((l) => l.includes('| User wants'));
      assert.ok(hasHeader, `${file} body must contain a routing table starting with "| User wants"`);
    });

    test(`${file} — body has at least one Invoke target`, () => {
      const fm = readNamespaceFile(file);
      const hasInvoke = /\bgsd-[a-z-]+/i.test(fm._body);
      assert.ok(hasInvoke, `${file} body must reference at least one gsd-* sub-skill`);
    });
  }
});

// ── Context guard contract on gsd-health ──────────────────────────────
// Asserts the `--context` surface promised by #2792 is wired through to
// both the command frontmatter and the workflow body. The classifier
// itself is covered by tests/context-utilization.test.cjs and the SDK
// CLI by tests/validate-context.test.cjs.

describe('gsd-health --context flag is wired into command + workflow', () => {
  const HEALTH_CMD = path.join(COMMANDS_DIR, 'health.md');
  const HEALTH_WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'health.md');

  test('commands/gsd/health.md argument-hint advertises --context', () => {
    const raw = fs.readFileSync(HEALTH_CMD, 'utf-8');
    const fm = parseFrontmatter(raw);
    assert.ok(
      fm['argument-hint'] && fm['argument-hint'].includes('--context'),
      `health.md argument-hint must include --context, got: ${fm['argument-hint']}`,
    );
  });

  test('commands/gsd/health.md body documents the three-state utilization table', () => {
    const raw = fs.readFileSync(HEALTH_CMD, 'utf-8');
    const body = parseFrontmatter(raw)._body.toLowerCase();
    assert.ok(body.includes('healthy'), 'body must name the healthy state');
    assert.ok(body.includes('warning'), 'body must name the warning state');
    assert.ok(body.includes('critical'), 'body must name the critical state');
    assert.ok(
      body.includes('60%') && body.includes('70%'),
      'body must reference the 60% and 70% threshold boundaries',
    );
  });

  test('get-shit-done/workflows/health.md has a context_check step', () => {
    const raw = fs.readFileSync(HEALTH_WORKFLOW, 'utf-8');
    assert.match(
      raw,
      /<step name="context_check">/,
      'workflow must define a <step name="context_check"> branch',
    );
  });

  test('workflow context_check invokes gsd-sdk query validate.context', () => {
    const raw = fs.readFileSync(HEALTH_WORKFLOW, 'utf-8');
    // Extract just the context_check step's body so a stray reference
    // elsewhere in the file can't satisfy this assertion.
    const stepMatch = raw.match(/<step name="context_check">([\s\S]*?)<\/step>/);
    assert.ok(stepMatch, 'context_check step must be a closed <step>...</step> block');
    const stepBody = stepMatch[1];
    assert.match(
      stepBody,
      /gsd-sdk\s+query\s+validate\.context/,
      'context_check must call `gsd-sdk query validate.context`',
    );
    assert.match(stepBody, /--tokens-used/, 'context_check must pass --tokens-used');
    assert.match(stepBody, /--context-window/, 'context_check must pass --context-window');
  });
});

// ── Cross-reference: every routed sub-skill must exist ─────────────────
// This is the regression guard the original PR lacked. Without it,
// post-#2790 consolidations can quietly invalidate router targets again.

describe('Namespace router targets resolve to surviving skills', () => {
  // Build the post-consolidation surviving set once.
  const surviving = new Set();
  for (const f of fs.readdirSync(COMMANDS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const base = f.replace(/\.md$/, '');
    if (base.startsWith('ns-')) continue; // namespace routers themselves
    surviving.add(`gsd-${base}`);
    // The PR #2858 rename canonicalized extract_learnings → extract-learnings.
    // Until #2790 rebases onto current main, accept either source filename
    // as resolving to the canonical hyphenated identifier.
    if (base === 'extract_learnings') surviving.add('gsd-extract-learnings');
  }

  for (const { file } of NAMESPACE_SKILLS) {
    test(`${file} — every routing target resolves`, () => {
      const fm = readNamespaceFile(file);
      // Extract every gsd-<name> token that appears in a table-row right column.
      // Strip flag suffixes (`gsd-foo --bar` → `gsd-foo`) before resolving.
      const targets = new Set();
      for (const line of fm._body.split('\n')) {
        // Only consider markdown table data rows: lines that start with `|`
        // and have content between pipes. Skip header / separator rows.
        if (!line.startsWith('|') || /^\|[\s\-:|]+\|?\s*$/.test(line)) continue;
        const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;
        for (const m of cells[cells.length - 1].matchAll(/\bgsd-[a-z][a-z0-9-]*/g)) {
          targets.add(m[0]);
        }
      }
      assert.ok(targets.size > 0, `${file} routing table must reference at least one gsd-* target`);
      const unresolved = [...targets].filter(
        (t) => !surviving.has(t) && !FLAG_FORM_PARENTS.has(t),
      );
      assert.deepStrictEqual(
        unresolved,
        [],
        `${file} routes to skills that don't exist in commands/gsd/: ${unresolved.join(', ')}`,
      );
    });
  }
});
