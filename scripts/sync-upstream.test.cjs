/**
 * GMSD Upstream Sync — Unit Tests
 *
 * Tests pure transform functions only (no git, no filesystem).
 * Uses node:test (project standard).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  CATEGORY,
  mapUpstreamPath,
  transformContent,
  convertMarkdownToOrg,
  addOrgHeader,
  convertYamlFrontmatter,
  parseYamlToProperties,
  detectHardcodedMd,
} = require('./sync-upstream.js');

// ─── mapUpstreamPath ─────────────────────────────────────────────────────────

describe('mapUpstreamPath', () => {
  test('maps exact gsd-tools.cjs path', () => {
    const result = mapUpstreamPath('get-shit-done/bin/gsd-tools.cjs');
    assert.deepStrictEqual(result, {
      gmsdPath: 'get-my-shit-done/bin/gmsd-tools.cjs',
      category: CATEGORY.CJS_LIB,
    });
  });

  test('maps get-shit-done/templates/*.md → .org with TEMPLATE category', () => {
    const result = mapUpstreamPath('get-shit-done/templates/roadmap.md');
    assert.deepStrictEqual(result, {
      gmsdPath: 'get-my-shit-done/templates/roadmap.org',
      category: CATEGORY.TEMPLATE,
    });
  });

  test('maps get-shit-done/bin/lib/core.cjs with CJS_LIB category', () => {
    const result = mapUpstreamPath('get-shit-done/bin/lib/core.cjs');
    assert.deepStrictEqual(result, {
      gmsdPath: 'get-my-shit-done/bin/lib/core.cjs',
      category: CATEGORY.CJS_LIB,
    });
  });

  test('maps commands/gsd/ → commands/gmsd/', () => {
    const result = mapUpstreamPath('commands/gsd/execute-phase.md');
    assert.deepStrictEqual(result, {
      gmsdPath: 'commands/gmsd/execute-phase.md',
      category: CATEGORY.MD_PROMPT,
    });
  });

  test('maps agents/gsd-*.md → agents/gmsd-*.md', () => {
    const result = mapUpstreamPath('agents/gsd-executor.md');
    assert.deepStrictEqual(result, {
      gmsdPath: 'agents/gmsd-executor.md',
      category: CATEGORY.MD_PROMPT,
    });
  });

  test('maps hooks/gsd-*.js → hooks/gmsd-*.js', () => {
    const result = mapUpstreamPath('hooks/gsd-check-update.js');
    assert.deepStrictEqual(result, {
      gmsdPath: 'hooks/gmsd-check-update.js',
      category: CATEGORY.CJS_LIB,
    });
  });

  test('maps root templates/*.md → .org', () => {
    const result = mapUpstreamPath('templates/summary.md');
    assert.deepStrictEqual(result, {
      gmsdPath: 'templates/summary.org',
      category: CATEGORY.TEMPLATE,
    });
  });

  test('maps docs/*.md → docs/*.org', () => {
    const result = mapUpstreamPath('docs/USER-GUIDE.md');
    assert.deepStrictEqual(result, {
      gmsdPath: 'docs/USER-GUIDE.org',
      category: CATEGORY.ORG_DOC,
    });
  });

  test('passes through SECURITY.md unchanged', () => {
    const result = mapUpstreamPath('SECURITY.md');
    assert.deepStrictEqual(result, {
      gmsdPath: 'SECURITY.md',
      category: CATEGORY.PASSTHROUGH,
    });
  });

  test('passes through CLAUDE.md unchanged', () => {
    const result = mapUpstreamPath('CLAUDE.md');
    assert.deepStrictEqual(result, {
      gmsdPath: 'CLAUDE.md',
      category: CATEGORY.PASSTHROUGH,
    });
  });

  test('skips package.json', () => {
    assert.strictEqual(mapUpstreamPath('package.json'), null);
  });

  test('skips .github/ files', () => {
    assert.strictEqual(mapUpstreamPath('.github/PULL_REQUEST_TEMPLATE.md'), null);
  });

  test('skips README.md', () => {
    assert.strictEqual(mapUpstreamPath('README.md'), null);
  });

  test('skips CHANGELOG.md', () => {
    assert.strictEqual(mapUpstreamPath('CHANGELOG.md'), null);
  });
});

// ─── transformContent ────────────────────────────────────────────────────────

describe('transformContent', () => {
  test('replaces get-shit-done with get-my-shit-done', () => {
    const { transformed } = transformContent(
      'require("get-shit-done/bin/lib/core.cjs")',
      'test.cjs',
      CATEGORY.CJS_LIB
    );
    assert.strictEqual(transformed, 'require("get-my-shit-done/bin/lib/core.cjs")');
  });

  test('replaces gsd-tools.cjs with gmsd-tools.cjs', () => {
    const { transformed } = transformContent(
      'const tools = "gsd-tools.cjs";',
      'test.cjs',
      CATEGORY.CJS_LIB
    );
    assert.strictEqual(transformed, 'const tools = "gmsd-tools.cjs";');
  });

  test('replaces /gsd: with /gmsd:', () => {
    const { transformed } = transformContent(
      'Use /gsd:execute-phase to run',
      'test.md',
      CATEGORY.MD_PROMPT
    );
    assert.strictEqual(transformed, 'Use /gmsd:execute-phase to run');
  });

  test('replaces ~/.gsd/ with ~/.gmsd/', () => {
    const { transformed } = transformContent(
      'Settings dir: ~/.gsd/settings.json',
      'test.md',
      CATEGORY.MD_PROMPT
    );
    assert.strictEqual(transformed, 'Settings dir: ~/.gmsd/settings.json');
  });

  test('replaces gsd_state_version with gmsd_state_version', () => {
    const { transformed } = transformContent(
      'gsd_state_version: 1',
      'test.cjs',
      CATEGORY.CJS_LIB
    );
    assert.strictEqual(transformed, 'gmsd_state_version: 1');
  });

  test('replaces gsd/phase- and gsd/milestone- branch patterns', () => {
    const { transformed } = transformContent(
      'git checkout -b gsd/phase-03 && git checkout -b gsd/milestone-2',
      'test.cjs',
      CATEGORY.CJS_LIB
    );
    assert.strictEqual(transformed, 'git checkout -b gmsd/phase-03 && git checkout -b gmsd/milestone-2');
  });

  test('replaces word-boundary gsd- prefix', () => {
    const { transformed } = transformContent(
      'Launch gsd-executor agent',
      'test.md',
      CATEGORY.MD_PROMPT
    );
    assert.strictEqual(transformed, 'Launch gmsd-executor agent');
  });

  test('replaces whole-word GSD', () => {
    const { transformed } = transformContent(
      'GSD is a project management tool',
      'test.md',
      CATEGORY.MD_PROMPT
    );
    assert.strictEqual(transformed, 'GMSD is a project management tool');
  });

  test('does not replace GSD inside other words', () => {
    const { transformed } = transformContent(
      'myGSDvar should stay but GSD should change',
      'test.md',
      CATEGORY.MD_PROMPT
    );
    assert.strictEqual(transformed, 'myGSDvar should stay but GMSD should change');
  });

  test('skips PASSTHROUGH files entirely', () => {
    const { transformed } = transformContent(
      'get-shit-done stays as-is',
      'SECURITY.md',
      CATEGORY.PASSTHROUGH
    );
    assert.strictEqual(transformed, 'get-shit-done stays as-is');
  });
});

// ─── convertYamlFrontmatter ─────────────────────────────────────────────────

describe('convertYamlFrontmatter', () => {
  test('converts simple YAML frontmatter to property drawer', () => {
    const input = `---
phase: 03
type: implementation
status: pending
---

# Content here`;
    const { converted, hadFrontmatter } = convertYamlFrontmatter(input);
    assert.strictEqual(hadFrontmatter, true);
    assert.ok(converted.startsWith(':PROPERTIES:'));
    assert.ok(converted.includes(':phase: 03'));
    assert.ok(converted.includes(':type: implementation'));
    assert.ok(converted.includes(':status: pending'));
    assert.ok(converted.includes(':END:'));
    assert.ok(converted.includes('# Content here'));
  });

  test('converts YAML with inline array', () => {
    const input = `---
tags: [api, backend]
---
Body`;
    const { converted } = convertYamlFrontmatter(input);
    assert.ok(converted.includes(':tags: [api, backend]'));
  });

  test('converts YAML with nested object using dot-notation', () => {
    const input = `---
tech-stack:
  added: react
  removed: angular
---
Body`;
    const { converted } = convertYamlFrontmatter(input);
    assert.ok(converted.includes(':tech-stack.added: react'));
    assert.ok(converted.includes(':tech-stack.removed: angular'));
  });

  test('converts YAML with multi-line array', () => {
    const input = `---
files_modified:
  - core.cjs
  - template.cjs
---
Body`;
    const { converted } = convertYamlFrontmatter(input);
    assert.ok(converted.includes(':files_modified: [core.cjs, template.cjs]'));
  });

  test('returns unchanged content when no frontmatter', () => {
    const input = '# Just a heading\n\nSome content';
    const { converted, hadFrontmatter } = convertYamlFrontmatter(input);
    assert.strictEqual(hadFrontmatter, false);
    assert.strictEqual(converted, input);
  });
});

// ─── convertMarkdownToOrg ───────────────────────────────────────────────────

describe('convertMarkdownToOrg', () => {
  test('converts markdown headings to org headings', () => {
    const input = '# Top\n## Second\n### Third';
    const result = convertMarkdownToOrg(input);
    assert.strictEqual(result, '* Top\n** Second\n*** Third');
  });

  test('converts code fences to org src blocks', () => {
    const input = '```javascript\nconst x = 1;\n```';
    const result = convertMarkdownToOrg(input);
    assert.ok(result.includes('#+begin_src javascript'));
    assert.ok(result.includes('const x = 1;'));
    assert.ok(result.includes('#+end_src'));
  });

  test('converts bold **text** to *text*', () => {
    const input = 'This is **bold** text';
    const result = convertMarkdownToOrg(input);
    assert.strictEqual(result, 'This is *bold* text');
  });

  test('does not convert content inside code blocks', () => {
    const input = '```\n## Not a heading\n**not bold**\n```';
    const result = convertMarkdownToOrg(input);
    assert.ok(result.includes('## Not a heading'));
    assert.ok(result.includes('**not bold**'));
  });
});

// ─── addOrgHeader ────────────────────────────────────────────────────────────

describe('addOrgHeader', () => {
  test('adds org header with title derived from filename', () => {
    const result = addOrgHeader('* Content', 'templates/phase-prompt.org');
    assert.ok(result.startsWith('#+title: Phase Prompt'));
    assert.ok(result.includes('#+startup: indent'));
    assert.ok(result.includes('#+options: toc:2 num:nil ^:{}'));
  });

  test('does not double-add header if already present', () => {
    const input = '#+title: Existing\n* Content';
    const result = addOrgHeader(input, 'test.org');
    assert.strictEqual(result, input);
  });
});

// ─── detectHardcodedMd ──────────────────────────────────────────────────────

describe('detectHardcodedMd', () => {
  test('detects hardcoded .md references in CJS files', () => {
    const content = `const file = 'STATE.md';
const other = 'ROADMAP.md';`;
    const warnings = detectHardcodedMd(content, 'lib/core.cjs');
    assert.strictEqual(warnings.length, 2);
    assert.strictEqual(warnings[0].match, 'STATE.md');
    assert.strictEqual(warnings[0].suggestion, 'STATE.org');
    assert.strictEqual(warnings[0].line, 1);
  });

  test('ignores acceptable .md references', () => {
    const content = `const claude = 'CLAUDE.md';
const agent = 'agents/gmsd-executor.md';
const cmd = 'commands/gmsd/plan.md';`;
    const warnings = detectHardcodedMd(content, 'lib/core.cjs');
    assert.strictEqual(warnings.length, 0);
  });

  test('skips non-code files', () => {
    const content = `'STATE.md' should not trigger`;
    const warnings = detectHardcodedMd(content, 'docs/guide.org');
    assert.strictEqual(warnings.length, 0);
  });

  test('detects .md in double-quoted and backtick strings', () => {
    const content = `const a = "PROJECT.md";
const b = \`MILESTONES.md\`;`;
    const warnings = detectHardcodedMd(content, 'lib/test.js');
    assert.strictEqual(warnings.length, 2);
  });
});

// ─── parseYamlToProperties ──────────────────────────────────────────────────

describe('parseYamlToProperties', () => {
  test('parses simple key-value pairs', () => {
    const result = parseYamlToProperties('phase: 03\nstatus: pending');
    assert.strictEqual(result, ':phase: 03\n:status: pending');
  });

  test('parses inline arrays', () => {
    const result = parseYamlToProperties('tags: [api, backend]');
    assert.strictEqual(result, ':tags: [api, backend]');
  });

  test('parses nested objects with dot-notation', () => {
    const result = parseYamlToProperties('parent:\n  child: value');
    assert.strictEqual(result, ':parent.child: value');
  });
});
