#!/usr/bin/env node
// PreToolUse(Bash) hook — validates git commit messages and blocks secret staging
// Exit code 2 = block

const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = ['.env', '.key', '.pem', 'credentials.', '.secret', 'id_rsa', 'id_ed25519'];
const COMMIT_FORMAT = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|enhancement|hotfix)(\(.+\))?: .+/;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    if (data.tool_name !== 'Bash') { process.exit(0); }

    const command = data.tool_input?.command || '';
    const cwd = data.cwd || process.cwd();

    // Check config
    try {
      const configPath = path.join(cwd, '.planning', 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.hooks && config.hooks.validateCommits === false) {
          process.exit(0);
        }
      }
    } catch (e) { /* default to enabled */ }

    // Check for git add of secrets
    if (/git\s+add/.test(command)) {
      for (const pattern of SECRET_PATTERNS) {
        if (command.includes(pattern)) {
          process.stdout.write(JSON.stringify({
            decision: 'block',
            reason: `Blocked staging potentially sensitive file matching "${pattern}". Stage files individually and ensure no secrets are committed.`
          }));
          process.exit(2);
        }
      }
    }

    // Check commit message format
    const commitMatch = command.match(/git\s+commit\s+.*-m\s+["']([^"']+)["']/);
    if (commitMatch) {
      const firstLine = commitMatch[1].split('\n')[0].trim();
      if (!COMMIT_FORMAT.test(firstLine)) {
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: `Commit message "${firstLine}" does not match format: type(scope): description. Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, enhancement, hotfix`
        }));
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (e) {
    process.exit(0); // Silent fail — never block on hook errors
  }
});
