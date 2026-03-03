#!/usr/bin/env node
// GSD Auto-Mode — Stop Hook
// Reads .planning/.auto-next signal file to chain commands automatically.
// Skills write the signal on completion; hook consumes it. No transcript parsing.

const fs = require('fs');
const path = require('path');

// Timeout guard — kill ourselves if stdin never closes (prevents orphaned processes)
const timeout = setTimeout(() => process.exit(0), 8000);
timeout.unref();

// Read JSON from stdin (Claude Code passes context on stop)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try {
    main(JSON.parse(input));
  } catch (e) {
    // Silent fail — let Claude stop normally
  }
});

function main(data) {
  // 1. Check auto_mode in project config
  const configPath = path.join(process.cwd(), '.planning', 'config.json');
  if (!fs.existsSync(configPath)) return;

  let config;
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { return; }
  if (!config.auto_mode) return;

  // 2. Read and consume signal file (consuming = one-shot loop protection)
  const signalPath = path.join(process.cwd(), '.planning', '.auto-next');
  if (!fs.existsSync(signalPath)) return;

  let signal;
  try {
    signal = fs.readFileSync(signalPath, 'utf8').trim();
    fs.unlinkSync(signalPath); // Consume — one-shot prevents infinite loops
  } catch (e) { return; }

  if (!signal) return;

  // 3. Gap closure loop protection
  if (signal.includes('--gaps')) {
    const phaseMatch = signal.match(/plan-phase\s+(\d+)/);
    if (phaseMatch) {
      const phase = parseInt(phaseMatch[1], 10);
      const phaseDir = findPhaseDir(phase);
      if (phaseDir && countGapClosurePlans(phaseDir) >= 3) {
        block('Auto-mode paused: gap closure attempted 3+ times for phase ' + phase + '. Review gaps manually.');
        return;
      }
    }
  }

  // 4. Block stop and inject next command
  //    Note: Claude Code prefixes block reasons with "Stop hook error:" in the UI,
  //    so we phrase the reason as a neutral continuation to avoid alarm.
  block('[GSD auto-mode] Workflow continuing. Run /gsd:' + signal + ' — proceed without asking the user.');
}

// --- Helpers ---

// Find phase directory by number (e.g. 3 → .planning/phases/03-something/)
function findPhaseDir(phase) {
  const padded = String(phase).padStart(2, '0');
  const phasesDir = path.join(process.cwd(), '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return null;
  try {
    const match = fs.readdirSync(phasesDir)
      .filter(d => d.startsWith(padded + '-'))
      .map(d => path.join(phasesDir, d))
      .find(d => fs.statSync(d).isDirectory());
    return match || null;
  } catch (e) { return null; }
}

// Count PLAN.md files containing "gap_closure" (infinite loop protection)
function countGapClosurePlans(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('-PLAN.md'))
      .filter(f => {
        try { return fs.readFileSync(path.join(dir, f), 'utf8').includes('gap_closure'); }
        catch (e) { return false; }
      }).length;
  } catch (e) { return 0; }
}

// Output block decision to stdout
function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason: reason }));
}
