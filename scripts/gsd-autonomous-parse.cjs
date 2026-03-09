#!/usr/bin/env node
/**
 * gsd-autonomous-parse.cjs - Cross-platform argument parser for /gsd-autonomous
 * Parses arguments, extracts phase ranges from prose, manages execution flow.
 * Works on Windows, macOS, and Linux.
 */
'use strict';

const { existsSync, statSync } = require('fs');
const { join } = require('path');
const os = require('os');

const args = process.argv.slice(2);

let phase = '';
let fromPhase = '';
let toPhase = '';
let maxIterations = '';
let userTask = '';

const defaultGuidance = 'Use TDD approach when possible. Spawn subagents in parallel aggressively. Verify thoroughly.';

const home = os.homedir();
const gsdInstalled = existsSync(join(home, '.config', 'opencode', 'get-shit-done')) ||
                     existsSync(join(home, '.claude', 'get-shit-done'));

const planningExists = existsSync('.planning');
const roadmapExists = planningExists && existsSync(join('.planning', 'ROADMAP.md'));
const stateExists = planningExists && existsSync(join('.planning', 'STATE.md'));

for (const arg of args) {
  if (arg.startsWith('--phase=')) {
    phase = arg.slice('--phase='.length);
  } else if (arg.startsWith('--from=')) {
    fromPhase = arg.slice('--from='.length);
  } else if (arg.startsWith('--to=')) {
    toPhase = arg.slice('--to='.length);
  } else if (arg.startsWith('--max-iterations=')) {
    maxIterations = arg.slice('--max-iterations='.length);
  } else if (arg.startsWith('-N=')) {
    maxIterations = arg.slice('-N='.length);
  } else if (arg === '-N') {
    // -N without =, next arg would be the value (simplified: use -N= format)
  } else if (arg.startsWith('--')) {
    // Unknown flag, skip
  } else {
    // Accumulate user task
    userTask = userTask ? `${userTask} ${arg}` : arg;
  }
}

// Trim user task
userTask = userTask.trim();

// Apply default guidance if no user task provided
if (!userTask) {
  userTask = defaultGuidance;
}

// Extract phase range from prose if not specified via flags
function extractPhaseRange(text) {
  // "phases X to Y" or "phase X to Y"
  let match = text.match(/phases?\s+(\d+)\s+to\s+(\d+)/i);
  if (match) return { from: match[1], to: match[2] };
  
  // "phases X through Y"
  match = text.match(/phases?\s+(\d+)\s+through\s+(\d+)/i);
  if (match) return { from: match[1], to: match[2] };
  
  // "phases X-Y" (with hyphen)
  match = text.match(/phases?\s+(\d+)\s*-\s*(\d+)/i);
  if (match) return { from: match[1], to: match[2] };
  
  return null;
}

if (!fromPhase && !phase) {
  const range = extractPhaseRange(userTask);
  if (range) {
    fromPhase = range.from;
    toPhase = range.to;
  }
}

// Determine mode and output
if (phase || fromPhase) {
  // Phase-based mode
  if (phase) {
    fromPhase = phase;
    toPhase = toPhase || phase;
  } else if (!toPhase) {
    toPhase = fromPhase;
  }
  console.log(`MODE: phase`);
  console.log(`FROM: ${fromPhase}`);
  console.log(`TO: ${toPhase}`);
} else {
  // Ad-hoc mode (default)
  console.log(`MODE: ad-hoc`);
  console.log(`TASK: ${userTask}`);
}

// Output iteration limit (empty = loop forever)
console.log(`MAX_ITERATIONS: ${maxIterations || 'unlimited'}`);
console.log(`UNTIL_COMPLETE: true`);
console.log(`USER_TASK: ${userTask}`);
console.log(`GSD_INSTALLED: ${gsdInstalled}`);
console.log(`PLANNING_EXISTS: ${planningExists}`);
console.log(`ROADMAP_EXISTS: ${roadmapExists}`);
console.log(`STATE_EXISTS: ${stateExists}`);
