#!/usr/bin/env node
// PreToolUse(Bash) safety hook — blocks destructive commands
// Exit code 2 = block the tool use

const fs = require('fs');
const path = require('path');

const DANGEROUS_PATTERNS = [
  { pattern: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--force\s+--recursive|-[a-zA-Z]*f[a-zA-Z]*r)\s+.*\.planning/i, reason: 'Blocks rm -rf .planning — prevents accidental deletion of project state' },
  { pattern: /git\s+reset\s+--hard/i, reason: 'Blocks git reset --hard — prevents irreversible history loss' },
  { pattern: /git\s+push\s+.*--force(?!-with-lease).*\b(main|master)\b/i, reason: 'Blocks force push to main/master — prevents overwriting shared history' },
  { pattern: /git\s+push\s+--force(?!-with-lease)\b/i, reason: 'Blocks git push --force — use --force-with-lease instead' },
  { pattern: /git\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*d|git\s+clean\s+-[a-zA-Z]*d[a-zA-Z]*f/i, reason: 'Blocks git clean -fd — prevents removing untracked files' },
  { pattern: /DROP\s+(TABLE|DATABASE)\b/i, reason: 'Blocks DROP TABLE/DATABASE — prevents accidental SQL destruction' },
];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    if (data.tool_name !== 'Bash') { process.exit(0); }

    const command = data.tool_input?.command || '';
    const cwd = data.cwd || process.cwd();

    // Check if hooks are enabled
    try {
      const configPath = path.join(cwd, '.planning', 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.hooks && config.hooks.blockDangerousCommands === false) {
          process.exit(0); // Hook disabled
        }
      }
    } catch (e) { /* default to enabled */ }

    for (const { pattern, reason } of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        // Output block decision
        const result = JSON.stringify({ decision: 'block', reason });
        process.stdout.write(result);
        process.exit(2); // Hard block
      }
    }

    // Allow
    process.exit(0);
  } catch (e) {
    process.exit(0); // Silent fail — never block on hook errors
  }
});
