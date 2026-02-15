#!/usr/bin/env node
// GSD PR Branch Auto-Sync — git post-commit hook
// Automatically updates PR branch after each commit on a feature branch.
// Runs in background, never blocks commits, silent on all errors.

// Re-entrancy guard: prevent infinite loops when cherry-picks trigger post-commit
if (process.env.GSD_PR_SYNC_RUNNING === '1') process.exit(0);

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

try {
  // Find project root (hook may run from subdirectory)
  const projectRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

  // Skip on main/master or detached HEAD
  let branch;
  try {
    branch = execSync('git symbolic-ref --short HEAD', { encoding: 'utf8', cwd: projectRoot }).trim();
  } catch {
    process.exit(0); // detached HEAD
  }
  if (branch === 'main' || branch === 'master') process.exit(0);

  // Check if auto_sync is enabled in config
  const configPath = path.join(projectRoot, '.planning', 'config.json');
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    process.exit(0); // no config or parse error
  }
  const autoSync = (config.pr_branch && config.pr_branch.auto_sync === true)
    || config.pr_branch_auto_sync === true;
  if (!autoSync) process.exit(0);

  // Resolve gsd-tools.js path (installed at ../get-shit-done/bin/gsd-tools.js)
  const gsdToolsPath = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.js');
  if (!fs.existsSync(gsdToolsPath)) process.exit(0);

  // Spawn in background with re-entrancy guard
  const child = spawn(process.execPath, [gsdToolsPath, 'pr-branch'], {
    cwd: projectRoot,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, GSD_PR_SYNC_RUNNING: '1' }
  });
  child.unref();
} catch {
  // Silent failure — never break host app
}
