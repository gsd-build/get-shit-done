#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const DEFAULT_RELATIVE_FILES = [
  '.github/workflows/test.yml',
  '.github/workflows/pr-template-format.yml',
  '.github/workflows/changeset-required.yml',
  'scripts/lint-no-source-grep.cjs',
  'scripts/lint-command-contract.cjs',
  'scripts/lint-skill-deps.cjs',
  'scripts/lint-descriptions.cjs',
  'scripts/lint-shell-command-projection-drift.cjs',
  'scripts/pr-template-policy.cjs',
  'scripts/changeset/lint.cjs',
];

function defaultFiles(rootDir = ROOT) {
  return DEFAULT_RELATIVE_FILES
    .map((file) => path.join(rootDir, file))
    .filter((file) => fs.existsSync(file));
}

function findForbiddenCwd(content, file = '<inline>') {
  const findings = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const pattern = /\bcwd\b/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      findings.push({
        file,
        line: index + 1,
        column: match.index + 1,
        source: line.trim(),
      });
    }
  });

  return findings;
}

function checkFiles(files, { rootDir = ROOT } = {}) {
  const findings = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(rootDir, file);
    findings.push(...findForbiddenCwd(content, rel));
  }
  return findings;
}

function formatFindings(findings) {
  const lines = [
    `ERROR lint-pr-check-project-dir: ${findings.length} forbidden cwd reference(s) found`,
    '',
    'PR checkers must use projectDir for project roots; cwd is forbidden in this layer.',
    '',
  ];

  for (const finding of findings) {
    lines.push(`  ${finding.file}:${finding.line}:${finding.column}`);
    lines.push(`    ${finding.source}`);
  }

  return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
  const files = argv.length > 0 ? argv.map((file) => path.resolve(file)) : defaultFiles();
  const findings = checkFiles(files);

  if (findings.length === 0) {
    console.log(`ok lint-pr-check-project-dir: ${files.length} PR check files checked`);
    return 0;
  }

  process.stderr.write(formatFindings(findings));
  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  DEFAULT_RELATIVE_FILES,
  checkFiles,
  defaultFiles,
  findForbiddenCwd,
  formatFindings,
  main,
};
