/**
 * Preflight — Pre-workflow validation for phase readiness
 */

const fs = require('fs');
const path = require('path');
const { planningDir, planningPaths, getRoadmapPhaseInternal, findPhaseInternal, getPhaseFileStats, extractCurrentMilestone, escapeRegex, output, error } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');

/**
 * Normalize workflow argument from various input formats.
 * Maps 'plan-phase' → 'plan', 'execute-phase' → 'execute', etc.
 */
function normalizeWorkflow(wf) {
  if (!wf) return null;
  const map = {
    'discuss-phase': 'discuss', 'discuss': 'discuss',
    'plan-phase': 'plan', 'plan': 'plan',
    'execute-phase': 'execute', 'execute': 'execute',
    'verify-phase': 'verify', 'verify': 'verify',
  };
  return map[wf] || null;
}

/**
 * Auto-detect the next workflow step based on artifact state.
 * No CONTEXT → discuss, CONTEXT no PLANs → plan, PLANs no SUMMARYs → execute, else verify.
 */
function detectWorkflow(phaseDir) {
  if (!phaseDir || !fs.existsSync(phaseDir)) return 'discuss';
  try {
    const stats = getPhaseFileStats(phaseDir);
    if (!stats.hasContext) return 'discuss';
    if (stats.plans.length === 0) return 'plan';
    if (stats.summaries.length === 0) return 'execute';
    return 'verify';
  } catch {
    return 'discuss';
  }
}

/**
 * Build the next command string for a given workflow and phase.
 */
function nextCommand(workflow, phase) {
  const map = {
    'discuss': `/gsd:discuss-phase ${phase}`,
    'plan': `/gsd:plan-phase ${phase}`,
    'execute': `/gsd:execute-phase ${phase}`,
    'verify': `/gsd:verify-work ${phase}`,
  };
  return map[workflow] || `/gsd:discuss-phase ${phase}`;
}

/**
 * Check 4: Verify required artifacts exist for the target workflow step.
 */
function checkArtifacts(phaseDirPath, workflow, phaseNum, phaseSection, blockers, warnings) {
  // discuss requires nothing
  if (workflow === 'discuss') return;

  // No phase dir at all — blocker for plan/execute/verify
  if (!phaseDirPath || !fs.existsSync(phaseDirPath)) {
    const artifactMap = { plan: 'CONTEXT.md', execute: 'PLAN.md', verify: 'SUMMARY.md' };
    blockers.push({
      type: 'artifact_missing',
      message: `Phase directory not found — ${artifactMap[workflow] || 'artifacts'} required for ${workflow}`,
      command: `/gsd:discuss-phase ${phaseNum}`,
      skippable: false,
    });
    return;
  }

  let stats;
  try {
    stats = getPhaseFileStats(phaseDirPath);
  } catch {
    blockers.push({
      type: 'artifact_missing',
      message: `Cannot read phase directory`,
      command: null,
      skippable: false,
    });
    return;
  }

  if (workflow === 'plan' && !stats.hasContext) {
    blockers.push({
      type: 'artifact_missing',
      message: `CONTEXT.md missing — required before planning`,
      command: `/gsd:discuss-phase ${phaseNum}`,
      skippable: false,
    });
  }

  if (workflow === 'execute' && stats.plans.length === 0) {
    blockers.push({
      type: 'artifact_missing',
      message: `No PLAN.md files found — required before execution`,
      command: `/gsd:plan-phase ${phaseNum}`,
      skippable: false,
    });
  }

  if (workflow === 'verify' && stats.summaries.length === 0) {
    blockers.push({
      type: 'artifact_missing',
      message: `No SUMMARY.md files found — required before verification`,
      command: `/gsd:execute-phase ${phaseNum}`,
      skippable: false,
    });
  }

  // UI-SPEC check: warning if frontend indicators present but no UI-SPEC
  if (workflow === 'plan' || workflow === 'execute') {
    const hasFrontendIndicators = /UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget/i.test(phaseSection || '');
    if (hasFrontendIndicators) {
      const files = fs.readdirSync(phaseDirPath);
      const hasUiSpec = files.some(f => f.endsWith('-UI-SPEC.md') || f === 'UI-SPEC.md');
      if (!hasUiSpec) {
        warnings.push({
          type: 'ui_spec_missing',
          message: `Frontend phase without UI-SPEC.md`,
          command: `/gsd:ui-phase ${phaseNum}`,
        });
      }
    }
  }
}

/**
 * Check 5: Validate canonical refs in CONTEXT.md point to real files.
 * Returns { checked: number, valid: number }.
 */
function checkCanonicalRefs(cwd, phaseDirPath, warnings) {
  const result = { checked: 0, valid: 0 };
  if (!phaseDirPath || !fs.existsSync(phaseDirPath)) return result;

  // Find CONTEXT.md
  let contextFile;
  try {
    const files = fs.readdirSync(phaseDirPath);
    contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
  } catch {
    return result;
  }
  if (!contextFile) return result;

  let content;
  try {
    content = fs.readFileSync(path.join(phaseDirPath, contextFile), 'utf-8');
  } catch {
    return result;
  }

  // Extract <canonical_refs> section
  const sectionMatch = content.match(/<canonical_refs>([\s\S]*?)<\/canonical_refs>/);
  if (!sectionMatch) return result;

  const section = sectionMatch[1];

  // Skip if explicitly empty
  if (/no external specs/i.test(section)) return result;

  // Extract backtick-quoted paths
  const pathMatches = section.matchAll(/`([^`]+)`/g);
  for (const m of pathMatches) {
    let refPath = m[1].trim();

    // Skip non-path entries (commands, code snippets)
    if (refPath.startsWith('/gsd:') || refPath.startsWith('node ') || refPath.includes('(') || !refPath.includes('/')) continue;

    // Strip §N section references
    refPath = refPath.replace(/\s*§\d+.*$/, '');

    result.checked++;
    const fullPath = path.resolve(cwd, refPath);
    if (fs.existsSync(fullPath)) {
      result.valid++;
    } else {
      warnings.push({
        type: 'canonical_ref_missing',
        message: `Referenced file not found: ${refPath}`,
        path: refPath,
      });
    }
  }

  return result;
}

/**
 * Check 6: Validate files_modified in PLAN frontmatter point to real files/dirs.
 * Returns { checked: number, valid: number }.
 */
function checkPlanPaths(cwd, phaseDirPath, warnings) {
  const result = { checked: 0, valid: 0 };
  if (!phaseDirPath || !fs.existsSync(phaseDirPath)) return result;

  let planFiles;
  try {
    const files = fs.readdirSync(phaseDirPath);
    planFiles = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
  } catch {
    return result;
  }
  if (planFiles.length === 0) return result;

  for (const planFile of planFiles) {
    let content;
    try {
      content = fs.readFileSync(path.join(phaseDirPath, planFile), 'utf-8');
    } catch {
      continue;
    }

    let fm;
    try {
      fm = extractFrontmatter(content);
    } catch {
      warnings.push({
        type: 'malformed_frontmatter',
        message: `Malformed YAML frontmatter in ${planFile}`,
      });
      continue;
    }

    const filesModified = fm.files_modified || fm['files-modified'];
    if (!filesModified) continue;

    // Normalize to array
    const pathList = Array.isArray(filesModified) ? filesModified : String(filesModified).split(',').map(s => s.trim());

    for (const p of pathList) {
      if (!p) continue;
      // Skip globs
      if (p.includes('*')) continue;

      result.checked++;
      const fullPath = path.resolve(cwd, p);
      if (fs.existsSync(fullPath)) {
        result.valid++;
      } else {
        // Check if parent directory exists (new file is ok if parent dir exists)
        const parentDir = path.dirname(fullPath);
        if (fs.existsSync(parentDir)) {
          result.valid++; // New file in existing dir — ok
        } else {
          warnings.push({
            type: 'files_modified_missing',
            message: `Plan path not found (parent dir also missing): ${p}`,
            path: p,
            plan: planFile,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Check 3: Verify all phase dependencies are marked complete.
 * Parses "Depends on" from phase section, cross-references roadmap checkboxes.
 */
function checkDependencies(cwd, phaseSection, phaseNum, blockers) {
  const dependsMatch = phaseSection.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
  if (!dependsMatch) return;

  const dependsRaw = dependsMatch[1].trim();
  // Skip if no real dependencies
  if (/^(nothing|none|—|-|n\/a)$/i.test(dependsRaw)) return;

  // Extract phase numbers from dependency string
  // Handles: "Phase 1", "Phase 1, Phase 2", "Phase 1 and Phase 2", "1, 2"
  const depNums = [];
  const phaseRefs = dependsRaw.matchAll(/(?:Phase\s+)?(\d+(?:\.\d+)*)/gi);
  for (const m of phaseRefs) {
    depNums.push(m[1]);
  }

  if (depNums.length === 0) return;

  // Read roadmap to check completion status
  const paths = planningPaths(cwd);
  let roadmapContent;
  try {
    roadmapContent = extractCurrentMilestone(fs.readFileSync(paths.roadmap, 'utf-8'), cwd);
  } catch {
    return; // Can't read roadmap — skip dependency check silently
  }

  for (const depNum of depNums) {
    const escaped = escapeRegex(depNum);
    const checkboxPattern = new RegExp(`-\\s*\\[(x| )\\]\\s*.*Phase\\s+${escaped}[:\\s]`, 'i');
    const match = roadmapContent.match(checkboxPattern);
    const isComplete = match ? match[1] === 'x' : false;

    if (!isComplete) {
      // Get dep phase name for better message
      const depInfo = getRoadmapPhaseInternal(cwd, depNum);
      const depName = depInfo ? depInfo.phase_name : `Phase ${depNum}`;
      blockers.push({
        type: 'dependency_incomplete',
        message: `Phase ${depNum} (${depName}) not complete — required by Phase ${phaseNum}`,
        command: `/gsd:execute-phase ${depNum}`,
        skippable: false,
      });
    }
  }
}

function cmdPreflight(cwd, phaseNum, workflowArg, raw) {
  const blockers = [];
  const warnings = [];

  // ── Check 1: Planning exists ──
  const pDir = planningDir(cwd);
  if (!fs.existsSync(pDir)) {
    output({
      ready: false,
      phase: phaseNum || null,
      phase_name: null,
      detected_workflow: null,
      next_command: '/gsd:new-project',
      blockers: [{ type: 'no_planning', message: '.planning/ directory not found. Run /gsd:new-project first', command: '/gsd:new-project', skippable: false }],
      warnings: [],
    }, raw);
    return;
  }

  const paths = planningPaths(cwd);
  if (!fs.existsSync(paths.roadmap)) {
    output({
      ready: false,
      phase: phaseNum || null,
      phase_name: null,
      detected_workflow: null,
      next_command: '/gsd:new-project',
      blockers: [{ type: 'no_roadmap', message: 'ROADMAP.md not found. Run /gsd:new-project first', command: '/gsd:new-project', skippable: false }],
      warnings: [],
    }, raw);
    return;
  }

  if (!phaseNum) {
    output({
      ready: false,
      phase: null,
      phase_name: null,
      detected_workflow: null,
      next_command: null,
      blockers: [{ type: 'no_phase', message: 'Phase number required. Usage: preflight <phase>', command: null, skippable: false }],
      warnings: [],
    }, raw);
    return;
  }

  // ── Check 2: Phase exists ──
  const phaseInfo = getRoadmapPhaseInternal(cwd, phaseNum);
  if (!phaseInfo || !phaseInfo.found) {
    output({
      ready: false,
      phase: phaseNum,
      phase_name: null,
      detected_workflow: null,
      next_command: null,
      blockers: [{ type: 'phase_not_found', message: `Phase ${phaseNum} not found in ROADMAP.md`, command: null, skippable: false }],
      warnings: [],
    }, raw);
    return;
  }

  const phaseName = phaseInfo.phase_name;
  const phaseSection = phaseInfo.section;

  // Resolve phase directory (may not exist yet — that's ok for discuss)
  const phaseDir = findPhaseInternal(cwd, phaseNum);
  const phaseDirPath = phaseDir ? path.join(cwd, phaseDir.directory) : null;

  // Detect or normalize workflow
  const workflow = normalizeWorkflow(workflowArg) || detectWorkflow(phaseDirPath);

  // ── Check 3: Dependencies complete ──
  checkDependencies(cwd, phaseSection, phaseNum, blockers);

  // ── Check 4: Artifact gate ──
  checkArtifacts(phaseDirPath, workflow, phaseNum, phaseSection, blockers, warnings);

  // ── Check 5: Canonical refs ──
  const canonicalStats = checkCanonicalRefs(cwd, phaseDirPath, warnings);

  // ── Check 6: Plan files_modified ──
  const planPathStats = checkPlanPaths(cwd, phaseDirPath, warnings);

  const ready = blockers.every(b => b.skippable);

  output({
    ready,
    phase: phaseNum,
    phase_name: phaseName,
    detected_workflow: workflow,
    next_command: nextCommand(workflow, phaseNum),
    blockers,
    warnings,
    canonical_refs_checked: canonicalStats.checked,
    canonical_refs_valid: canonicalStats.valid,
    plan_paths_checked: planPathStats.checked,
    plan_paths_valid: planPathStats.valid,
  }, raw);
}

module.exports = { cmdPreflight };
