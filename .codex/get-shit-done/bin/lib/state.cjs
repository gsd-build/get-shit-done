/**
 * State — STATE.md operations and progression engine
 *
 * ## Multi-Milestone STATE.md Schema
 *
 * When `parallel_milestones: true` in config.json, STATE.md supports tracking
 * multiple milestones with independent progress. The schema adds:
 *
 * ### YAML Frontmatter Additions
 * ```yaml
 * ---
 * parallel_milestones: true
 * active_milestones: [M1, M7]    # Quick reference
 * current_milestone: M1          # Current context
 * ---
 * ```
 *
 * ### New Markdown Sections
 *
 * #### ## Milestones
 * Tracks all active milestones with per-milestone progress:
 * ```markdown
 * ## Milestones
 *
 * | ID | Name | Status | Progress | Current Phase | Blockers |
 * |----|------|--------|----------|---------------|----------|
 * | M1 | Full PubMed Ingestion | active | 80% | 3-bulk-ingestion | |
 * | M2 | RAG Quality | blocked | 20% | 1-query-transform | Waiting M1 |
 * | M7 | Patient Engagement | active | 40% | 2-compliance | |
 * ```
 *
 * Status values: active, blocked, complete, paused
 *
 * #### ## Position (Extended)
 * Adds milestone context to existing position:
 * ```markdown
 * ## Position
 *
 * **Milestone:** M1
 * **Phase:** 3-bulk-ingestion
 * **Plan:** 2
 * **Status:** Executing plan 3-02
 * ```
 *
 * #### ## Progress (Extended)
 * Shows overall multi-milestone progress:
 * ```markdown
 * ## Progress
 *
 * Overall: [██████░░░░] 60%  (3/5 milestones progressing)
 * ```
 *
 * #### ## Recent Activity
 * Cross-milestone activity log:
 * ```markdown
 * ## Recent Activity
 *
 * - 2026-02-27 14:30 — M7: Completed phase 1-fhir-foundation
 * - 2026-02-27 12:15 — M1: Started phase 3-bulk-ingestion
 * - 2026-02-27 10:00 — M1: Completed plan 2-03
 * ```
 *
 * ### Backward Compatibility
 * Legacy STATE.md files without milestones section continue to work.
 * `parallel_milestones: false` (or absent) uses single-project mode.
 */

const fs = require('fs');
const path = require('path');
const { loadConfig, getMilestoneInfo, output, error } = require('./core.cjs');
const { extractFrontmatter, reconstructFrontmatter } = require('./frontmatter.cjs');

// ─── Multi-Milestone State Helpers ────────────────────────────────────────────

/**
 * Check if STATE.md uses parallel milestones
 * @param {string} content - STATE.md content
 * @param {string} cwd - Current working directory
 * @returns {boolean}
 */
function isParallelMilestoneState(content, cwd) {
  // Check YAML frontmatter first
  const fm = extractFrontmatter(content);
  if (fm && fm.parallel_milestones === true) return true;

  // Check config.json
  const config = loadConfig(cwd);
  if (config.parallel_milestones === true) return true;

  // Check for ## Milestones section
  return /^##\s*Milestones\s*$/m.test(content);
}

/**
 * Parse the ## Milestones table from STATE.md
 * @param {string} content - STATE.md content
 * @returns {Array<{id: string, name: string, status: string, progress_percent: number, current_phase: string, blockers: string[]}>}
 */
function parseMilestonesTable(content) {
  const milestones = [];

  // Match ## Milestones section with markdown table
  const sectionMatch = content.match(/##\s*Milestones\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (!sectionMatch) return milestones;

  const sectionContent = sectionMatch[1];

  // Find table rows (skip header and separator)
  const lines = sectionContent.split('\n');
  let inTable = false;
  let headerPassed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect table start
    if (trimmed.startsWith('|') && trimmed.includes('ID')) {
      inTable = true;
      continue;
    }

    // Skip separator row
    if (inTable && /^\|[-|\s]+\|$/.test(trimmed)) {
      headerPassed = true;
      continue;
    }

    // Parse data rows
    if (inTable && headerPassed && trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 5) {
        const progressMatch = cells[3].match(/(\d+)/);
        const blockerText = cells[5] || '';
        const blockers = blockerText
          ? blockerText.split(/[,;]/).map(b => b.trim()).filter(Boolean)
          : [];

        milestones.push({
          id: cells[0],
          name: cells[1],
          status: cells[2].toLowerCase(),
          progress_percent: progressMatch ? parseInt(progressMatch[1], 10) : 0,
          current_phase: cells[4],
          blockers,
        });
      }
    }
  }

  return milestones;
}

/**
 * Get current milestone context from STATE.md
 * @param {string} content - STATE.md content
 * @returns {string|null} Current milestone ID or null
 */
function getCurrentMilestoneFromState(content) {
  // Check frontmatter
  const fm = extractFrontmatter(content);
  if (fm && fm.current_milestone) return fm.current_milestone;

  // Check ## Position section for **Milestone:** field
  const milestoneMatch = content.match(/\*\*Milestone:\*\*\s*(\S+)/i);
  return milestoneMatch ? milestoneMatch[1] : null;
}

/**
 * Ensure STATE.md has the ## Milestones section
 * @param {string} content - STATE.md content
 * @returns {string} Updated content with milestones section
 */
function ensureMilestonesSection(content) {
  if (/^##\s*Milestones\s*$/m.test(content)) {
    return content; // Already exists
  }

  // Insert after frontmatter or at top
  const milestonesSection = `## Milestones

| ID | Name | Status | Progress | Current Phase | Blockers |
|----|------|--------|----------|---------------|----------|

`;

  // Find good insertion point (after frontmatter, before ## Position or first ##)
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n*/);
  if (fmMatch) {
    const insertIdx = fmMatch[0].length;
    return content.slice(0, insertIdx) + milestonesSection + content.slice(insertIdx);
  }

  // Insert at top if no frontmatter
  const firstSection = content.search(/^##/m);
  if (firstSection > 0) {
    return content.slice(0, firstSection) + milestonesSection + content.slice(firstSection);
  }

  return milestonesSection + content;
}

/**
 * Ensure STATE.md has the ## Recent Activity section
 * @param {string} content - STATE.md content
 * @returns {string} Updated content with activity section
 */
function ensureRecentActivitySection(content) {
  if (/^##\s*Recent Activity\s*$/m.test(content)) {
    return content; // Already exists
  }

  const activitySection = `## Recent Activity

`;

  // Insert before last section or at end
  const lastSectionMatch = content.match(/\n---\n\*[^*]+\*\s*$/);
  if (lastSectionMatch) {
    const insertIdx = content.lastIndexOf(lastSectionMatch[0]);
    return content.slice(0, insertIdx) + '\n' + activitySection + content.slice(insertIdx);
  }

  return content + '\n' + activitySection;
}

/**
 * Update a milestone row in the ## Milestones table
 * @param {string} content - STATE.md content
 * @param {string} milestoneId - Milestone ID (e.g., "M7")
 * @param {object} updates - Fields to update { status?, progress_percent?, current_phase?, blockers? }
 * @returns {string} Updated content
 */
function updateMilestoneRow(content, milestoneId, updates) {
  const normalizedId = milestoneId.toUpperCase();

  // Find and update the row
  const rowPattern = new RegExp(
    `^(\\|\\s*${normalizedId}\\s*\\|)([^|]+\\|)([^|]+\\|)([^|]+\\|)([^|]+\\|)([^|]*)\\|`,
    'im'
  );

  const match = content.match(rowPattern);
  if (!match) return content;

  // Current values
  const currentName = match[2].trim().replace(/\|$/, '');
  const currentStatus = match[3].trim().replace(/\|$/, '');
  const currentProgress = match[4].trim().replace(/\|$/, '');
  const currentPhase = match[5].trim().replace(/\|$/, '');
  const currentBlockers = match[6].trim().replace(/\|$/, '');

  // Build new row
  const newStatus = updates.status || currentStatus;
  const newProgress = updates.progress_percent !== undefined
    ? `${updates.progress_percent}%`
    : currentProgress;
  const newPhase = updates.current_phase || currentPhase;
  const newBlockers = updates.blockers !== undefined
    ? updates.blockers.join(', ')
    : currentBlockers;

  const newRow = `| ${normalizedId} | ${currentName} | ${newStatus} | ${newProgress} | ${newPhase} | ${newBlockers} |`;

  return content.replace(rowPattern, newRow);
}

/**
 * Add a new milestone row to the ## Milestones table
 * @param {string} content - STATE.md content
 * @param {object} milestone - { id, name, status, progress_percent, current_phase, blockers }
 * @returns {string} Updated content
 */
function addMilestoneRow(content, milestone) {
  const { id, name, status = 'active', progress_percent = 0, current_phase = '-', blockers = [] } = milestone;

  // Ensure milestones section exists
  content = ensureMilestonesSection(content);

  // Find the table and add row
  const tablePattern = /(##\s*Milestones\s*\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|$)/i;
  const match = content.match(tablePattern);

  if (match) {
    const tableBody = match[2].trimEnd();
    const newRow = `| ${id.toUpperCase()} | ${name} | ${status} | ${progress_percent}% | ${current_phase} | ${blockers.join(', ')} |`;

    const newTableBody = tableBody ? tableBody + '\n' + newRow : newRow;
    return content.replace(tablePattern, `${match[1]}${newTableBody}\n`);
  }

  return content;
}

/**
 * Remove a milestone row from the ## Milestones table
 * @param {string} content - STATE.md content
 * @param {string} milestoneId - Milestone ID to remove
 * @returns {string} Updated content
 */
function removeMilestoneRow(content, milestoneId) {
  const normalizedId = milestoneId.toUpperCase();
  const rowPattern = new RegExp(`^\\|\\s*${normalizedId}\\s*\\|[^\\n]*\\n`, 'im');
  return content.replace(rowPattern, '');
}

function cmdStateLoad(cwd, raw) {
  const config = loadConfig(cwd);
  const planningDir = path.join(cwd, '.planning');

  let stateRaw = '';
  try {
    stateRaw = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
  } catch {}

  const configExists = fs.existsSync(path.join(planningDir, 'config.json'));
  const roadmapExists = fs.existsSync(path.join(planningDir, 'ROADMAP.md'));
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
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  try {
    const content = fs.readFileSync(statePath, 'utf-8');

    if (!section) {
      output({ content }, raw, content);
      return;
    }

    // Try to find markdown section or field
    const fieldEscaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Check for **field:** value
    const fieldPattern = new RegExp(`\\*\\*${fieldEscaped}:\\*\\*\\s*(.*)`, 'i');
    const fieldMatch = content.match(fieldPattern);
    if (fieldMatch) {
      output({ [section]: fieldMatch[1].trim() }, raw, fieldMatch[1].trim());
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

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  try {
    return fs.readFileSync(resolvedPath, 'utf-8').trimEnd();
  } catch {
    throw new Error(`${label} file not found: ${filePath}`);
  }
}

function cmdStatePatch(cwd, patches, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  try {
    let content = fs.readFileSync(statePath, 'utf-8');
    const results = { updated: [], failed: [] };

    for (const [field, value] of Object.entries(patches)) {
      const fieldEscaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(\\*\\*${fieldEscaped}:\\*\\*\\s*)(.*)`, 'i');

      if (pattern.test(content)) {
        content = content.replace(pattern, (_match, prefix) => `${prefix}${value}`);
        results.updated.push(field);
      } else {
        results.failed.push(field);
      }
    }

    if (results.updated.length > 0) {
      writeStateMd(statePath, content, cwd);
    }

    output(results, raw, results.updated.length > 0 ? 'true' : 'false');
  } catch {
    error('STATE.md not found');
  }
}

function cmdStateUpdate(cwd, field, value) {
  if (!field || value === undefined) {
    error('field and value required for state update');
  }

  const statePath = path.join(cwd, '.planning', 'STATE.md');
  try {
    let content = fs.readFileSync(statePath, 'utf-8');
    const fieldEscaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\*\\*${fieldEscaped}:\\*\\*\\s*)(.*)`, 'i');
    if (pattern.test(content)) {
      content = content.replace(pattern, (_match, prefix) => `${prefix}${value}`);
      writeStateMd(statePath, content, cwd);
      output({ updated: true });
    } else {
      output({ updated: false, reason: `Field "${field}" not found in STATE.md` });
    }
  } catch {
    output({ updated: false, reason: 'STATE.md not found' });
  }
}

// ─── State Progression Engine ────────────────────────────────────────────────

function stateExtractField(content, fieldName) {
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function stateReplaceField(content, fieldName, newValue) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (pattern.test(content)) {
    return content.replace(pattern, (_match, prefix) => `${prefix}${newValue}`);
  }
  return null;
}

function cmdStateAdvancePlan(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');
  const currentPlan = parseInt(stateExtractField(content, 'Current Plan'), 10);
  const totalPlans = parseInt(stateExtractField(content, 'Total Plans in Phase'), 10);
  const today = new Date().toISOString().split('T')[0];

  if (isNaN(currentPlan) || isNaN(totalPlans)) {
    output({ error: 'Cannot parse Current Plan or Total Plans in Phase from STATE.md' }, raw);
    return;
  }

  if (currentPlan >= totalPlans) {
    content = stateReplaceField(content, 'Status', 'Phase complete — ready for verification') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    writeStateMd(statePath, content, cwd);
    output({ advanced: false, reason: 'last_plan', current_plan: currentPlan, total_plans: totalPlans, status: 'ready_for_verification' }, raw, 'false');
  } else {
    const newPlan = currentPlan + 1;
    content = stateReplaceField(content, 'Current Plan', String(newPlan)) || content;
    content = stateReplaceField(content, 'Status', 'Ready to execute') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    writeStateMd(statePath, content, cwd);
    output({ advanced: true, previous_plan: currentPlan, current_plan: newPlan, total_plans: totalPlans }, raw, 'true');
  }
}

function cmdStateRecordMetric(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');
  const { phase, plan, duration, tasks, files } = options;

  if (!phase || !plan || !duration) {
    output({ error: 'phase, plan, and duration required' }, raw);
    return;
  }

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

    content = content.replace(metricsPattern, (_match, header) => `${header}${tableBody}\n`);
    writeStateMd(statePath, content, cwd);
    output({ recorded: true, phase, plan, duration }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'Performance Metrics section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateUpdateProgress(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');

  // Count summaries across all phases
  const phasesDir = path.join(cwd, '.planning', 'phases');
  let totalPlans = 0;
  let totalSummaries = 0;

  if (fs.existsSync(phasesDir)) {
    const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name);
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

  const progressPattern = /(\*\*Progress:\*\*\s*).*/i;
  if (progressPattern.test(content)) {
    content = content.replace(progressPattern, (_match, prefix) => `${prefix}${progressStr}`);
    writeStateMd(statePath, content, cwd);
    output({ updated: true, percent, completed: totalSummaries, total: totalPlans, bar: progressStr }, raw, progressStr);
  } else {
    output({ updated: false, reason: 'Progress field not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateAddDecision(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
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

  let content = fs.readFileSync(statePath, 'utf-8');
  const entry = `- [Phase ${phase || '?'}]: ${summaryText}${rationaleText ? ` — ${rationaleText}` : ''}`;

  // Find Decisions section (various heading patterns)
  const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    let sectionBody = match[2];
    // Remove placeholders
    sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/No decisions yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, (_match, header) => `${header}${sectionBody}`);
    writeStateMd(statePath, content, cwd);
    output({ added: true, decision: entry }, raw, 'true');
  } else {
    output({ added: false, reason: 'Decisions section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateAddBlocker(cwd, text, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
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

  let content = fs.readFileSync(statePath, 'utf-8');
  const entry = `- ${blockerText}`;

  const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    let sectionBody = match[2];
    sectionBody = sectionBody.replace(/None\.?\s*\n?/gi, '').replace(/None yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, (_match, header) => `${header}${sectionBody}`);
    writeStateMd(statePath, content, cwd);
    output({ added: true, blocker: blockerText }, raw, 'true');
  } else {
    output({ added: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateResolveBlocker(cwd, text, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }
  if (!text) { output({ error: 'text required' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');

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

    content = content.replace(sectionPattern, (_match, header) => `${header}${newBody}`);
    writeStateMd(statePath, content, cwd);
    output({ resolved: true, blocker: text }, raw, 'true');
  } else {
    output({ resolved: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateRecordSession(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');
  const now = new Date().toISOString();
  const updated = [];

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

  if (updated.length > 0) {
    writeStateMd(statePath, content, cwd);
    output({ recorded: true, updated }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'No session fields found in STATE.md' }, raw, 'false');
  }
}

function cmdStateSnapshot(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  const content = fs.readFileSync(statePath, 'utf-8');

  // Helper to extract **Field:** value patterns
  const extractField = (fieldName) => {
    const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
    const match = content.match(pattern);
    return match ? match[1].trim() : null;
  };

  // Check if this is a parallel milestones project
  const parallelMilestones = isParallelMilestoneState(content, cwd);

  // Extract basic fields
  const currentPhase = extractField('Current Phase');
  const currentPhaseName = extractField('Current Phase Name');
  const totalPhasesRaw = extractField('Total Phases');
  const currentPlan = extractField('Current Plan');
  const totalPlansRaw = extractField('Total Plans in Phase');
  const status = extractField('Status');
  const progressRaw = extractField('Progress');
  const lastActivity = extractField('Last Activity');
  const lastActivityDesc = extractField('Last Activity Description');
  const pausedAt = extractField('Paused At');

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
    const lastDateMatch = sessionSection.match(/\*\*Last Date:\*\*\s*(.+)/i);
    const stoppedAtMatch = sessionSection.match(/\*\*Stopped At:\*\*\s*(.+)/i);
    const resumeFileMatch = sessionSection.match(/\*\*Resume File:\*\*\s*(.+)/i);

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
    parallel_milestones: parallelMilestones,
  };

  // Add milestone data if parallel milestones enabled
  if (parallelMilestones) {
    // Parse milestones from STATE.md table
    const stateMilestones = parseMilestonesTable(content);

    // Merge with listMilestones() for accuracy if milestone-parallel module available
    let milestones = stateMilestones;
    try {
      const milestoneParallel = require('./milestone-parallel.cjs');
      const diskMilestones = milestoneParallel.listMilestones(cwd);

      // Create map for quick lookup
      const stateMap = new Map(stateMilestones.map(m => [m.id, m]));

      // Merge - prefer STATE.md for status/blockers, ROADMAP.md for progress
      milestones = diskMilestones.map(disk => {
        const state = stateMap.get(disk.id) || {};
        return {
          id: disk.id,
          name: disk.name,
          status: state.status || disk.status,
          progress_percent: disk.progress_percent, // Trust ROADMAP.md calculations
          current_phase: disk.phase_count > 0
            ? `Phase ${disk.completed_count + 1}/${disk.phase_count}`
            : state.current_phase || '-',
          phase_count: disk.phase_count,
          completed_phases: disk.completed_count,
          blockers: state.blockers || [],
        };
      });
    } catch {
      // milestone-parallel module not available, use STATE.md data only
    }

    result.milestones = milestones;
    result.current_milestone = getCurrentMilestoneFromState(content);

    // Calculate overall progress across all milestones
    if (milestones.length > 0) {
      const totalProgress = milestones.reduce((sum, m) => sum + (m.progress_percent || 0), 0);
      result.overall_progress = Math.round(totalProgress / milestones.length);

      // Count active milestones
      result.active_milestone_count = milestones.filter(m =>
        m.status === 'active' || m.status === 'blocked'
      ).length;
    }
  }

  output(result, raw);
}

// ─── State Frontmatter Sync ──────────────────────────────────────────────────

/**
 * Extract machine-readable fields from STATE.md markdown body and build
 * a YAML frontmatter object. Allows hooks and scripts to read state
 * reliably via `state json` instead of fragile regex parsing.
 */
function buildStateFrontmatter(bodyContent, cwd) {
  const extractField = (fieldName) => {
    const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
    const match = bodyContent.match(pattern);
    return match ? match[1].trim() : null;
  };

  const currentPhase = extractField('Current Phase');
  const currentPhaseName = extractField('Current Phase Name');
  const currentPlan = extractField('Current Plan');
  const totalPhasesRaw = extractField('Total Phases');
  const totalPlansRaw = extractField('Total Plans in Phase');
  const status = extractField('Status');
  const progressRaw = extractField('Progress');
  const lastActivity = extractField('Last Activity');
  const stoppedAt = extractField('Stopped At') || extractField('Stopped at');
  const pausedAt = extractField('Paused At');

  let milestone = null;
  let milestoneName = null;
  if (cwd) {
    try {
      const info = getMilestoneInfo(cwd);
      milestone = info.version;
      milestoneName = info.name;
    } catch {}
  }

  let totalPhases = totalPhasesRaw ? parseInt(totalPhasesRaw, 10) : null;
  let completedPhases = null;
  let totalPlans = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;
  let completedPlans = null;

  if (cwd) {
    try {
      const phasesDir = path.join(cwd, '.planning', 'phases');
      if (fs.existsSync(phasesDir)) {
        const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
          .filter(e => e.isDirectory()).map(e => e.name);
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
        if (totalPhases === null) totalPhases = phaseDirs.length;
        completedPhases = diskCompletedPhases;
        totalPlans = diskTotalPlans;
        completedPlans = diskTotalSummaries;
      }
    } catch {}
  }

  let progressPercent = null;
  if (progressRaw) {
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
  return content.replace(/^---\n[\s\S]*?\n---\n*/, '');
}

function syncStateFrontmatter(content, cwd) {
  const body = stripFrontmatter(content);
  const fm = buildStateFrontmatter(body, cwd);
  const yamlStr = reconstructFrontmatter(fm);
  return `---\n${yamlStr}\n---\n\n${body}`;
}

/**
 * Write STATE.md with synchronized YAML frontmatter.
 * All STATE.md writes should use this instead of raw writeFileSync.
 */
function writeStateMd(statePath, content, cwd) {
  const synced = syncStateFrontmatter(content, cwd);
  fs.writeFileSync(statePath, synced, 'utf-8');
}

function cmdStateJson(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw, 'STATE.md not found');
    return;
  }

  const content = fs.readFileSync(statePath, 'utf-8');
  const fm = extractFrontmatter(content);

  if (!fm || Object.keys(fm).length === 0) {
    const body = stripFrontmatter(content);
    const built = buildStateFrontmatter(body, cwd);
    output(built, raw, JSON.stringify(built, null, 2));
    return;
  }

  output(fm, raw, JSON.stringify(fm, null, 2));
}

// ─── Multi-Milestone State Commands ──────────────────────────────────────────

/**
 * Set current milestone context in STATE.md
 * Updates ## Position section with milestone: <id>
 * @param {string} cwd - Current working directory
 * @param {string} milestoneId - Milestone ID (e.g., "M7")
 * @param {boolean} raw - Raw output mode
 */
function cmdStateSetMilestone(cwd, milestoneId, raw) {
  if (!milestoneId) {
    error('Milestone ID required');
    return;
  }

  const normalizedId = milestoneId.toUpperCase();
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  // Validate milestone exists
  let milestoneExists = false;
  try {
    const milestoneParallel = require('./milestone-parallel.cjs');
    const milestones = milestoneParallel.listMilestones(cwd);
    milestoneExists = milestones.some(m => m.id === normalizedId);
  } catch {
    // Check in STATE.md milestones table
    const content = fs.readFileSync(statePath, 'utf-8');
    const stateMilestones = parseMilestonesTable(content);
    milestoneExists = stateMilestones.some(m => m.id === normalizedId);
  }

  if (!milestoneExists) {
    output({ error: `Milestone ${normalizedId} not found` }, raw);
    return;
  }

  let content = fs.readFileSync(statePath, 'utf-8');

  // Update **Milestone:** field in ## Position section
  const milestoneFieldPattern = /(\*\*Milestone:\*\*\s*)(\S+)/i;
  if (milestoneFieldPattern.test(content)) {
    content = content.replace(milestoneFieldPattern, `$1${normalizedId}`);
  } else {
    // Add Milestone field after ## Position heading
    const positionPattern = /(##\s*Position\s*\n)/i;
    if (positionPattern.test(content)) {
      content = content.replace(positionPattern, `$1\n**Milestone:** ${normalizedId}\n`);
    }
  }

  writeStateMd(statePath, content, cwd);
  output({ set: true, milestone: normalizedId }, raw, `Switched to milestone ${normalizedId}`);
}

/**
 * Update milestone row in STATE.md with fresh progress from ROADMAP.md
 * @param {string} cwd - Current working directory
 * @param {string} milestoneId - Milestone ID (e.g., "M7")
 * @param {boolean} raw - Raw output mode
 */
function cmdStateUpdateMilestone(cwd, milestoneId, raw) {
  if (!milestoneId) {
    error('Milestone ID required');
    return;
  }

  const normalizedId = milestoneId.toUpperCase();
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  // Get fresh data from milestone-parallel module
  let milestoneInfo = null;
  try {
    const milestoneParallel = require('./milestone-parallel.cjs');
    milestoneInfo = milestoneParallel.getMilestoneInfo(cwd, normalizedId);
  } catch {
    output({ error: 'milestone-parallel module not available' }, raw);
    return;
  }

  if (!milestoneInfo) {
    output({ error: `Milestone ${normalizedId} not found` }, raw);
    return;
  }

  let content = fs.readFileSync(statePath, 'utf-8');

  // Ensure milestones section exists
  content = ensureMilestonesSection(content);

  // Check if milestone row exists
  const rowPattern = new RegExp(`^\\|\\s*${normalizedId}\\s*\\|`, 'im');
  if (rowPattern.test(content)) {
    // Update existing row
    content = updateMilestoneRow(content, normalizedId, {
      status: milestoneInfo.status,
      progress_percent: milestoneInfo.progress_percent,
      current_phase: milestoneInfo.phase_count > 0
        ? `Phase ${milestoneInfo.completed_count + 1}/${milestoneInfo.phase_count}`
        : '-',
    });
  } else {
    // Add new row
    content = addMilestoneRow(content, {
      id: normalizedId,
      name: milestoneInfo.name,
      status: milestoneInfo.status,
      progress_percent: milestoneInfo.progress_percent,
      current_phase: milestoneInfo.phase_count > 0
        ? `Phase ${milestoneInfo.completed_count + 1}/${milestoneInfo.phase_count}`
        : '-',
      blockers: [],
    });
  }

  writeStateMd(statePath, content, cwd);
  output({
    updated: true,
    milestone: normalizedId,
    progress_percent: milestoneInfo.progress_percent,
    status: milestoneInfo.status,
  }, raw, `Updated ${normalizedId}: ${milestoneInfo.progress_percent}%`);
}

/**
 * Add new milestone to STATE.md tracking
 * @param {string} cwd - Current working directory
 * @param {string} milestoneId - Milestone ID (e.g., "M7")
 * @param {string} name - Milestone name
 * @param {boolean} raw - Raw output mode
 */
function cmdStateAddMilestone(cwd, milestoneId, name, raw) {
  if (!milestoneId) {
    error('Milestone ID required');
    return;
  }

  const normalizedId = milestoneId.toUpperCase();
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  let content = fs.readFileSync(statePath, 'utf-8');

  // Check if milestone already exists in table
  const existingMilestones = parseMilestonesTable(content);
  if (existingMilestones.some(m => m.id === normalizedId)) {
    output({ error: `Milestone ${normalizedId} already exists in STATE.md` }, raw);
    return;
  }

  // Get name from milestone-parallel if not provided
  let milestoneName = name;
  if (!milestoneName) {
    try {
      const milestoneParallel = require('./milestone-parallel.cjs');
      const info = milestoneParallel.getMilestoneInfo(cwd, normalizedId);
      if (info) milestoneName = info.name;
    } catch {
      // Use ID as name fallback
    }
  }
  if (!milestoneName) milestoneName = normalizedId;

  // Ensure milestones section exists and add row
  content = ensureMilestonesSection(content);
  content = addMilestoneRow(content, {
    id: normalizedId,
    name: milestoneName,
    status: 'active',
    progress_percent: 0,
    current_phase: '-',
    blockers: [],
  });

  // Update frontmatter active_milestones
  const fm = extractFrontmatter(content);
  if (fm) {
    const activeMilestones = fm.active_milestones || [];
    if (!activeMilestones.includes(normalizedId)) {
      activeMilestones.push(normalizedId);
      fm.active_milestones = activeMilestones;
      fm.parallel_milestones = true;
    }
  }

  writeStateMd(statePath, content, cwd);
  output({ added: true, milestone: normalizedId, name: milestoneName }, raw, `Added ${normalizedId}: ${milestoneName}`);
}

/**
 * Remove milestone from STATE.md tracking
 * @param {string} cwd - Current working directory
 * @param {string} milestoneId - Milestone ID (e.g., "M7")
 * @param {boolean} raw - Raw output mode
 */
function cmdStateRemoveMilestone(cwd, milestoneId, raw) {
  if (!milestoneId) {
    error('Milestone ID required');
    return;
  }

  const normalizedId = milestoneId.toUpperCase();
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  let content = fs.readFileSync(statePath, 'utf-8');

  // Check if milestone exists in table
  const existingMilestones = parseMilestonesTable(content);
  if (!existingMilestones.some(m => m.id === normalizedId)) {
    output({ error: `Milestone ${normalizedId} not found in STATE.md` }, raw);
    return;
  }

  // Remove row from table
  content = removeMilestoneRow(content, normalizedId);

  // Update frontmatter active_milestones
  const fm = extractFrontmatter(content);
  if (fm && Array.isArray(fm.active_milestones)) {
    fm.active_milestones = fm.active_milestones.filter(id => id !== normalizedId);
    if (fm.active_milestones.length === 0) {
      delete fm.active_milestones;
    }
  }

  // Clear current_milestone if it matches
  if (fm && fm.current_milestone === normalizedId) {
    delete fm.current_milestone;
  }

  writeStateMd(statePath, content, cwd);
  output({ removed: true, milestone: normalizedId }, raw, `Removed ${normalizedId}`);
}

/**
 * Get milestones list from STATE.md
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - Raw output mode
 */
function cmdStateGetMilestones(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  const content = fs.readFileSync(statePath, 'utf-8');
  const milestones = parseMilestonesTable(content);
  const currentMilestone = getCurrentMilestoneFromState(content);

  const result = {
    milestones,
    current_milestone: currentMilestone,
    count: milestones.length,
  };

  // Format human-readable output
  const lines = milestones.map(m =>
    `${m.id === currentMilestone ? '* ' : '  '}${m.id}: ${m.name} (${m.status}) - ${m.progress_percent}%`
  );

  output(result, raw, lines.join('\n') || 'No milestones tracked');
}

// ─── Cross-Milestone Activity Logging ────────────────────────────────────────

/** Default max activity entries to keep */
const DEFAULT_MAX_ACTIVITY_ENTRIES = 20;

/**
 * Activity types for cross-milestone logging
 */
const ACTIVITY_TYPES = {
  PHASE_STARTED: 'Started phase',
  PHASE_COMPLETED: 'Completed phase',
  PLAN_STARTED: 'Started plan',
  PLAN_COMPLETED: 'Completed plan',
  BLOCKER_ADDED: 'Blocker added',
  BLOCKER_RESOLVED: 'Blocker resolved',
  STATUS_CHANGED: 'Status changed to',
};

/**
 * Log activity to STATE.md ## Recent Activity section
 * Format: - YYYY-MM-DD HH:MM — <milestone>: <activity>
 *
 * @param {string} cwd - Current working directory
 * @param {object} options - Activity details
 * @param {string} options.milestone - Milestone ID (e.g., "M7") or null for global
 * @param {string} options.activity - Activity description
 * @param {string} [options.type] - Activity type from ACTIVITY_TYPES
 * @param {number} [options.max_entries] - Max entries to keep (default 20)
 * @param {boolean} raw - Raw output mode
 */
function cmdStateLogActivity(cwd, options, raw) {
  const { milestone, activity, type, max_entries = DEFAULT_MAX_ACTIVITY_ENTRIES } = options || {};

  if (!activity) {
    error('Activity description required');
    return;
  }

  const statePath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  let content = fs.readFileSync(statePath, 'utf-8');

  // Ensure ## Recent Activity section exists
  content = ensureRecentActivitySection(content);

  // Build activity entry
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 16); // YYYY-MM-DD HH:MM
  const milestonePrefix = milestone ? `${milestone.toUpperCase()}: ` : '';
  const activityText = type ? `${type} ${activity}` : activity;
  const entry = `- ${timestamp} \u2014 ${milestonePrefix}${activityText}`;

  // Find ## Recent Activity section and add entry
  const sectionPattern = /(##\s*Recent Activity\s*\n)([\s\S]*?)(?=\n##|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    let sectionBody = match[2].trim();

    // Parse existing entries
    const lines = sectionBody.split('\n').filter(l => l.startsWith('- '));

    // Add new entry at top (newest first)
    lines.unshift(entry);

    // Truncate to max entries
    const truncatedLines = lines.slice(0, max_entries);

    const newBody = truncatedLines.length > 0 ? truncatedLines.join('\n') + '\n' : '';
    content = content.replace(sectionPattern, `$1\n${newBody}`);

    writeStateMd(statePath, content, cwd);
    output({
      logged: true,
      entry,
      entries_count: truncatedLines.length,
      truncated: lines.length > max_entries,
    }, raw, `Logged: ${entry}`);
  } else {
    output({ logged: false, reason: 'Recent Activity section not found' }, raw, 'false');
  }
}

/**
 * Get recent activity log from STATE.md
 * @param {string} cwd - Current working directory
 * @param {object} options - Filter options
 * @param {string} [options.milestone] - Filter by milestone ID
 * @param {number} [options.limit] - Limit number of entries
 * @param {boolean} raw - Raw output mode
 */
function cmdStateGetActivity(cwd, options, raw) {
  const { milestone, limit } = options || {};

  const statePath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  const content = fs.readFileSync(statePath, 'utf-8');

  // Parse ## Recent Activity section
  const sectionMatch = content.match(/##\s*Recent Activity\s*\n([\s\S]*?)(?=\n##|$)/i);

  const entries = [];
  if (sectionMatch) {
    const lines = sectionMatch[1].trim().split('\n').filter(l => l.startsWith('- '));

    for (const line of lines) {
      // Parse: - YYYY-MM-DD HH:MM — [M7: ]activity
      const parseMatch = line.match(/^-\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+\u2014\s+(?:(M\d+):\s+)?(.+)$/);
      if (parseMatch) {
        entries.push({
          timestamp: parseMatch[1],
          milestone: parseMatch[2] || null,
          activity: parseMatch[3],
        });
      }
    }
  }

  // Filter by milestone if specified
  let filtered = entries;
  if (milestone) {
    const normalizedMilestone = milestone.toUpperCase();
    filtered = entries.filter(e => e.milestone === normalizedMilestone);
  }

  // Apply limit
  if (limit && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  const result = {
    entries: filtered,
    count: filtered.length,
    total: entries.length,
  };

  // Format human-readable output
  const lines = filtered.map(e =>
    `${e.timestamp} ${e.milestone ? `[${e.milestone}] ` : ''}${e.activity}`
  );

  output(result, raw, lines.join('\n') || 'No activity logged');
}

module.exports = {
  // Core helpers
  stateExtractField,
  stateReplaceField,
  writeStateMd,
  // Multi-milestone helpers
  isParallelMilestoneState,
  parseMilestonesTable,
  getCurrentMilestoneFromState,
  ensureMilestonesSection,
  ensureRecentActivitySection,
  updateMilestoneRow,
  addMilestoneRow,
  removeMilestoneRow,
  // Activity types
  ACTIVITY_TYPES,
  // Standard state commands
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
  // Multi-milestone commands
  cmdStateSetMilestone,
  cmdStateUpdateMilestone,
  cmdStateAddMilestone,
  cmdStateRemoveMilestone,
  cmdStateGetMilestones,
  // Activity logging
  cmdStateLogActivity,
  cmdStateGetActivity,
};
