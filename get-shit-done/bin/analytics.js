'use strict';

/**
 * analytics.js — GSD Execution Analytics
 *
 * Provides two exported functions:
 *   generateReport(projectPath) — reads EXECUTION_LOG.md + SUMMARY.md files,
 *     returns a human-readable markdown analytics report.
 *   calibrate(projectPath, options) — reads execution history, proposes
 *     config.json threshold updates based on observed outcomes.
 */

const fs = require('fs');
const path = require('path');

// Lazy-load execution-log to avoid circular dependency issues
function getHistory(projectPath) {
  try {
    const { getHistory: _getHistory } = require('./execution-log.js');
    return _getHistory(projectPath);
  } catch (e) {
    // Fallback: parse EXECUTION_LOG.md manually
    const logPath = path.join(projectPath, '.planning', 'EXECUTION_LOG.md');
    if (!fs.existsSync(logPath)) return [];
    const lines = fs.readFileSync(logPath, 'utf8').split('\n');
    const events = [];
    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;
      try { events.push(JSON.parse(line)); } catch (e2) { /* skip */ }
    }
    return events;
  }
}

/**
 * Scan all phase SUMMARY.md files and extract first content line.
 * Returns array of { phase, name, oneliner, path }
 */
function scanSummaries(projectPath) {
  const phasesDir = path.join(projectPath, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return [];

  const results = [];
  const entries = fs.readdirSync(phasesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const phaseDir = path.join(phasesDir, entry.name);

    // Find SUMMARY.md files
    let summaryFiles;
    try {
      summaryFiles = fs.readdirSync(phaseDir).filter(f => f.endsWith('-SUMMARY.md'));
    } catch (e) {
      continue;
    }

    for (const summaryFile of summaryFiles) {
      const summaryPath = path.join(phaseDir, summaryFile);
      let oneliner = '';
      try {
        const content = fs.readFileSync(summaryPath, 'utf8');
        const lines = content.split('\n');
        // Find first non-blank, non-heading line
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            oneliner = trimmed.slice(0, 120);
            break;
          }
        }
      } catch (e) { /* skip */ }

      // Extract phase number from directory name (e.g. "40-observability-analytics" -> 40)
      const phaseMatch = entry.name.match(/^(\d+)/);
      const phaseNum = phaseMatch ? parseInt(phaseMatch[1], 10) : null;

      results.push({
        phase: phaseNum,
        dir: entry.name,
        oneliner,
        path: summaryPath,
        file: summaryFile
      });
    }
  }

  return results.sort((a, b) => (a.phase || 0) - (b.phase || 0));
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
function formatDuration(ms) {
  if (ms < 0) return 'N/A';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * Pad a string to a given width.
 */
function pad(str, width) {
  const s = String(str == null ? '' : str);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/**
 * Generate an analytics report from EXECUTION_LOG.md and SUMMARY.md files.
 *
 * @param {string} projectPath — root of the project (contains .planning/)
 * @returns {string} markdown report
 */
function generateReport(projectPath) {
  const events = getHistory(projectPath);

  if (events.length === 0) {
    return [
      '# GSD Execution Analytics Report',
      '',
      `**Generated:** ${new Date().toISOString().slice(0, 10)}`,
      '',
      'No execution history found. Run `execute-roadmap` first to generate data.',
      ''
    ].join('\n');
  }

  const lines = [];
  const now = new Date();

  // --- Header ---
  lines.push('# GSD Execution Analytics Report');
  lines.push('');
  lines.push(`**Generated:** ${now.toISOString().slice(0, 10)}`);
  lines.push('');

  // --- Phase duration computation ---
  const phaseStarts = {};
  const phaseCompletes = {};
  const phaseFailed = {};
  const phaseNames = {};

  for (const ev of events) {
    if (ev.type === 'phase_start') {
      phaseStarts[ev.phase] = ev.timestamp;
      if (ev.name) phaseNames[ev.phase] = ev.name;
    } else if (ev.type === 'phase_complete') {
      phaseCompletes[ev.phase] = ev.timestamp;
      if (ev.name) phaseNames[ev.phase] = ev.name;
    } else if (ev.type === 'phase_failed') {
      phaseFailed[ev.phase] = ev.timestamp;
      if (ev.name) phaseNames[ev.phase] = ev.name;
    }
  }

  const allPhaseNums = new Set([
    ...Object.keys(phaseStarts),
    ...Object.keys(phaseCompletes),
    ...Object.keys(phaseFailed)
  ].map(Number));

  const phaseDurations = [];
  for (const phaseNum of Array.from(allPhaseNums).sort((a, b) => a - b)) {
    const startTs = phaseStarts[phaseNum];
    const completeTs = phaseCompletes[phaseNum];
    const failedTs = phaseFailed[phaseNum];
    const endTs = completeTs || failedTs;
    const status = completeTs ? 'complete' : (failedTs ? 'failed' : 'in_progress');
    const durationMs = (startTs && endTs) ? new Date(endTs) - new Date(startTs) : -1;
    phaseDurations.push({ phase: phaseNum, status, durationMs, name: phaseNames[phaseNum] || '' });
  }

  const completedPhases = phaseDurations.filter(p => p.status === 'complete');
  const failedPhases = phaseDurations.filter(p => p.status === 'failed');
  const failureRate = allPhaseNums.size > 0
    ? ((failedPhases.length / allPhaseNums.size) * 100).toFixed(1)
    : '0.0';

  // Total roadmap duration
  const roadmapStarts = events.filter(e => e.type === 'roadmap_start');
  const roadmapCompletes = events.filter(e => e.type === 'roadmap_complete');
  let roadmapDurationMs = -1;
  if (roadmapStarts.length > 0 && roadmapCompletes.length > 0) {
    roadmapDurationMs = new Date(roadmapCompletes[roadmapCompletes.length - 1].timestamp) -
                        new Date(roadmapStarts[0].timestamp);
  }

  const avgPhaseDurationMs = completedPhases.length > 0
    ? completedPhases.reduce((sum, p) => sum + (p.durationMs > 0 ? p.durationMs : 0), 0) / completedPhases.length
    : -1;

  // --- Summary Table ---
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Phases completed | ${completedPhases.length} |`);
  lines.push(`| Phases failed | ${failedPhases.length} |`);
  lines.push(`| Failure rate | ${failureRate}% |`);
  lines.push(`| Total roadmap duration | ${roadmapDurationMs > 0 ? formatDuration(roadmapDurationMs) : 'N/A'} |`);
  lines.push(`| Average phase duration | ${avgPhaseDurationMs > 0 ? formatDuration(avgPhaseDurationMs) : 'N/A'} |`);
  lines.push('');

  // --- Phase Breakdown ---
  lines.push('## Phase Breakdown');
  lines.push('');
  lines.push(`| ${pad('Phase', 6)} | ${pad('Name', 30)} | ${pad('Duration', 10)} | ${pad('Status', 12)} |`);
  lines.push(`|${'-'.repeat(8)}|${'-'.repeat(32)}|${'-'.repeat(12)}|${'-'.repeat(14)}|`);

  for (const p of phaseDurations) {
    const dur = p.durationMs > 0 ? formatDuration(p.durationMs) : 'N/A';
    const name = (p.name || '').slice(0, 28);
    lines.push(`| ${pad(p.phase, 6)} | ${pad(name, 30)} | ${pad(dur, 10)} | ${pad(p.status, 12)} |`);
  }
  lines.push('');

  // --- Model Tier Distribution ---
  const routingEvents = events.filter(e => e.type === 'routing_decision' || e.type === 'task_dispatch');
  const tierCounts = { haiku: 0, sonnet: 0, opus: 0, unknown: 0 };
  for (const ev of routingEvents) {
    const tier = (ev.model || ev.tier || '').toLowerCase();
    if (tier === 'haiku') tierCounts.haiku++;
    else if (tier === 'sonnet') tierCounts.sonnet++;
    else if (tier === 'opus') tierCounts.opus++;
    else tierCounts.unknown++;
  }

  const totalRouted = Object.values(tierCounts).reduce((a, b) => a + b, 0);
  if (totalRouted > 0) {
    lines.push('## Model Tier Distribution');
    lines.push('');
    lines.push('| Tier | Count | % |');
    lines.push('|------|-------|---|');
    for (const [tier, count] of Object.entries(tierCounts)) {
      if (count === 0) continue;
      const pct = ((count / totalRouted) * 100).toFixed(1);
      lines.push(`| ${tier} | ${count} | ${pct}% |`);
    }
    lines.push('');
  }

  // --- Failure Analysis ---
  const failureEvents = events.filter(e => e.type === 'phase_failed');
  if (failureEvents.length > 0) {
    lines.push('## Failure Analysis');
    lines.push('');
    for (const ev of failureEvents) {
      lines.push(`- **Phase ${ev.phase}** (${ev.name || 'unknown'}): ${ev.error || 'no error details'}`);
    }
    lines.push('');
  }

  // --- Phase Summaries ---
  const summaries = scanSummaries(projectPath);
  if (summaries.length > 0) {
    lines.push('## Phase Summaries');
    lines.push('');
    for (const s of summaries) {
      if (s.oneliner) {
        lines.push(`- **Phase ${s.phase}** (${s.dir}): ${s.oneliner}`);
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Report generated by \`gsd-tools.js analytics report\` at ${now.toISOString()}*`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Calibrate config.json thresholds from execution history.
 *
 * @param {string} projectPath — root of the project (contains .planning/)
 * @param {Object} options
 * @param {boolean} options.dryRun — if true, show proposed changes without writing
 * @returns {Object} { proposed_changes, applied, dry_run }
 */
function calibrate(projectPath, options) {
  const { dryRun = true } = options || {};
  const events = getHistory(projectPath);
  const configPath = path.join(projectPath, '.planning', 'config.json');

  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    // config.json is absent or unparseable — start fresh
  }

  const proposedChanges = [];

  // --- Calibration 1: haiku failure rate analysis ---
  // If haiku-tier tasks fail disproportionately, propose raising the complexity
  // threshold that routes tasks to haiku (i.e. make haiku harder to qualify for).
  const haikuDispatches = events.filter(e =>
    (e.type === 'task_dispatch' || e.type === 'routing_decision') &&
    (e.tier || e.model || '').toLowerCase() === 'haiku'
  );

  // task_failed events with haiku tier
  const haikuFailures = events.filter(e =>
    e.type === 'task_failed' && (e.tier || '').toLowerCase() === 'haiku'
  );

  if (haikuDispatches.length >= 3) {
    const haikuFailureRate = haikuDispatches.length > 0
      ? haikuFailures.length / haikuDispatches.length
      : 0;

    if (haikuFailureRate > 0.25) {
      // More than 25% haiku tasks fail — propose tightening haiku routing
      const currentThreshold = (config.routing && config.routing.haiku_max_score) || 0.35;
      const proposedThreshold = Math.max(0.10, currentThreshold - 0.05);

      proposedChanges.push({
        field: 'routing.haiku_max_score',
        current_value: currentThreshold,
        proposed_value: proposedThreshold,
        rationale: `Haiku failure rate is ${(haikuFailureRate * 100).toFixed(1)}% (${haikuFailures.length}/${haikuDispatches.length} tasks). Lowering haiku_max_score makes fewer tasks route to haiku.`,
        data_points: haikuDispatches.length
      });
    } else if (haikuFailureRate < 0.05 && haikuDispatches.length >= 10) {
      // Very low failure rate — haiku could handle more tasks
      const currentThreshold = (config.routing && config.routing.haiku_max_score) || 0.35;
      const proposedThreshold = Math.min(0.60, currentThreshold + 0.05);

      if (proposedThreshold !== currentThreshold) {
        proposedChanges.push({
          field: 'routing.haiku_max_score',
          current_value: currentThreshold,
          proposed_value: proposedThreshold,
          rationale: `Haiku failure rate is only ${(haikuFailureRate * 100).toFixed(1)}% (${haikuFailures.length}/${haikuDispatches.length} tasks). Raising haiku_max_score routes more simple tasks to haiku for efficiency.`,
          data_points: haikuDispatches.length
        });
      }
    }
  }

  // --- Calibration 2: Coverage threshold from SUMMARY.md files ---
  const summaries = scanSummaries(projectPath);
  const coverageValues = [];

  for (const s of summaries) {
    try {
      const content = fs.readFileSync(s.path, 'utf8');
      // Look for "coverage: XX%" or "coverage XX%" patterns
      const matches = content.match(/coverage[:\s]+(\d+(?:\.\d+)?)\s*%/gi) || [];
      for (const match of matches) {
        const numMatch = match.match(/(\d+(?:\.\d+)?)/);
        if (numMatch) {
          const val = parseFloat(numMatch[1]);
          if (val >= 0 && val <= 100) coverageValues.push(val);
        }
      }
    } catch (e) { /* skip */ }
  }

  if (coverageValues.length >= 3) {
    const sorted = [...coverageValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const currentThreshold = (config.coverage && config.coverage.threshold) || 80;

    if (Math.abs(median - currentThreshold) > 5) {
      // Propose adjusting toward observed median, but cap at 95 and floor at 50
      const proposed = Math.max(50, Math.min(95, Math.round(median)));
      proposedChanges.push({
        field: 'coverage.threshold',
        current_value: currentThreshold,
        proposed_value: proposed,
        rationale: `Observed median coverage across ${coverageValues.length} summaries is ${median.toFixed(1)}%, which differs from current threshold (${currentThreshold}%) by more than 5 points.`,
        data_points: coverageValues.length
      });
    }
  }

  // --- Calibration 3: Average phase duration -> suggest coordinator timeout ---
  const phaseDurations = [];
  const phaseStarts = {};
  const phaseCompletes = {};

  for (const ev of events) {
    if (ev.type === 'phase_start' && ev.timestamp) phaseStarts[ev.phase] = ev.timestamp;
    if (ev.type === 'phase_complete' && ev.timestamp) phaseCompletes[ev.phase] = ev.timestamp;
  }

  for (const phaseNum of Object.keys(phaseCompletes)) {
    if (phaseStarts[phaseNum]) {
      const durationMs = new Date(phaseCompletes[phaseNum]) - new Date(phaseStarts[phaseNum]);
      if (durationMs > 0) phaseDurations.push(durationMs);
    }
  }

  if (phaseDurations.length >= 3) {
    const avgMs = phaseDurations.reduce((a, b) => a + b, 0) / phaseDurations.length;
    const avgMinutes = Math.ceil(avgMs / 60000);
    const suggestedTimeout = Math.max(15, avgMinutes * 2); // 2x average with 15m minimum
    const currentTimeout = (config.coordinator && config.coordinator.phase_timeout_minutes) || 60;

    if (Math.abs(suggestedTimeout - currentTimeout) >= 10) {
      proposedChanges.push({
        field: 'coordinator.phase_timeout_minutes',
        current_value: currentTimeout,
        proposed_value: suggestedTimeout,
        rationale: `Average phase duration from ${phaseDurations.length} completed phases is ${avgMinutes}m. Setting timeout to 2x average (${suggestedTimeout}m) provides adequate headroom.`,
        data_points: phaseDurations.length
      });
    }
  }

  if (proposedChanges.length === 0) {
    const totalEvents = events.length;
    const msg = totalEvents < 10
      ? `Insufficient data — need at least 3 completed phases to calibrate (currently ${Object.keys(phaseCompletes).length} completed). Run execute-roadmap at least once.`
      : 'No calibration opportunities found — current thresholds appear well-tuned for observed execution patterns.';

    return {
      proposed_changes: [],
      applied: false,
      dry_run: dryRun,
      message: msg
    };
  }

  // Apply changes if not dry run
  let applied = false;
  if (!dryRun && proposedChanges.length > 0) {
    for (const change of proposedChanges) {
      // Set nested field using dot notation (e.g. "routing.haiku_max_score")
      const parts = change.field.split('.');
      let obj = config;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') {
          obj[parts[i]] = {};
        }
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = change.proposed_value;
    }

    try {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
      applied = true;
    } catch (e) {
      // Return changes as proposed even if write failed
    }
  }

  return {
    proposed_changes: proposedChanges,
    applied,
    dry_run: dryRun
  };
}

module.exports = { generateReport, calibrate };
