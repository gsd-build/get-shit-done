#!/usr/bin/env node
// gsd-hook-version: 1.42.3
// PreToolUse hook: enforce Conventional Commits format on git commit messages.
// OPT-IN: no-op unless config.json has hooks.community: true.

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
let enabled = false;
try {
  const cfgPath = path.join(cwd, '.planning', 'config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    enabled = cfg.hooks?.community === true;
  }
} catch (_) {}

if (!enabled) process.exit(0);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let command = '';
  try { command = JSON.parse(input).tool_input?.command || ''; } catch (_) {}

  // Only inspect git commit commands via isGitSubcommand.
  const gitCmdLib = path.join(__dirname, 'lib', 'git-cmd.js');
  let isCommit = false;
  if (fs.existsSync(gitCmdLib)) {
    try {
      const { isGitSubcommand } = require(gitCmdLib);
      isCommit = isGitSubcommand(command, 'commit');
    } catch (_) {}
  }

  if (!isCommit) process.exit(0);

  // Extract -m message
  const msgMatch = command.match(/-m\s+"([^"]+)"/) || command.match(/-m\s+'([^']+)'/);
  if (!msgMatch) process.exit(0);

  const subject = msgMatch[1].split('\n')[0];
  const ccRe = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?:\s+.+/;

  if (!ccRe.test(subject)) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      code: 'CONVENTIONAL_COMMITS_VIOLATION',
      reason: 'Commit message must follow Conventional Commits: <type>(<scope>): <subject>. Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore. Subject must be <=72 chars, lowercase, imperative mood, no trailing period.',
    }));
    process.exit(2);
  }

  if (subject.length > 72) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      code: 'COMMIT_SUBJECT_TOO_LONG',
      reason: 'Commit subject must be 72 characters or less.',
    }));
    process.exit(2);
  }

  process.exit(0);
});
