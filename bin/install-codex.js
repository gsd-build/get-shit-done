#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const pkg = require('../package.json');
const repoRoot = path.resolve(__dirname, '..');

const GSD_AGENT_ROLES = [
  { name: 'gsd-project-researcher', description: 'GSD role: project researcher.' },
  { name: 'gsd-research-synthesizer', description: 'GSD role: research synthesizer.' },
  { name: 'gsd-roadmapper', description: 'GSD role: roadmap planning.' },
  { name: 'gsd-phase-researcher', description: 'GSD role: phase research.' },
  { name: 'gsd-planner', description: 'GSD role: phase planning.' },
  { name: 'gsd-plan-checker', description: 'GSD role: plan verification.' },
  { name: 'gsd-executor', description: 'GSD role: plan execution.' },
  { name: 'gsd-verifier', description: 'GSD role: execution verification.' },
  { name: 'gsd-debugger', description: 'GSD role: debugging.' },
  { name: 'gsd-integration-checker', description: 'GSD role: integration verification.' },
  { name: 'gsd-codebase-mapper', description: 'GSD role: codebase mapping.' },
];

const helpText = `
${pkg.name} v${pkg.version}

Usage:
  ${pkg.name} [--path <target-dir>] [--global] [--help]

Options:
  --path <target-dir>   Install into this directory (defaults to current directory)
  --global              Also install .claude to your home directory (for manual sharing)
  --help, -h            Show this help message

Examples:
  npx gsd-codex-cli@latest --path .
  npx gsd-codex-cli@latest --path ./my-project
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

function escapeRegExp(value) {
  // Escape special regex characters.
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureCodexConfigHasGsdAgentRoles(codexDir) {
  const configPath = path.join(codexDir, 'config.toml');
  const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  const eol = existing.includes('\r\n') ? '\r\n' : '\n';

  const blocks = [];
  for (const role of GSD_AGENT_ROLES) {
    const header = `[agents.${role.name}]`;
    const headerRegex = new RegExp(`^\\s*\\[agents\\.${escapeRegExp(role.name)}\\]\\s*$`, 'm');
    if (headerRegex.test(existing)) continue;

    blocks.push([
      header,
      `description = "${role.description}"`,
      `config_file = "./agents/${role.name}.toml"`,
    ].join(eol));
  }

  if (blocks.length === 0) {
    return { changed: false, added_roles: [] };
  }

  let next = existing;
  if (next.length > 0 && !next.endsWith(eol)) next += eol;
  if (next.length > 0 && !next.endsWith(eol + eol)) next += eol;
  next += blocks.join(eol + eol) + eol;

  fs.writeFileSync(configPath, next, 'utf8');
  return { changed: true, added_roles: blocks.map(b => b.split(eol, 1)[0]) };
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
  const versionDest = path.join(targetClaude, 'get-shit-done', 'VERSION');
  const codexVersionDest = path.join(targetCodex, 'gsd', 'VERSION');

  ensureDir(baseDir);
  ensureDir(targetCodex);
  ensureDir(targetClaude);

  copyRecursive(sourceCodex, targetCodex);
  copyRecursive(sourceGetShitDone, path.join(targetClaude, 'get-shit-done'));
  copyRecursive(sourceAgents, path.join(targetClaude, 'agents'));
  ensureCodexConfigHasGsdAgentRoles(targetCodex);
  ensureDir(path.dirname(versionDest));
  fs.writeFileSync(versionDest, `${pkg.version}\n`);
  ensureDir(path.dirname(codexVersionDest));
  fs.writeFileSync(codexVersionDest, `${pkg.version}\n`);
}

async function main() {
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
  console.log('  2) Run /prompts:gsd-new-project, then /prompts:gsd-discuss-phase, /prompts:gsd-plan-phase, /prompts:gsd-execute-phase');
  console.log('  3) If something looks off, run /prompts:gsd-doctor');
  console.log('  4) Use .codex/prompts/* for all GSD commands in this fork');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
