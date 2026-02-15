#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const pkg = require('../package.json');
const repoRoot = path.resolve(__dirname, '..');

const helpText = `
${pkg.name} v${pkg.version}

Usage:
  get-shit-done-codex [--path <target-dir>] [--help]

Options:
  --path <target-dir>   Install into this directory (defaults to current directory)
  --global              Also install .claude to your home directory (for manual sharing)
  --help, -h            Show this help message

Examples:
  npx @ahmed118glitch/get-shit-done-codex@latest --path .
  npx @ahmed118glitch/get-shit-done-codex@latest --path ./my-project
`;

if (args.includes('--help') || args.includes('-h')) {
  console.log(helpText);
  process.exit(0);
}

const pathArgIndex = args.findIndex((arg, index) => {
  if (arg === '--path') return true;
  return false;
});
let targetDir = process.cwd();
if (pathArgIndex !== -1) {
  const userPath = args[pathArgIndex + 1];
  if (!userPath || userPath.startsWith('-')) {
    console.error('Error: --path requires a directory argument.');
    process.exit(1);
  }
  targetDir = path.resolve(process.cwd(), userPath);
}

const installGlobal = args.includes('--global');

function copyRecursive(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, destination, { recursive: true, force: true });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveSourceDir(repoRelative, fallbackRelative) {
  const primary = path.join(repoRoot, repoRelative);
  const fallback = fallbackRelative ? path.join(repoRoot, fallbackRelative) : null;

  if (fs.existsSync(primary)) return primary;
  if (fallback && fs.existsSync(fallback)) return fallback;

  const fallbackMessage = fallbackRelative ? ` or ${fallbackRelative}` : '';
  throw new Error(`Missing source directory "${repoRelative}"${fallbackMessage} in repository root ${repoRoot}`);
}

function copyCodexToDirectory(baseDir) {
  const targetCodex = path.join(baseDir, '.codex');
  const targetClaude = path.join(baseDir, '.claude');
  const sourceCodex = path.join(repoRoot, '.codex');
  const sourceGetShitDone = resolveSourceDir('get-shit-done', '.claude/get-shit-done');
  const sourceAgents = resolveSourceDir('agents', '.claude/agents');

  ensureDir(baseDir);
  ensureDir(targetCodex);
  ensureDir(targetClaude);

  copyRecursive(sourceCodex, targetCodex);
  copyRecursive(sourceGetShitDone, path.join(targetClaude, 'get-shit-done'));
  copyRecursive(sourceAgents, path.join(targetClaude, 'agents'));
}

copyCodexToDirectory(targetDir);

if (installGlobal) {
  // Global installs should place prompts at ~/.codex/prompts (not ~/.codex/.codex/prompts).
  const globalBase = os.homedir();
  copyCodexToDirectory(globalBase);
}

console.log(`\n${pkg.name}@${pkg.version} installed to:`);
console.log(`  local: ${targetDir}`);
if (installGlobal) {
  console.log('  global: ~/.codex');
}
console.log('\nNext steps:');
console.log('  1) Open your project in Codex');
console.log('  2) Run prompt gsd-new-project, then gsd-plan-phase, gsd-execute-phase');
console.log('  3) Use .codex/prompts/* for all GSD commands in this fork');
