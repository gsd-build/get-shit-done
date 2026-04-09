/**
 * State — STATE.md operations and progression engine
 */

const fs = require('fs');
const path = require('path');
const { escapeRegex, loadConfig, getMilestoneInfo, getMilestonePhaseFilter, normalizeMd, planningDir, planningPaths, output, error, atomicWriteFileSync } = require('./core.cjs');
const { extractFrontmatter, reconstructFrontmatter } = require('./frontmatter.cjs');

/** Shorthand — every state command needs this path */
function getStatePath(cwd) {
  return planningPaths(cwd).state;
}

// Track all lock files held by this process so they can be removed on exit.
// process.on('exit') fires even on process.exit(1), unlike try/finally which is
// skipped when error() calls process.exit(1) inside a locked region (#1916).
const _heldStateLocks = new Set();
process.on('exit', () => {
  for (const lockPath of _heldStateLocks) {
    try { require('fs').unlinkSync(lockPath); } catch { /* already gone */ }
  }
});

// Shared helper: extract a field value from STATE.md content.
// Supports both **Field:** bold and plain Field: format.
function stateExtractField(content, fieldName) {
  const escaped = escapeRegex(fieldName);
  const boldPattern = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+)`, 'i');
  const boldMatch = content.match(boldPattern);
  if (boldMatch) return boldMatch[1].trim();
  const plainPattern = new RegExp(`^${escaped}:\\s*(.+)`, 'im');
  const plainMatch = content.match(plainPattern);
  return plainMatch ? plainMatch[1].trim() : null;
}

function cmdStateLoad(cwd, raw) {
  const config = loadConfig(cwd);
  const planDir = planningPaths(cwd).planning;

  let stateRaw = '';
  try {
    stateRaw = fs.readFileSync(path.join(planDir, 'STATE.md'), 'utf-8');
  } catch { /* intentionally empty */ }

  const configExists = fs.existsSync(path.join(planDir, 'config.json'));
  const roadmapExists = fs.existsSync(path.join(planDir, 'ROADMAP.md'));
  const stateExists = stateRaw.length > 0;

  const result = {
    config,
    state_raw: stateRaw,
    state_exists: stateExists,
    roadmap_exists: roadmapExists,
    config_exists: configExists,
  };

  // For --raw, output a condensed key=value format
  if (raw) {
    const c = config;
    const lines = [
      `model_profile=${c.model_profile}`,
      `commit_docs=${c.commit_docs}`,
      `branching_strategy=${c.branching_strategy}`,
      `phase_branch_template=${c.phase_branch_template}`,
      `milestone_branch_template=${c.milestone_branch_template}`,
      `parallelization=${c.parallelization}`,
      `research=${c.research}`,
      `plan_checker=${c.plan_checker}`,
      `verifier=${c.verifier}`,
      `config_exists=${configExists}`,
      `roadmap_exists=${roadmapExists}`,
      `state_exists=${stateExists}`,
    ];
    process.stdout.write(lines.join('\n'));
    process.exit(0);
  }

  output(result);
}

function cmdStateGet(cwd, section, raw) {
  const statePath = planningPaths(cwd).state;
  try {
    const content = fs.readFileSync(statePath, 'utf-8');

    if (!section) {
      output({ content }, raw, content);
      return;
    }

    // Try to find markdown section or field
    const fieldEscaped = escapeRegex(section);

    // Check for **field:** value (bold format)
    const boldPattern = new RegExp(`\\*\\*${fieldEscaped}:\\*\\*\\s*(.*)`, 'i');
    const boldMatch = content.match(boldPattern);
    if (boldMatch) {
      output({ [section]: boldMatch[1].trim() }, raw, boldMatch[1].trim());
      return;
    }

    // Check for field: value (plain format)
    const plainPattern = new RegExp(`^${fieldEscaped}:\\s*(.*)`, 'im');
    const plainMatch = content.match(plainPattern);
    if (plainMatch) {
      output({ [section]: plainMatch[1].trim() }, raw, plainMatch[1].trim());
      return;
    }

    // Check for ## Section
    const sectionPattern = new RegExp(`##\\s*${fieldEscaped}\\s*\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
    const sectionMatch = content.match(sectionPattern);
    if (sectionMatch) {
      output({ [section]: sectionMatch[1].trim() }, raw, sectionMatch[1].trim());
      return;
    }

    output({ error: `Section or field "${section}" not found` }, raw, '');
  } catch {
    error('STATE.md not found');
  }
}

function readTextArgOrFile(cwd, value, filePath, label) {
  if (!filePath) return value;

  // Path traversal guard: ensure file resolves within project directory
  const { validatePath } = require('./security.cjs');
  const pathCheck = validatePath(filePath, cwd, { allowAbsolute: true });
  if (!pathCheck.safe) {
    throw new Error(`${label} path rejected: ${pathCheck.error}`);
  }

  try {
    return fs.readFileSync(pathCheck.resolved, 'utf-8').trimEnd();
  } catch {
    throw new Error(`${label} file not found: ${filePath}`);
  }
}

function cmdStatePatch(cwd, patches, raw) {
  // Validate all field names before processing
  const { validateFieldName } = require('./security.cjs');
  for (const field of Object.keys(patches)) {
    const fieldCheck = validateFieldName(field);
    if (!fieldCheck.valid) {
      error(`state patch: ${fieldCheck.error}`);
    }
  }

  const statePath = planningPaths(cwd).state;
  try {
    const results = { updated: [], failed: [] };

    // Use atomic read-modify-write to prevent lost updates from concurrent agents
    readModifyWriteStateMd(statePath, (content) => {
      for (const [field, value] of Object.entries(patches)) {
        const fieldEscaped = escapeRegex(field);
        // Try **Field:** bold format first, then plain Field: format
        const boldPattern = new RegExp(`(\\*\\*${fieldEscaped}:\\*\\*\\s*)(.*)`, 'i');
        const plainPattern = new RegExp(`(^${fieldEscaped}:\\s*)(.*)`, 'im');

        if (boldPattern.test(content)) {
          content = content.replace(boldPattern, (_match, prefix) => `${prefix}${value}`);
          results.updated.push(field);
        } else if (plainPattern.test(content)) {
          content = content.replace(plainPattern, (_match, prefix) => `${prefix}${value}`);
          results.updated.push(field);
        } else {
          results.failed.push(field);
        }
      }
      return content;
    }, cwd);

    output(results, raw, results.updated.length > 0 ? 'true' : 'false');
  } catch {
    error('STATE.md not found');
  }
}

function cmdStateUpdate(cwd, field, value) {
  if (!field || value === undefined) {
    error('field and value required for state update');
  }

  // Validate field name to prevent regex injection via crafted field names
  const { validateFieldName } = require('./security.cjs');
  const fieldCheck = validateFieldName(field);
  if (!fieldCheck.valid) {
    error(`state update: ${fieldCheck.error}`);
  }

  const statePath = planningPaths(cwd).state;
  try {
    let updated = false;
    readModifyWriteStateMd(statePath, (content) => {
      const fieldEscaped = escapeRegex(field);
      // Try **Field:** bold format first, then plain Field: format
      const boldPattern = new RegExp(`(\\*\\*${fieldEscaped}:\\*\\*\\s*)(.*)`, 'i');
      const plainPattern = new RegExp(`(^${fieldEscaped}:\\s*)(.*)`, 'im');
      if (boldPattern.test(content)) {
        updated = true;
        return content.replace(boldPattern, (_match, prefix) => `${prefix}${value}`);
      } else if (plainPattern.test(content)) {
        updated = true;
        return content.replace(plainPattern, (_match, prefix) => `${prefix}${value}`);
      }
      return content;
    }, cwd);
    if (updated) {
      output({ updated: true });
    } else {
      output({ updated: false, reason: `Field "${field}" not found in STATE.md` });
    }
  } catch {
    output({ updated: false, reason: 'STATE.md not found' });
  }
}

// ─── State Progression Engine ────────────────────────────────────────────────
// stateExtractField is defined above (shared helper) — do not duplicate.

function stateReplaceField(content, fieldName, newValue) {
  const escaped = escapeRegex(fieldName);
  // Try **Field:** bold format first, then plain Field: format
  const boldPattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (boldPattern.test(content)) {
    return content.replace(boldPattern, (_match, prefix) => `${prefix}${newValue}`);
  }
  const plainPattern = new RegExp(`(^${escaped}:\\s*)(.*)`, 'im');
  if (plainPattern.test(content)) {
    return content.replace(plainPattern, (_match, prefix) => `${prefix}${newValue}`);
  }
  return null;
}

/**
 * Replace a STATE.md field with fallback field name support.
 * Tries `primary` first, then `fallback` (if provided), returns content unchanged
 * if neither matches. This consolidates the replaceWithFallback pattern that was
 * previously duplicated inline across phase.cjs, milestone.cjs, and state.cjs.
 */
function stateReplaceFieldWithFallback(content, primary, fallback, value) {
  let result = stateReplaceField(content, primary, value);
  if (result) return result;
  if (fallback) {
    result = stateReplaceField(content, fallback, value);
    if (result) return result;
  }
  // Neither pattern matched — field may have been reformatted or removed.
  // Log diagnostic so template drift is detected early rather than silently swallowed.
  process.stderr.write(
    `[gsd-tools] WARNING: STATE.md field "${primary}"${fallback ? ` (fallback: "${fallback}")` : ''} not found — update skipped. ` +
    `This may indicate STATE.md was externally modified or uses an unexpected format.\n`
  );
  return content;
}

/**
 * Update fields within the ## Current Position section of STATE.md.
 * This keeps the Current Position body in sync with the bold frontmatter fields.
 * Only updates fields that already exist in the section; does not add new lines.
 * Fixes #1365: advance-plan could not update Status/Last activity after begin-phase.
 */
function updateCurrentPositionFields(content, fields) {
  const posPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
  const posMatch = content.match(posPattern);
  if (!posMatch) return content;

  let posBody = posMatch[2];

  if (fields.status && /^Status:/m.test(posBody)) {
    posBody = posBody.replace(/^Status:.*$/m, `Status: ${fields.status}`);
  }
  if (fields.lastActivity && /^Last activity:/im.test(posBody)) {
    posBody = posBody.replace(/^Last activity:.*$/im, `Last activity: ${fields.lastActivity}`);
  }
  if (fields.plan && /^Plan:/m.test(posBody)) {
    posBody = posBody.replace(/^Plan:.*$/m, `Plan: ${fields.plan}`);
  }

  return content.replace(posPattern, `${posMatch[1]}${posBody}`);
}

function cmdStateAdvancePlan(cwd, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  const today = new Date().toISOString().split('T')[0];
  let result = null;

  readModifyWriteStateMd(statePath, (content) => {
    // Try legacy separate fields first, then compound "Plan: X of Y" format
    const legacyPlan = stateExtractField(content, 'Current Plan');
    const legacyTotal = stateExtractField(content, 'Total Plans in Phase');
    const planField = stateExtractField(content, 'Plan');

    let currentPlan, totalPlans;
    let useCompoundFormat = false;

    if (legacyPlan && legacyTotal) {
      currentPlan = parseInt(legacyPlan, 10);
      totalPlans = parseInt(legacyTotal, 10);
    } else if (planField) {
      // Compound format: "2 of 6 in current phase" or "2 of 6"
      currentPlan = parseInt(planField, 10);
      const ofMatch = planField.match(/of\s+(\d+)/);
      totalPlans = ofMatch ? parseInt(ofMatch[1], 10) : NaN;
      useCompoundFormat = true;
    }

    if (isNaN(currentPlan) || isNaN(totalPlans)) {
      result = { error: true };
      return content;
    }

    if (currentPlan >= totalPlans) {
      content = stateReplaceFieldWithFallback(content, 'Status', null, 'Phase complete — ready for verification');
      content = stateReplaceFieldWithFallback(content, 'Last Activity', 'Last activity', today);
      content = updateCurrentPositionFields(content, { status: 'Phase complete — ready for verification', lastActivity: today });
      result = { advanced: false, reason: 'last_plan', current_plan: currentPlan, total_plans: totalPlans, status: 'ready_for_verification' };
    } else {
      const newPlan = currentPlan + 1;
      let planDisplayValue;
      if (useCompoundFormat) {
        // Preserve compound format: "X of Y in current phase" → replace X only
        planDisplayValue = planField.replace(/^\d+/, String(newPlan));
        content = stateReplaceField(content, 'Plan', planDisplayValue) || content;
      } else {
        planDisplayValue = `${newPlan} of ${totalPlans}`;
        content = stateReplaceField(content, 'Current Plan', String(newPlan)) || content;
      }
      content = stateReplaceFieldWithFallback(content, 'Status', null, 'Ready to execute');
      content = stateReplaceFieldWithFallback(content, 'Last Activity', 'Last activity', today);
      content = updateCurrentPositionFields(content, { status: 'Ready to execute', lastActivity: today, plan: planDisplayValue });
      result = { advanced: true, previous_plan: currentPlan, current_plan: newPlan, total_plans: totalPlans };
    }
    return content;
  }, cwd);

  if (!result || result.error) {
    output({ error: 'Cannot parse Current Plan or Total Plans in Phase from STATE.md' }, raw);
    return;
  }

  if (result.advanced === false) {
    output(result, raw, 'false');
  } else {
    output(result, raw, 'true');
  }
}

function cmdStateRecordMetric(cwd, options, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  const { phase, plan, duration, tasks, files } = options;

  if (!phase || !plan || !duration) {
    output({ error: 'phase, plan, and duration required' }, raw);
    return;
  }

  let recorded = false;
  readModifyWriteStateMd(statePath, (content) => {
    // Find Performance Metrics section and its table
    const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
    const metricsMatch = content.match(metricsPattern);

    if (metricsMatch) {
      let tableBody = metricsMatch[2].trimEnd();
      const newRow = `| Phase ${phase} P${plan} | ${duration} | ${tasks || '-'} tasks | ${files || '-'} files |`;

      if (tableBody.trim() === '' || tableBody.includes('None yet')) {
        tableBody = newRow;
      } else {
        tableBody = tableBody + '\n' + newRow;
      }

      recorded = true;
      return content.replace(metricsPattern, (_match, header) => `${header}${tableBody}\n`);
    }
    return content;
  }, cwd);

  if (recorded) {
    output({ recorded: true, phase, plan, duration }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'Performance Metrics section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateUpdateProgress(cwd, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  // Count summaries across current milestone phases only (outside lock — read-only)
  const phasesDir = planningPaths(cwd).phases;
  let totalPlans = 0;
  let totalSummaries = 0;

  if (fs.existsSync(phasesDir)) {
    const isDirInMilestone = getMilestonePhaseFilter(cwd);
    const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name)
      .filter(isDirInMilestone);
    for (const dir of phaseDirs) {
      const files = fs.readdirSync(path.join(phasesDir, dir));
      totalPlans += files.filter(f => f.match(/-PLAN\.md$/i)).length;
      totalSummaries += files.filter(f => f.match(/-SUMMARY\.md$/i)).length;
    }
  }

  const percent = totalPlans > 0 ? Math.min(100, Math.round(totalSummaries / totalPlans * 100)) : 0;
  const barWidth = 10;
  const filled = Math.round(percent / 100 * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const progressStr = `[${bar}] ${percent}%`;

  let updated = false;
  const _totalPlans = totalPlans;
  const _totalSummaries = totalSummaries;

  readModifyWriteStateMd(statePath, (content) => {
    // Try **Progress:** bold format first, then plain Progress: format
    const boldProgressPattern = /(\*\*Progress:\*\*\s*).*/i;
    const plainProgressPattern = /^(Progress:\s*).*/im;
    if (boldProgressPattern.test(content)) {
      updated = true;
      return content.replace(boldProgressPattern, (_match, prefix) => `${prefix}${progressStr}`);
    } else if (plainProgressPattern.test(content)) {
      updated = true;
      return content.replace(plainProgressPattern, (_match, prefix) => `${prefix}${progressStr}`);
    }
    return content;
  }, cwd);

  if (updated) {
    output({ updated: true, percent, completed: _totalSummaries, total: _totalPlans, bar: progressStr }, raw, progressStr);
  } else {
    output({ updated: false, reason: 'Progress field not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateAddDecision(cwd, options, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  const { phase, summary, summary_file, rationale, rationale_file } = options;
  let summaryText = null;
  let rationaleText = '';

  try {
    summaryText = readTextArgOrFile(cwd, summary, summary_file, 'summary');
    rationaleText = readTextArgOrFile(cwd, rationale || '', rationale_file, 'rationale');
  } catch (err) {
    output({ added: false, reason: err.message }, raw, 'false');
    return;
  }

  if (!summaryText) { output({ error: 'summary required' }, raw); return; }

  const entry = `- [Phase ${phase || '?'}]: ${summaryText}${rationaleText ? ` — ${rationaleText}` : ''}`;
  let added = false;

  readModifyWriteStateMd(statePath, (content) => {
    // Find Decisions section (various heading patterns)
    const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (match) {
      let sectionBody = match[2];
      // Remove placeholders
      sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/No decisions yet\.?\s*\n?/gi, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      added = true;
      return content.replace(sectionPattern, (_match, header) => `${header}${sectionBody}`);
    }
    return content;
  }, cwd);

  if (added) {
    output({ added: true, decision: entry }, raw, 'true');
  } else {
    output({ added: false, reason: 'Decisions section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateAddBlocker(cwd, text, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }
  const blockerOptions = typeof text === 'object' && text !== null ? text : { text };
  let blockerText = null;

  try {
    blockerText = readTextArgOrFile(cwd, blockerOptions.text, blockerOptions.text_file, 'blocker');
  } catch (err) {
    output({ added: false, reason: err.message }, raw, 'false');
    return;
  }

  if (!blockerText) { output({ error: 'text required' }, raw); return; }

  const entry = `- ${blockerText}`;
  let added = false;

  readModifyWriteStateMd(statePath, (content) => {
    const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (match) {
      let sectionBody = match[2];
      sectionBody = sectionBody.replace(/None\.?\s*\n?/gi, '').replace(/None yet\.?\s*\n?/gi, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      added = true;
      return content.replace(sectionPattern, (_match, header) => `${header}${sectionBody}`);
    }
    return content;
  }, cwd);

  if (added) {
    output({ added: true, blocker: blockerText }, raw, 'true');
  } else {
    output({ added: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateResolveBlocker(cwd, text, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }
  if (!text) { output({ error: 'text required' }, raw); return; }

  let resolved = false;

  readModifyWriteStateMd(statePath, (content) => {
    const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (match) {
      const sectionBody = match[2];
      const lines = sectionBody.split('\n');
      const filtered = lines.filter(line => {
        if (!line.startsWith('- ')) return true;
        return !line.toLowerCase().includes(text.toLowerCase());
      });

      let newBody = filtered.join('\n');
      // If section is now empty, add placeholder
      if (!newBody.trim() || !newBody.includes('- ')) {
        newBody = 'None\n';
      }

      resolved = true;
      return content.replace(sectionPattern, (_match, header) => `${header}${newBody}`);
    }
    return content;
  }, cwd);

  if (resolved) {
    output({ resolved: true, blocker: text }, raw, 'true');
  } else {
    output({ resolved: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateRecordSession(cwd, options, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  const now = new Date().toISOString();
  const updated = [];

  readModifyWriteStateMd(statePath, (content) => {
    // Update Last session / Last Date
    let result = stateReplaceField(content, 'Last session', now);
    if (result) { content = result; updated.push('Last session'); }
    result = stateReplaceField(content, 'Last Date', now);
    if (result) { content = result; updated.push('Last Date'); }

    // Update Stopped at
    if (options.stopped_at) {
      result = stateReplaceField(content, 'Stopped At', options.stopped_at);
      if (!result) result = stateReplaceField(content, 'Stopped at', options.stopped_at);
      if (result) { content = result; updated.push('Stopped At'); }
    }

    // Update Resume file
    const resumeFile = options.resume_file || 'None';
    result = stateReplaceField(content, 'Resume File', resumeFile);
    if (!result) result = stateReplaceField(content, 'Resume file', resumeFile);
    if (result) { content = result; updated.push('Resume File'); }

    return content;
  }, cwd);

  if (updated.length > 0) {
    output({ recorded: true, updated }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'No session fields found in STATE.md' }, raw, 'false');
  }
}

function cmdStateSnapshot(cwd, raw) {
  const statePath = planningPaths(cwd).state;

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  const content = fs.readFileSync(statePath, 'utf-8');

  // Extract basic fields
  const currentPhase = stateExtractField(content, 'Current Phase');
  const currentPhaseName = stateExtractField(content, 'Current Phase Name');
  const totalPhasesRaw = stateExtractField(content, 'Total Phases');
  const currentPlan = stateExtractField(content, 'Current Plan');
  const totalPlansRaw = stateExtractField(content, 'Total Plans in Phase');
  const status = stateExtractField(content, 'Status');
  const progressRaw = stateExtractField(content, 'Progress');
  const lastActivity = stateExtractField(content, 'Last Activity');
  const lastActivityDesc = stateExtractField(content, 'Last Activity Description');
  const pausedAt = stateExtractField(content, 'Paused At');

  // Parse numeric fields
  const totalPhases = totalPhasesRaw ? parseInt(totalPhasesRaw, 10) : null;
  const totalPlansInPhase = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;
  const progressPercent = progressRaw ? parseInt(progressRaw.replace('%', ''), 10) : null;

  // Extract decisions table
  const decisions = [];
  const decisionsMatch = content.match(/##\s*Decisions Made[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n([\s\S]*?)(?=\n##|\n$|$)/i);
  if (decisionsMatch) {
    const tableBody = decisionsMatch[1];
    const rows = tableBody.trim().split('\n').filter(r => r.includes('|'));
    for (const row of rows) {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        decisions.push({
          phase: cells[0],
          summary: cells[1],
          rationale: cells[2],
        });
      }
    }
  }

  // Extract blockers list
  const blockers = [];
  const blockersMatch = content.match(/##\s*Blockers\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (blockersMatch) {
    const blockersSection = blockersMatch[1];
    const items = blockersSection.match(/^-\s+(.+)$/gm) || [];
    for (const item of items) {
      blockers.push(item.replace(/^-\s+/, '').trim());
    }
  }

  // Extract session info
  const session = {
    last_date: null,
    stopped_at: null,
    resume_file: null,
  };

  const sessionMatch = content.match(/##\s*Session\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (sessionMatch) {
    const sessionSection = sessionMatch[1];
    const lastDateMatch = sessionSection.match(/\*\*Last Date:\*\*\s*(.+)/i)
      || sessionSection.match(/^Last Date:\s*(.+)/im);
    const stoppedAtMatch = sessionSection.match(/\*\*Stopped At:\*\*\s*(.+)/i)
      || sessionSection.match(/^Stopped At:\s*(.+)/im);
    const resumeFileMatch = sessionSection.match(/\*\*Resume File:\*\*\s*(.+)/i)
      || sessionSection.match(/^Resume File:\s*(.+)/im);

    if (lastDateMatch) session.last_date = lastDateMatch[1].trim();
    if (stoppedAtMatch) session.stopped_at = stoppedAtMatch[1].trim();
    if (resumeFileMatch) session.resume_file = resumeFileMatch[1].trim();
  }

  const result = {
    current_phase: currentPhase,
    current_phase_name: currentPhaseName,
    total_phases: totalPhases,
    current_plan: currentPlan,
    total_plans_in_phase: totalPlansInPhase,
    status,
    progress_percent: progressPercent,
    last_activity: lastActivity,
    last_activity_desc: lastActivityDesc,
    decisions,
    blockers,
    paused_at: pausedAt,
    session,
  };

  output(result, raw);
}

// ─── State Frontmatter Sync ──────────────────────────────────────────────────

/**
 * Extract machine-readable fields from STATE.md markdown body and build
 * a YAML frontmatter object. Allows hooks and scripts to read state
 * reliably via `state json` instead of fragile regex parsing.
 */
function buildStateFrontmatter(bodyContent, cwd) {
  const currentPhase = stateExtractField(bodyContent, 'Current Phase');
  const currentPhaseName = stateExtractField(bodyContent, 'Current Phase Name');
  const currentPlan = stateExtractField(bodyContent, 'Current Plan');
  const totalPhasesRaw = stateExtractField(bodyContent, 'Total Phases');
  const totalPlansRaw = stateExtractField(bodyContent, 'Total Plans in Phase');
  const status = stateExtractField(bodyContent, 'Status');
  const progressRaw = stateExtractField(bodyContent, 'Progress');
  const lastActivity = stateExtractField(bodyContent, 'Last Activity');
  const stoppedAt = stateExtractField(bodyContent, 'Stopped At') || stateExtractField(bodyContent, 'Stopped at');
  const pausedAt = stateExtractField(bodyContent, 'Paused At');

  let milestone = null;
  let milestoneName = null;
  if (cwd) {
    try {
      const info = getMilestoneInfo(cwd);
      milestone = info.version;
      milestoneName = info.name;
    } catch { /* intentionally empty */ }
  }

  let totalPhases = totalPhasesRaw ? parseInt(totalPhasesRaw, 10) : null;
  let completedPhases = null;
  let totalPlans = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;
  let completedPlans = null;

  if (cwd) {
    try {
      const phasesDir = planningPaths(cwd).phases;
      if (fs.existsSync(phasesDir)) {
        const isDirInMilestone = getMilestonePhaseFilter(cwd);
        const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
          .filter(e => e.isDirectory()).map(e => e.name)
          .filter(isDirInMilestone);
        let diskTotalPlans = 0;
        let diskTotalSummaries = 0;
        let diskCompletedPhases = 0;

        for (const dir of phaseDirs) {
          const files = fs.readdirSync(path.join(phasesDir, dir));
          const plans = files.filter(f => f.match(/-PLAN\.md$/i)).length;
          const summaries = files.filter(f => f.match(/-SUMMARY\.md$/i)).length;
          diskTotalPlans += plans;
          diskTotalSummaries += summaries;
          if (plans > 0 && summaries >= plans) diskCompletedPhases++;
        }
        totalPhases = isDirInMilestone.phaseCount > 0
          ? Math.max(phaseDirs.length, isDirInMilestone.phaseCount)
          : phaseDirs.length;
        completedPhases = diskCompletedPhases;
        totalPlans = diskTotalPlans;
        completedPlans = diskTotalSummaries;
      }
    } catch { /* intentionally empty */ }
  }

  // Derive percent from disk counts when available (ground truth).
  // Only falls back to the body Progress: field when no plan files exist on disk
  // (phases directory empty or absent), which means disk has no authoritative data.
  // This prevents a stale body "0%" from overriding the real 100% completion state.
  let progressPercent = null;
  if (totalPlans !== null && totalPlans > 0 && completedPlans !== null) {
    progressPercent = Math.min(100, Math.round(completedPlans / totalPlans * 100));
  } else if (progressRaw) {
    const pctMatch = progressRaw.match(/(\d+)%/);
    if (pctMatch) progressPercent = parseInt(pctMatch[1], 10);
  }

  // Normalize status to one of: planning, discussing, executing, verifying, paused, completed, unknown
  let normalizedStatus = status || 'unknown';
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('paused') || statusLower.includes('stopped') || pausedAt) {
    normalizedStatus = 'paused';
  } else if (statusLower.includes('executing') || statusLower.includes('in progress')) {
    normalizedStatus = 'executing';
  } else if (statusLower.includes('planning') || statusLower.includes('ready to plan')) {
    normalizedStatus = 'planning';
  } else if (statusLower.includes('discussing')) {
    normalizedStatus = 'discussing';
  } else if (statusLower.includes('verif')) {
    normalizedStatus = 'verifying';
  } else if (statusLower.includes('complete') || statusLower.includes('done')) {
    normalizedStatus = 'completed';
  } else if (statusLower.includes('ready to execute')) {
    normalizedStatus = 'executing';
  }

  const fm = { gsd_state_version: '1.0' };

  if (milestone) fm.milestone = milestone;
  if (milestoneName) fm.milestone_name = milestoneName;
  if (currentPhase) fm.current_phase = currentPhase;
  if (currentPhaseName) fm.current_phase_name = currentPhaseName;
  if (currentPlan) fm.current_plan = currentPlan;
  fm.status = normalizedStatus;
  if (stoppedAt) fm.stopped_at = stoppedAt;
  if (pausedAt) fm.paused_at = pausedAt;
  fm.last_updated = new Date().toISOString();
  if (lastActivity) fm.last_activity = lastActivity;

  const progress = {};
  if (totalPhases !== null) progress.total_phases = totalPhases;
  if (completedPhases !== null) progress.completed_phases = completedPhases;
  if (totalPlans !== null) progress.total_plans = totalPlans;
  if (completedPlans !== null) progress.completed_plans = completedPlans;
  if (progressPercent !== null) progress.percent = progressPercent;
  if (Object.keys(progress).length > 0) fm.progress = progress;

  return fm;
}

function stripFrontmatter(content) {
  // Strip ALL frontmatter blocks at the start of the file.
  // Handles CRLF line endings and multiple stacked blocks (corruption recovery).
  // Greedy: keeps stripping ---...--- blocks separated by optional whitespace.
  let result = content;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const stripped = result.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\s*/, '');
    if (stripped === result) break;
    result = stripped;
  }
  return result;
}

function syncStateFrontmatter(content, cwd) {
  // Read existing frontmatter BEFORE stripping — it may contain values
  // that the body no longer has (e.g., Status field removed by an agent).
  const existingFm = extractFrontmatter(content);
  const body = stripFrontmatter(content);
  const derivedFm = buildStateFrontmatter(body, cwd);

  // Preserve existing frontmatter status when body-derived status is 'unknown'.
  // This prevents a missing Status: field in the body from overwriting a
  // previously valid status (e.g., 'executing' → 'unknown').
  if (derivedFm.status === 'unknown' && existingFm.status && existingFm.status !== 'unknown') {
    derivedFm.status = existingFm.status;
  }

  const yamlStr = reconstructFrontmatter(derivedFm);
  return `---\n${yamlStr}\n---\n\n${body}`;
}

/**
 * Acquire a lockfile for STATE.md operations.
 * Returns the lock path for later release.
 */
function acquireStateLock(statePath) {
  const lockPath = statePath + '.lock';
  const maxRetries = 10;
  const retryDelay = 200; // ms

  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      // Register for exit-time cleanup so process.exit(1) inside a locked region
      // cannot leave a stale lock file (#1916).
      _heldStateLocks.add(lockPath);
      return lockPath;
    } catch (err) {
      if (err.code === 'EEXIST') {
        try {
          const stat = fs.statSync(lockPath);
          if (Date.now() - stat.mtimeMs > 10000) {
            fs.unlinkSync(lockPath);
            continue;
          }
        } catch { /* lock was released between check — retry */ }

        if (i === maxRetries - 1) {
          try { fs.unlinkSync(lockPath); } catch {}
          return lockPath;
        }
        const jitter = Math.floor(Math.random() * 50);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, retryDelay + jitter);
        continue;
      }
      return lockPath; // non-EEXIST error — proceed without lock
    }
  }
  return statePath + '.lock';
}

function releaseStateLock(lockPath) {
  _heldStateLocks.delete(lockPath);
  try { fs.unlinkSync(lockPath); } catch { /* lock already gone */ }
}

/**
 * Write STATE.md with synchronized YAML frontmatter.
 * All STATE.md writes should use this instead of raw writeFileSync.
 * Uses a simple lockfile to prevent parallel agents from overwriting
 * each other's changes (race condition with read-modify-write cycle).
 */
function writeStateMd(statePath, content, cwd) {
  const synced = syncStateFrontmatter(content, cwd);
  const lockPath = acquireStateLock(statePath);
  try {
    atomicWriteFileSync(statePath, normalizeMd(synced), 'utf-8');
  } finally {
    releaseStateLock(lockPath);
  }
}

/**
 * Atomic read-modify-write for STATE.md.
 * Holds the lock across the entire read -> transform -> write cycle,
 * preventing the lost-update problem where two agents read the same
 * content and the second write clobbers the first.
 */
function readModifyWriteStateMd(statePath, transformFn, cwd) {
  const lockPath = acquireStateLock(statePath);
  try {
    const content = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf-8') : '';
    const modified = transformFn(content);
    const synced = syncStateFrontmatter(modified, cwd);
    atomicWriteFileSync(statePath, normalizeMd(synced), 'utf-8');
  } finally {
    releaseStateLock(lockPath);
  }
}

function cmdStateJson(cwd, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw, 'STATE.md not found');
    return;
  }

  const content = fs.readFileSync(statePath, 'utf-8');
  const existingFm = extractFrontmatter(content);
  const body = stripFrontmatter(content);

  // Always rebuild from body + disk so progress counters reflect current state.
  // Returning cached frontmatter directly causes stale percent/completed_plans
  // when SUMMARY files were added after the last STATE.md write (#1589).
  const built = buildStateFrontmatter(body, cwd);

  // Preserve frontmatter-only fields that cannot be recovered from the body.
  if (existingFm && existingFm.stopped_at && !built.stopped_at) {
    built.stopped_at = existingFm.stopped_at;
  }
  if (existingFm && existingFm.paused_at && !built.paused_at) {
    built.paused_at = existingFm.paused_at;
  }
  // Preserve existing status when body-derived status is 'unknown' (same logic as syncStateFrontmatter).
  if (built.status === 'unknown' && existingFm && existingFm.status && existingFm.status !== 'unknown') {
    built.status = existingFm.status;
  }

  output(built, raw, JSON.stringify(built, null, 2));
}

/**
 * Update STATE.md when a new phase begins execution.
 * Updates body text fields (Current focus, Status, Last Activity, Current Position)
 * and synchronizes frontmatter via writeStateMd.
 * Fixes: #1102 (plan counts), #1103 (status/last_activity), #1104 (body text).
 */
function cmdStateBeginPhase(cwd, phaseNumber, phaseName, planCount, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const updated = [];

  readModifyWriteStateMd(statePath, (content) => {
    // Update Status field
    const statusValue = `Executing Phase ${phaseNumber}`;
    let result = stateReplaceField(content, 'Status', statusValue);
    if (result) { content = result; updated.push('Status'); }

    // Update Last Activity
    result = stateReplaceField(content, 'Last Activity', today);
    if (result) { content = result; updated.push('Last Activity'); }

    // Update Last Activity Description if it exists
    const activityDesc = `Phase ${phaseNumber} execution started`;
    result = stateReplaceField(content, 'Last Activity Description', activityDesc);
    if (result) { content = result; updated.push('Last Activity Description'); }

    // Update Current Phase
    result = stateReplaceField(content, 'Current Phase', String(phaseNumber));
    if (result) { content = result; updated.push('Current Phase'); }

    // Update Current Phase Name
    if (phaseName) {
      result = stateReplaceField(content, 'Current Phase Name', phaseName);
      if (result) { content = result; updated.push('Current Phase Name'); }
    }

    // Update Current Plan to 1 (starting from the first plan)
    result = stateReplaceField(content, 'Current Plan', '1');
    if (result) { content = result; updated.push('Current Plan'); }

    // Update Total Plans in Phase
    if (planCount) {
      result = stateReplaceField(content, 'Total Plans in Phase', String(planCount));
      if (result) { content = result; updated.push('Total Plans in Phase'); }
    }

    // Update **Current focus:** body text line (#1104)
    const focusLabel = phaseName ? `Phase ${phaseNumber} — ${phaseName}` : `Phase ${phaseNumber}`;
    const focusPattern = /(\*\*Current focus:\*\*\s*).*/i;
    if (focusPattern.test(content)) {
      content = content.replace(focusPattern, (_match, prefix) => `${prefix}${focusLabel}`);
      updated.push('Current focus');
    }

    // Update ## Current Position section (#1104, #1365)
    // Update individual fields within Current Position instead of replacing the
    // entire section, so that Status, Last activity, and Progress are preserved.
    const positionPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
    const positionMatch = content.match(positionPattern);
    if (positionMatch) {
      const header = positionMatch[1];
      let posBody = positionMatch[2];

      // Update or insert Phase line
      const newPhase = `Phase: ${phaseNumber}${phaseName ? ` (${phaseName})` : ''} — EXECUTING`;
      if (/^Phase:/m.test(posBody)) {
        posBody = posBody.replace(/^Phase:.*$/m, newPhase);
      } else {
        posBody = newPhase + '\n' + posBody;
      }

      // Update or insert Plan line
      const newPlan = `Plan: 1 of ${planCount || '?'}`;
      if (/^Plan:/m.test(posBody)) {
        posBody = posBody.replace(/^Plan:.*$/m, newPlan);
      } else {
        posBody = posBody.replace(/^(Phase:.*$)/m, `$1\n${newPlan}`);
      }

      // Update Status line if present
      const newStatus = `Status: Executing Phase ${phaseNumber}`;
      if (/^Status:/m.test(posBody)) {
        posBody = posBody.replace(/^Status:.*$/m, newStatus);
      }

      // Update Last activity line if present
      const newActivity = `Last activity: ${today} -- Phase ${phaseNumber} execution started`;
      if (/^Last activity:/im.test(posBody)) {
        posBody = posBody.replace(/^Last activity:.*$/im, newActivity);
      }

      content = content.replace(positionPattern, `${header}${posBody}`);
      updated.push('Current Position');
    }

    return content;
  }, cwd);

  output({ updated, phase: phaseNumber, phase_name: phaseName || null, plan_count: planCount || null }, raw, updated.length > 0 ? 'true' : 'false');
}

/**
 * Write a WAITING.json signal file when GSD hits a decision point.
 * External watchers (fswatch, polling, orchestrators) can detect this.
 * File is written to .planning/WAITING.json (or .gsd/WAITING.json if .gsd exists).
 * Fixes #1034.
 */
function cmdSignalWaiting(cwd, type, question, options, phase, raw) {
  const gsdDir = fs.existsSync(path.join(cwd, '.gsd')) ? path.join(cwd, '.gsd') : planningDir(cwd);
  const waitingPath = path.join(gsdDir, 'WAITING.json');

  const signal = {
    status: 'waiting',
    type: type || 'decision_point',
    question: question || null,
    options: options ? options.split('|').map(o => o.trim()) : [],
    since: new Date().toISOString(),
    phase: phase || null,
  };

  try {
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(waitingPath, JSON.stringify(signal, null, 2), 'utf-8');
    output({ signaled: true, path: waitingPath }, raw, 'true');
  } catch (e) {
    output({ signaled: false, error: e.message }, raw, 'false');
  }
}

/**
 * Remove the WAITING.json signal file when user answers and agent resumes.
 */
function cmdSignalResume(cwd, raw) {
  const paths = [
    path.join(cwd, '.gsd', 'WAITING.json'),
    path.join(planningDir(cwd), 'WAITING.json'),
  ];

  let removed = false;
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); removed = true; } catch {}
    }
  }

  output({ resumed: true, removed }, raw, removed ? 'true' : 'false');
}

// ─── Gate Functions (STATE.md consistency enforcement) ────────────────────────

/**
 * Update the ## Performance Metrics section in STATE.md content.
 * Increments Velocity totals and upserts a By Phase table row.
 * Returns modified content string.
 */
function updatePerformanceMetricsSection(content, cwd, phaseNum, planCount, summaryCount) {
  // Update Velocity: Total plans completed
  const totalMatch = content.match(/Total plans completed:\s*(\d+|\[N\])/);
  const prevTotal = totalMatch && totalMatch[1] !== '[N]' ? parseInt(totalMatch[1], 10) : 0;
  const newTotal = prevTotal + summaryCount;
  content = content.replace(
    /Total plans completed:\s*(\d+|\[N\])/,
    `Total plans completed: ${newTotal}`
  );

  // Update By Phase table — upsert row for this phase
  const byPhaseTablePattern = /(\|\s*Phase\s*\|\s*Plans\s*\|\s*Total\s*\|\s*Avg\/Plan\s*\|[ \t]*\n\|(?:[- :\t]+\|)+[ \t]*\n)((?:[ \t]*\|[^\n]*\n)*)(?=\n|$)/i;
  const byPhaseMatch = content.match(byPhaseTablePattern);
  if (byPhaseMatch) {
    let tableBody = byPhaseMatch[2].trim();
    const phaseRowPattern = new RegExp(`^\\|\\s*${escapeRegex(String(phaseNum))}\\s*\\|.*$`, 'm');
    const newRow = `| ${phaseNum} | ${summaryCount} | - | - |`;

    if (phaseRowPattern.test(tableBody)) {
      // Update existing row
      tableBody = tableBody.replace(phaseRowPattern, newRow);
    } else {
      // Remove placeholder row and add new row
      tableBody = tableBody.replace(/^\|\s*-\s*\|\s*-\s*\|\s*-\s*\|\s*-\s*\|$/m, '').trim();
      tableBody = tableBody ? tableBody + '\n' + newRow : newRow;
    }

    content = content.replace(byPhaseTablePattern, `$1${tableBody}\n`);
  }

  return content;
}

/**
 * Gate 3a: Record state after plan-phase completes.
 * Updates Status to "Ready to execute", Total Plans, Last Activity.
 */
function cmdStatePlannedPhase(cwd, phaseNumber, planCount, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  let content = fs.readFileSync(statePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  const updated = [];

  // Update Status
  let result = stateReplaceField(content, 'Status', 'Ready to execute');
  if (result) { content = result; updated.push('Status'); }

  // Update Total Plans in Phase
  if (planCount !== null && planCount !== undefined) {
    result = stateReplaceField(content, 'Total Plans in Phase', String(planCount));
    if (result) { content = result; updated.push('Total Plans in Phase'); }
  }

  // Update Last Activity
  result = stateReplaceField(content, 'Last Activity', today);
  if (result) { content = result; updated.push('Last Activity'); }

  // Update Last Activity Description
  result = stateReplaceField(content, 'Last Activity Description', `Phase ${phaseNumber} planning complete — ${planCount || '?'} plans ready`);
  if (result) { content = result; updated.push('Last Activity Description'); }

  // Update Current Position section
  content = updateCurrentPositionFields(content, {
    status: 'Ready to execute',
    lastActivity: `${today} -- Phase ${phaseNumber} planning complete`,
  });

  if (updated.length > 0) {
    writeStateMd(statePath, content, cwd);
  }

  output({ updated, phase: phaseNumber, plan_count: planCount }, raw, updated.length > 0 ? 'true' : 'false');
}

/**
 * Gate 1: Validate STATE.md against filesystem.
 * Returns { valid, warnings, drift } JSON.
 */
function cmdStateValidate(cwd, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  const content = fs.readFileSync(statePath, 'utf-8');
  const warnings = [];
  const drift = {};

  const status = stateExtractField(content, 'Status') || '';
  const currentPhase = stateExtractField(content, 'Current Phase');
  const totalPlansRaw = stateExtractField(content, 'Total Plans in Phase');
  const totalPlansInPhase = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;

  const phasesDir = planningPaths(cwd).phases;

  // Scan disk for current phase
  if (currentPhase && fs.existsSync(phasesDir)) {
    const normalized = currentPhase.replace(/\s+of\s+\d+.*/, '').trim();
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const phaseDir = entries.find(e => e.isDirectory() && e.name.startsWith(normalized.replace(/^0+/, '').padStart(2, '0')));
      if (phaseDir) {
        const phaseDirPath = path.join(phasesDir, phaseDir.name);
        const files = fs.readdirSync(phaseDirPath);
        const diskPlans = files.filter(f => f.match(/-PLAN\.md$/i)).length;
        const diskSummaries = files.filter(f => f.match(/-SUMMARY\.md$/i)).length;

        // Check plan count mismatch
        if (totalPlansInPhase !== null && diskPlans !== totalPlansInPhase) {
          warnings.push(`Plan count mismatch: STATE.md says ${totalPlansInPhase} plans, disk has ${diskPlans}`);
          drift.plan_count = { state: totalPlansInPhase, disk: diskPlans };
        }

        // Check for VERIFICATION.md
        const verificationFiles = files.filter(f => f.includes('VERIFICATION') && f.endsWith('.md'));
        for (const vf of verificationFiles) {
          try {
            const vContent = fs.readFileSync(path.join(phaseDirPath, vf), 'utf-8');
            if (/status:\s*passed/i.test(vContent) && /executing/i.test(status)) {
              warnings.push(`Status drift: STATE.md says "${status}" but ${vf} shows verification passed — phase may be complete`);
              drift.verification_status = { state_status: status, verification: 'passed' };
            }
          } catch { /* intentionally empty */ }
        }

        // Check if all plans have summaries but status still says executing
        if (diskPlans > 0 && diskSummaries >= diskPlans && /executing/i.test(status)) {
          // Only warn if no verification exists (if verification passed, the above warning covers it)
          if (verificationFiles.length === 0) {
            warnings.push(`All ${diskPlans} plans have summaries but status is still "${status}" — phase may be ready for verification`);
          }
        }
      }
    } catch { /* intentionally empty */ }
  }

  const valid = warnings.length === 0;
  output({ valid, warnings, drift }, raw);
}

/**
 * Gate 2: Sync STATE.md from filesystem ground truth.
 * Scans phase dirs, reconstructs counters, progress, metrics.
 * Supports --verify for dry-run mode.
 */
function cmdStateSync(cwd, options, raw) {
  const statePath = planningPaths(cwd).state;
  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  const verify = options && options.verify;
  const content = fs.readFileSync(statePath, 'utf-8');
  const changes = [];
  let modified = content;
  const today = new Date().toISOString().split('T')[0];

  const phasesDir = planningPaths(cwd).phases;
  if (!fs.existsSync(phasesDir)) {
    output({ synced: true, changes: [], dry_run: !!verify }, raw);
    return;
  }

  // Scan all phases
  let entries;
  try {
    entries = fs.readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
  } catch {
    output({ synced: true, changes: [], dry_run: !!verify }, raw);
    return;
  }

  let totalDiskPlans = 0;
  let totalDiskSummaries = 0;
  let highestIncompletePhase = null;
  let highestIncompletePhaseNum = null;
  let highestIncompletePhaseplanCount = 0;
  let highestIncompletePhaseSummaryCount = 0;

  for (const dir of entries) {
    const dirPath = path.join(phasesDir, dir);
    const files = fs.readdirSync(dirPath);
    const plans = files.filter(f => f.match(/-PLAN\.md$/i)).length;
    const summaries = files.filter(f => f.match(/-SUMMARY\.md$/i)).length;
    totalDiskPlans += plans;
    totalDiskSummaries += summaries;

    // Track the highest phase with incomplete plans (or any plans)
    const phaseMatch = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
    if (phaseMatch && plans > 0) {
      if (summaries < plans) {
        // Incomplete phase — this is likely the current one
        highestIncompletePhase = dir;
        highestIncompletePhaseNum = phaseMatch[1];
        highestIncompletePhaseplanCount = plans;
        highestIncompletePhaseSummaryCount = summaries;
      } else if (!highestIncompletePhase) {
        // All complete, track as potential current
        highestIncompletePhase = dir;
        highestIncompletePhaseNum = phaseMatch[1];
        highestIncompletePhaseplanCount = plans;
        highestIncompletePhaseSummaryCount = summaries;
      }
    }
  }

  // Sync Total Plans in Phase
  if (highestIncompletePhase) {
    const currentPlansField = stateExtractField(modified, 'Total Plans in Phase');
    if (currentPlansField && parseInt(currentPlansField, 10) !== highestIncompletePhaseplanCount) {
      changes.push(`Total Plans in Phase: ${currentPlansField} -> ${highestIncompletePhaseplanCount}`);
      const result = stateReplaceField(modified, 'Total Plans in Phase', String(highestIncompletePhaseplanCount));
      if (result) modified = result;
    }
  }

  // Sync Progress
  const percent = totalDiskPlans > 0 ? Math.min(100, Math.round(totalDiskSummaries / totalDiskPlans * 100)) : 0;
  const currentProgress = stateExtractField(modified, 'Progress');
  if (currentProgress) {
    const currentPercent = parseInt(currentProgress.replace(/[^\d]/g, ''), 10);
    if (currentPercent !== percent) {
      const barWidth = 10;
      const filled = Math.round(percent / 100 * barWidth);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
      const progressStr = `[${bar}] ${percent}%`;
      changes.push(`Progress: ${currentProgress} -> ${progressStr}`);
      const result = stateReplaceField(modified, 'Progress', progressStr);
      if (result) modified = result;
    }
  }

  // Sync Last Activity
  const result = stateReplaceField(modified, 'Last Activity', today);
  if (result) {
    const oldActivity = stateExtractField(modified, 'Last Activity');
    if (oldActivity !== today) {
      changes.push(`Last Activity: ${oldActivity} -> ${today}`);
    }
    modified = result;
  }

  if (verify) {
    output({ synced: false, changes, dry_run: true }, raw);
    return;
  }

  if (changes.length > 0 || modified !== content) {
    writeStateMd(statePath, modified, cwd);
  }

  output({ synced: true, changes, dry_run: false }, raw);
}

module.exports = {
  stateExtractField,
  stateReplaceField,
  stateReplaceFieldWithFallback,
  writeStateMd,
  readModifyWriteStateMd,
  updatePerformanceMetricsSection,
  cmdStateLoad,
  cmdStateGet,
  cmdStatePatch,
  cmdStateUpdate,
  cmdStateAdvancePlan,
  cmdStateRecordMetric,
  cmdStateUpdateProgress,
  cmdStateAddDecision,
  cmdStateAddBlocker,
  cmdStateResolveBlocker,
  cmdStateRecordSession,
  cmdStateSnapshot,
  cmdStateJson,
  cmdStateBeginPhase,
  cmdStatePlannedPhase,
  cmdStateValidate,
  cmdStateSync,
  cmdSignalWaiting,
  cmdSignalResume,
};
