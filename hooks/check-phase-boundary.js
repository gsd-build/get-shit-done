#!/usr/bin/env node
// PreToolUse(Write/Edit) hook — warns or blocks writes outside current phase directory
// Reads current phase from .planning/STATE.md and checks if the target file
// is inside the expected phase directory.
//
// Behavior:
//   - Planning files (.planning/**) are always allowed
//   - Files inside current phase directory are allowed
//   - Files outside phase dir: warn by default, block if enforcePhaseBoundaries: true
//   - Config toggle: config.hooks.enforcePhaseBoundaries (default: false = warn only)
//
// Input: JSON on stdin with { tool_name, tool_input, cwd }
// Output: JSON { decision: "allow" } or { decision: "block", reason: "..." }

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();

    // Only handle Write and Edit tools
    if (data.tool_name !== 'Write' && data.tool_name !== 'Edit') {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    // Check config toggle
    const config = loadHookConfig(cwd);
    // If explicitly set to false by name, skip entirely
    if (config.enforcePhaseBoundaries === false && config.checkPhaseBoundary === false) {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    const filePath = (data.tool_input && (data.tool_input.file_path || data.tool_input.path)) || '';
    if (!filePath) {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    // Normalize paths
    const normalizedFile = filePath.replace(/\\/g, '/');
    const normalizedCwd = cwd.replace(/\\/g, '/');

    // Planning files are always allowed
    if (normalizedFile.includes('.planning/')) {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      logEvent(cwd, filePath, 'allow', 'planning-file');
      process.exit(0);
    }

    // Read STATE.md to get current phase
    const statePath = path.join(cwd, '.planning', 'STATE.md');
    let stateContent = '';
    try {
      stateContent = fs.readFileSync(statePath, 'utf8');
    } catch (e) {
      // No STATE.md — can't check boundaries, allow
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    const phaseMatch = stateContent.match(/\*\*Current Phase:\*\*\s*(\S+)/);
    if (!phaseMatch) {
      // No phase info — allow
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    const currentPhase = phaseMatch[1].replace(/^0+/, '') || '0';
    const paddedPhase = currentPhase.padStart(2, '0');

    // Find the current phase directory
    const phasesDir = path.join(cwd, '.planning', 'phases');
    let phaseDir = null;
    try {
      if (fs.existsSync(phasesDir)) {
        const dirs = fs.readdirSync(phasesDir);
        const match = dirs.find(d =>
          d.startsWith(paddedPhase + '-') || d.startsWith(paddedPhase + '.')
        );
        if (match) {
          phaseDir = path.join(phasesDir, match).replace(/\\/g, '/');
        }
      }
    } catch (e) {
      // Can't read phases dir — allow
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    if (!phaseDir) {
      // No phase directory found — allow
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    // Check if the file is inside the phase directory
    const absoluteFile = path.isAbsolute(filePath)
      ? filePath.replace(/\\/g, '/')
      : path.resolve(cwd, filePath).replace(/\\/g, '/');

    if (absoluteFile.startsWith(phaseDir + '/') || absoluteFile === phaseDir) {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      logEvent(cwd, filePath, 'allow', 'in-phase');
      process.exit(0);
    }

    // File is outside phase directory
    const enforce = config.enforcePhaseBoundaries === true;

    if (enforce) {
      const reason = `File "${path.basename(filePath)}" is outside the current phase directory (phase ${currentPhase}). Phase boundary enforcement is enabled.`;
      process.stdout.write(JSON.stringify({ decision: 'block', reason }));
      logEvent(cwd, filePath, 'block', 'out-of-phase');
      process.exit(0);
    }

    // Warn only (default behavior)
    process.stderr.write(
      `[check-phase-boundary] Warning: "${path.basename(filePath)}" is outside the current phase ${currentPhase} directory\n`
    );
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
    logEvent(cwd, filePath, 'warn', 'out-of-phase');

  } catch (e) {
    // Silent fail — never block on hook bugs
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  }
  process.exit(0);
});

function loadHookConfig(cwd) {
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.hooks || {};
    }
  } catch (e) { /* ignore parse errors */ }
  return {};
}

function logEvent(cwd, filePath, decision, reason) {
  try {
    const logsDir = path.join(cwd, '.planning', 'logs');
    const logFile = path.join(logsDir, 'hooks.jsonl');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const entry = {
      timestamp: new Date().toISOString(),
      hook: 'check-phase-boundary',
      event: 'PreToolUse',
      decision,
      file: path.basename(filePath),
      reason,
    };

    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch (e) { /* ignore logging errors */ }
}
