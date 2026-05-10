/**
 * Phase — Phase CRUD, query, and lifecycle operations
 */

const fs = require('fs');
const path = require('path');
const { escapeRegex, loadConfig, normalizePhaseName, comparePhaseNum, findPhaseInternal, getArchivedPhaseDirs, generateSlugInternal, getMilestonePhaseFilter, stripShippedMilestones, extractCurrentMilestone, replaceInCurrentMilestone, toPosixPath, output, error, readSubdirectories, phaseTokenMatches, atomicWriteFileSync } = require('./core.cjs');
const { planningDir, withPlanningLock } = require('./planning-workspace.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');
const { writeStateMd, readModifyWriteStateMd, stateExtractField, stateReplaceField, stateReplaceFieldWithFallback, updatePerformanceMetricsSection } = require('./state.cjs');

// #2893 — strict canonical filter: `{padded_phase}-{NN}-PLAN.md` or `PLAN.md`.
// Documented in agents/gsd-planner.md (write_phase_prompt step). The wider
// "looks like a plan but isn't canonical" probe below is used to surface a
// loud warning instead of silently returning zero plans.
const isCanonicalPlanFile = (f) => f.endsWith('-PLAN.md') || f === 'PLAN.md';

// Any .md file with PLAN anywhere in the basename — the diagnostic net for
// catching agent deviations like `01-PLAN-01-foundation.md` (#2893).
// Excludes derivative files (`-PLAN-OUTLINE.md`, `*.pre-bounce.md`, etc.) that
// the planner legitimately produces alongside canonical plans.
const PLAN_OUTLINE_RE = /-PLAN-OUTLINE\.md$/i;
const PLAN_PRE_BOUNCE_RE = /-PLAN.*\.pre-bounce\.md$/i;
const looksLikePlanFile = (f) =>
  /\.md$/i.test(f)
  && /PLAN/i.test(f)
  && !PLAN_OUTLINE_RE.test(f)
  && !PLAN_PRE_BOUNCE_RE.test(f);

/**
 * Detect plan-shaped files that the canonical filter would reject. Returns
 * a warning string when offenders exist, else null. Centralised so every
 * read site (phase-plan-index, phases list --type plans, find-phase) emits
 * the same message.
 *
 * @param {string[]} dirFiles — readdirSync output for one phase directory
 * @param {string[]} matchedFiles — what the canonical filter accepted
 * @returns {string|null}
 */
function describeNonCanonicalPlans(dirFiles, matchedFiles) {
  const matched = new Set(matchedFiles);
  const offenders = dirFiles.filter((f) => looksLikePlanFile(f) && !matched.has(f));
  if (offenders.length === 0) return null;
  return (
    `Found ${offenders.length} plan-shaped file(s) in this phase that don't match the canonical ` +
    `naming convention "{padded_phase}-{NN}-PLAN.md" (or bare "PLAN.md") and were skipped: ` +
    offenders.map((f) => `"${f}"`).join(', ') +
    `. Rename to the canonical form (e.g. "01-01-PLAN.md") so the executor can detect them. ` +
    `See agents/gsd-planner.md write_phase_prompt step for the full contract.`
  );
}

function extractCanonicalPlanId(filename) {
  const base = filename.replace(/-PLAN\.md$/i, '').replace(/-SUMMARY\.md$/i, '').replace(/\.md$/i, '');
  const parts = base.split('-').filter(Boolean);
  const tokenRe = /^\d+[A-Z]?(?:\.\d+)*$/i;
  const phaseIdx = parts.findIndex(p => tokenRe.test(p));
  if (phaseIdx >= 0 && phaseIdx + 1 < parts.length && tokenRe.test(parts[phaseIdx + 1])) {
    return `${parts[phaseIdx]}-${parts[phaseIdx + 1]}`;
  }
  return base;
}

function cmdPhasesList(cwd, options, raw) {
  const phasesDir = path.join(planningDir(cwd), 'phases');
  const { type, phase, includeArchived } = options;

  // If no phases directory, return empty
  if (!fs.existsSync(phasesDir)) {
    if (type) {
      output({ files: [], count: 0 }, raw, '');
    } else {
      output({ directories: [], count: 0 }, raw, '');
    }
    return;
  }

  try {
    // Get all phase directories
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    let dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    // Include archived phases if requested
    if (includeArchived) {
      const archived = getArchivedPhaseDirs(cwd);
      for (const a of archived) {
        dirs.push(`${a.name} [${a.milestone}]`);
      }
    }

    // Sort numerically (handles integers, decimals, letter-suffix, hybrids)
    dirs.sort((a, b) => comparePhaseNum(a, b));

    // If filtering by phase number
    if (phase) {
      const normalized = normalizePhaseName(phase);
      const match = dirs.find(d => phaseTokenMatches(d, normalized));
      if (!match) {
        output({ files: [], count: 0, phase_dir: null, error: 'Phase not found' }, raw, '');
        return;
      }
      dirs = [match];
    }

    // If listing files of a specific type
    if (type) {
      const files = [];
      const warnings = [];
      for (const dir of dirs) {
        const dirPath = path.join(phasesDir, dir);
        const dirFiles = fs.readdirSync(dirPath);

        let filtered;
        if (type === 'plans') {
          filtered = dirFiles.filter(isCanonicalPlanFile);
          // #2893 — surface plan-shaped files the canonical filter rejected
          // so callers (executor init, etc.) don't silently see zero plans.
          const w = describeNonCanonicalPlans(dirFiles, filtered);
          if (w) warnings.push(`${dir}: ${w}`);
        } else if (type === 'summaries') {
          filtered = dirFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        } else {
          filtered = dirFiles;
        }

        files.push(...filtered.sort());
      }

      const result = {
        files,
        count: files.length,
        phase_dir: phase ? dirs[0].replace(/^\d+(?:\.\d+)*-?/, '') : null,
      };
      if (warnings.length) result.warning = warnings.join(' | ');
      output(result, raw, files.join('\n'));
      return;
    }

    // Default: list directories
    output({ directories: dirs, count: dirs.length }, raw, dirs.join('\n'));
  } catch (e) {
    error('Failed to list phases: ' + e.message);
  }
}

function cmdPhaseNextDecimal(cwd, basePhase, raw) {
  const phasesDir = path.join(planningDir(cwd), 'phases');
  const normalized = normalizePhaseName(basePhase);

  try {
    let baseExists = false;
    const decimalSet = new Set();

    // Scan directory names for existing decimal phases
    if (fs.existsSync(phasesDir)) {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      baseExists = dirs.some(d => phaseTokenMatches(d, normalized));

      const dirPattern = new RegExp(`^(?:[A-Z]{1,6}-)?${escapeRegex(normalized)}\\.(\\d+)`);
      for (const dir of dirs) {
        const match = dir.match(dirPattern);
        if (match) decimalSet.add(parseInt(match[1], 10));
      }
    }

    // Also scan ROADMAP.md for phase entries that may not have directories yet
    const roadmapPath = path.join(planningDir(cwd), 'ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      try {
        const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
        const phasePattern = new RegExp(
          `#{2,4}\\s*Phase\\s+0*${escapeRegex(normalized)}\\.(\\d+)\\s*:`, 'gi'
        );
        let pm;
        while ((pm = phasePattern.exec(roadmapContent)) !== null) {
          decimalSet.add(parseInt(pm[1], 10));
        }
      } catch { /* ROADMAP.md read failure is non-fatal */ }
    }

    // Build sorted list of existing decimals
    const existingDecimals = Array.from(decimalSet)
      .sort((a, b) => a - b)
      .map(n => `${normalized}.${n}`);

    // Calculate next decimal
    let nextDecimal;
    if (decimalSet.size === 0) {
      nextDecimal = `${normalized}.1`;
    } else {
      nextDecimal = `${normalized}.${Math.max(...decimalSet) + 1}`;
    }

    output(
      {
        found: baseExists,
        base_phase: normalized,
        next: nextDecimal,
        existing: existingDecimals,
      },
      raw,
      nextDecimal
    );
  } catch (e) {
    error('Failed to calculate next decimal phase: ' + e.message);
  }
}

function cmdFindPhase(cwd, phase, raw) {
  if (!phase) {
    error('phase identifier required');
  }

  const planBase = planningDir(cwd);
  const normalized = normalizePhaseName(phase);
  const notFound = { found: false, directory: null, phase_number: null, phase_name: null, plans: [], summaries: [], searched_directories: [] };

  // Build candidate search dirs: flat layout first, then milestone-archive layout.
  const searchDirs = [];
  const flatPhasesDir = path.join(planBase, 'phases');
  if (fs.existsSync(flatPhasesDir)) searchDirs.push(flatPhasesDir);
  try {
    const milestonesDir = path.join(planBase, 'milestones');
    const entries = fs.readdirSync(milestonesDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^v\d+.*-phases$/.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const e of entries) {
      searchDirs.push(path.join(milestonesDir, e.name));
    }
  } catch { /* no milestones dir */ }

  notFound.searched_directories = searchDirs.map((searchDir) =>
    toPosixPath(path.join(path.relative(cwd, planBase), path.relative(planBase, searchDir))));

  for (const searchDir of searchDirs) {
    try {
      const entries = fs.readdirSync(searchDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => comparePhaseNum(a, b));

      const match = dirs.find(d => phaseTokenMatches(d, normalized));
      if (!match) continue;

      // Extract phase number — supports project-code-prefixed (CK-01-name), numeric (01-name), and custom IDs
      const dirMatch = match.match(/^(?:[A-Z]{1,6}-)(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i)
        || match.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
      const phaseNumber = dirMatch ? dirMatch[1] : normalized;
      const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;

      const phaseDir = path.join(searchDir, match);
      const phaseFiles = fs.readdirSync(phaseDir);
      const plans = phaseFiles.filter(isCanonicalPlanFile).sort();
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').sort();
      // #2893 — same diagnostic as phase-plan-index for consistency.
      const planNamingWarning = describeNonCanonicalPlans(phaseFiles, plans);

      const result = {
        found: true,
        directory: toPosixPath(path.join(path.relative(cwd, planBase), path.relative(planBase, searchDir), match)),
        phase_number: phaseNumber,
        phase_name: phaseName,
        plans,
        summaries,
      };
      if (planNamingWarning) result.warning = planNamingWarning;

      output(result, raw, result.directory);
      return;
    } catch { continue; }
  }

  output(notFound, raw, '');
}

function extractObjective(content) {
  const m = content.match(/<objective>\s*\n?\s*(.+)/);
  return m ? m[1].trim() : null;
}

function cmdPhasePlanIndex(cwd, phase, raw) {
  if (!phase) {
    error('phase required for phase-plan-index');
  }

  const phasesDir = path.join(planningDir(cwd), 'phases');
  const normalized = normalizePhaseName(phase);

  // Find phase directory
  let phaseDir = null;
  let phaseDirName = null;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => comparePhaseNum(a, b));
    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    if (match) {
      phaseDir = path.join(phasesDir, match);
      phaseDirName = match;
    }
  } catch {
    // phases dir doesn't exist
  }

  if (!phaseDir) {
    output({ phase: normalized, error: 'Phase not found', plans: [], waves: {}, incomplete: [], has_checkpoints: false }, raw);
    return;
  }

  // Get all files in phase directory
  const phaseFiles = fs.readdirSync(phaseDir);
  const planFiles = phaseFiles.filter(isCanonicalPlanFile).sort();
  const summaryFiles = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
  // #2893 — surface plan-shaped files the canonical filter rejected so a
  // misnamed plan never silently produces plan_count: 0 at executor init.
  const planNamingWarning = describeNonCanonicalPlans(phaseFiles, planFiles);

  // Build set of plan IDs with summaries
  const completedPlanIds = new Set(
    summaryFiles.flatMap(s => {
      const exact = s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '');
      const canonical = extractCanonicalPlanId(s);
      return canonical === exact ? [exact] : [exact, canonical];
    })
  );

  // ── Pass 1: parse each plan file ─────────────────────────────────────────

  const rawPlans = [];

  for (const planFile of planFiles) {
    const planId = planFile.replace('-PLAN.md', '').replace('PLAN.md', '');
    const planPath = path.join(phaseDir, planFile);
    const content = fs.readFileSync(planPath, 'utf-8');
    const fm = extractFrontmatter(content);

    // Count tasks: XML <task> tags (canonical) or ## Task N markdown (legacy)
    const xmlTasks = content.match(/<task[\s>]/gi) || [];
    const mdTasks = content.match(/##\s*Task\s*\d+/gi) || [];
    const taskCount = xmlTasks.length || mdTasks.length;

    // Parse wave as integer — use nullish handling so wave: 0 is preserved.
    // parseInt returns NaN for missing/non-numeric values; fall back to null
    // (meaning "no declared wave") so downstream can apply the topo default.
    const parsedWave = parseInt(fm.wave, 10);
    const declaredWave = Number.isNaN(parsedWave) ? null : parsedWave;

    // Parse depends_on — normalise to string[]
    let dependsOn = [];
    const fmDeps = fm['depends_on'];
    if (Array.isArray(fmDeps)) {
      dependsOn = fmDeps.map(String);
    } else if (typeof fmDeps === 'string' && fmDeps.trim() !== '') {
      dependsOn = [fmDeps];
    }

    // Parse autonomous (default true if not specified)
    let autonomous = true;
    if (fm.autonomous !== undefined) {
      autonomous = fm.autonomous === 'true' || fm.autonomous === true;
    }

    // Parse files_modified (underscore is canonical; also accept hyphenated for compat)
    let filesModified = [];
    const fmFiles = fm['files_modified'] || fm['files-modified'];
    if (fmFiles) {
      filesModified = Array.isArray(fmFiles) ? fmFiles : [fmFiles];
    }

    const hasSummary = completedPlanIds.has(planId) || completedPlanIds.has(extractCanonicalPlanId(planFile));

    rawPlans.push({
      id: planId,
      declaredWave,
      dependsOn,
      autonomous,
      objective: extractObjective(content) || fm.objective || null,
      filesModified,
      taskCount,
      hasSummary,
    });
  }

  // ── Pass 2: topological level assignment via depends_on DAG ──────────────

  // Build a map from plan ID → raw plan for fast lookup.
  // Deps that reference plans outside this phase are treated as external and ignored.
  const planMap = new Map(rawPlans.map(p => [p.id, p]));
  // Secondary index: canonical prefix → full plan ID, so depends_on: ['03-01'] resolves
  // to '03-01-auth-hardening-PLAN.md'-derived ID '03-01-auth-hardening' (k015).
  const canonicalToId = new Map(rawPlans.map(p => [extractCanonicalPlanId(p.id), p.id]));

  // Kahn's algorithm — compute in-degree and adjacency for in-phase deps only.
  const level = new Map();
  const inDeg = new Map();
  const adj = new Map();

  for (const p of rawPlans) {
    if (!inDeg.has(p.id)) inDeg.set(p.id, 0);
    if (!adj.has(p.id)) adj.set(p.id, []);
    for (const dep of p.dependsOn) {
      // Accept both full-stem ('03-01-auth-hardening') and canonical-prefix ('03-01') forms.
      const resolvedDep = planMap.has(dep) ? dep : canonicalToId.get(dep);
      if (!resolvedDep) continue; // external dep — ignore
      if (!adj.has(resolvedDep)) adj.set(resolvedDep, []);
      adj.get(resolvedDep).push(p.id);
      inDeg.set(p.id, (inDeg.get(p.id) ?? 0) + 1);
    }
  }

  // Start with nodes that have no in-phase dependencies.
  const queue = [];
  for (const p of rawPlans) {
    if ((inDeg.get(p.id) ?? 0) === 0) {
      queue.push(p.id);
      level.set(p.id, 0);
    }
  }

  let visited = 0;
  while (queue.length > 0) {
    const cur = queue.shift();
    visited++;
    const curLevel = level.get(cur);
    for (const dep of (adj.get(cur) ?? [])) {
      const newLevel = curLevel + 1;
      if (newLevel > (level.get(dep) ?? -1)) {
        level.set(dep, newLevel);
      }
      inDeg.set(dep, inDeg.get(dep) - 1);
      if (inDeg.get(dep) === 0) {
        queue.push(dep);
      }
    }
  }

  // Cycle detection — any node not visited has a cycle.
  if (visited < rawPlans.length) {
    const cycleNodes = rawPlans.filter(p => !level.has(p.id)).map(p => p.id);
    error(`depends_on cycle detected in phase ${normalized} — cycle involves: ${cycleNodes.join(', ')}`);
    return;
  }

  // ── Pass 3: determine lowest bucket key and build output ─────────────────

  // If any plan has declared wave: 0, the lowest level maps to "0"; otherwise "1".
  const anyWaveZero = rawPlans.some(p => p.declaredWave === 0);
  const levelOffset = anyWaveZero ? 0 : 1;

  const plans = [];
  const waves = {};
  const incomplete = [];
  let hasCheckpoints = false;
  const warnings = [];

  for (const raw of rawPlans) {
    if (!raw.autonomous) {
      hasCheckpoints = true;
    }
    if (!raw.hasSummary) {
      incomplete.push(raw.id);
    }

    // Computed wave = topological level + offset (so lowest level → 0 or 1).
    const computedWave = (level.get(raw.id) ?? 0) + levelOffset;

    // The effective wave used for bucketing is always the computed topo level.
    // If the plan declared a wave that disagrees, emit a non-fatal warning.
    const effectiveWave = computedWave;
    if (raw.declaredWave !== null && raw.declaredWave !== computedWave) {
      warnings.push(
        `Plan ${raw.id}: declared wave: ${raw.declaredWave} but depends_on DAG places it in wave ${computedWave}`,
      );
    }

    const plan = {
      id: raw.id,
      wave: effectiveWave,
      depends_on: raw.dependsOn,
      autonomous: raw.autonomous,
      objective: raw.objective,
      files_modified: raw.filesModified,
      task_count: raw.taskCount,
      has_summary: raw.hasSummary,
    };

    plans.push(plan);

    const waveKey = String(effectiveWave);
    if (!waves[waveKey]) {
      waves[waveKey] = [];
    }
    waves[waveKey].push(raw.id);
  }

  const result = {
    phase: normalized,
    plans,
    waves,
    incomplete,
    has_checkpoints: hasCheckpoints,
  };
  if (planNamingWarning) result.warning = planNamingWarning;
  if (warnings.length > 0) result.warnings = warnings;

  output(result, raw);
}

function cmdPhaseAdd(cwd, description, raw, customId) {
  if (!description) {
    error('description required for phase add');
  }

  const config = loadConfig(cwd);
  const roadmapPath = path.join(planningDir(cwd), 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found');
  }

  const slug = generateSlugInternal(description);

  // Wrap entire read-modify-write in lock to prevent concurrent corruption
  const { newPhaseId, dirName } = withPlanningLock(cwd, () => {
    const rawContent = fs.readFileSync(roadmapPath, 'utf-8');
    const content = extractCurrentMilestone(rawContent, cwd);

    // Optional project code prefix (e.g., 'CK' → 'CK-01-foundation')
    const projectCode = config.project_code || '';
    const prefix = projectCode ? `${projectCode}-` : '';

    let _newPhaseId;
    let _dirName;

    if (customId || config.phase_naming === 'custom') {
      // Custom phase naming: use provided ID or generate from description
      _newPhaseId = customId || slug.toUpperCase().replace(/-/g, '-');
      if (!_newPhaseId) error('--id required when phase_naming is "custom"');
      _dirName = `${prefix}${_newPhaseId}-${slug}`;
    } else {
      // Sequential mode: find highest integer phase number from two sources:
      // 1. ROADMAP.md (current milestone only)
      // 2. .planning/phases/ on disk (orphan directories not tracked in roadmap)
      // Skip 999.x backlog phases — they live outside the active sequence
      const phasePattern = /#{2,4}\s*Phase\s+(\d+)[A-Z]?(?:\.\d+)*:/gi;
      let maxPhase = 0;
      let m;
      while ((m = phasePattern.exec(content)) !== null) {
        const num = parseInt(m[1], 10);
        if (num >= 999) continue; // backlog phases use 999.x numbering
        if (num > maxPhase) maxPhase = num;
      }

      // Also scan .planning/phases/ for orphan directories not tracked in ROADMAP.
      // Directory names follow: [PREFIX-]NN-slug (e.g. 03-api or CK-05-old-feature).
      // Strip the optional project_code prefix before extracting the leading integer.
      const phasesOnDisk = path.join(planningDir(cwd), 'phases');
      if (fs.existsSync(phasesOnDisk)) {
        const dirNumPattern = /^(?:[A-Z][A-Z0-9]*-)?(\d+)-/;
        for (const entry of fs.readdirSync(phasesOnDisk)) {
          const match = entry.match(dirNumPattern);
          if (!match) continue;
          const num = parseInt(match[1], 10);
          if (num >= 999) continue; // skip backlog orphans
          if (num > maxPhase) maxPhase = num;
        }
      }

      _newPhaseId = maxPhase + 1;
      const paddedNum = String(_newPhaseId).padStart(2, '0');
      _dirName = `${prefix}${paddedNum}-${slug}`;
    }

    const dirPath = path.join(planningDir(cwd), 'phases', _dirName);

    // Create directory with .gitkeep so git tracks empty folders
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');

    // Build phase entry
    const dependsOn = config.phase_naming === 'custom' ? '' : `\n**Depends on:** Phase ${typeof _newPhaseId === 'number' ? _newPhaseId - 1 : 'TBD'}`;
    const phaseEntry = `\n### Phase ${_newPhaseId}: ${description}\n\n**Goal:** [To be planned]\n**Requirements**: TBD${dependsOn}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${_newPhaseId} to break down)\n`;

    // Find insertion point: before last "---" or at end
    let updatedContent;
    const lastSeparator = rawContent.lastIndexOf('\n---');
    if (lastSeparator > 0) {
      updatedContent = rawContent.slice(0, lastSeparator) + phaseEntry + rawContent.slice(lastSeparator);
    } else {
      updatedContent = rawContent + phaseEntry;
    }

    atomicWriteFileSync(roadmapPath, updatedContent);
    return { newPhaseId: _newPhaseId, dirName: _dirName };
  });

  const result = {
    phase_number: typeof newPhaseId === 'number' ? newPhaseId : String(newPhaseId),
    padded: typeof newPhaseId === 'number' ? String(newPhaseId).padStart(2, '0') : String(newPhaseId),
    name: description,
    slug,
    directory: toPosixPath(path.join(path.relative(cwd, planningDir(cwd)), 'phases', dirName)),
    naming_mode: config.phase_naming,
  };

  output(result, raw, result.padded);
}

function cmdPhaseAddBatch(cwd, descriptions, raw) {
  if (!Array.isArray(descriptions) || descriptions.length === 0) {
    error('descriptions array required for phase add-batch');
  }
  const config = loadConfig(cwd);
  const roadmapPath = path.join(planningDir(cwd), 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) { error('ROADMAP.md not found'); }
  const projectCode = config.project_code || '';
  const prefix = projectCode ? `${projectCode}-` : '';

  const results = withPlanningLock(cwd, () => {
    let rawContent = fs.readFileSync(roadmapPath, 'utf-8');
    const content = extractCurrentMilestone(rawContent, cwd);
    let maxPhase = 0;
    if (config.phase_naming !== 'custom') {
      const phasePattern = /#{2,4}\s*Phase\s+(\d+)[A-Z]?(?:\.\d+)*:/gi;
      let m;
      while ((m = phasePattern.exec(content)) !== null) {
        const num = parseInt(m[1], 10);
        if (num >= 999) continue;
        if (num > maxPhase) maxPhase = num;
      }
      const phasesOnDisk = path.join(planningDir(cwd), 'phases');
      if (fs.existsSync(phasesOnDisk)) {
        const dirNumPattern = /^(?:[A-Z][A-Z0-9]*-)?(\d+)-/;
        for (const entry of fs.readdirSync(phasesOnDisk)) {
          const match = entry.match(dirNumPattern);
          if (!match) continue;
          const num = parseInt(match[1], 10);
          if (num >= 999) continue;
          if (num > maxPhase) maxPhase = num;
        }
      }
    }
    const added = [];
    for (const description of descriptions) {
      const slug = generateSlugInternal(description);
      let newPhaseId, dirName;
      if (config.phase_naming === 'custom') {
        newPhaseId = slug.toUpperCase().replace(/-/g, '-');
        dirName = `${prefix}${newPhaseId}-${slug}`;
      } else {
        maxPhase += 1;
        newPhaseId = maxPhase;
        dirName = `${prefix}${String(newPhaseId).padStart(2, '0')}-${slug}`;
      }
      const dirPath = path.join(planningDir(cwd), 'phases', dirName);
      fs.mkdirSync(dirPath, { recursive: true });
      fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');
      const dependsOn = config.phase_naming === 'custom' ? '' : `\n**Depends on:** Phase ${typeof newPhaseId === 'number' ? newPhaseId - 1 : 'TBD'}`;
      const phaseEntry = `\n### Phase ${newPhaseId}: ${description}\n\n**Goal:** [To be planned]\n**Requirements**: TBD${dependsOn}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${newPhaseId} to break down)\n`;
      const lastSeparator = rawContent.lastIndexOf('\n---');
      rawContent = lastSeparator > 0
        ? rawContent.slice(0, lastSeparator) + phaseEntry + rawContent.slice(lastSeparator)
        : rawContent + phaseEntry;
      added.push({
        phase_number: typeof newPhaseId === 'number' ? newPhaseId : String(newPhaseId),
        padded: typeof newPhaseId === 'number' ? String(newPhaseId).padStart(2, '0') : String(newPhaseId),
        name: description,
        slug,
        directory: toPosixPath(path.join(path.relative(cwd, planningDir(cwd)), 'phases', dirName)),
        naming_mode: config.phase_naming,
      });
    }
    atomicWriteFileSync(roadmapPath, rawContent);
    return added;
  });
  output({ phases: results, count: results.length }, raw);
}

function cmdPhaseInsert(cwd, afterPhase, description, raw) {
  if (!afterPhase || !description) {
    error('after-phase and description required for phase insert');
  }

  const roadmapPath = path.join(planningDir(cwd), 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found');
  }

  const slug = generateSlugInternal(description);

  // Wrap entire read-modify-write in lock to prevent concurrent corruption
  const { decimalPhase, dirName } = withPlanningLock(cwd, () => {
    const rawContent = fs.readFileSync(roadmapPath, 'utf-8');
    const content = extractCurrentMilestone(rawContent, cwd);

    // Normalize input then strip leading zeros for flexible matching
    const normalizedAfter = normalizePhaseName(afterPhase);
    const unpadded = normalizedAfter.replace(/^0+/, '');
    const afterPhaseEscaped = unpadded.replace(/\./g, '\\.');
    const targetPattern = new RegExp(`#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:`, 'i');
    if (!targetPattern.test(content)) {
      const checklistPattern = new RegExp(`-\\s*\\[[ x]\\]\\s*\\*\\*Phase\\s+0*${afterPhaseEscaped}:`, 'i');
      if (checklistPattern.test(content)) {
        error(`Phase ${afterPhase} exists in roadmap summary but is missing a detail section (### Phase ${afterPhase}: ...).`);
      }
      error(`Phase ${afterPhase} not found in ROADMAP.md`);
    }

    // Calculate next decimal by scanning both directories AND ROADMAP.md entries
    const phasesDir = path.join(planningDir(cwd), 'phases');
    const normalizedBase = normalizePhaseName(afterPhase);
    const decimalSet = new Set();

    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const decimalPattern = new RegExp(`^(?:[A-Z]{1,6}-)?${escapeRegex(normalizedBase)}\\.(\\d+)`);
      for (const dir of dirs) {
        const dm = dir.match(decimalPattern);
        if (dm) decimalSet.add(parseInt(dm[1], 10));
      }
    } catch { /* intentionally empty */ }

    // Also scan ROADMAP.md content (already loaded) for decimal entries
    const rmPhasePattern = new RegExp(
      `#{2,4}\\s*Phase\\s+0*${escapeRegex(normalizedBase)}\\.(\\d+)\\s*:`, 'gi'
    );
    let rmMatch;
    while ((rmMatch = rmPhasePattern.exec(rawContent)) !== null) {
      decimalSet.add(parseInt(rmMatch[1], 10));
    }

    const nextDecimal = decimalSet.size === 0 ? 1 : Math.max(...decimalSet) + 1;
    const _decimalPhase = `${normalizedBase}.${nextDecimal}`;
    // Optional project code prefix
    const insertConfig = loadConfig(cwd);
    const projectCode = insertConfig.project_code || '';
    const pfx = projectCode ? `${projectCode}-` : '';
    const _dirName = `${pfx}${_decimalPhase}-${slug}`;
    const dirPath = path.join(planningDir(cwd), 'phases', _dirName);

    // Create directory with .gitkeep so git tracks empty folders
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');

    // Build phase entry
    const phaseEntry = `\n### Phase ${_decimalPhase}: ${description} (INSERTED)\n\n**Goal:** [Urgent work - to be planned]\n**Requirements**: TBD\n**Depends on:** Phase ${afterPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${_decimalPhase} to break down)\n`;

    // Insert after the target phase section
    const headerPattern = new RegExp(`(#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:[^\\n]*\\n)`, 'i');
    const headerMatch = rawContent.match(headerPattern);
    if (!headerMatch) {
      error(`Could not find Phase ${afterPhase} header`);
    }

    const headerIdx = rawContent.indexOf(headerMatch[0]);
    const afterHeader = rawContent.slice(headerIdx + headerMatch[0].length);
    const nextPhaseMatch = afterHeader.match(/\n#{2,4}\s+Phase\s+\d/i);

    let insertIdx;
    if (nextPhaseMatch) {
      insertIdx = headerIdx + headerMatch[0].length + nextPhaseMatch.index;
    } else {
      insertIdx = rawContent.length;
    }

    const updatedContent = rawContent.slice(0, insertIdx) + phaseEntry + rawContent.slice(insertIdx);
    atomicWriteFileSync(roadmapPath, updatedContent);
    return { decimalPhase: _decimalPhase, dirName: _dirName };
  });

  const result = {
    phase_number: decimalPhase,
    after_phase: afterPhase,
    name: description,
    slug,
    directory: toPosixPath(path.join(path.relative(cwd, planningDir(cwd)), 'phases', dirName)),
  };

  output(result, raw, decimalPhase);
}

/**
 * Renumber sibling decimal phases after a decimal phase is removed.
 * e.g. removing 06.2 → 06.3 becomes 06.2, 06.4 becomes 06.3, etc.
 * Returns { renamedDirs, renamedFiles }.
 */
function renameDecimalPhases(phasesDir, baseInt, removedDecimal) {
  const renamedDirs = [], renamedFiles = [];
  // Capture the zero-padded prefix (e.g. "06" from "06.3-slug") so the renamed
  // directory preserves the original padding format.
  const decPattern = new RegExp(`^(0*${baseInt})\\.(\\d+)-(.+)$`);
  const dirs = readSubdirectories(phasesDir, true);
  const toRename = dirs
    .map(dir => { const m = dir.match(decPattern); return m ? { dir, prefix: m[1], oldDecimal: parseInt(m[2], 10), slug: m[3] } : null; })
    .filter(item => item && item.oldDecimal > removedDecimal)
    .sort((a, b) => b.oldDecimal - a.oldDecimal); // descending to avoid conflicts

  for (const item of toRename) {
    const newDecimal = item.oldDecimal - 1;
    const oldPhaseId = `${baseInt}.${item.oldDecimal}`;
    const newPhaseId = `${baseInt}.${newDecimal}`;
    const newDirName = `${item.prefix}.${newDecimal}-${item.slug}`;
    fs.renameSync(path.join(phasesDir, item.dir), path.join(phasesDir, newDirName));
    renamedDirs.push({ from: item.dir, to: newDirName });
    for (const f of fs.readdirSync(path.join(phasesDir, newDirName))) {
      if (f.includes(oldPhaseId)) {
        const newFileName = f.replace(oldPhaseId, newPhaseId);
        fs.renameSync(path.join(phasesDir, newDirName, f), path.join(phasesDir, newDirName, newFileName));
        renamedFiles.push({ from: f, to: newFileName });
      }
    }
  }
  return { renamedDirs, renamedFiles };
}

/**
 * Renumber all integer phases after removedInt.
 * e.g. removing phase 5 → phase 6 becomes 5, phase 7 becomes 6, etc.
 * Returns { renamedDirs, renamedFiles }.
 */
function renameIntegerPhases(phasesDir, removedInt) {
  const renamedDirs = [], renamedFiles = [];
  const dirs = readSubdirectories(phasesDir, true);
  const toRename = dirs
    .map(dir => {
      const m = dir.match(/^(\d+)([A-Z])?(?:\.(\d+))?-(.+)$/i);
      if (!m) return null;
      const dirInt = parseInt(m[1], 10);
      return (dirInt > removedInt && dirInt < 999) ? { dir, oldInt: dirInt, letter: m[2] ? m[2].toUpperCase() : '', decimal: m[3] ? parseInt(m[3], 10) : null, slug: m[4] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.oldInt !== b.oldInt ? b.oldInt - a.oldInt : (b.decimal || 0) - (a.decimal || 0));

  for (const item of toRename) {
    const newInt = item.oldInt - 1;
    const newPadded = String(newInt).padStart(2, '0');
    const oldPadded = String(item.oldInt).padStart(2, '0');
    const letterSuffix = item.letter || '';
    const decimalSuffix = item.decimal !== null ? `.${item.decimal}` : '';
    const oldPrefix = `${oldPadded}${letterSuffix}${decimalSuffix}`;
    const newPrefix = `${newPadded}${letterSuffix}${decimalSuffix}`;
    const newDirName = `${newPrefix}-${item.slug}`;
    fs.renameSync(path.join(phasesDir, item.dir), path.join(phasesDir, newDirName));
    renamedDirs.push({ from: item.dir, to: newDirName });
    for (const f of fs.readdirSync(path.join(phasesDir, newDirName))) {
      if (f.startsWith(oldPrefix)) {
        const newFileName = newPrefix + f.slice(oldPrefix.length);
        fs.renameSync(path.join(phasesDir, newDirName, f), path.join(phasesDir, newDirName, newFileName));
        renamedFiles.push({ from: f, to: newFileName });
      }
    }
  }
  return { renamedDirs, renamedFiles };
}

function decrementRoadmapPhaseNumber(raw, removedInt) {
  const num = parseInt(raw, 10);
  if (!Number.isInteger(num) || num <= removedInt || num >= 999) return raw;
  return String(num - 1);
}

function decrementRoadmapPhaseToken(raw, removedInt) {
  const match = String(raw).match(/^(\d+)(\.\d+)?$/);
  if (!match) return raw;
  const num = parseInt(match[1], 10);
  if (!Number.isInteger(num) || num <= removedInt || num >= 999) return raw;
  return `${num - 1}${match[2] || ''}`;
}

function decrementRoadmapPaddedPhaseNumber(raw, removedInt) {
  const num = parseInt(raw, 10);
  if (!Number.isInteger(num) || num <= removedInt || num >= 999) return raw;
  return String(num - 1).padStart(raw.length, '0');
}

/**
 * Remove a phase section from ROADMAP.md and renumber all subsequent integer phases.
 */
function updateRoadmapAfterPhaseRemoval(roadmapPath, targetPhase, isDecimal, removedInt, cwd) {
  // Wrap entire read-modify-write in lock to prevent concurrent corruption
  withPlanningLock(cwd, () => {
    let content = fs.readFileSync(roadmapPath, 'utf-8');
    const escaped = escapeRegex(targetPhase);

    content = content.replace(new RegExp(`\\n?#{2,4}\\s*Phase\\s+${escaped}\\s*:[\\s\\S]*?(?=\\n#{2,4}\\s+Phase\\s+\\d+\\s*:|$)`, 'i'), '');
    content = content.replace(new RegExp(`\\n?-\\s*\\[[ x]\\]\\s*.*Phase\\s+${escaped}[:\\s][^\\n]*`, 'gi'), '');
    content = content.replace(new RegExp(`\\n?\\|\\s*${escaped}\\.?\\s[^|]*\\|[^\\n]*`, 'gi'), '');

    if (!isDecimal) {
      content = content.replace(
        /(#{2,4}\s*Phase\s+)(\d+(?:\.\d+)?)(\s*:)/gi,
        (_match, prefix, num, suffix) => `${prefix}${decrementRoadmapPhaseToken(num, removedInt)}${suffix}`
      );
      content = content.replace(
        /(-\s*\[[ x]\]\s*.*?Phase\s+)(\d+)(\s*:|\s+)/gi,
        (_match, prefix, num, suffix) => `${prefix}${decrementRoadmapPhaseNumber(num, removedInt)}${suffix}`
      );
      content = content.replace(
        /(\|\s*)(\d+)(\.\s)/g,
        (_match, prefix, num, suffix) => `${prefix}${decrementRoadmapPhaseNumber(num, removedInt)}${suffix}`
      );
      content = content.replace(
        /(?<![0-9-])(\d{2})-(\d{2})(?=(?:-(?:PLAN|SUMMARY)\.md)?(?![0-9-]))/g,
        (_match, phaseNum, planNum) => `${decrementRoadmapPaddedPhaseNumber(phaseNum, removedInt)}-${planNum}`
      );
      content = content.replace(
        /(\*\*Depends on\*\*\s*:\s*Phase\s+)(\d+(?:\.\d+)?)\b/gi,
        (_match, prefix, num) => `${prefix}${decrementRoadmapPhaseToken(num, removedInt)}`
      );
      content = content.replace(
        /(Depends on:\*\*\s*Phase\s+)(\d+(?:\.\d+)?)\b/gi,
        (_match, prefix, num) => `${prefix}${decrementRoadmapPhaseToken(num, removedInt)}`
      );
    }

    atomicWriteFileSync(roadmapPath, content);
  });
}

function cmdPhaseRemove(cwd, targetPhase, options, raw) {
  if (!targetPhase) error('phase number required for phase remove');

  const roadmapPath = path.join(planningDir(cwd), 'ROADMAP.md');
  const phasesDir = path.join(planningDir(cwd), 'phases');

  if (!fs.existsSync(roadmapPath)) error('ROADMAP.md not found');

  const normalized = normalizePhaseName(targetPhase);
  const isDecimal = targetPhase.includes('.');
  const force = options.force || false;

  // Find target directory
  const targetDir = readSubdirectories(phasesDir, true)
    .find(d => phaseTokenMatches(d, normalized)) || null;

  // Guard against removing executed work
  if (targetDir && !force) {
    const files = fs.readdirSync(path.join(phasesDir, targetDir));
    const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
    if (summaries.length > 0) {
      error(`Phase ${targetPhase} has ${summaries.length} executed plan(s). Use --force to remove anyway.`);
    }
  }

  if (targetDir) fs.rmSync(path.join(phasesDir, targetDir), { recursive: true, force: true });

  // Renumber subsequent phases on disk
  let renamedDirs = [], renamedFiles = [];
  try {
    const renamed = isDecimal
      ? renameDecimalPhases(phasesDir, parseInt(normalized.split('.')[0], 10), parseInt(normalized.split('.')[1], 10))
      : renameIntegerPhases(phasesDir, parseInt(normalized, 10));
    renamedDirs = renamed.renamedDirs;
    renamedFiles = renamed.renamedFiles;
  } catch { /* intentionally empty */ }

  // Update ROADMAP.md
  updateRoadmapAfterPhaseRemoval(roadmapPath, targetPhase, isDecimal, parseInt(normalized, 10), cwd);

  // Update STATE.md phase count atomically (#P4.4)
  const statePath = path.join(planningDir(cwd), 'STATE.md');
  if (fs.existsSync(statePath)) {
    readModifyWriteStateMd(statePath, (stateContent) => {
      const totalRaw = stateExtractField(stateContent, 'Total Phases');
      if (totalRaw) {
        stateContent = stateReplaceField(stateContent, 'Total Phases', String(parseInt(totalRaw, 10) - 1)) || stateContent;
      }
      const ofMatch = stateContent.match(/(\bof\s+)(\d+)(\s*(?:\(|phases?))/i);
      if (ofMatch) {
        stateContent = stateContent.replace(/(\bof\s+)(\d+)(\s*(?:\(|phases?))/i, `$1${parseInt(ofMatch[2], 10) - 1}$3`);
      }
      return stateContent;
    }, cwd);
  }

  output({
    removed: targetPhase,
    directory_deleted: targetDir,
    renamed_directories: renamedDirs,
    renamed_files: renamedFiles,
    roadmap_updated: true,
    state_updated: fs.existsSync(statePath),
  }, raw);
}

function cmdPhaseComplete(cwd, phaseNum, raw) {
  if (!phaseNum) {
    error('phase number required for phase complete');
  }

  const roadmapPath = path.join(planningDir(cwd), 'ROADMAP.md');
  const statePath = path.join(planningDir(cwd), 'STATE.md');
  const phasesDir = path.join(planningDir(cwd), 'phases');
  const normalized = normalizePhaseName(phaseNum);
  const today = new Date().toISOString().split('T')[0];

  // Verify phase info
  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) {
    error(`Phase ${phaseNum} not found`);
  }

  const planCount = phaseInfo.plans.length;
  const summaryCount = phaseInfo.summaries.length;
  let requirementsUpdated = false;

  // Check for unresolved verification debt (non-blocking warnings)
  const warnings = [];
  try {
    const phaseFullDir = path.join(cwd, phaseInfo.directory);
    const phaseFiles = fs.readdirSync(phaseFullDir);

    for (const file of phaseFiles.filter(f => f.includes('-UAT') && f.endsWith('.md'))) {
      const content = fs.readFileSync(path.join(phaseFullDir, file), 'utf-8');
      if (/result: pending/.test(content)) warnings.push(`${file}: has pending tests`);
      if (/result: blocked/.test(content)) warnings.push(`${file}: has blocked tests`);
      if (/status: partial/.test(content)) warnings.push(`${file}: testing incomplete (partial)`);
      if (/status: diagnosed/.test(content)) warnings.push(`${file}: has diagnosed gaps`);
    }

    for (const file of phaseFiles.filter(f => f.includes('-VERIFICATION') && f.endsWith('.md'))) {
      const content = fs.readFileSync(path.join(phaseFullDir, file), 'utf-8');
      if (/status: human_needed/.test(content)) warnings.push(`${file}: needs human verification`);
      if (/status: gaps_found/.test(content)) warnings.push(`${file}: has unresolved gaps`);
    }
  } catch {}

  // Update ROADMAP.md and REQUIREMENTS.md atomically under lock
  if (fs.existsSync(roadmapPath)) {
    withPlanningLock(cwd, () => {
      let roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');

      // Checkbox: - [ ] Phase N: → - [x] Phase N: (...completed DATE)
      const checkboxPattern = new RegExp(
        `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${escapeRegex(phaseNum)}[:\\s][^\\n]*)`,
        'i'
      );
      roadmapContent = roadmapContent.replace(checkboxPattern, `$1x$2 (completed ${today})`);

      // Progress table: update Status to Complete, add date (handles 4 or 5 column tables)
      const phaseEscaped = escapeRegex(phaseNum);
      const tableRowPattern = new RegExp(
        `^(\\|\\s*${phaseEscaped}\\.?\\s[^|]*(?:\\|[^\\n]*))$`,
        'im'
      );
      roadmapContent = roadmapContent.replace(tableRowPattern, (fullRow) => {
        const cells = fullRow.split('|').slice(1, -1);
        if (cells.length === 5) {
          // 5-col: Phase | Milestone | Plans | Status | Completed
          cells[2] = ` ${summaryCount}/${planCount} `;
          cells[3] = ' Complete    ';
          cells[4] = ` ${today} `;
        } else if (cells.length === 4) {
          // 4-col: Phase | Plans | Status | Completed
          cells[1] = ` ${summaryCount}/${planCount} `;
          cells[2] = ' Complete    ';
          cells[3] = ` ${today} `;
        }
        return '|' + cells.join('|') + '|';
      });

      // Update plan count in phase section.
      // Use direct .replace() rather than replaceInCurrentMilestone() so this
      // works when the current milestone section is itself inside a <details>
      // block (the standard /gsd-new-project layout). replaceInCurrentMilestone
      // scopes to content after the last </details>, which misses content inside
      // the current milestone's own <details> wrapper (#2005).
      // The phase-scoped heading pattern is specific enough to avoid matching
      // archived phases (which belong to different milestones).
      const planCountPattern = new RegExp(
        `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:\\*\\*\\s*)[^\\n]+`,
        'i'
      );
      roadmapContent = roadmapContent.replace(
        planCountPattern,
        `$1${summaryCount}/${planCount} plans complete`
      );

      // Mark completed plan checkboxes (safety net for missed per-plan updates)
      // Handles both plain IDs ("- [ ] 01-01-PLAN.md") and bold-wrapped IDs ("- [ ] **01-01**")
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

      atomicWriteFileSync(roadmapPath, roadmapContent);

      // Update REQUIREMENTS.md traceability for this phase's requirements
      const reqPath = path.join(planningDir(cwd), 'REQUIREMENTS.md');
      if (fs.existsSync(reqPath)) {
        // Extract the current phase section from roadmap (scoped to avoid cross-phase matching)
        const phaseEsc = escapeRegex(phaseNum);
        const currentMilestoneRoadmap = extractCurrentMilestone(roadmapContent, cwd);
        const phaseSectionMatch = currentMilestoneRoadmap.match(
          new RegExp(`(#{2,4}\\s*Phase\\s+${phaseEsc}[:\\s][\\s\\S]*?)(?=#{2,4}\\s*Phase\\s+|$)`, 'i')
        );

        const sectionText = phaseSectionMatch ? phaseSectionMatch[1] : '';
        // Accept all bold/colon variants (#2769) — the previous pattern only
        // matched **Requirements:** (colon inside bold) and silently skipped
        // **Requirements**: (colon outside), preventing the matching REQ-IDs
        // from being ticked off in REQUIREMENTS.md on phase completion.
        const reqMatch = sectionText.match(/\*\*Requirements:?\*\*[^\S\n]*:?[^\S\n]*([^\n]+)/i);

        let reqContent = fs.readFileSync(reqPath, 'utf-8');

        if (reqMatch) {
          const reqIds = reqMatch[1].replace(/[\[\]]/g, '').split(/[,\s]+/).map(r => r.trim()).filter(Boolean);

          for (const reqId of reqIds) {
            const reqEscaped = escapeRegex(reqId);
            // Update checkbox: - [ ] **REQ-ID** → - [x] **REQ-ID**
            reqContent = reqContent.replace(
              new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqEscaped}\\*\\*)`, 'gi'),
              '$1x$2'
            );
            // Update traceability table: | REQ-ID | Phase N | Pending/In Progress | → | REQ-ID | Phase N | Complete |
            reqContent = reqContent.replace(
              new RegExp(`(\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|)\\s*(?:Pending|In Progress)\\s*(\\|)`, 'gi'),
              '$1 Complete $2'
            );
          }
        }

        // Scan body for all **REQ-ID** patterns, warn about any missing from the Traceability table.
        // Always runs regardless of whether the roadmap has a Requirements: line.
        const bodyReqIds = [];
        const bodyReqPattern = /\*\*([A-Z][A-Z0-9]*-\d+)\*\*/g;
        let bodyMatch;
        while ((bodyMatch = bodyReqPattern.exec(reqContent)) !== null) {
          const id = bodyMatch[1];
          if (!bodyReqIds.includes(id)) bodyReqIds.push(id);
        }

        // Collect REQ-IDs present in the Traceability section only, to avoid
        // picking up IDs from other tables in the document.
        const traceabilityHeadingMatch = reqContent.match(/^#{1,6}\s+Traceability\b/im);
        const traceabilitySection = traceabilityHeadingMatch
          ? reqContent.slice(traceabilityHeadingMatch.index)
          : '';
        const tableReqIds = new Set();
        const tableRowPattern = /^\|\s*([A-Z][A-Z0-9]*-\d+)\s*\|/gm;
        let tableMatch;
        while ((tableMatch = tableRowPattern.exec(traceabilitySection)) !== null) {
          tableReqIds.add(tableMatch[1]);
        }

        const unregistered = bodyReqIds.filter(id => !tableReqIds.has(id));
        if (unregistered.length > 0) {
          warnings.push(
            `REQUIREMENTS.md: ${unregistered.length} REQ-ID(s) found in body but missing from Traceability table: ${unregistered.join(', ')} — add them manually to keep traceability in sync`
          );
        }

        atomicWriteFileSync(reqPath, reqContent);
        requirementsUpdated = true;
      }
    });
  }

  // Find next phase — check both filesystem AND roadmap
  // Phases may be defined in ROADMAP.md but not yet scaffolded to disk,
  // so a filesystem-only scan would incorrectly report is_last_phase:true
  let nextPhaseNum = null;
  let nextPhaseName = null;
  let isLastPhase = true;

  try {
    const isDirInMilestone = getMilestonePhaseFilter(cwd);
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
      .filter(isDirInMilestone)
      .sort((a, b) => comparePhaseNum(a, b));

    // Find the next phase directory after current
    // Skip backlog phases (999.x) — they are parked ideas, not sequential work (#2129)
    for (const dir of dirs) {
      const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
      if (dm) {
        if (/^999(?:\.|$)/.test(dm[1])) continue;
        if (comparePhaseNum(dm[1], phaseNum) > 0) {
          nextPhaseNum = dm[1];
          nextPhaseName = dm[2] || null;
          isLastPhase = false;
          break;
        }
      }
    }
  } catch { /* intentionally empty */ }

  // Fallback: if filesystem found no next phase, check ROADMAP.md
  // for phases that are defined but not yet planned (no directory on disk)
  if (isLastPhase && fs.existsSync(roadmapPath)) {
    try {
      const roadmapForPhases = extractCurrentMilestone(fs.readFileSync(roadmapPath, 'utf-8'), cwd);
      const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
      let pm;
      while ((pm = phasePattern.exec(roadmapForPhases)) !== null) {
        if (comparePhaseNum(pm[1], phaseNum) > 0) {
          nextPhaseNum = pm[1];
          nextPhaseName = pm[2].replace(/\(INSERTED\)/i, '').trim().toLowerCase().replace(/\s+/g, '-');
          isLastPhase = false;
          break;
        }
      }
    } catch { /* intentionally empty */ }
  }

  // Update STATE.md atomically — hold lock across read-modify-write (#P4.4).
  // Previously read outside the lock; a crash between the ROADMAP update
  // (locked above) and this write left ROADMAP/STATE inconsistent.
  if (fs.existsSync(statePath)) {
    readModifyWriteStateMd(statePath, (stateContent) => {
      // Update Current Phase — preserve "X of Y (Name)" compound format
      const phaseValue = nextPhaseNum || phaseNum;
      const existingPhaseField = stateExtractField(stateContent, 'Current Phase')
        || stateExtractField(stateContent, 'Phase');
      let newPhaseValue = String(phaseValue);
      if (existingPhaseField) {
        const totalMatch = existingPhaseField.match(/of\s+(\d+)/);
        const nameMatch = existingPhaseField.match(/\(([^)]+)\)/);
        if (totalMatch) {
          const total = totalMatch[1];
          const nameStr = nextPhaseName ? ` (${nextPhaseName.replace(/-/g, ' ')})` : (nameMatch ? ` (${nameMatch[1]})` : '');
          newPhaseValue = `${phaseValue} of ${total}${nameStr}`;
        }
      }
      stateContent = stateReplaceFieldWithFallback(stateContent, 'Current Phase', 'Phase', newPhaseValue);

      // Update Current Phase Name
      if (nextPhaseName) {
        stateContent = stateReplaceFieldWithFallback(stateContent, 'Current Phase Name', null, nextPhaseName.replace(/-/g, ' '));
      }

      // Update Status
      stateContent = stateReplaceFieldWithFallback(stateContent, 'Status', null,
        isLastPhase ? 'Milestone complete' : 'Ready to plan');

      // Update Current Plan
      stateContent = stateReplaceFieldWithFallback(stateContent, 'Current Plan', 'Plan', 'Not started');

      // Update Last Activity
      stateContent = stateReplaceFieldWithFallback(stateContent, 'Last Activity', 'Last activity', today);

      // Update Last Activity Description
      stateContent = stateReplaceFieldWithFallback(stateContent, 'Last Activity Description', null,
        `Phase ${phaseNum} complete${nextPhaseNum ? `, transitioned to Phase ${nextPhaseNum}` : ''}`);

      // Increment Completed Phases counter (#956)
      const completedRaw = stateExtractField(stateContent, 'Completed Phases');
      if (completedRaw) {
        const newCompleted = parseInt(completedRaw, 10) + 1;
        stateContent = stateReplaceField(stateContent, 'Completed Phases', String(newCompleted)) || stateContent;

        // Recalculate percent based on completed / total (#956)
        const totalRaw = stateExtractField(stateContent, 'Total Phases');
        if (totalRaw) {
          const totalPhases = parseInt(totalRaw, 10);
          if (totalPhases > 0) {
            const newPercent = Math.round((newCompleted / totalPhases) * 100);
            stateContent = stateReplaceField(stateContent, 'Progress', `${newPercent}%`) || stateContent;
            stateContent = stateContent.replace(
              /(percent:\s*)\d+/,
              `$1${newPercent}`
            );
          }
        }
      }

      // Gate 4: Update Performance Metrics section (#1627)
      stateContent = updatePerformanceMetricsSection(stateContent, cwd, phaseNum, planCount, summaryCount);

      return stateContent;
    }, cwd);
  }

  // Auto-prune STATE.md on phase boundary when configured (#2087)
  let autoPruned = false;
  try {
    const configPath = path.join(planningDir(cwd), 'config.json');
    if (fs.existsSync(configPath)) {
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const autoPruneEnabled = rawConfig.workflow && rawConfig.workflow.auto_prune_state === true;
      if (autoPruneEnabled && fs.existsSync(statePath)) {
        const { cmdStatePrune } = require('./state.cjs');
        cmdStatePrune(cwd, { keepRecent: '3', dryRun: false, silent: true }, true);
        autoPruned = true;
      }
    }
  } catch { /* intentionally empty — auto-prune is best-effort */ }

  const result = {
    completed_phase: phaseNum,
    phase_name: phaseInfo.phase_name,
    plans_executed: `${summaryCount}/${planCount}`,
    next_phase: nextPhaseNum,
    next_phase_name: nextPhaseName,
    is_last_phase: isLastPhase,
    date: today,
    roadmap_updated: fs.existsSync(roadmapPath),
    state_updated: fs.existsSync(statePath),
    requirements_updated: requirementsUpdated,
    auto_pruned: autoPruned,
    warnings,
    has_warnings: warnings.length > 0,
  };

  output(result, raw);
}

module.exports = {
  cmdPhasesList,
  cmdPhaseNextDecimal,
  cmdFindPhase,
  cmdPhasePlanIndex,
  cmdPhaseAdd,
  cmdPhaseAddBatch,
  cmdPhaseInsert,
  cmdPhaseRemove,
  cmdPhaseComplete,
};
