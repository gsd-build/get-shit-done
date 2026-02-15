#!/usr/bin/env node
// PreCompact — preserves rich session context before lossy compaction
// Layer 3 of 3-layer context budget management system
// Enhanced version of gsd-precompact.js with richer context preservation

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();
    const planningDir = path.join(cwd, '.planning');

    const statePath = path.join(planningDir, 'STATE.md');
    if (!fs.existsSync(statePath)) {
      process.exit(0);
    }

    let stateContent = fs.readFileSync(statePath, 'utf8');
    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

    // Gather context from various sources
    let currentPhase = 'unknown';
    let currentPlan = 'unknown';
    let activeOperation = 'none';

    const phaseMatch = stateContent.match(/Phase:\s*(.+)/);
    if (phaseMatch) currentPhase = phaseMatch[1].trim();

    const planMatch = stateContent.match(/Plan:\s*(.+)/);
    if (planMatch) currentPlan = planMatch[1].trim();

    // Read active operation signal
    const activeOpPath = path.join(planningDir, '.active-operation');
    if (fs.existsSync(activeOpPath)) {
      try {
        activeOperation = fs.readFileSync(activeOpPath, 'utf8').trim();
      } catch (e) { /* ignore */ }
    }

    // Read active plan signal (which plan is currently executing)
    let activePlan = 'none';
    const activePlanPath = path.join(planningDir, '.active-plan');
    if (fs.existsSync(activePlanPath)) {
      try {
        activePlan = fs.readFileSync(activePlanPath, 'utf8').trim();
      } catch (e) { /* ignore */ }
    }

    // Read latest .PROGRESS file for task-level position
    let taskPosition = 'unknown';
    try {
      const entries = fs.readdirSync(planningDir);
      const progressFiles = entries.filter(e => e.startsWith('.PROGRESS-')).sort();
      if (progressFiles.length > 0) {
        const latest = progressFiles[progressFiles.length - 1];
        const progressData = JSON.parse(fs.readFileSync(path.join(planningDir, latest), 'utf8'));
        taskPosition = `task ${progressData.task || '?'}/${progressData.total || '?'}`;
        if (progressData.commit) taskPosition += ` (last commit: ${progressData.commit})`;
      }
    } catch (e) { /* ignore */ }

    // Read roadmap progress summary
    let roadmapSummary = 'unavailable';
    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      try {
        const roadmap = fs.readFileSync(roadmapPath, 'utf8');
        const phases = roadmap.match(/^##\s+Phase\s+\d+/gm);
        const completed = roadmap.match(/\[x\]|\bcomplete\b/gi);
        roadmapSummary = `${phases ? phases.length : '?'} phases, ~${completed ? completed.length : 0} completed`;
      } catch (e) { /* ignore */ }
    }

    // Read context tracker stats
    let contextStats = 'no tracking data';
    const trackerPath = path.join(planningDir, '.context-tracker');
    if (fs.existsSync(trackerPath)) {
      try {
        const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
        contextStats = `${tracker.reads} reads, ${Math.round(tracker.chars / 1000)}k chars, ${tracker.files.length} unique files`;
      } catch (e) { /* ignore */ }
    }

    const continuity = `## Session Continuity

Last session: ${now}
Stopped at: Context compaction
Active phase: ${currentPhase}
Active plan: ${currentPlan}
Active operation: ${activeOperation}
Executing plan: ${activePlan}
Task position: ${taskPosition}
Roadmap progress: ${roadmapSummary}
Context consumption: ${contextStats}
Resume action: Check STATE.md and continue from current phase/plan`;

    // Replace existing section or append
    const sectionRegex = /## Session Continuity[\s\S]*$/;
    if (sectionRegex.test(stateContent)) {
      stateContent = stateContent.replace(sectionRegex, continuity);
    } else {
      stateContent = stateContent.trimEnd() + '\n\n' + continuity + '\n';
    }

    fs.writeFileSync(statePath, stateContent);

    // Reset compact counter (compaction happened)
    const counterPath = path.join(planningDir, '.compact-counter');
    if (fs.existsSync(counterPath)) {
      fs.writeFileSync(counterPath, JSON.stringify({ calls: 0, lastSuggested: 0 }));
    }

    // Reset context tracker to zero (not delete) to prevent false budget warnings
    // after compaction. Previous session's accumulated reads should not count
    // against the new post-compaction context budget.
    const trackerResetPath = path.join(planningDir, '.context-tracker');
    if (fs.existsSync(trackerResetPath)) {
      fs.writeFileSync(trackerResetPath, JSON.stringify({ reads: 0, chars: 0, files: [], resetAt: now }));
    }

    // Output additionalContext for post-compaction recovery
    const additional = {
      additionalContext: `GSD session was compacted. Active: phase ${currentPhase}, plan ${currentPlan}. Operation: ${activeOperation}. Executing: ${activePlan}. Position: ${taskPosition}. ${roadmapSummary}. Resume from STATE.md.`
    };
    process.stdout.write(JSON.stringify(additional));
  } catch (e) {
    // Silent fail — never block compaction
  }
  process.exit(0);
});
