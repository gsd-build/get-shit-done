#!/usr/bin/env node
/**
 * GSD State Verification Script
 * Run after any /gsd: command to verify artifacts were created
 *
 * Cross-platform: Works on Windows, macOS, and Linux
 */

const fs = require('fs');
const path = require('path');

const PLANNING_DIR = '.planning';
let errors = 0;

function formatDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 16);
}

function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' GSD State Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Check STATE.md exists and was recently modified
  const statePath = path.join(PLANNING_DIR, 'STATE.md');
  if (fs.existsSync(statePath)) {
    const stats = fs.statSync(statePath);
    const modified = formatDate(stats.mtime);
    console.log(`✅ STATE.md exists (modified: ${modified})`);
  } else {
    console.log('❌ STATE.md MISSING');
    errors++;
  }

  console.log('');
  console.log('Phase Directory Status:');
  console.log('─────────────────────────────────────────────────────');

  // Check phases directory exists
  const phasesDir = path.join(PLANNING_DIR, 'phases');
  if (!fs.existsSync(phasesDir)) {
    console.log('❌ No phases directory found');
    errors++;
    printSummary();
    return;
  }

  // Get all phase directories
  const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  for (const phase of phaseDirs) {
    const phaseDir = path.join(phasesDir, phase);

    let files = [];
    try {
      files = fs.readdirSync(phaseDir);
    } catch (e) {
      console.log(`❌ ${phase}: Cannot read directory`);
      errors++;
      continue;
    }

    // Count specific file types
    const plans = files.filter(f => f.endsWith('-PLAN.md')).length;
    const summaries = files.filter(f => f.endsWith('-SUMMARY.md')).length;
    const fileCount = files.length;

    if (fileCount === 0) {
      console.log(`❌ ${phase}: EMPTY (no artifacts)`);
      errors++;
    } else if (summaries === 0 && plans > 0) {
      console.log(`⚠️  ${phase}: PLAN exists but NO SUMMARY (incomplete execution)`);
      errors++;
    } else if (summaries > 0) {
      console.log(`✅ ${phase}: ${plans} plan(s), ${summaries} summary(s)`);
    } else {
      console.log(`⚠️  ${phase}: ${fileCount} file(s) but no PLAN or SUMMARY`);
    }
  }

  printSummary();
}

function printSummary() {
  console.log('');
  console.log('─────────────────────────────────────────────────────');

  if (errors === 0) {
    console.log('✅ All phases have artifacts. GSD state is consistent.');
  } else {
    console.log(`❌ Found ${errors} issue(s). GSD state needs attention.`);
    console.log('');
    console.log('To fix empty phases, run:');
    console.log('  /gsd:plan-phase <phase-number>');
    console.log('  /gsd:execute-phase <phase-number>');
  }

  console.log('');
  process.exit(errors > 0 ? 1 : 0);
}

main();
