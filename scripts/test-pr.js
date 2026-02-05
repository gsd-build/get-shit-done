#!/usr/bin/env node
/**
 * test-pr.js — Switch global GSD install between main and a PR branch.
 *
 * Uses git worktrees so the main checkout stays untouched.
 * The installer's __dirname resolves to the worktree, copying PR files.
 *
 * Usage:
 *   node scripts/test-pr.js <branch>      Install GSD from <branch> via worktree
 *   node scripts/test-pr.js main          Reinstall GSD from main (no worktree)
 *   node scripts/test-pr.js --status      Show installed version & active worktrees
 *   node scripts/test-pr.js --cleanup     Remove all test worktrees
 *   node scripts/test-pr.js --help        Show usage
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── Colors (match install.js) ──────────────────────────────────────
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

// ── Paths ──────────────────────────────────────────────────────────
const REPO_ROOT = path.join(__dirname, '..');
const WORKTREE_DIR = path.join(REPO_ROOT, '.worktrees');

// ── Helpers ────────────────────────────────────────────────────────

/** Sanitize branch name for use as directory name */
function sanitizeBranch(branch) {
  return branch.replace(/[\/\\:*?"<>|]/g, '-');
}

/** Get worktree path for a branch */
function getWorktreePath(branch) {
  return path.join(WORKTREE_DIR, sanitizeBranch(branch));
}

/** Run a command, return trimmed stdout */
function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT, ...opts }).trim();
}

/** Run a command with output visible to user */
function runVisible(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: REPO_ROOT, ...opts });
}

/** Get the currently checked-out branch name */
function currentBranch() {
  try {
    return run('git branch --show-current');
  } catch { return ''; }
}

/** Check if a branch exists locally */
function branchExistsLocally(branch) {
  try {
    run(`git rev-parse --verify refs/heads/${branch}`);
    return true;
  } catch { return false; }
}

/** Check if a branch exists on origin */
function branchExistsOnOrigin(branch) {
  try {
    run(`git ls-remote --exit-code --heads origin ${branch}`);
    return true;
  } catch { return false; }
}

// ── Worktree Management ────────────────────────────────────────────

function ensureWorktree(branch) {
  const wtPath = getWorktreePath(branch);

  // If directory exists but is corrupt (no .git), remove and recreate
  if (fs.existsSync(wtPath) && !fs.existsSync(path.join(wtPath, '.git'))) {
    console.log(`${yellow}Removing corrupt worktree directory...${reset}`);
    fs.rmSync(wtPath, { recursive: true, force: true });
    try { run('git worktree prune'); } catch { /* ignore */ }
  }

  // Reuse existing worktree — just pull latest
  if (fs.existsSync(wtPath)) {
    console.log(`${dim}Worktree exists, updating...${reset}`);
    try {
      runVisible(`git pull --ff-only`, { cwd: wtPath });
    } catch {
      console.log(`${yellow}Pull failed (may be detached), continuing with existing state${reset}`);
    }
    return wtPath;
  }

  // Ensure branch is available locally
  if (!branchExistsLocally(branch)) {
    console.log(`${dim}Branch not found locally, fetching from origin...${reset}`);
    try {
      runVisible(`git fetch origin ${branch}`);
    } catch {
      // If specific branch fetch fails, do a general fetch
      runVisible('git fetch origin');
    }

    if (!branchExistsLocally(branch) && branchExistsOnOrigin(branch)) {
      // Create local tracking branch
      run(`git branch ${branch} origin/${branch}`);
    }

    if (!branchExistsLocally(branch)) {
      console.error(`${red}Branch '${branch}' not found locally or on origin.${reset}`);
      process.exit(1);
    }
  }

  // Create worktree directory
  if (!fs.existsSync(WORKTREE_DIR)) {
    fs.mkdirSync(WORKTREE_DIR, { recursive: true });
  }

  console.log(`${cyan}Creating worktree for ${bold}${branch}${reset}${cyan}...${reset}`);
  runVisible(`git worktree add "${wtPath}" ${branch}`);

  return wtPath;
}

// ── Config Sync ────────────────────────────────────────────────────

function syncConfig(wtPath, branch) {
  const srcConfig = path.join(REPO_ROOT, '.planning', 'config.json');
  const destDir = path.join(wtPath, '.planning');
  const destConfig = path.join(destDir, 'config.json');

  if (!fs.existsSync(srcConfig)) return;

  try {
    const config = JSON.parse(fs.readFileSync(srcConfig, 'utf8'));

    // Add agent_teams flag for agent-teams branches
    if (branch.includes('agent-teams')) {
      config.agent_teams = true;
    }

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.writeFileSync(destConfig, JSON.stringify(config, null, 2) + '\n');
    console.log(`${dim}Synced .planning/config.json to worktree${reset}`);
  } catch {
    console.log(`${yellow}Could not sync config (non-fatal)${reset}`);
  }
}

// ── Installation ───────────────────────────────────────────────────

function installFrom(sourceDir, label) {
  console.log(`\n${cyan}Building hooks in ${label}...${reset}`);
  const buildScript = path.join(sourceDir, 'scripts', 'build-hooks.js');
  if (fs.existsSync(buildScript)) {
    runVisible(`node "${buildScript}"`, { cwd: sourceDir });
  } else {
    console.log(`${yellow}No build-hooks.js found, skipping hook build${reset}`);
  }

  console.log(`\n${cyan}Installing GSD from ${bold}${label}${reset}${cyan}...${reset}\n`);
  const installer = path.join(sourceDir, 'bin', 'install.js');
  runVisible(`node "${installer}" --claude --global`, { cwd: sourceDir });
}

// ── Post-Install Message ───────────────────────────────────────────

function showPostInstallMessage(branch) {
  console.log(`\n${green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
  console.log(`${green}GSD installed from: ${bold}${branch}${reset}`);
  console.log(`${green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);

  if (branch.includes('agent-teams')) {
    console.log(`\n${yellow}This branch requires an environment variable:${reset}`);
    console.log(`${dim}Set it before running Claude Code:${reset}\n`);
    if (process.platform === 'win32') {
      console.log(`  ${cyan}PowerShell:${reset}  $env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"`);
      console.log(`  ${cyan}cmd:${reset}         set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`);
    } else {
      console.log(`  ${cyan}export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1${reset}`);
    }
    console.log(`\n${dim}Then test: /gsd:settings, /gsd:new-project, /gsd:debug${reset}`);
  }

  if (branch === 'main') {
    console.log(`\n${dim}You're back on the stable release.${reset}`);
  }
}

// ── Status ─────────────────────────────────────────────────────────

function showStatus() {
  // Installed version
  const pkg = require(path.join(REPO_ROOT, 'package.json'));
  console.log(`${cyan}GSD repo version:${reset} ${bold}${pkg.version}${reset}`);
  console.log(`${cyan}Current branch:${reset}   ${bold}${run('git branch --show-current')}${reset}`);

  // Check globally installed version
  const homeDir = require('os').homedir();
  const globalCmd = path.join(homeDir, '.claude', 'commands', 'gsd');
  if (fs.existsSync(globalCmd)) {
    console.log(`${cyan}Global install:${reset}   ${green}present${reset} ${dim}(${globalCmd})${reset}`);
  } else {
    console.log(`${cyan}Global install:${reset}   ${yellow}not found${reset}`);
  }

  // List worktrees
  console.log(`\n${cyan}Worktrees:${reset}`);
  try {
    const output = run('git worktree list');
    const lines = output.split('\n');
    if (lines.length <= 1) {
      console.log(`  ${dim}No test worktrees active${reset}`);
    } else {
      for (const line of lines) {
        const isWorktree = line.includes('.worktrees');
        console.log(`  ${isWorktree ? yellow : dim}${line}${reset}`);
      }
    }
  } catch {
    console.log(`  ${dim}Could not list worktrees${reset}`);
  }
}

// ── Cleanup ────────────────────────────────────────────────────────

function cleanup() {
  if (!fs.existsSync(WORKTREE_DIR)) {
    console.log(`${dim}No worktrees directory found — nothing to clean up.${reset}`);
    return;
  }

  const entries = fs.readdirSync(WORKTREE_DIR);
  if (entries.length === 0) {
    console.log(`${dim}No worktrees found — nothing to clean up.${reset}`);
    fs.rmSync(WORKTREE_DIR, { recursive: true, force: true });
    return;
  }

  console.log(`${cyan}Removing ${entries.length} worktree(s)...${reset}`);

  for (const entry of entries) {
    const wtPath = path.join(WORKTREE_DIR, entry);
    if (!fs.statSync(wtPath).isDirectory()) continue;

    try {
      runVisible(`git worktree remove "${wtPath}" --force`);
      console.log(`  ${green}Removed${reset} ${entry}`);
    } catch {
      // Fallback: manual removal + prune
      console.log(`  ${yellow}Force-removing${reset} ${entry}`);
      fs.rmSync(wtPath, { recursive: true, force: true });
    }
  }

  // Clean up any stale worktree refs
  try { run('git worktree prune'); } catch { /* ignore */ }

  // Remove the .worktrees directory itself
  if (fs.existsSync(WORKTREE_DIR)) {
    fs.rmSync(WORKTREE_DIR, { recursive: true, force: true });
  }

  console.log(`${green}Cleanup complete.${reset}`);
}

// ── Help ───────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
${cyan}${bold}GSD PR Testing Tool${reset}
${dim}Switch global GSD install between main and PR branches${reset}

${yellow}Usage:${reset}
  node scripts/test-pr.js <branch>      Install GSD from <branch> via worktree
  node scripts/test-pr.js main          Reinstall GSD from main (no worktree)
  node scripts/test-pr.js --status      Show installed version & active worktrees
  node scripts/test-pr.js --cleanup     Remove all test worktrees
  node scripts/test-pr.js --help        Show this help

${yellow}Examples:${reset}
  ${dim}# Install the agent-teams PR version${reset}
  node scripts/test-pr.js enhancement/agent-teams

  ${dim}# Switch back to stable${reset}
  node scripts/test-pr.js main

  ${dim}# Check what's installed${reset}
  node scripts/test-pr.js --status

  ${dim}# Clean up when done testing${reset}
  node scripts/test-pr.js --cleanup

${yellow}How it works:${reset}
  Creates a git worktree in .worktrees/ for the target branch, builds
  hooks, then runs the GSD installer from that worktree. The installer's
  __dirname resolves to the worktree, so it copies the PR's files globally.
  For 'main', installs directly from the current repo (no worktree needed).
`);
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  // Ensure we're in a git repo
  try {
    run('git rev-parse --is-inside-work-tree');
  } catch {
    console.error(`${red}Not inside a git repository.${reset}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--status')) {
    showStatus();
    return;
  }

  if (args.includes('--cleanup')) {
    cleanup();
    return;
  }

  // Branch argument
  const branch = args[0];

  if (branch === currentBranch()) {
    // Already on the target branch — install directly from repo root
    // (git won't allow a worktree for an already-checked-out branch)
    console.log(`${cyan}Installing GSD from ${bold}${branch}${reset}${cyan} (repo root)...${reset}`);
    installFrom(REPO_ROOT, branch);
    showPostInstallMessage(branch);
    return;
  }

  // Different branch — create/reuse worktree and install from it
  const wtPath = ensureWorktree(branch);
  syncConfig(wtPath, branch);
  installFrom(wtPath, branch);
  showPostInstallMessage(branch);
}

main();
