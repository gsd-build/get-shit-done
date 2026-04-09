/**
 * Regression guard for #1777: product names must not have parenthetical descriptions.
 *
 * Community PRs repeatedly add editorial commentary in parentheses next to
 * product names (licensing, parent company, architecture). This test scans
 * all README files and ensures install-block comment lines contain only the
 * product name — no parenthetical text of any kind.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Product names that appear in install blocks as comment headers
const PRODUCTS = [
  'Claude Code', 'Claude', 'OpenCode', 'Kilo', 'Codex', 'Copilot',
  'Cursor', 'Windsurf', 'Antigravity', 'Trae', 'Cline', 'Augment',
  'Gemini', 'Gemini CLI',
];

// README files to scan (root + i18n variants + docs)
const README_FILES = [
  'README.md',
  'README.ko-KR.md',
  'README.ja-JP.md',
  'README.zh-CN.md',
  'README.pt-BR.md',
  'docs/zh-CN/README.md',
  'docs/ko-KR/README.md',
  'docs/ja-JP/README.md',
  'docs/pt-BR/README.md',
  'docs/README.md',
].filter(f => fs.existsSync(path.join(ROOT, f)));

describe('product name purity (#1777)', () => {
  test('no README install-block comments contain parenthetical descriptions', () => {
    const violations = [];

    for (const file of README_FILES) {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match shell comment lines that start with # followed by a product name
        // and then have parenthetical text: # ProductName (something)
        // Also match fullwidth parens used in CJK: # ProductName（something）
        const match = line.match(/^#\s+(\S+(?:\s+\S+)?)\s*[（(].+[）)]/);
        if (!match) continue;

        const name = match[1];
        // Check if this is actually a product name line (not a random comment)
        const isProduct = PRODUCTS.some(p =>
          name === p || name.startsWith(p)
        );
        if (isProduct) {
          violations.push([
            file + ':' + (i + 1),
            line.trim(),
          ].join(' — '));
        }
      }
    }

    assert.strictEqual(
      violations.length, 0,
      [
        'Product names in README install blocks must not have parenthetical descriptions.',
        'Found violations:',
        ...violations.map(v => '  ' + v),
      ].join('\n')
    );
  });

  test('CHANGELOG does not include parenthetical product descriptions', () => {
    const changelog = path.join(ROOT, 'CHANGELOG.md');
    if (!fs.existsSync(changelog)) return;

    const content = fs.readFileSync(changelog, 'utf-8');
    const violations = [];

    for (const product of PRODUCTS) {
      // Match "ProductName (something)" but not "ProductName (v1.2.3)" (version refs are ok)
      const pattern = new RegExp(
        product.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '\\s*\\([^)]*(?!v?\\d+\\.\\d)[^)]*\\)',
        'g'
      );
      const matches = content.match(pattern);
      if (matches) {
        for (const m of matches) {
          // Skip version references like "Claude Code (v1.32.0)"
          if (/\(v?\d+\.\d+/.test(m)) continue;
          violations.push(m);
        }
      }
    }

    assert.strictEqual(
      violations.length, 0,
      [
        'CHANGELOG must not include parenthetical product descriptions.',
        'Found:',
        ...violations.map(v => '  ' + v),
      ].join('\n')
    );
  });
});
