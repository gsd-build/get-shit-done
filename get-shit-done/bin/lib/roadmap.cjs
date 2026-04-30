/**
 * Roadmap — Roadmap parsing and update operations
 */

const fs = require('fs');
const path = require('path');
const { escapeRegex, normalizePhaseName, output, error, findPhaseInternal, stripShippedMilestones, extractCurrentMilestone, replaceInCurrentMilestone, phaseTokenMatches, atomicWriteFileSync } = require('./core.cjs');
const { planningPaths, withPlanningLock } = require('./planning-workspace.cjs');

/**
 * Coerce an arbitrary YAML scalar/object into a string for cross-cutting
 * truth aggregation. Handles:
 *   - strings (passthrough)
 *   - numbers / booleans (String() coercion — issue #2770: bare YAML ints
 *     like `- 3` must be surfaced, not silently skipped)
 *   - kv-shaped objects from parseMustHavesBlock continuation kv (issue
 *     #2757) — extract the first meaningful string field
 *
 * Returns the empty string when no usable text can be derived; callers should
 * skip empty results.
 */
function coerceTruthToString(t) {
  if (t === null || t === undefined) return '';
  if (typeof t === 'string') return t;
  if (typeof t === 'number' || typeof t === 'boolean' || typeof t === 'bigint') {
    return String(t);
  }
  if (typeof t === 'object') {
    // Prefer common title-bearing keys produced by parseMustHavesBlock
    for (const k of ['title', 'text', 'name', 'rule', 'path', 'provides']) {
      const v = t[k];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    }
  }
  return '';
}

/**
 * Search for a phase header (and its section) within the given content string.
 * Returns a result object if found (either a full match or a malformed_roadmap
 * checklist-only match), or null if the phase is not present at all.
 */
function searchPhaseInContent(content, escapedPhase, phaseNum) {
  // Match "## Phase X:", "### Phase X:", or "#### Phase X:" with optional name
  const phasePattern = new RegExp(
    `#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`,
    'i'
  );
  const headerMatch = content.match(phasePattern);

  if (!headerMatch) {
    // Fallback: check if phase exists in summary list but missing detail section
    const checklistPattern = new RegExp(
      `-\\s*\\[[ x]\\]\\s*\\*\\*Phase\\s+${escapedPhase}:\\s*([^*]+)\\*\\*`,
      'i'
    );
    const checklistMatch = content.match(checklistPattern);

    if (checklistMatch) {
      return {
        found: false,
        phase_number: phaseNum,
        phase_name: checklistMatch[1].trim(),
        error: 'malformed_roadmap',
        message: `Phase ${phaseNum} exists in summary list but missing "### Phase ${phaseNum}:" detail section. ROADMAP.md needs both formats.`
      };
    }

    return null;
  }

  const phaseName = headerMatch[1].trim();
  const headerIndex = headerMatch.index;

  // Find the end of this section (next ## or ### phase header, or end of file)
  const restOfContent = content.slice(headerIndex);
  const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
  const sectionEnd = nextHeaderMatch
    ? headerIndex + nextHeaderMatch.index
    : content.length;

  const section = content.slice(headerIndex, sectionEnd).trim();

  // Extract goal if present (supports both **Goal:** and **Goal**: formats)
  const goalMatch = section.match(/\*\*Goal(?::\*\*|\*\*:)\s*([^\n]+)/i);
  const goal = goalMatch ? goalMatch[1].trim() : null;

  // Extract success criteria as structured array
  const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
  const success_criteria = criteriaMatch
    ? criteriaMatch[1].trim().split('\n').map(line => line.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean)
    : [];

  return {
    found: true,
    phase_number: phaseNum,
    phase_name: phaseName,
    goal,
    success_criteria,
    section,
  };
}

function cmdRoadmapGetPhase(cwd, phaseNum, raw) {
  const roadmapPath = planningPaths(cwd).roadmap;

  if (!fs.existsSync(roadmapPath)) {
    output({ found: false, error: 'ROADMAP.md not found' }, raw, '');
    return;
  }

  try {
    const rawContent = fs.readFileSync(roadmapPath, 'utf-8');
    const milestoneContent = extractCurrentMilestone(rawContent, cwd);

    // Escape special regex chars in phase number, handle decimal
    const escapedPhase = escapeRegex(phaseNum);

    // Search the current milestone slice first, then fall back to full roadmap.
    // A malformed_roadmap result (checklist-only) from the milestone should not
    // block finding a full header match in the wider roadmap content.
    const fullContent = stripShippedMilestones(rawContent);
    const milestoneResult = searchPhaseInContent(milestoneContent, escapedPhase, phaseNum);
    const result = (milestoneResult && !milestoneResult.error)
      ? milestoneResult
      : searchPhaseInContent(fullContent, escapedPhase, phaseNum) || milestoneResult;

    if (!result) {
      output({ found: false, phase_number: phaseNum }, raw, '');
      return;
    }

    if (result.error) {
      output(result, raw, '');
      return;
    }

    output(result, raw, result.section);
  } catch (e) {
    error('Failed to read ROADMAP.md: ' + e.message);
  }
}

function cmdRoadmapAnalyze(cwd, raw) {
  const roadmapPath = planningPaths(cwd).roadmap;

  if (!fs.existsSync(roadmapPath)) {
    output({ error: 'ROADMAP.md not found', milestones: [], phases: [], current_phase: null }, raw);
    return;
  }

  const rawContent = fs.readFileSync(roadmapPath, 'utf-8');
  const content = extractCurrentMilestone(rawContent, cwd);
  const phasesDir = planningPaths(cwd).phases;

  // Extract all phase headings: ## Phase N: Name or ### Phase N: Name
  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
  const phases = [];
  let match;

  // Build phase directory lookup once (O(1) readdir instead of O(N) per phase)
  const _phaseDirNames = (() => {
    try {
      return fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
    } catch { return []; }
  })();

  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseName = match[2].replace(/\(INSERTED\)/i, '').trim();

    // Extract goal from the section
    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index : content.length;
    const section = content.slice(sectionStart, sectionEnd);

    const goalMatch = section.match(/\*\*Goal(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    const dependsMatch = section.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const depends_on = dependsMatch ? dependsMatch[1].trim() : null;

    // Check completion on disk
    const normalized = normalizePhaseName(phaseNum);
    let diskStatus = 'no_directory';
    let planCount = 0;
    let summaryCount = 0;
    let hasContext = false;
    let hasResearch = false;

    try {
      const dirMatch = _phaseDirNames.find(d => phaseTokenMatches(d, normalized));

      if (dirMatch) {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dirMatch));
        planCount = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
        summaryCount = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;
        hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
        hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

        if (summaryCount >= planCount && planCount > 0) diskStatus = 'complete';
        else if (summaryCount > 0) diskStatus = 'partial';
        else if (planCount > 0) diskStatus = 'planned';
        else if (hasResearch) diskStatus = 'researched';
        else if (hasContext) diskStatus = 'discussed';
        else diskStatus = 'empty';
      }
    } catch { /* intentionally empty */ }

    // Check ROADMAP checkbox status
    const checkboxPattern = new RegExp(`-\\s*\\[(x| )\\]\\s*.*Phase\\s+${escapeRegex(phaseNum)}[:\\s]`, 'i');
    const checkboxMatch = content.match(checkboxPattern);
    const roadmapComplete = checkboxMatch ? checkboxMatch[1] === 'x' : false;

    // If roadmap marks phase complete, trust that over disk file structure.
    // Phases completed before GSD tracking (or via external tools) may lack
    // the standard PLAN/SUMMARY pairs but are still done.
    if (roadmapComplete && diskStatus !== 'complete') {
      diskStatus = 'complete';
    }

    phases.push({
      number: phaseNum,
      name: phaseName,
      goal,
      depends_on,
      plan_count: planCount,
      summary_count: summaryCount,
      has_context: hasContext,
      has_research: hasResearch,
      disk_status: diskStatus,
      roadmap_complete: roadmapComplete,
    });
  }

  // Extract milestone info
  const milestones = [];
  const milestonePattern = /##\s*(.*v(\d+(?:\.\d+)+)[^(\n]*)/gi;
  let mMatch;
  while ((mMatch = milestonePattern.exec(content)) !== null) {
    milestones.push({
      heading: mMatch[1].trim(),
      version: 'v' + mMatch[2],
    });
  }

  // Find current and next phase
  const currentPhase = phases.find(p => p.disk_status === 'planned' || p.disk_status === 'partial') || null;
  const nextPhase = phases.find(p => p.disk_status === 'empty' || p.disk_status === 'no_directory' || p.disk_status === 'discussed' || p.disk_status === 'researched') || null;

  // Aggregated stats
  const totalPlans = phases.reduce((sum, p) => sum + p.plan_count, 0);
  const totalSummaries = phases.reduce((sum, p) => sum + p.summary_count, 0);
  const completedPhases = phases.filter(p => p.disk_status === 'complete').length;

  // Detect phases in summary list without detail sections (malformed ROADMAP)
  const checklistPattern = /-\s*\[[ x]\]\s*\*\*Phase\s+(\d+[A-Z]?(?:\.\d+)*)/gi;
  const checklistPhases = new Set();
  let checklistMatch;
  while ((checklistMatch = checklistPattern.exec(content)) !== null) {
    checklistPhases.add(checklistMatch[1]);
  }
  const detailPhases = new Set(phases.map(p => p.number));
  const missingDetails = [...checklistPhases].filter(p => !detailPhases.has(p));

  const result = {
    milestones,
    phases,
    phase_count: phases.length,
    completed_phases: completedPhases,
    total_plans: totalPlans,
    total_summaries: totalSummaries,
    progress_percent: totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0,
    current_phase: currentPhase ? currentPhase.number : null,
    next_phase: nextPhase ? nextPhase.number : null,
    missing_phase_details: missingDetails.length > 0 ? missingDetails : null,
  };

  output(result, raw);
}

function cmdRoadmapUpdatePlanProgress(cwd, phaseNum, raw) {
  if (!phaseNum) {
    error('phase number required for roadmap update-plan-progress');
  }

  const roadmapPath = planningPaths(cwd).roadmap;

  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) {
    error(`Phase ${phaseNum} not found`);
  }

  const planCount = phaseInfo.plans.length;
  const summaryCount = phaseInfo.summaries.length;

  if (planCount === 0) {
    output({ updated: false, reason: 'No plans found', plan_count: 0, summary_count: 0 }, raw, 'no plans');
    return;
  }

  const isComplete = summaryCount >= planCount;
  const status = isComplete ? 'Complete' : summaryCount > 0 ? 'In Progress' : 'Planned';
  const today = new Date().toISOString().split('T')[0];

  if (!fs.existsSync(roadmapPath)) {
    output({ updated: false, reason: 'ROADMAP.md not found', plan_count: planCount, summary_count: summaryCount }, raw, 'no roadmap');
    return;
  }

  // Wrap entire read-modify-write in lock to prevent concurrent corruption
  withPlanningLock(cwd, () => {
    let roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    const phaseEscaped = escapeRegex(phaseNum);

    // Progress table row: update Plans/Status/Date columns (handles 4 or 5 column tables)
    const tableRowPattern = new RegExp(
      `^(\\|\\s*${phaseEscaped}\\.?\\s[^|]*(?:\\|[^\\n]*))$`,
      'im'
    );
    const dateField = isComplete ? ` ${today} ` : '  ';
    roadmapContent = roadmapContent.replace(tableRowPattern, (fullRow) => {
      const cells = fullRow.split('|').slice(1, -1); // drop leading/trailing empty from split
      if (cells.length === 5) {
        // 5-col: Phase | Milestone | Plans | Status | Completed
        cells[2] = ` ${summaryCount}/${planCount} `;
        cells[3] = ` ${status.padEnd(11)}`;
        cells[4] = dateField;
      } else if (cells.length === 4) {
        // 4-col: Phase | Plans | Status | Completed
        cells[1] = ` ${summaryCount}/${planCount} `;
        cells[2] = ` ${status.padEnd(11)}`;
        cells[3] = dateField;
      }
      return '|' + cells.join('|') + '|';
    });

    // Update plan count in phase detail section
    const planCountPattern = new RegExp(
      `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:\\*\\*\\s*)[^\\n]+`,
      'i'
    );
    const planCountText = isComplete
      ? `${summaryCount}/${planCount} plans complete`
      : `${summaryCount}/${planCount} plans executed`;
    roadmapContent = replaceInCurrentMilestone(roadmapContent, planCountPattern, `$1${planCountText}`);

    // If complete: check checkbox
    if (isComplete) {
      const checkboxPattern = new RegExp(
        `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseEscaped}[:\\s][^\\n]*)`,
        'i'
      );
      roadmapContent = replaceInCurrentMilestone(roadmapContent, checkboxPattern, `$1x$2 (completed ${today})`);
    }

    // Mark completed plan checkboxes (e.g. "- [ ] 50-01-PLAN.md", "- [ ] 50-01:", or "- [ ] **50-01**")
    for (const summaryFile of phaseInfo.summaries) {
      const planId = summaryFile.replace('-SUMMARY.md', '').replace('SUMMARY.md', '');
      if (!planId) continue;
      const planEscaped = escapeRegex(planId);
      const planCheckboxPattern = new RegExp(
        `(-\\s*\\[) (\\]\\s*(?:\\*\\*)?${planEscaped}(?:\\*\\*)?)`,
        'i'
      );
      roadmapContent = roadmapContent.replace(planCheckboxPattern, '$1x$2');
    }

    atomicWriteFileSync(roadmapPath, roadmapContent, 'utf-8');
  });
  output({
    updated: true,
    phase: phaseNum,
    plan_count: planCount,
    summary_count: summaryCount,
    status,
    complete: isComplete,
  }, raw, `${summaryCount}/${planCount} ${status}`);
}

/**
 * Annotate the ROADMAP.md plan list for a phase with wave dependency notes
 * and a cross-cutting constraints subsection derived from PLAN frontmatter.
 *
 * Wave dependency notes: "Wave 2 — blocked on Wave 1 completion" inserted as
 * bold headers before each wave group in the plan checklist.
 *
 * Cross-cutting constraints: must_haves.truths strings that appear in 2+ plans
 * are surfaced in a "Cross-cutting constraints" subsection below the plan list.
 *
 * The operation is idempotent: if wave headers already exist in the section
 * the function returns without modifying the file.
 */
function cmdRoadmapAnnotateDependencies(cwd, phaseNum, raw) {
  if (!phaseNum) {
    error('phase number required for roadmap annotate-dependencies');
  }

  const roadmapPath = planningPaths(cwd).roadmap;
  if (!fs.existsSync(roadmapPath)) {
    output({ updated: false, reason: 'ROADMAP.md not found' }, raw, 'no roadmap');
    return;
  }

  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo || phaseInfo.plans.length === 0) {
    output({ updated: false, reason: 'no plans found for phase', phase: phaseNum }, raw, 'no plans');
    return;
  }

  const { extractFrontmatter, parseMustHavesBlock } = require('./frontmatter.cjs');

  // Read each PLAN.md and extract wave + must_haves.truths
  const planData = [];
  for (const planFile of phaseInfo.plans) {
    const planPath = path.join(path.resolve(cwd, phaseInfo.directory), planFile);
    try {
      const content = fs.readFileSync(planPath, 'utf-8');
      const fm = extractFrontmatter(content);
      const wave = parseInt(fm.wave, 10) || 1;
      const planId = planFile.replace(/-PLAN\.md$/i, '').replace(/PLAN\.md$/i, '');
      const truths = parseMustHavesBlock(content, 'truths') || [];
      planData.push({ planFile, planId, wave, truths });
    } catch { /* skip unreadable plans */ }
  }

  if (planData.length === 0) {
    output({ updated: false, reason: 'could not read plan frontmatter' }, raw, 'no frontmatter');
    return;
  }

  // Group plans by wave (sorted)
  const waveGroups = new Map();
  for (const p of planData) {
    if (!waveGroups.has(p.wave)) waveGroups.set(p.wave, []);
    waveGroups.get(p.wave).push(p);
  }
  const waves = [...waveGroups.keys()].sort((a, b) => a - b);

  // Find cross-cutting truths: appear in 2+ plans (de-duplicated, case-insensitive).
  //
  // Issue #2770: must **coerce, not skip**. A previous guard
  // `if (typeof t !== 'string') continue` silently dropped numeric scalars
  // (YAML ints like `- 3`) and kv-shaped truths (`- title: X`), so the
  // cross-cutting analysis lost real constraints rather than crashing on
  // `t.trim()`. We coerce primitives via `String(t)` and extract a sensible
  // string field from object-shaped items produced by parseMustHavesBlock's
  // continuation-kv path (issue #2757 produces those shapes for nested keys).
  const truthCounts = new Map();
  for (const { truths } of planData) {
    const seen = new Set();
    for (const t of truths) {
      const text = coerceTruthToString(t);
      if (!text) continue;
      const trimmed = text.trim();
      const key = trimmed.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (!truthCounts.has(key)) truthCounts.set(key, { count: 0, text: trimmed });
      truthCounts.get(key).count++;
    }
  }
  const crossCuttingTruths = [...truthCounts.values()]
    .filter(v => v.count >= 2)
    .map(v => v.text);

  // Patch ROADMAP.md
  let updated = false;
  withPlanningLock(cwd, () => {
    let content = fs.readFileSync(roadmapPath, 'utf-8');

    // Find the phase section
    const phaseEscaped = escapeRegex(phaseNum);
    const phaseHeaderPattern = new RegExp(`(#{2,4}\\s*Phase\\s+${phaseEscaped}:[^\\n]*)`, 'i');
    const phaseMatch = content.match(phaseHeaderPattern);
    if (!phaseMatch) return;

    const phaseStart = phaseMatch.index;
    const restAfterHeader = content.slice(phaseStart);
    const nextPhaseOffset = restAfterHeader.slice(1).search(/\n#{2,4}\s+Phase\s+\d/i);
    const phaseEnd = nextPhaseOffset >= 0 ? phaseStart + 1 + nextPhaseOffset : content.length;
    const phaseSection = content.slice(phaseStart, phaseEnd);

    // Idempotency: skip if annotation markers already present
    if (
      /\*\*Wave\s+\d+/i.test(phaseSection) ||
      /\*\*Cross-cutting constraints:\*\*/i.test(phaseSection)
    ) return;

    // Find the Plans: section within the phase section
    const plansBlockMatch = phaseSection.match(/(Plans:\s*\n)((?:\s*-\s*\[[ x]\][^\n]*\n?)*)/i);
    if (!plansBlockMatch) return;

    const plansHeader = plansBlockMatch[1];
    const existingList = plansBlockMatch[2];
    const listLines = existingList.split('\n').filter(l => /^\s*-\s*\[/.test(l));

    if (listLines.length === 0) return;

    // Build wave-annotated plan list
    const linesByWave = new Map();
    for (const line of listLines) {
      // Match plan ID from line: "- [ ] 01-01-PLAN.md — ..." or "- [ ] 01-01: ..."
      const idMatch = line.match(/\[\s*[x ]\s*\]\s*([\w-]+?)(?:-PLAN\.md|\.md|:|\s—)/i);
      const planId = idMatch ? idMatch[1] : null;
      const planEntry = planId ? planData.find(p => p.planId === planId) : null;
      const wave = planEntry ? planEntry.wave : 1;
      if (!linesByWave.has(wave)) linesByWave.set(wave, []);
      linesByWave.get(wave).push(line);
    }

    const annotatedLines = [];
    const sortedWaves = [...linesByWave.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sortedWaves.length; i++) {
      const w = sortedWaves[i];
      const waveLines = linesByWave.get(w);
      if (sortedWaves.length > 1) {
        const dep = i > 0 ? ` *(blocked on Wave ${sortedWaves[i - 1]} completion)*` : '';
        annotatedLines.push(`**Wave ${w}**${dep}`);
      }
      annotatedLines.push(...waveLines);
      if (i < sortedWaves.length - 1) annotatedLines.push('');
    }

    // Append cross-cutting constraints subsection if any found
    if (crossCuttingTruths.length > 0) {
      annotatedLines.push('');
      annotatedLines.push('**Cross-cutting constraints:**');
      for (const t of crossCuttingTruths) {
        annotatedLines.push(`- ${t}`);
      }
    }

    const newListBlock = annotatedLines.join('\n') + '\n';
    const newPhaseSection = phaseSection.replace(
      plansBlockMatch[0],
      plansHeader + newListBlock
    );

    const nextContent = content.slice(0, phaseStart) + newPhaseSection + content.slice(phaseEnd);
    if (nextContent === content) return;
    atomicWriteFileSync(roadmapPath, nextContent);
    updated = true;
  });

  output({
    updated,
    phase: phaseNum,
    waves: waves.length,
    cross_cutting_constraints: crossCuttingTruths.length,
  }, raw, updated ? `annotated ${waves.length} wave(s), ${crossCuttingTruths.length} constraint(s)` : 'skipped (already annotated or no plan list)');
}

module.exports = {
  cmdRoadmapGetPhase,
  cmdRoadmapAnalyze,
  cmdRoadmapUpdatePlanProgress,
  cmdRoadmapAnnotateDependencies,
};
