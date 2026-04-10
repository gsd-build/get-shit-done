#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

const pkg = require('../package.json');

// Parse args
const args = process.argv.slice(2);
const hasUninstall = args.includes('--uninstall') || args.includes('-u');
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasHelp = args.includes('--help') || args.includes('-h');

if (hasHelp) {
  console.log(`
${bold}gsd-plugin-soc2${reset} v${pkg.version}
SOC 2 Auditor skill plugin for GSD / Claude Code

${bold}Usage:${reset}
  npx gsd-plugin-soc2              Install skills to current project
  npx gsd-plugin-soc2 --global     Install skills globally (~/.claude/skills/)
  npx gsd-plugin-soc2 --uninstall  Remove installed skills

${bold}What gets installed:${reset}
  .claude/skills/soc2-kickoff/     Engagement kickoff
  .claude/skills/soc2-plan/        Audit planning + risk assessment
  .claude/skills/soc2-pbc/         PBC / evidence request list
  .claude/skills/soc2-sample/      Statistical/judgmental sampling
  .claude/skills/soc2-test/        Control testing + evidence review
  .claude/skills/soc2-workpaper/   Work paper assembly
  .claude/skills/soc2-review/      Peer review / quality review
  .claude/skills/soc2-package/     Final report assembly + Word export
  .claude/skills/soc2-references/  Shared reference knowledge base
  .claude/skills/soc2-templates/   Shared document templates
`);
  process.exit(0);
}

// Determine target directory
function getTargetDir() {
  if (hasGlobal) {
    return path.join(os.homedir(), '.claude', 'skills');
  }
  // Local install: find project root (nearest .git or package.json)
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return path.join(dir, '.claude', 'skills');
    }
    dir = path.dirname(dir);
  }
  // Fallback to cwd
  return path.join(process.cwd(), '.claude', 'skills');
}

const targetDir = getTargetDir();
const pluginRoot = path.join(__dirname, '..');

// Directories to install
const skillDirs = [
  'soc2-kickoff',
  'soc2-plan',
  'soc2-pbc',
  'soc2-sample',
  'soc2-test',
  'soc2-workpaper',
  'soc2-review',
  'soc2-package',
];

const sharedDirs = [
  { src: 'references', dest: 'soc2-references' },
  { src: 'templates', dest: 'soc2-templates' },
];

// Copy directory recursively
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Remove directory recursively
function removeDirSync(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Uninstall
if (hasUninstall) {
  console.log(`\n${bold}Uninstalling gsd-plugin-soc2${reset} from ${dim}${targetDir}${reset}\n`);
  let removed = 0;

  for (const skill of skillDirs) {
    const dest = path.join(targetDir, skill);
    if (fs.existsSync(dest)) {
      removeDirSync(dest);
      console.log(`  ${red}removed${reset} ${skill}/`);
      removed++;
    }
  }

  for (const { dest } of sharedDirs) {
    const destPath = path.join(targetDir, dest);
    if (fs.existsSync(destPath)) {
      removeDirSync(destPath);
      console.log(`  ${red}removed${reset} ${dest}/`);
      removed++;
    }
  }

  if (removed === 0) {
    console.log(`  ${dim}Nothing to remove.${reset}`);
  } else {
    console.log(`\n${green}Uninstalled ${removed} directories.${reset}\n`);
  }
  process.exit(0);
}

// Install
console.log(`\n${bold}Installing gsd-plugin-soc2${reset} v${pkg.version}`);
console.log(`${dim}Target: ${targetDir}${reset}\n`);

fs.mkdirSync(targetDir, { recursive: true });

// Install skill directories
for (const skill of skillDirs) {
  const src = path.join(pluginRoot, 'skills', skill);
  const dest = path.join(targetDir, skill);

  if (!fs.existsSync(src)) {
    console.log(`  ${yellow}skip${reset} ${skill}/ ${dim}(source not found)${reset}`);
    continue;
  }

  removeDirSync(dest); // Clean install
  copyDirSync(src, dest);
  console.log(`  ${green}installed${reset} ${skill}/`);
}

// Install shared directories
for (const { src: srcName, dest: destName } of sharedDirs) {
  const src = path.join(pluginRoot, srcName);
  const dest = path.join(targetDir, destName);

  if (!fs.existsSync(src)) {
    console.log(`  ${yellow}skip${reset} ${destName}/ ${dim}(source not found)${reset}`);
    continue;
  }

  removeDirSync(dest);
  copyDirSync(src, dest);
  console.log(`  ${green}installed${reset} ${destName}/`);
}

// Check for GSD installation
const gsdDir = path.join(path.dirname(targetDir), 'get-shit-done');
const hasGSD = fs.existsSync(gsdDir);

console.log('');
if (hasGSD) {
  console.log(`${green}GSD detected${reset} — skills will auto-discover via CLAUDE.md generation.`);
} else {
  console.log(`${cyan}Standalone mode${reset} — skills installed without GSD.`);
  console.log(`${dim}Use /soc2-kickoff to start a new engagement.${reset}`);
}

console.log(`
${bold}Installed skills:${reset}
  /soc2-kickoff     Start a SOC 2 engagement
  /soc2-plan        Audit planning + risk assessment
  /soc2-pbc         Generate PBC evidence request list
  /soc2-sample      Calculate sample sizes + select items
  /soc2-test        Test controls (inspect/reperform/observe/inquiry)
  /soc2-workpaper   Assemble formal work papers
  /soc2-review      Peer review / quality review
  /soc2-package     Final report assembly + Word export

${bold}Quick start:${reset}
  1. Run ${cyan}/soc2-kickoff${reset} with your engagement letter
  2. Follow the guided workflow through each phase
  3. State is stored in ${cyan}.audit/${reset} at your project root

${dim}Run with --uninstall to remove.${reset}
`);
