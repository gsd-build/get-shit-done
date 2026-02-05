#!/usr/bin/env node
// GSD Auto-Mode — Stop Hook
// Chains plan-phase → execute-phase → plan-phase automatically

const fs = require('fs');
const path = require('path');

// Read JSON from stdin (Claude Code passes context on stop)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    main(JSON.parse(input));
  } catch (e) {
    // Silent fail — let Claude stop normally
  }
});

function main(data) {
  // 0. Prevent infinite loops — if we're already continuing from a stop hook, exit
  if (data.stop_hook_active) return;

  // 1. Check auto_mode in project config
  const configPath = path.join(process.cwd(), '.planning', 'config.json');
  if (!fs.existsSync(configPath)) return;

  let config;
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { return; }
  if (!config.auto_mode) return;

  // 2. Read transcript tail
  const transcriptPath = data.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;

  let tail;
  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n');
    tail = lines.slice(-200).join('\n');
  } catch (e) { return; }

  if (!tail) return;

  // 3. Hard stops — never auto-continue past these
  if (tail.includes('MILESTONE COMPLETE')) return;
  if (tail.includes('human_needed')) return;
  if (tail.includes('\u2551  ERROR')) return; // ║  ERROR (error box pattern from ui-brand.md)

  // 4. Detect GSD completion patterns and route

  // PHASE X PLANNED → execute phase X
  if (tail.includes('PLANNED')) {
    const phase = extractPhaseFrom(tail, 'PLANNED');
    if (phase != null) {
      block('Auto-mode: Phase ' + phase + ' planned. Run /gsd:execute-phase ' + phase);
      return;
    }
  }

  // PHASE X COMPLETE → plan phase X+1
  if (tail.includes('COMPLETE')) {
    const phase = extractPhaseFrom(tail, 'COMPLETE');
    if (phase != null) {
      block('Auto-mode: Plan next phase. Run /gsd:plan-phase ' + (phase + 1));
      return;
    }
  }

  // GAPS FOUND → plan --gaps (with infinite loop protection)
  if (tail.includes('GAPS FOUND')) {
    const phase = extractPhaseFrom(tail, 'GAPS FOUND');
    if (phase != null) {
      const phaseDir = findPhaseDir(phase);
      if (phaseDir) {
        const gapCount = countGapClosurePlans(phaseDir);
        if (gapCount >= 3) {
          block('Auto-mode: Gap closure attempted 3+ times. Stopping for manual review.');
          return;
        }
      }
      block('Auto-mode: Gaps found. Run /gsd:plan-phase ' + phase + ' --gaps');
      return;
    }
  }

  // AUTO-MODE ON → determine next action from STATE.md
  if (tail.includes('AUTO-MODE ON')) {
    const statePath = path.join(process.cwd(), '.planning', 'STATE.md');
    if (!fs.existsSync(statePath)) return;

    let state;
    try { state = fs.readFileSync(statePath, 'utf8'); } catch (e) { return; }

    const match = state.match(/Phase:\s*(\d+)/);
    if (!match) return;
    const phase = parseInt(match[1], 10);
    if (!Number.isInteger(phase)) return;

    const phaseDir = findPhaseDir(phase);
    if (!phaseDir) {
      block('Auto-mode: Starting. Run /gsd:plan-phase ' + phase);
      return;
    }

    const planCount = countFilesBySuffix(phaseDir, '-PLAN.md');
    const summaryCount = countFilesBySuffix(phaseDir, '-SUMMARY.md');

    if (planCount === 0) {
      block('Auto-mode: Starting. Run /gsd:plan-phase ' + phase);
    } else if (summaryCount < planCount) {
      block('Auto-mode: Starting. Run /gsd:execute-phase ' + phase);
    } else {
      block('Auto-mode: Starting. Run /gsd:plan-phase ' + (phase + 1));
    }
  }
}

// --- Helpers ---

// Extract phase number from a specific GSD banner line
// e.g. extractPhaseFrom(text, 'PLANNED') finds "PHASE 3 PLANNED" → 3
function extractPhaseFrom(text, pattern) {
  const regex = new RegExp('.*PHASE\\s+(\\d+).*' + escapeRegex(pattern) + '.*', 'g');
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return null;
  const num = parseInt(matches[matches.length - 1][1], 10);
  return Number.isInteger(num) ? num : null;
}

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

// Count files ending with a suffix in a directory
function countFilesBySuffix(dir, suffix) {
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith(suffix)).length;
  } catch (e) { return 0; }
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

// Escape string for use in RegExp
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Output block decision to stdout
function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason: reason }));
}
