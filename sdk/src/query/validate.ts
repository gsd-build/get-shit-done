/**
 * Validation query handlers — key-link verification and consistency checking.
 *
 * Ported from get-shit-done/bin/lib/verify.cjs.
 * Provides key-link integration point verification and cross-file consistency
 * detection as native TypeScript query handlers registered in the SDK query registry.
 *
 * @example
 * ```typescript
 * import { verifyKeyLinks, validateConsistency } from './validate.js';
 *
 * const result = await verifyKeyLinks(['path/to/plan.md'], '/project');
 * // { data: { all_verified: true, verified: 1, total: 1, links: [...] } }
 * ```
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

import { MODEL_PROFILES } from './config-query.js';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter, parseMustHavesBlock } from './frontmatter.js';
import { escapeRegex, normalizePhaseName, planningPaths, resolvePathUnderProject } from './helpers.js';
import type { QueryHandler } from './utils.js';

/** Max length for key_links regex patterns (ReDoS mitigation). */
const MAX_KEY_LINK_PATTERN_LEN = 512;

/**
 * Build a RegExp for must_haves key_links pattern matching.
 * Long or nested-quantifier patterns fall back to a literal match via escapeRegex.
 */
export function regexForKeyLinkPattern(pattern: string): RegExp {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    return /$^/;
  }
  if (pattern.length > MAX_KEY_LINK_PATTERN_LEN) {
    return new RegExp(escapeRegex(pattern.slice(0, MAX_KEY_LINK_PATTERN_LEN)));
  }
  // Mitigate catastrophic backtracking on nested quantifier forms
  if (/\([^)]*[\+\*][^)]*\)[\+\*]/.test(pattern)) {
    return new RegExp(escapeRegex(pattern));
  }
  try {
    return new RegExp(pattern);
  } catch {
    return new RegExp(escapeRegex(pattern));
  }
}

// ─── verifyKeyLinks ───────────────────────────────────────────────────────

/**
 * Verify key-link integration points from must_haves.key_links.
 *
 * Port of `cmdVerifyKeyLinks` from `verify.cjs` lines 338-396.
 * Reads must_haves.key_links from plan frontmatter, checks source/target
 * files for pattern matching or target reference presence.
 *
 * @param args - args[0]: plan file path (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with { all_verified, verified, total, links }
 * @throws GSDError with Validation classification if file path missing
 */
export const verifyKeyLinks: QueryHandler = async (args, projectDir) => {
  const planFilePath = args[0];
  if (!planFilePath) {
    throw new GSDError('plan file path required', ErrorClassification.Validation);
  }

  // T-12-07: Null byte check on plan file path
  if (planFilePath.includes('\0')) {
    throw new GSDError('file path contains null bytes', ErrorClassification.Validation);
  }

  let fullPath: string;
  try {
    fullPath = await resolvePathUnderProject(projectDir, planFilePath);
  } catch (err) {
    if (err instanceof GSDError) {
      return { data: { error: err.message, path: planFilePath } };
    }
    throw err;
  }

  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return { data: { error: 'File not found', path: planFilePath } };
  }

  const { items: keyLinks } = parseMustHavesBlock(content, 'key_links');
  if (keyLinks.length === 0) {
    return { data: { error: 'No must_haves.key_links found in frontmatter', path: planFilePath } };
  }

  const results: Array<{ from: string; to: string; via: string; verified: boolean; detail: string }> = [];

  for (const link of keyLinks) {
    if (typeof link === 'string') continue;
    const linkObj = link as Record<string, unknown>;
    const check = {
      from: (linkObj.from as string) || '',
      to: (linkObj.to as string) || '',
      via: (linkObj.via as string) || '',
      verified: false,
      detail: '',
    };

    let sourceContent: string | null = null;
    if (check.from) {
      try {
        const sourcePath = await resolvePathUnderProject(projectDir, check.from);
        sourceContent = await readFile(sourcePath, 'utf-8');
      } catch {
        // Source file not found or path escapes project
      }
    }

    if (!sourceContent) {
      check.detail = 'Source file not found';
    } else if (linkObj.pattern) {
      try {
        const regex = new RegExp(linkObj.pattern as string);
        if (regex.test(sourceContent)) {
          check.verified = true;
          check.detail = 'Pattern found in source';
        } else {
          let targetContent: string | null = null;
          if (check.to) {
            try {
              const targetPath = await resolvePathUnderProject(projectDir, check.to);
              targetContent = await readFile(targetPath, 'utf-8');
            } catch {
              // Target file not found or path escapes project
            }
          }
          if (targetContent && regex.test(targetContent)) {
            check.verified = true;
            check.detail = 'Pattern found in target';
          } else {
            check.detail = `Pattern "${linkObj.pattern}" not found in source or target`;
          }
        }
      } catch {
        check.detail = `Invalid regex pattern: ${linkObj.pattern}`;
      }
    } else {
      // No pattern: check if target path is referenced in source content
      if (sourceContent.includes(check.to)) {
        check.verified = true;
        check.detail = 'Target referenced in source';
      } else {
        check.detail = 'Target not referenced in source';
      }
    }

    results.push(check);
  }

  const verified = results.filter(r => r.verified).length;
  return {
    data: {
      all_verified: verified === results.length,
      verified,
      total: results.length,
      links: results,
    },
  };
};

// ─── validateConsistency ─────────────────────────────────────────────────

/**
 * Validate consistency between ROADMAP.md, disk phases, and plan frontmatter.
 *
 * Port of `cmdValidateConsistency` from `verify.cjs` lines 398-519.
 * Checks ROADMAP/disk phase sync, sequential numbering, plan numbering gaps,
 * summary/plan orphans, and frontmatter completeness.
 *
 * @param _args - No required args (operates on projectDir)
 * @param projectDir - Project root directory
 * @returns QueryResult with { passed, errors, warnings, warning_count }
 */
export const validateConsistency: QueryHandler = async (_args, projectDir, workstream) => {
  const paths = planningPaths(projectDir, workstream);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Read ROADMAP.md
  let roadmapContent: string;
  try {
    roadmapContent = await readFile(paths.roadmap, 'utf-8');
  } catch {
    return { data: { passed: false, errors: ['ROADMAP.md not found'], warnings: [], warning_count: 0 } };
  }

  // Strip shipped milestone <details> blocks
  const activeContent = roadmapContent.replace(/<details>[\s\S]*?<\/details>/gi, '');

  // Extract phase numbers from ROADMAP headings
  const roadmapPhases = new Set<string>();
  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = phasePattern.exec(activeContent)) !== null) {
    roadmapPhases.add(m[1]);
  }

  // Get phases on disk
  const diskPhases = new Set<string>();
  let diskDirs: string[] = [];
  try {
    const entries = await readdir(paths.phases, { withFileTypes: true });
    diskDirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    for (const dir of diskDirs) {
      const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
      if (dm) diskPhases.add(dm[1]);
    }
  } catch {
    // phases directory doesn't exist
  }

  // Check: phases in ROADMAP but not on disk
  for (const p of roadmapPhases) {
    if (!diskPhases.has(p) && !diskPhases.has(normalizePhaseName(p))) {
      warnings.push(`Phase ${p} in ROADMAP.md but no directory on disk`);
    }
  }

  // Check: phases on disk but not in ROADMAP
  for (const p of diskPhases) {
    const unpadded = String(parseInt(p, 10));
    if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
      warnings.push(`Phase ${p} exists on disk but not in ROADMAP.md`);
    }
  }

  // Check sequential phase numbering (skip in custom naming mode)
  let config: Record<string, unknown> = {};
  try {
    const configContent = await readFile(paths.config, 'utf-8');
    config = JSON.parse(configContent) as Record<string, unknown>;
  } catch {
    // config not found or invalid — proceed with defaults
  }

  if (config.phase_naming !== 'custom') {
    const integerPhases = [...diskPhases]
      .filter(p => !p.includes('.'))
      .map(p => parseInt(p, 10))
      .sort((a, b) => a - b);

    for (let i = 1; i < integerPhases.length; i++) {
      if (integerPhases[i] !== integerPhases[i - 1] + 1) {
        warnings.push(`Gap in phase numbering: ${integerPhases[i - 1]} \u2192 ${integerPhases[i]}`);
      }
    }
  }

  // Check plan numbering and summaries within each phase
  for (const dir of diskDirs) {
    let phaseFiles: string[];
    try {
      phaseFiles = await readdir(join(paths.phases, dir));
    } catch {
      continue;
    }

    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md')).sort();
    const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md'));

    // Extract plan numbers and check for gaps
    const planNums = plans.map(p => {
      const pm = p.match(/-(\d{2})-PLAN\.md$/);
      return pm ? parseInt(pm[1], 10) : null;
    }).filter((n): n is number => n !== null);

    for (let i = 1; i < planNums.length; i++) {
      if (planNums[i] !== planNums[i - 1] + 1) {
        warnings.push(`Gap in plan numbering in ${dir}: plan ${planNums[i - 1]} \u2192 ${planNums[i]}`);
      }
    }

    // Check: summaries without matching plans
    const planIds = new Set(plans.map(p => p.replace('-PLAN.md', '')));
    const summaryIds = new Set(summaries.map(s => s.replace('-SUMMARY.md', '')));

    for (const sid of summaryIds) {
      if (!planIds.has(sid)) {
        warnings.push(`Summary ${sid}-SUMMARY.md in ${dir} has no matching PLAN.md`);
      }
    }
  }

  // Check frontmatter completeness in plans
  for (const dir of diskDirs) {
    let phaseFiles: string[];
    try {
      phaseFiles = await readdir(join(paths.phases, dir));
    } catch {
      continue;
    }

    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md'));
    for (const plan of plans) {
      try {
        const content = await readFile(join(paths.phases, dir, plan), 'utf-8');
        const fm = extractFrontmatter(content);
        if (!fm.wave) {
          warnings.push(`${dir}/${plan}: missing 'wave' in frontmatter`);
        }
      } catch {
        // Cannot read plan file
      }
    }
  }

  const passed = errors.length === 0;
  return {
    data: {
      passed,
      errors,
      warnings,
      warning_count: warnings.length,
    },
  };
};

// ─── validateHealth ─────────────────────────────────────────────────────────

/**
 * Health check with optional repair mode.
 *
 * Port of `cmdValidateHealth` from `verify.cjs` lines 522-921.
 * Performs 10+ checks on .planning/ directory structure, config, state,
 * and cross-file consistency. With `--repair` flag, can fix missing
 * config.json, STATE.md, and nyquist key.
 *
 * @param args - Optional: '--repair' to perform repairs
 * @param projectDir - Project root directory
 * @returns QueryResult with { status, errors, warnings, info, repairable_count, repairs_performed? }
 */
export const validateHealth: QueryHandler = async (args, projectDir, _workstream) => {
  const doRepair = args.includes('--repair');

  // T-12-09: Home directory guard
  const resolved = resolve(projectDir);
  if (resolved === homedir()) {
    return {
      data: {
        status: 'error',
        errors: [{
          code: 'E010',
          message: `CWD is home directory (${resolved}) — health check would read the wrong .planning/ directory. Run from your project root instead.`,
          fix: 'cd into your project directory and retry',
        }],
        warnings: [],
        info: [{ code: 'I010', message: `Resolved CWD: ${resolved}` }],
        repairable_count: 0,
      },
    };
  }

  const paths = planningPaths(projectDir);
  const planBase = join(projectDir, '.planning');
  const projectPath = join(planBase, 'PROJECT.md');
  const roadmapPath = join(planBase, 'ROADMAP.md');
  const statePath = join(planBase, 'STATE.md');
  const configPath = join(planBase, 'config.json');
  const phasesDir = join(planBase, 'phases');

  interface Issue {
    code: string;
    message: string;
    fix: string;
    repairable: boolean;
  }
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const info: Issue[] = [];
  const repairs: string[] = [];

  const addIssue = (severity: 'error' | 'warning' | 'info', code: string, message: string, fix: string, repairable = false) => {
    const issue: Issue = { code, message, fix, repairable };
    if (severity === 'error') errors.push(issue);
    else if (severity === 'warning') warnings.push(issue);
    else info.push(issue);
  };

  // ─── Check 1: .planning/ exists ───────────────────────────────────────────
  if (!existsSync(planBase)) {
    addIssue('error', 'E001', '.planning/ directory not found', 'Run /gsd-new-project to initialize');
    return {
      data: {
        status: 'broken',
        errors,
        warnings,
        info,
        repairable_count: 0,
      },
    };
  }

  // ─── Check 2: PROJECT.md exists and has required sections ─────────────────
  if (!existsSync(projectPath)) {
    addIssue('error', 'E002', 'PROJECT.md not found', 'Run /gsd-new-project to create');
  } else {
    try {
      const content = await readFile(projectPath, 'utf-8');
      const requiredSections = ['## What This Is', '## Core Value', '## Requirements'];
      for (const section of requiredSections) {
        if (!content.includes(section)) {
          addIssue('warning', 'W001', `PROJECT.md missing section: ${section}`, 'Add section manually');
        }
      }
    } catch { /* intentionally empty */ }
  }

  // ─── Check 3: ROADMAP.md exists ───────────────────────────────────────────
  if (!existsSync(roadmapPath)) {
    addIssue('error', 'E003', 'ROADMAP.md not found', 'Run /gsd-new-milestone to create roadmap');
  }

  // ─── Check 4: STATE.md exists and references valid phases ─────────────────
  if (!existsSync(statePath)) {
    addIssue('error', 'E004', 'STATE.md not found', 'Run /gsd-health --repair to regenerate', true);
    repairs.push('regenerateState');
  } else {
    try {
      const stateContent = await readFile(statePath, 'utf-8');
      const phaseRefs = [...stateContent.matchAll(/[Pp]hase\s+(\d+(?:\.\d+)*)/g)].map(m => m[1]);
      const diskPhases = new Set<string>();
      try {
        const entries = await readdir(phasesDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            const m = e.name.match(/^(\d+(?:\.\d+)*)/);
            if (m) diskPhases.add(m[1]);
          }
        }
      } catch { /* intentionally empty */ }

      for (const ref of phaseRefs) {
        const normalizedRef = String(parseInt(ref, 10)).padStart(2, '0');
        if (!diskPhases.has(ref) && !diskPhases.has(normalizedRef) && !diskPhases.has(String(parseInt(ref, 10)))) {
          if (diskPhases.size > 0) {
            addIssue('warning', 'W002',
              `STATE.md references phase ${ref}, but only phases ${[...diskPhases].sort().join(', ')} exist`,
              'Review STATE.md manually');
          }
        }
      }
    } catch { /* intentionally empty */ }
  }

  // ─── Check 5: config.json valid JSON + valid schema ───────────────────────
  if (!existsSync(configPath)) {
    addIssue('warning', 'W003', 'config.json not found', 'Run /gsd-health --repair to create with defaults', true);
    repairs.push('createConfig');
  } else {
    try {
      const raw = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const validProfiles = ['quality', 'balanced', 'budget', 'inherit'];
      if (parsed.model_profile && !validProfiles.includes(parsed.model_profile as string)) {
        addIssue('warning', 'W004', `config.json: invalid model_profile "${parsed.model_profile}"`, `Valid values: ${validProfiles.join(', ')}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addIssue('error', 'E005', `config.json: JSON parse error - ${msg}`, 'Run /gsd-health --repair to reset to defaults', true);
      repairs.push('resetConfig');
    }
  }

  // ─── Check 5b: Nyquist validation key presence ──────────────────────────
  if (existsSync(configPath)) {
    try {
      const configRaw = await readFile(configPath, 'utf-8');
      const configParsed = JSON.parse(configRaw) as Record<string, unknown>;
      const workflow = configParsed.workflow as Record<string, unknown> | undefined;
      if (workflow && workflow.nyquist_validation === undefined) {
        addIssue('warning', 'W008', 'config.json: workflow.nyquist_validation absent (defaults to enabled but agents may skip)', 'Run /gsd-health --repair to add key', true);
        if (!repairs.includes('addNyquistKey')) repairs.push('addNyquistKey');
      }
    } catch { /* intentionally empty */ }
  }

  // ─── Check 6: Phase directory naming (NN-name format) ─────────────────────
  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.match(/^\d{2}(?:\.\d+)*-[\w-]+$/)) {
        addIssue('warning', 'W005', `Phase directory "${e.name}" doesn't follow NN-name format`, 'Rename to match pattern (e.g., 01-setup)');
      }
    }
  } catch { /* intentionally empty */ }

  // ─── Check 7: Orphaned plans (PLAN without SUMMARY) ───────────────────────
  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const phaseFiles = await readdir(join(phasesDir, e.name));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      const summaryBases = new Set(summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '')));

      for (const plan of plans) {
        const planBase2 = plan.replace('-PLAN.md', '').replace('PLAN.md', '');
        if (!summaryBases.has(planBase2)) {
          addIssue('info', 'I001', `${e.name}/${plan} has no SUMMARY.md`, 'May be in progress');
        }
      }
    }
  } catch { /* intentionally empty */ }

  // ─── Check 7b: Nyquist VALIDATION.md consistency ────────────────────────
  try {
    const phaseEntries = await readdir(phasesDir, { withFileTypes: true });
    for (const e of phaseEntries) {
      if (!e.isDirectory()) continue;
      const phaseFiles = await readdir(join(phasesDir, e.name));
      const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md'));
      const hasValidation = phaseFiles.some(f => f.endsWith('-VALIDATION.md'));
      if (hasResearch && !hasValidation) {
        const researchFile = phaseFiles.find(f => f.endsWith('-RESEARCH.md'));
        if (researchFile) {
          try {
            const researchContent = await readFile(join(phasesDir, e.name, researchFile), 'utf-8');
            if (researchContent.includes('## Validation Architecture')) {
              addIssue('warning', 'W009', `Phase ${e.name}: has Validation Architecture in RESEARCH.md but no VALIDATION.md`, 'Re-run /gsd-plan-phase with --research to regenerate');
            }
          } catch { /* intentionally empty */ }
        }
      }
    }
  } catch { /* intentionally empty */ }

  // ─── Check 8: ROADMAP/disk phase sync ─────────────────────────────────────
  if (existsSync(roadmapPath)) {
    try {
      const roadmapContent = await readFile(roadmapPath, 'utf-8');
      const roadmapPhases = new Set<string>();
      const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
      let m: RegExpExecArray | null;
      while ((m = phasePattern.exec(roadmapContent)) !== null) {
        roadmapPhases.add(m[1]);
      }

      const diskPhases = new Set<string>();
      try {
        const entries = await readdir(phasesDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            const dm = e.name.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
            if (dm) diskPhases.add(dm[1]);
          }
        }
      } catch { /* intentionally empty */ }

      for (const p of roadmapPhases) {
        const padded = String(parseInt(p, 10)).padStart(2, '0');
        if (!diskPhases.has(p) && !diskPhases.has(padded)) {
          addIssue('warning', 'W006', `Phase ${p} in ROADMAP.md but no directory on disk`, 'Create phase directory or remove from roadmap');
        }
      }

      for (const p of diskPhases) {
        const unpadded = String(parseInt(p, 10));
        if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
          addIssue('warning', 'W007', `Phase ${p} exists on disk but not in ROADMAP.md`, 'Add to roadmap or remove directory');
        }
      }
    } catch { /* intentionally empty */ }
  }

  // ─── Check 9: STATE.md / ROADMAP.md cross-validation ─────────────────────
  if (existsSync(statePath) && existsSync(roadmapPath)) {
    try {
      const stateContent = await readFile(statePath, 'utf-8');
      const roadmapContentFull = await readFile(roadmapPath, 'utf-8');

      const currentPhaseMatch = stateContent.match(/\*\*Current Phase:\*\*\s*(\S+)/i) ||
                                 stateContent.match(/Current Phase:\s*(\S+)/i);
      if (currentPhaseMatch) {
        const statePhase = currentPhaseMatch[1].replace(/^0+/, '');
        const phaseCheckboxRe = new RegExp(`-\\s*\\[x\\].*Phase\\s+0*${escapeRegex(statePhase)}[:\\s]`, 'i');
        if (phaseCheckboxRe.test(roadmapContentFull)) {
          const stateStatus = stateContent.match(/\*\*Status:\*\*\s*(.+)/i);
          const statusVal = stateStatus ? stateStatus[1].trim().toLowerCase() : '';
          if (statusVal !== 'complete' && statusVal !== 'done') {
            addIssue('warning', 'W011',
              `STATE.md says current phase is ${statePhase} (status: ${statusVal || 'unknown'}) but ROADMAP.md shows it as [x] complete — state files may be out of sync`,
              'Run /gsd-progress to re-derive current position, or manually update STATE.md');
          }
        }
      }
    } catch { /* intentionally empty */ }
  }

  // ─── Check 10: Config field validation ────────────────────────────────────
  if (existsSync(configPath)) {
    try {
      const configRaw = await readFile(configPath, 'utf-8');
      const configParsed = JSON.parse(configRaw) as Record<string, unknown>;

      const validStrategies = ['none', 'phase', 'milestone'];
      const bs = configParsed.branching_strategy as string | undefined;
      if (bs && !validStrategies.includes(bs)) {
        addIssue('warning', 'W012',
          `config.json: invalid branching_strategy "${bs}"`,
          `Valid values: ${validStrategies.join(', ')}`);
      }

      if (configParsed.context_window !== undefined) {
        const cw = configParsed.context_window;
        if (typeof cw !== 'number' || cw <= 0 || !Number.isInteger(cw)) {
          addIssue('warning', 'W013',
            `config.json: context_window should be a positive integer, got "${cw}"`,
            'Set to 200000 (default) or 1000000 (for 1M models)');
        }
      }

      const pbt = configParsed.phase_branch_template as string | undefined;
      if (pbt && !pbt.includes('{phase}')) {
        addIssue('warning', 'W014',
          'config.json: phase_branch_template missing {phase} placeholder',
          'Template must include {phase} for phase number substitution');
      }
      const mbt = configParsed.milestone_branch_template as string | undefined;
      if (mbt && !mbt.includes('{milestone}')) {
        addIssue('warning', 'W015',
          'config.json: milestone_branch_template missing {milestone} placeholder',
          'Template must include {milestone} for version substitution');
      }
    } catch { /* parse error already caught in Check 5 */ }
  }

  // ─── Perform repairs if requested ─────────────────────────────────────────
  const repairActions: Array<{ action: string; success: boolean; path?: string; error?: string }> = [];
  if (doRepair && repairs.length > 0) {
    for (const repair of repairs) {
      try {
        switch (repair) {
          case 'createConfig':
          case 'resetConfig': {
            // T-12-11: Write known-safe defaults only
            const defaults = {
              model_profile: 'balanced',
              commit_docs: false,
              search_gitignored: false,
              branching_strategy: 'none',
              phase_branch_template: 'feat/phase-{phase}',
              milestone_branch_template: 'feat/{milestone}',
              quick_branch_template: 'fix/{slug}',
              workflow: {
                research: true,
                plan_check: true,
                verifier: true,
                nyquist_validation: true,
              },
              parallelization: 1,
              brave_search: false,
            };
            await writeFile(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
            repairActions.push({ action: repair, success: true, path: 'config.json' });
            break;
          }
          case 'regenerateState': {
            // Generate minimal STATE.md from ROADMAP.md structure
            let milestoneName = 'Unknown';
            let milestoneVersion = 'v1.0';
            try {
              const roadmapContent = await readFile(roadmapPath, 'utf-8');
              const milestoneMatch = roadmapContent.match(/##\s+(?:Current\s+)?Milestone[:\s]+(\S+)\s*[-—]\s*(.+)/i);
              if (milestoneMatch) {
                milestoneVersion = milestoneMatch[1];
                milestoneName = milestoneMatch[2].trim();
              }
            } catch { /* intentionally empty */ }

            let stateContent = `# Session State\n\n`;
            stateContent += `## Project Reference\n\n`;
            stateContent += `See: .planning/PROJECT.md\n\n`;
            stateContent += `## Position\n\n`;
            stateContent += `**Milestone:** ${milestoneVersion} ${milestoneName}\n`;
            stateContent += `**Current phase:** (determining...)\n`;
            stateContent += `**Status:** Resuming\n\n`;
            stateContent += `## Session Log\n\n`;
            stateContent += `- ${new Date().toISOString().split('T')[0]}: STATE.md regenerated by /gsd-health --repair\n`;
            await writeFile(statePath, stateContent, 'utf-8');
            repairActions.push({ action: repair, success: true, path: 'STATE.md' });
            break;
          }
          case 'addNyquistKey': {
            if (existsSync(configPath)) {
              try {
                const configRaw = await readFile(configPath, 'utf-8');
                const configParsed = JSON.parse(configRaw) as Record<string, unknown>;
                if (!configParsed.workflow) configParsed.workflow = {};
                const wf = configParsed.workflow as Record<string, unknown>;
                if (wf.nyquist_validation === undefined) {
                  wf.nyquist_validation = true;
                  await writeFile(configPath, JSON.stringify(configParsed, null, 2), 'utf-8');
                }
                repairActions.push({ action: repair, success: true, path: 'config.json' });
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                repairActions.push({ action: repair, success: false, error: msg });
              }
            }
            break;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        repairActions.push({ action: repair, success: false, error: msg });
      }
    }
  }

  // ─── Determine overall status ─────────────────────────────────────────────
  let status: string;
  if (errors.length > 0) {
    status = 'broken';
  } else if (warnings.length > 0) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  const repairableCount = errors.filter(e => e.repairable).length +
                         warnings.filter(w => w.repairable).length;

  return {
    data: {
      status,
      errors,
      warnings,
      info,
      repairable_count: repairableCount,
      repairs_performed: repairActions.length > 0 ? repairActions : undefined,
    },
  };
};

// ─── validateAgents ────────────────────────────────────────────────────────

/**
 * Default agents directory — mirrors `getAgentsDir` in `get-shit-done/bin/lib/core.cjs`:
 * `GSD_AGENTS_DIR`, else `../../../agents` relative to this module (`sdk/dist/query` → monorepo
 * root), matching `core.cjs` (`get-shit-done/bin/lib` → same repo `agents/`).
 */
function getAgentsDirForValidateAgents(): string {
  if (process.env.GSD_AGENTS_DIR) return process.env.GSD_AGENTS_DIR;
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..', 'agents');
}

/**
 * Validate GSD agent file installation under the managed agents directory.
 *
 * Port of `cmdValidateAgents` from `verify.cjs` lines 997–1009 (uses `checkAgentsInstalled` from core).
 */
export const validateAgents: QueryHandler = async (_args, _projectDir) => {
  const agentsDir = getAgentsDirForValidateAgents();
  const expected = Object.keys(MODEL_PROFILES);
  const installed: string[] = [];
  const missing: string[] = [];

  if (!existsSync(agentsDir)) {
    return {
      data: {
        agents_dir: agentsDir,
        agents_found: false,
        installed: [] as string[],
        missing: expected,
        expected,
      },
    };
  }

  for (const agent of expected) {
    const agentFile = join(agentsDir, `${agent}.md`);
    const agentFileCopilot = join(agentsDir, `${agent}.agent.md`);
    if (existsSync(agentFile) || existsSync(agentFileCopilot)) {
      installed.push(agent);
    } else {
      missing.push(agent);
    }
  }

  const agentsInstalled = installed.length > 0 && missing.length === 0;
  return {
    data: {
      agents_dir: agentsDir,
      agents_found: agentsInstalled,
      installed,
      missing,
      expected,
    },
  };
};
