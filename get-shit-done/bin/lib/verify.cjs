/**
 * Verify — Verification suite, consistency, and health validation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { safeReadFile, loadConfig, normalizePhaseName, escapeRegex, execGit, findPhaseInternal, getMilestoneInfo, stripShippedMilestones, extractCurrentMilestone, output, error, checkAgentsInstalled, CONFIG_DEFAULTS, inspectWorktreeHealth } = require('./core.cjs');
const { planningDir } = require('./planning-workspace.cjs');
const { extractFrontmatter, parseMustHavesBlock } = require('./frontmatter.cjs');
const { writeStateMd } = require('./state.cjs');

function cmdVerifySummary(cwd, summaryPath, checkFileCount, raw) {
  if (!summaryPath) {
    error('summary-path required');
  }

  const fullPath = path.join(cwd, summaryPath);
  const checkCount = checkFileCount || 2;

  // Check 1: Summary exists
  if (!fs.existsSync(fullPath)) {
    const result = {
      passed: false,
      checks: {
        summary_exists: false,
        files_created: { checked: 0, found: 0, missing: [] },
        commits_exist: false,
        self_check: 'not_found',
      },
      errors: ['SUMMARY.md not found'],
    };
    output(result, raw, 'failed');
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const errors = [];

  // Check 2: Spot-check files mentioned in summary
  const mentionedFiles = new Set();
  const patterns = [
    /`([^`]+\.[a-zA-Z]+)`/g,
    /(?:Created|Modified|Added|Updated|Edited):\s*`?([^\s`]+\.[a-zA-Z]+)`?/gi,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) {
      const filePath = m[1];
      if (filePath && !filePath.startsWith('http') && filePath.includes('/')) {
        mentionedFiles.add(filePath);
      }
    }
  }

  const filesToCheck = Array.from(mentionedFiles).slice(0, checkCount);
  const missing = [];
  for (const file of filesToCheck) {
    if (!fs.existsSync(path.join(cwd, file))) {
      missing.push(file);
    }
  }

  // Check 3: Commits exist
  const commitHashPattern = /\b[0-9a-f]{7,40}\b/g;
  const hashes = content.match(commitHashPattern) || [];
  let commitsExist = false;
  if (hashes.length > 0) {
    for (const hash of hashes.slice(0, 3)) {
      const result = execGit(cwd, ['cat-file', '-t', hash]);
      if (result.exitCode === 0 && result.stdout === 'commit') {
        commitsExist = true;
        break;
      }
    }
  }

  // Check 4: Self-check section
  let selfCheck = 'not_found';
  const selfCheckPattern = /##\s*(?:Self[- ]?Check|Verification|Quality Check)/i;
  if (selfCheckPattern.test(content)) {
    const passPattern = /(?:all\s+)?(?:pass|✓|✅|complete|succeeded)/i;
    const failPattern = /(?:fail|✗|❌|incomplete|blocked)/i;
    const checkSection = content.slice(content.search(selfCheckPattern));
    if (failPattern.test(checkSection)) {
      selfCheck = 'failed';
    } else if (passPattern.test(checkSection)) {
      selfCheck = 'passed';
    }
  }

  if (missing.length > 0) errors.push('Missing files: ' + missing.join(', '));
  if (!commitsExist && hashes.length > 0) errors.push('Referenced commit hashes not found in git history');
  if (selfCheck === 'failed') errors.push('Self-check section indicates failure');

  const checks = {
    summary_exists: true,
    files_created: { checked: filesToCheck.length, found: filesToCheck.length - missing.length, missing },
    commits_exist: commitsExist,
    self_check: selfCheck,
  };

  const passed = missing.length === 0 && selfCheck !== 'failed';
  const result = { passed, checks, errors };
  output(result, raw, passed ? 'passed' : 'failed');
}

function cmdVerifyPlanStructure(cwd, filePath, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }

  const fm = extractFrontmatter(content);
  const errors = [];
  const warnings = [];

  // Check required frontmatter fields
  const required = ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'];
  for (const field of required) {
    if (fm[field] === undefined) errors.push(`Missing required frontmatter field: ${field}`);
  }

  // Parse and check task elements
  const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks = [];
  let taskMatch;
  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const taskContent = taskMatch[1];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const taskName = nameMatch ? nameMatch[1].trim() : 'unnamed';
    const hasFiles = /<files>/.test(taskContent);
    const hasAction = /<action>/.test(taskContent);
    const hasVerify = /<verify>/.test(taskContent);
    const hasDone = /<done>/.test(taskContent);

    if (!nameMatch) errors.push('Task missing <name> element');
    if (!hasAction) errors.push(`Task '${taskName}' missing <action>`);
    if (!hasVerify) warnings.push(`Task '${taskName}' missing <verify>`);
    if (!hasDone) warnings.push(`Task '${taskName}' missing <done>`);
    if (!hasFiles) warnings.push(`Task '${taskName}' missing <files>`);

    tasks.push({ name: taskName, hasFiles, hasAction, hasVerify, hasDone });
  }

  if (tasks.length === 0) warnings.push('No <task> elements found');

  // Wave/depends_on consistency
  if (fm.wave && parseInt(fm.wave) > 1 && (!fm.depends_on || (Array.isArray(fm.depends_on) && fm.depends_on.length === 0))) {
    warnings.push('Wave > 1 but depends_on is empty');
  }

  // Autonomous/checkpoint consistency
  const hasCheckpoints = /<task\s+type=["']?checkpoint/.test(content);
  if (hasCheckpoints && fm.autonomous !== 'false' && fm.autonomous !== false) {
    errors.push('Has checkpoint tasks but autonomous is not false');
  }

  output({
    valid: errors.length === 0,
    errors,
    warnings,
    task_count: tasks.length,
    tasks,
    frontmatter_fields: Object.keys(fm),
  }, raw, errors.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyPhaseCompleteness(cwd, phase, raw) {
  if (!phase) { error('phase required'); }
  const phaseInfo = findPhaseInternal(cwd, phase);
  if (!phaseInfo || !phaseInfo.found) {
    output({ error: 'Phase not found', phase }, raw);
    return;
  }

  const errors = [];
  const warnings = [];
  const phaseDir = path.join(cwd, phaseInfo.directory);

  // List plans and summaries
  let files;
  try { files = fs.readdirSync(phaseDir); } catch { output({ error: 'Cannot read phase directory' }, raw); return; }

  const plans = files.filter(f => f.match(/-PLAN\.md$/i));
  const summaries = files.filter(f => f.match(/-SUMMARY\.md$/i));

  // Extract plan IDs (everything before -PLAN.md)
  const planIds = new Set(plans.map(p => p.replace(/-PLAN\.md$/i, '')));
  const summaryIds = new Set(summaries.map(s => s.replace(/-SUMMARY\.md$/i, '')));

  // Plans without summaries
  const incompletePlans = [...planIds].filter(id => !summaryIds.has(id));
  if (incompletePlans.length > 0) {
    errors.push(`Plans without summaries: ${incompletePlans.join(', ')}`);
  }

  // Summaries without plans (orphans)
  const orphanSummaries = [...summaryIds].filter(id => !planIds.has(id));
  if (orphanSummaries.length > 0) {
    warnings.push(`Summaries without plans: ${orphanSummaries.join(', ')}`);
  }

  output({
    complete: errors.length === 0,
    phase: phaseInfo.phase_number,
    plan_count: plans.length,
    summary_count: summaries.length,
    incomplete_plans: incompletePlans,
    orphan_summaries: orphanSummaries,
    errors,
    warnings,
  }, raw, errors.length === 0 ? 'complete' : 'incomplete');
}

function cmdVerifyReferences(cwd, filePath, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }

  const found = [];
  const missing = [];

  // Find @-references: @path/to/file (must contain / to be a file path)
  const atRefs = content.match(/@([^\s\n,)]+\/[^\s\n,)]+)/g) || [];
  for (const ref of atRefs) {
    const cleanRef = ref.slice(1); // remove @
    const resolved = cleanRef.startsWith('~/')
      ? path.join(process.env.HOME || '', cleanRef.slice(2))
      : path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) {
      found.push(cleanRef);
    } else {
      missing.push(cleanRef);
    }
  }

  // Find backtick file paths that look like real paths (contain / and have extension)
  const backtickRefs = content.match(/`([^`]+\/[^`]+\.[a-zA-Z]{1,10})`/g) || [];
  for (const ref of backtickRefs) {
    const cleanRef = ref.slice(1, -1); // remove backticks
    if (cleanRef.startsWith('http') || cleanRef.includes('${') || cleanRef.includes('{{')) continue;
    if (found.includes(cleanRef) || missing.includes(cleanRef)) continue; // dedup
    const resolved = path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) {
      found.push(cleanRef);
    } else {
      missing.push(cleanRef);
    }
  }

  output({
    valid: missing.length === 0,
    found: found.length,
    missing,
    total: found.length + missing.length,
  }, raw, missing.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyCommits(cwd, hashes, raw) {
  if (!hashes || hashes.length === 0) { error('At least one commit hash required'); }

  const valid = [];
  const invalid = [];
  for (const hash of hashes) {
    const result = execGit(cwd, ['cat-file', '-t', hash]);
    if (result.exitCode === 0 && result.stdout.trim() === 'commit') {
      valid.push(hash);
    } else {
      invalid.push(hash);
    }
  }

  output({
    all_valid: invalid.length === 0,
    valid,
    invalid,
    total: hashes.length,
  }, raw, invalid.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyArtifacts(cwd, planFilePath, raw) {
  if (!planFilePath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const artifacts = parseMustHavesBlock(content, 'artifacts');
  if (artifacts.length === 0) {
    output({ error: 'No must_haves.artifacts found in frontmatter', path: planFilePath }, raw);
    return;
  }

  const results = [];
  for (const artifact of artifacts) {
    if (typeof artifact === 'string') continue; // skip simple string items
    const artPath = artifact.path;
    if (!artPath) continue;

    const artFullPath = path.join(cwd, artPath);
    const exists = fs.existsSync(artFullPath);
    const check = { path: artPath, exists, issues: [], passed: false };

    if (exists) {
      const fileContent = safeReadFile(artFullPath) || '';
      const lineCount = fileContent.split('\n').length;

      if (artifact.min_lines && lineCount < artifact.min_lines) {
        check.issues.push(`Only ${lineCount} lines, need ${artifact.min_lines}`);
      }
      if (artifact.contains && !fileContent.includes(artifact.contains)) {
        check.issues.push(`Missing pattern: ${artifact.contains}`);
      }
      if (artifact.exports) {
        const exports = Array.isArray(artifact.exports) ? artifact.exports : [artifact.exports];
        for (const exp of exports) {
          if (!fileContent.includes(exp)) check.issues.push(`Missing export: ${exp}`);
        }
      }
      check.passed = check.issues.length === 0;
    } else {
      check.issues.push('File not found');
    }

    results.push(check);
  }

  const passed = results.filter(r => r.passed).length;
  output({
    all_passed: passed === results.length,
    passed,
    total: results.length,
    artifacts: results,
  }, raw, passed === results.length ? 'valid' : 'invalid');
}

function cmdVerifyKeyLinks(cwd, planFilePath, raw) {
  if (!planFilePath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const keyLinks = parseMustHavesBlock(content, 'key_links');
  if (keyLinks.length === 0) {
    output({ error: 'No must_haves.key_links found in frontmatter', path: planFilePath }, raw);
    return;
  }

  const results = [];
  for (const link of keyLinks) {
    if (typeof link === 'string') continue;
    const check = { from: link.from, to: link.to, via: link.via || '', verified: false, detail: '' };

    const sourceContent = safeReadFile(path.join(cwd, link.from || ''));
    if (!sourceContent) {
      check.detail = 'Source file not found';
    } else if (link.pattern) {
      try {
        const regex = new RegExp(link.pattern);
        if (regex.test(sourceContent)) {
          check.verified = true;
          check.detail = 'Pattern found in source';
        } else {
          const targetContent = safeReadFile(path.join(cwd, link.to || ''));
          if (targetContent && regex.test(targetContent)) {
            check.verified = true;
            check.detail = 'Pattern found in target';
          } else {
            check.detail = `Pattern "${link.pattern}" not found in source or target`;
          }
        }
      } catch {
        check.detail = `Invalid regex pattern: ${link.pattern}`;
      }
    } else {
      // No pattern: just check source references target
      if (sourceContent.includes(link.to || '')) {
        check.verified = true;
        check.detail = 'Target referenced in source';
      } else {
        check.detail = 'Target not referenced in source';
      }
    }

    results.push(check);
  }

  const verified = results.filter(r => r.verified).length;
  output({
    all_verified: verified === results.length,
    verified,
    total: results.length,
    links: results,
  }, raw, verified === results.length ? 'valid' : 'invalid');
}

const PHASE_TOKEN_FROM_DIR_RE = /^(?:[A-Z]{1,6}-)?(\d+[A-Z]?(?:\.\d+)*)(?:-|$)/i;
const MILESTONE_ARCHIVE_DIR_RE = /^v\d+.*-phases$/i;

function listMilestoneArchiveDirs(planBase) {
  const milestonesDir = path.join(planBase, 'milestones');
  try {
    return fs.readdirSync(milestonesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && MILESTONE_ARCHIVE_DIR_RE.test(e.name))
      .map((e) => path.join(milestonesDir, e.name))
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }));
  } catch {
    return [];
  }
}

function getActiveMilestoneArchiveDir(planBase) {
  const archiveDirs = listMilestoneArchiveDirs(planBase);
  if (archiveDirs.length === 0) return null;

  // Prefer STATE.md milestone when it maps to an on-disk archive dir.
  try {
    const statePath = path.join(planBase, 'STATE.md');
    if (fs.existsSync(statePath)) {
      const state = fs.readFileSync(statePath, 'utf-8');
      const m = state.match(/^\s*(?:\*\*)?milestone(?:\*\*)?:\s*([^\s\r\n#]+).*$/mi);
      if (m && m[1]) {
        const milestone = m[1].trim();
        const candidate = path.join(planBase, 'milestones', `${milestone}-phases`);
        if (archiveDirs.includes(candidate)) return candidate;
      }
    }
  } catch { /* intentionally empty */ }

  // Fallback when STATE.md is absent/stale: highest (most recent) archive by version-ish name.
  return archiveDirs[archiveDirs.length - 1];
}

function collectPhaseRoots(planBase) {
  const roots = [];
  const flatPhasesDir = path.join(planBase, 'phases');
  if (fs.existsSync(flatPhasesDir)) roots.push(flatPhasesDir);
  const activeArchive = getActiveMilestoneArchiveDir(planBase);
  if (activeArchive) roots.push(activeArchive);
  return roots;
}

// Returns a Set of phase numbers found on disk across active phase roots.
function collectDiskPhases(planBase) {
  const diskPhases = new Set();
  const phaseRoots = collectPhaseRoots(planBase);
  const scanDir = (dir) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          const m = e.name.match(PHASE_TOKEN_FROM_DIR_RE);
          if (m) diskPhases.add(m[1]);
        }
      }
    } catch { /* dir absent */ }
  };

  for (const root of phaseRoots) scanDir(root);

  return diskPhases;
}

function cmdValidateConsistency(cwd, raw) {
  const planBase = planningDir(cwd);
  const roadmapPath = path.join(planBase, 'ROADMAP.md');
  const errors = [];
  const warnings = [];

  // Check for ROADMAP
  if (!fs.existsSync(roadmapPath)) {
    errors.push('ROADMAP.md not found');
    output({ passed: false, errors, warnings }, raw, 'failed');
    return;
  }

  const roadmapContentRaw = fs.readFileSync(roadmapPath, 'utf-8');
  const roadmapContent = extractCurrentMilestone(roadmapContentRaw, cwd);

  // Extract phases from ROADMAP (archived milestones already stripped)
  const roadmapPhases = new Set();
  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
  let m;
  while ((m = phasePattern.exec(roadmapContent)) !== null) {
    roadmapPhases.add(m[1]);
  }

  // Get phases on disk (flat layout + milestone-archive layout)
  const diskPhases = collectDiskPhases(planBase);

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

  // Check: sequential phase numbers (integers only, skip in custom naming mode)
  const config = loadConfig(cwd);
  if (config.phase_naming !== 'custom') {
    const integerPhases = [...diskPhases]
      .filter(p => !p.includes('.'))
      .map(p => parseInt(p, 10))
      .sort((a, b) => a - b);

    for (let i = 1; i < integerPhases.length; i++) {
      if (integerPhases[i] !== integerPhases[i - 1] + 1) {
        warnings.push(`Gap in phase numbering: ${integerPhases[i - 1]} → ${integerPhases[i]}`);
      }
    }
  }

  const phaseRoots = collectPhaseRoots(planBase);
  for (const phaseRoot of phaseRoots) {
    try {
      const entries = fs.readdirSync(phaseRoot, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

      for (const dir of dirs) {
        const phasePath = path.join(phaseRoot, dir);
        const phaseLabel = path.relative(planBase, phasePath).replace(/\\/g, '/');
        const phaseFiles = fs.readdirSync(phasePath);
        const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md')).sort();

        // Extract plan numbers
        const planNums = plans.map(p => {
          const pm = p.match(/-(\d{2})-PLAN\.md$/);
          return pm ? parseInt(pm[1], 10) : null;
        }).filter(n => n !== null);

        for (let i = 1; i < planNums.length; i++) {
          if (planNums[i] !== planNums[i - 1] + 1) {
            warnings.push(`Gap in plan numbering in ${phaseLabel}: plan ${planNums[i - 1]} → ${planNums[i]}`);
          }
        }

        // Check: plans without summaries (completed plans)
        const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md'));
        const planIds = new Set(plans.map(p => p.replace('-PLAN.md', '')));
        const summaryIds = new Set(summaries.map(s => s.replace('-SUMMARY.md', '')));

        // Summary without matching plan is suspicious
        for (const sid of summaryIds) {
          if (!planIds.has(sid)) {
            warnings.push(`Summary ${sid}-SUMMARY.md in ${phaseLabel} has no matching PLAN.md`);
          }
        }

        // Check: frontmatter in plans has required fields
        for (const plan of plans) {
          const content = fs.readFileSync(path.join(phasePath, plan), 'utf-8');
          const fm = extractFrontmatter(content);
          if (!fm.wave) {
            warnings.push(`${phaseLabel}/${plan}: missing 'wave' in frontmatter`);
          }
        }
      }
    } catch { /* intentionally empty */ }
  }

  const passed = errors.length === 0;
  output({ passed, errors, warnings, warning_count: warnings.length }, raw, passed ? 'passed' : 'failed');
}

function cmdValidateHealth(cwd, options, raw) {
  // Guard: detect if CWD is the home directory (likely accidental)
  const resolved = path.resolve(cwd);
  if (resolved === os.homedir()) {
    output({
      status: 'error',
      errors: [{ code: 'E010', message: `CWD is home directory (${resolved}) — health check would read the wrong .planning/ directory. Run from your project root instead.`, fix: 'cd into your project directory and retry' }],
      warnings: [],
      info: [{ code: 'I010', message: `Resolved CWD: ${resolved}` }],
      repairable_count: 0,
    }, raw);
    return;
  }

  const planBase = planningDir(cwd);
  const projectPath = path.join(planBase, 'PROJECT.md');
  const roadmapPath = path.join(planBase, 'ROADMAP.md');
  const statePath = path.join(planBase, 'STATE.md');
  const configPath = path.join(planBase, 'config.json');
  const phasesDir = path.join(planBase, 'phases');

  const errors = [];
  const warnings = [];
  const info = [];
  const repairs = [];

  // Helper to add issue
  const addIssue = (severity, code, message, fix, repairable = false) => {
    const issue = { code, message, fix, repairable };
    if (severity === 'error') errors.push(issue);
    else if (severity === 'warning') warnings.push(issue);
    else info.push(issue);
  };

  // ─── Check 1: .planning/ exists ───────────────────────────────────────────
  if (!fs.existsSync(planBase)) {
    addIssue('error', 'E001', '.planning/ directory not found', 'Run /gsd-new-project to initialize');
    output({
      status: 'broken',
      errors,
      warnings,
      info,
      repairable_count: 0,
    }, raw);
    return;
  }

  // ─── Check 2: PROJECT.md exists and has required sections ─────────────────
  if (!fs.existsSync(projectPath)) {
    addIssue('error', 'E002', 'PROJECT.md not found', 'Run /gsd-new-project to create');
  } else {
    const content = fs.readFileSync(projectPath, 'utf-8');
    const requiredSections = ['## What This Is', '## Core Value', '## Requirements'];
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        addIssue('warning', 'W001', `PROJECT.md missing section: ${section}`, 'Add section manually');
      }
    }
  }

  // ─── Check 3: ROADMAP.md exists ───────────────────────────────────────────
  if (!fs.existsSync(roadmapPath)) {
    addIssue('error', 'E003', 'ROADMAP.md not found', 'Run /gsd-new-milestone to create roadmap');
  }

  // ─── Check 4: STATE.md exists and references valid phases ─────────────────
  if (!fs.existsSync(statePath)) {
    addIssue('error', 'E004', 'STATE.md not found', 'Run /gsd-health --repair to regenerate', true);
    repairs.push('regenerateState');
  } else {
    const stateContent = fs.readFileSync(statePath, 'utf-8');
    // Extract phase references from STATE.md
    const phaseRefs = [...stateContent.matchAll(/[Pp]hase\s+(\d+[A-Z]?(?:\.\d+)*)/g)].map(m => m[1]);
    // Bug #2633 — ROADMAP.md is the authority for which phases are valid.
    // STATE.md may legitimately reference current-milestone future phases
    // (not yet materialized on disk) and shipped-milestone history phases
    // (archived / cleared off disk). Matching only against on-disk dirs
    // produces false W002 warnings in both cases.
    const validPhases = collectDiskPhases(planBase);
    // Union in every phase declared anywhere in ROADMAP.md (current + shipped + backlog).
    try {
      if (fs.existsSync(roadmapPath)) {
        const roadmapRaw = fs.readFileSync(roadmapPath, 'utf-8');
        const all = [...roadmapRaw.matchAll(/#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)/gi)];
        for (const m of all) validPhases.add(m[1]);
      }
    } catch { /* intentionally empty */ }
    // Compare canonical full phase tokens. Also accept a leading-zero variant
    // on the integer prefix only (e.g. "03" matching "3", "03.1" matching
    // "3.1") so historic STATE.md formatting still validates. Suffix tokens
    // like "3A" must match exactly — never collapsed to "3".
    const normalizedValid = new Set();
    for (const p of validPhases) {
      normalizedValid.add(p);
      const dotIdx = p.indexOf('.');
      const head = dotIdx === -1 ? p : p.slice(0, dotIdx);
      const tail = dotIdx === -1 ? '' : p.slice(dotIdx);
      if (/^\d+$/.test(head)) {
        normalizedValid.add(head.padStart(2, '0') + tail);
      }
    }
    // Check for invalid references
    for (const ref of phaseRefs) {
      const dotIdx = ref.indexOf('.');
      const head = dotIdx === -1 ? ref : ref.slice(0, dotIdx);
      const tail = dotIdx === -1 ? '' : ref.slice(dotIdx);
      const padded = /^\d+$/.test(head) ? head.padStart(2, '0') + tail : ref;
      if (!normalizedValid.has(ref) && !normalizedValid.has(padded)) {
        // Only warn if we know any valid phases (not just an empty project)
        if (normalizedValid.size > 0) {
          addIssue(
            'warning',
            'W002',
            `STATE.md references phase ${ref}, but only phases ${[...validPhases].sort().join(', ')} are declared`,
            'Review STATE.md manually before changing it; /gsd-health --repair will not overwrite an existing STATE.md for phase mismatches'
          );
        }
      }
    }
  }

  // ─── Check 5: config.json valid JSON + valid schema ───────────────────────
  if (!fs.existsSync(configPath)) {
    addIssue('warning', 'W003', 'config.json not found', 'Run /gsd-health --repair to create with defaults', true);
    repairs.push('createConfig');
  } else {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      // Validate known fields
      const validProfiles = ['quality', 'balanced', 'budget', 'inherit'];
      if (parsed.model_profile && !validProfiles.includes(parsed.model_profile)) {
        addIssue('warning', 'W004', `config.json: invalid model_profile "${parsed.model_profile}"`, `Valid values: ${validProfiles.join(', ')}`);
      }
    } catch (err) {
      addIssue('error', 'E005', `config.json: JSON parse error - ${err.message}`, 'Run /gsd-health --repair to reset to defaults', true);
      repairs.push('resetConfig');
    }
  }

  // ─── Check 5b: Nyquist validation key presence ──────────────────────────
  if (fs.existsSync(configPath)) {
    try {
      const configRaw = fs.readFileSync(configPath, 'utf-8');
      const configParsed = JSON.parse(configRaw);
      if (configParsed.workflow && configParsed.workflow.nyquist_validation === undefined) {
        addIssue('warning', 'W008', 'config.json: workflow.nyquist_validation absent (defaults to enabled but agents may skip)', 'Run /gsd-health --repair to add key', true);
        if (!repairs.includes('addNyquistKey')) repairs.push('addNyquistKey');
      }
      if (configParsed.workflow && configParsed.workflow.ai_integration_phase === undefined) {
        addIssue('warning', 'W016', 'config.json: workflow.ai_integration_phase absent (defaults to enabled — run /gsd-ai-integration-phase before planning AI system phases)', 'Run /gsd-health --repair to add key', true);
        if (!repairs.includes('addAiIntegrationPhaseKey')) repairs.push('addAiIntegrationPhaseKey');
      }
    } catch { /* intentionally empty */ }
  }

  // ─── Read phase directories once for checks 6, 7, 7b, and 8 (#1973) ──────
  let phaseDirEntries = [];
  const phaseDirFiles = new Map(); // phase dir name → file list
  try {
    phaseDirEntries = fs.readdirSync(phasesDir, { withFileTypes: true }).filter(e => e.isDirectory());
    for (const e of phaseDirEntries) {
      try {
        phaseDirFiles.set(e.name, fs.readdirSync(path.join(phasesDir, e.name)));
      } catch { phaseDirFiles.set(e.name, []); }
    }
  } catch { /* intentionally empty */ }

  // ─── Check 6: Phase directory naming (NN-name format) ─────────────────────
  for (const e of phaseDirEntries) {
    if (!e.name.match(/^\d{2}(?:\.\d+)*-[\w-]+$/)) {
      addIssue('warning', 'W005', `Phase directory "${e.name}" doesn't follow NN-name format`, 'Rename to match pattern (e.g., 01-setup)');
    }
  }

  // ─── Check 7: Orphaned plans (PLAN without SUMMARY) ───────────────────────
  for (const e of phaseDirEntries) {
    const phaseFiles = phaseDirFiles.get(e.name) || [];
    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
    const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
    const summaryBases = new Set(summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '')));

    for (const plan of plans) {
      const planBase = plan.replace('-PLAN.md', '').replace('PLAN.md', '');
      if (!summaryBases.has(planBase)) {
        addIssue('info', 'I001', `${e.name}/${plan} has no SUMMARY.md`, 'May be in progress');
      }
    }
  }

  // ─── Check 7b: Nyquist VALIDATION.md consistency ────────────────────────
  for (const e of phaseDirEntries) {
    const phaseFiles = phaseDirFiles.get(e.name) || [];
    const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md'));
    const hasValidation = phaseFiles.some(f => f.endsWith('-VALIDATION.md'));
    if (hasResearch && !hasValidation) {
      const researchFile = phaseFiles.find(f => f.endsWith('-RESEARCH.md'));
      try {
        const researchContent = fs.readFileSync(path.join(phasesDir, e.name, researchFile), 'utf-8');
        if (researchContent.includes('## Validation Architecture')) {
          addIssue('warning', 'W009', `Phase ${e.name}: has Validation Architecture in RESEARCH.md but no VALIDATION.md`, 'Re-run /gsd-plan-phase with --research to regenerate');
        }
      } catch { /* intentionally empty */ }
    }
  }

  // ─── Check 7c: Agent installation (#1371) ──────────────────────────────────
  // Verify GSD agents are installed. Missing agents cause Task(subagent_type=...)
  // to silently fall back to general-purpose, losing specialized instructions.
  try {
    const agentStatus = checkAgentsInstalled();
    if (!agentStatus.agents_installed) {
      if (agentStatus.installed_agents.length === 0) {
        addIssue('warning', 'W010',
          `No GSD agents found in ${agentStatus.agents_dir} — Task(subagent_type="gsd-*") will fall back to general-purpose`,
          'Run the GSD installer: npx get-shit-done-cc@latest');
      } else {
        addIssue('warning', 'W010',
          `Missing ${agentStatus.missing_agents.length} GSD agents: ${agentStatus.missing_agents.join(', ')} — affected workflows will fall back to general-purpose`,
          'Run the GSD installer: npx get-shit-done-cc@latest');
      }
    }
  } catch { /* intentionally empty — agent check is non-blocking */ }

  // ─── Check 8: Run existing consistency checks ─────────────────────────────
  // Inline subset of cmdValidateConsistency
  if (fs.existsSync(roadmapPath)) {
    const roadmapContentRaw = fs.readFileSync(roadmapPath, 'utf-8');
    const roadmapContent = extractCurrentMilestone(roadmapContentRaw, cwd);
    const roadmapPhases = new Set();
    const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
    let m;
    while ((m = phasePattern.exec(roadmapContent)) !== null) {
      roadmapPhases.add(m[1]);
    }

    const diskPhases = collectDiskPhases(planBase);

    // Build a set of phases explicitly marked not-yet-started in the ROADMAP
    // summary list (- [ ] **Phase N:**). These phases are intentionally absent
    // from disk -- W006 must not fire for them (#2009).
    const notStartedPhases = new Set();
    const uncheckedPattern = /-\s*\[\s\]\s*\*{0,2}Phase\s+(\d+[A-Z]?(?:\.\d+)*)[:\s*]/gi;
    let um;
    while ((um = uncheckedPattern.exec(roadmapContent)) !== null) {
      notStartedPhases.add(um[1]);
      // Also add zero-padded variant so 1 and 01 both match
      notStartedPhases.add(String(parseInt(um[1], 10)).padStart(2, '0'));
    }

    // Phases in ROADMAP but not on disk
    for (const p of roadmapPhases) {
      const padded = String(parseInt(p, 10)).padStart(2, '0');
      if (!diskPhases.has(p) && !diskPhases.has(padded)) {
        // Skip phases explicitly flagged as not-yet-started in the summary list
        if (notStartedPhases.has(p) || notStartedPhases.has(padded)) continue;
        addIssue('warning', 'W006', `Phase ${p} in ROADMAP.md but no directory on disk`, 'Create phase directory or remove from roadmap');
      }
    }

    // Phases on disk but not in ROADMAP
    for (const p of diskPhases) {
      const unpadded = String(parseInt(p, 10));
      if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
        addIssue('warning', 'W007', `Phase ${p} exists on disk but not in ROADMAP.md`, 'Add to roadmap or remove directory');
      }
    }
  }

  // ─── Check 9: STATE.md / ROADMAP.md cross-validation ─────────────────────
  if (fs.existsSync(statePath) && fs.existsSync(roadmapPath)) {
    try {
      const stateContent = fs.readFileSync(statePath, 'utf-8');
      const roadmapContentFull = fs.readFileSync(roadmapPath, 'utf-8');

      // Extract current phase from STATE.md
      const currentPhaseMatch = stateContent.match(/\*\*Current Phase:\*\*\s*(\S+)/i) ||
                                 stateContent.match(/Current Phase:\s*(\S+)/i);
      if (currentPhaseMatch) {
        const statePhase = currentPhaseMatch[1].replace(/^0+/, '');
        // Check if ROADMAP shows this phase as already complete
        const phaseCheckboxRe = new RegExp(`-\\s*\\[x\\].*Phase\\s+0*${escapeRegex(statePhase)}[:\\s]`, 'i');
        if (phaseCheckboxRe.test(roadmapContentFull)) {
          // STATE says "current" but ROADMAP says "complete" — divergence
          const stateStatus = stateContent.match(/\*\*Status:\*\*\s*(.+)/i);
          const statusVal = stateStatus ? stateStatus[1].trim().toLowerCase() : '';
          if (statusVal !== 'complete' && statusVal !== 'done') {
            addIssue('warning', 'W011',
              `STATE.md says current phase is ${statePhase} (status: ${statusVal || 'unknown'}) but ROADMAP.md shows it as [x] complete — state files may be out of sync`,
              'Run /gsd-progress to re-derive current position, or manually update STATE.md');
          }
        }
      }
    } catch { /* intentionally empty — cross-validation is advisory */ }
  }

  // ─── Check 10: Config field validation ────────────────────────────────────
  if (fs.existsSync(configPath)) {
    try {
      const configRaw = fs.readFileSync(configPath, 'utf-8');
      const configParsed = JSON.parse(configRaw);

      // Validate branching_strategy
      const validStrategies = ['none', 'phase', 'milestone'];
      if (configParsed.branching_strategy && !validStrategies.includes(configParsed.branching_strategy)) {
        addIssue('warning', 'W012',
          `config.json: invalid branching_strategy "${configParsed.branching_strategy}"`,
          `Valid values: ${validStrategies.join(', ')}`);
      }

      // Validate context_window is a positive integer
      if (configParsed.context_window !== undefined) {
        const cw = configParsed.context_window;
        if (typeof cw !== 'number' || cw <= 0 || !Number.isInteger(cw)) {
          addIssue('warning', 'W013',
            `config.json: context_window should be a positive integer, got "${cw}"`,
            'Set to 200000 (default) or 1000000 (for 1M models)');
        }
      }

      // Validate branch templates have required placeholders
      if (configParsed.phase_branch_template && !configParsed.phase_branch_template.includes('{phase}')) {
        addIssue('warning', 'W014',
          'config.json: phase_branch_template missing {phase} placeholder',
          'Template must include {phase} for phase number substitution');
      }
      if (configParsed.milestone_branch_template && !configParsed.milestone_branch_template.includes('{milestone}')) {
        addIssue('warning', 'W015',
          'config.json: milestone_branch_template missing {milestone} placeholder',
          'Template must include {milestone} for version substitution');
      }
    } catch { /* parse error already caught in Check 5 */ }
  }

  // ─── Check 11: Stale / orphan git worktrees (#2167) ────────────────────────
  try {
    const worktreeHealth = inspectWorktreeHealth(
      cwd,
      { staleAfterMs: 60 * 60 * 1000 },
      { execGit, existsSync: fs.existsSync, statSync: fs.statSync }
    );
    if (!worktreeHealth.ok) {
      // AC2 / AC3: surface degraded-git state as a structured warning instead
      // of silently suppressing it (PRED.k302 — error-swallowing-empty-sentinel).
      if (worktreeHealth.reason === 'git_timed_out') {
        addIssue('warning', 'W020',
          'Worktree health check degraded: git worktree list timed out after 10s — orphan/stale worktrees could not be inspected',
          'Run: git worktree list --porcelain to diagnose; check for .git/index.lock or a hung git process');
      }
      if (worktreeHealth.reason === 'git_list_failed') {
        addIssue('warning', 'W020',
          'Worktree health check degraded: git worktree list failed — orphan/stale worktrees could not be inspected',
          'Run: git worktree list --porcelain to diagnose; check git repository state and permissions');
      }
      // Other non-ok reasons (not_a_git_repo) are silent — not meaningful for
      // users who have no git repo.
    } else {
      for (const finding of worktreeHealth.findings) {
        if (finding.kind === 'orphan') {
          addIssue('warning', 'W017',
            `Orphan git worktree: ${finding.path} (path no longer exists on disk)`,
            'Run: git worktree prune');
          continue;
        }

        if (finding.kind === 'stale') {
          addIssue('warning', 'W017',
            `Stale git worktree: ${finding.path} (last modified ${finding.ageMinutes} minutes ago)`,
            `Run: git worktree remove ${finding.path} --force`);
        }
      }
    }
  } catch { /* git worktree not available or not a git repo — skip silently */ }

  // ─── Check 12: MILESTONES.md / archive snapshot drift (#2446) ─────────────
  const milestonesPath = path.join(planBase, 'MILESTONES.md');
  const milestonesArchiveDir = path.join(planBase, 'milestones');
  const missingFromRegistry = [];
  try {
    if (fs.existsSync(milestonesArchiveDir)) {
      const archiveFiles = fs.readdirSync(milestonesArchiveDir);
      const archivedVersions = archiveFiles
        .map(f => f.match(/^(v\d+\.\d+(?:\.\d+)?)-ROADMAP\.md$/))
        .filter(Boolean)
        .map(m => m[1]);

      if (archivedVersions.length > 0) {
        const registryContent = fs.existsSync(milestonesPath)
          ? fs.readFileSync(milestonesPath, 'utf-8')
          : '';
        for (const ver of archivedVersions) {
          if (!registryContent.includes(`## ${ver}`)) {
            missingFromRegistry.push(ver);
          }
        }
        if (missingFromRegistry.length > 0) {
          addIssue('warning', 'W018',
            `MILESTONES.md missing ${missingFromRegistry.length} archived milestone(s): ${missingFromRegistry.join(', ')}`,
            'Run /gsd-health --backfill to synthesize missing entries from archive snapshots',
            true);
          repairs.push('backfillMilestones');
        }
      }
    }
  } catch { /* intentionally empty — milestone sync check is advisory */ }

  // ─── Check 13: Unrecognized .planning/ root files (W019) ──────────────────
  try {
    const { isCanonicalPlanningFile } = require('./artifacts.cjs');
    const entries = fs.readdirSync(planBase, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md')) continue;
      if (!isCanonicalPlanningFile(entry.name)) {
        addIssue('warning', 'W019',
          `Unrecognized .planning/ file: ${entry.name} — not a canonical GSD artifact`,
          'Move to .planning/milestones/ archive subdir or delete if stale. See templates/README.md for the canonical artifact list.',
          false);
      }
    }
  } catch { /* artifact check is advisory — skip on error */ }

  // ─── Perform repairs if requested ─────────────────────────────────────────
  const repairActions = [];
  if (options.repair && repairs.length > 0) {
    for (const repair of repairs) {
      try {
        switch (repair) {
          case 'createConfig':
          case 'resetConfig': {
            const defaults = {
              model_profile: CONFIG_DEFAULTS.model_profile,
              commit_docs: CONFIG_DEFAULTS.commit_docs,
              search_gitignored: CONFIG_DEFAULTS.search_gitignored,
              branching_strategy: CONFIG_DEFAULTS.branching_strategy,
              phase_branch_template: CONFIG_DEFAULTS.phase_branch_template,
              milestone_branch_template: CONFIG_DEFAULTS.milestone_branch_template,
              quick_branch_template: CONFIG_DEFAULTS.quick_branch_template,
              workflow: {
                research: CONFIG_DEFAULTS.research,
                plan_check: CONFIG_DEFAULTS.plan_checker,
                verifier: CONFIG_DEFAULTS.verifier,
                nyquist_validation: CONFIG_DEFAULTS.nyquist_validation,
              },
              parallelization: CONFIG_DEFAULTS.parallelization,
              brave_search: CONFIG_DEFAULTS.brave_search,
            };
            fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
            repairActions.push({ action: repair, success: true, path: 'config.json' });
            break;
          }
          case 'regenerateState': {
            // Create timestamped backup before overwriting
            if (fs.existsSync(statePath)) {
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
              const backupPath = `${statePath}.bak-${timestamp}`;
              fs.copyFileSync(statePath, backupPath);
              repairActions.push({ action: 'backupState', success: true, path: backupPath });
            }
            // Generate minimal STATE.md from ROADMAP.md structure
            const milestone = getMilestoneInfo(cwd);
            const projectRef = path
              .relative(cwd, path.join(planningDir(cwd), 'PROJECT.md'))
              .split(path.sep).join('/');
            let stateContent = `# Session State\n\n`;
            stateContent += `## Project Reference\n\n`;
            stateContent += `See: ${projectRef}\n\n`;
            stateContent += `## Position\n\n`;
            stateContent += `**Milestone:** ${milestone.version} ${milestone.name}\n`;
            stateContent += `**Current phase:** (determining...)\n`;
            stateContent += `**Status:** Resuming\n\n`;
            stateContent += `## Session Log\n\n`;
            stateContent += `- ${new Date().toISOString().split('T')[0]}: STATE.md regenerated by /gsd-health --repair\n`;
            writeStateMd(statePath, stateContent, cwd);
            repairActions.push({ action: repair, success: true, path: 'STATE.md' });
            break;
          }
          case 'addNyquistKey': {
            if (fs.existsSync(configPath)) {
              try {
                const configRaw = fs.readFileSync(configPath, 'utf-8');
                const configParsed = JSON.parse(configRaw);
                if (!configParsed.workflow) configParsed.workflow = {};
                if (configParsed.workflow.nyquist_validation === undefined) {
                  configParsed.workflow.nyquist_validation = true;
                  fs.writeFileSync(configPath, JSON.stringify(configParsed, null, 2), 'utf-8');
                }
                repairActions.push({ action: repair, success: true, path: 'config.json' });
              } catch (err) {
                repairActions.push({ action: repair, success: false, error: err.message });
              }
            }
            break;
          }
          case 'addAiIntegrationPhaseKey': {
            if (fs.existsSync(configPath)) {
              try {
                const configRaw = fs.readFileSync(configPath, 'utf-8');
                const configParsed = JSON.parse(configRaw);
                if (!configParsed.workflow) configParsed.workflow = {};
                if (configParsed.workflow.ai_integration_phase === undefined) {
                  configParsed.workflow.ai_integration_phase = true;
                  fs.writeFileSync(configPath, JSON.stringify(configParsed, null, 2), 'utf-8');
                }
                repairActions.push({ action: repair, success: true, path: 'config.json' });
              } catch (err) {
                repairActions.push({ action: repair, success: false, error: err.message });
              }
            }
            break;
          }
          case 'backfillMilestones': {
            if (!options.backfill && !options.repair) break;
            const today = new Date().toISOString().split('T')[0];
            let backfilled = 0;
            for (const ver of missingFromRegistry) {
              try {
                const snapshotPath = path.join(milestonesArchiveDir, `${ver}-ROADMAP.md`);
                const snapshot = fs.existsSync(snapshotPath) ? fs.readFileSync(snapshotPath, 'utf-8') : null;
                // Build minimal entry from snapshot title or version
                const titleMatch = snapshot && snapshot.match(/^#\s+(.+)$/m);
                const milestoneName = titleMatch ? titleMatch[1].replace(/^Milestone\s+/i, '').replace(/^v[\d.]+\s*/, '').trim() : ver;
                const entry = `## ${ver}${milestoneName && milestoneName !== ver ? ` ${milestoneName}` : ''} (Backfilled: ${today})\n\n**Note:** Synthesized from archive snapshot by \`/gsd-health --backfill\`. Original completion date unknown.\n\n---\n\n`;
                const milestonesContent = fs.existsSync(milestonesPath)
                  ? fs.readFileSync(milestonesPath, 'utf-8')
                  : '';
                if (!milestonesContent.trim()) {
                  fs.writeFileSync(milestonesPath, `# Milestones\n\n${entry}`, 'utf-8');
                } else {
                  const headerMatch = milestonesContent.match(/^(#{1,3}\s+[^\n]*\n\n?)/);
                  if (headerMatch) {
                    const header = headerMatch[1];
                    const rest = milestonesContent.slice(header.length);
                    fs.writeFileSync(milestonesPath, header + entry + rest, 'utf-8');
                  } else {
                    fs.writeFileSync(milestonesPath, entry + milestonesContent, 'utf-8');
                  }
                }
                backfilled++;
              } catch { /* intentionally empty — partial backfill is acceptable */ }
            }
            repairActions.push({ action: repair, success: true, detail: `Backfilled ${backfilled} milestone(s) into MILESTONES.md` });
            break;
          }
        }
      } catch (err) {
        repairActions.push({ action: repair, success: false, error: err.message });
      }
    }
  }

  // ─── Determine overall status ─────────────────────────────────────────────
  let status;
  if (errors.length > 0) {
    status = 'broken';
  } else if (warnings.length > 0) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  const repairableCount = errors.filter(e => e.repairable).length +
                         warnings.filter(w => w.repairable).length;

  const result = {
    status,
    errors,
    warnings,
    info,
    repairable_count: repairableCount,
    repairs_performed: repairActions.length > 0 ? repairActions : undefined,
  };
  output(result, raw);
  return result;
}

/**
 * Validate agent installation status (#1371).
 * Returns detailed information about which agents are installed and which are missing.
 */
function cmdValidateAgents(cwd, raw) {
  const { MODEL_PROFILES } = require('./model-profiles.cjs');
  const agentStatus = checkAgentsInstalled();
  const expected = Object.keys(MODEL_PROFILES);

  output({
    agents_dir: agentStatus.agents_dir,
    agents_found: agentStatus.agents_installed,
    installed: agentStatus.installed_agents,
    missing: agentStatus.missing_agents,
    expected,
  }, raw);
}

// ─── Schema Drift Detection ──────────────────────────────────────────────────

function cmdVerifySchemaDrift(cwd, phaseArg, skipFlag, raw) {
  const { detectSchemaFiles, checkSchemaDrift } = require('./schema-detect.cjs');

  if (!phaseArg) {
    error('Usage: verify schema-drift <phase> [--skip]');
    return;
  }

  // Find phase directory
  const pDir = planningDir(cwd);
  const phasesDir = path.join(pDir, 'phases');
  if (!fs.existsSync(phasesDir)) {
    output({ drift_detected: false, blocking: false, message: 'No phases directory' }, raw);
    return;
  }

  // Find matching phase directory
  let phaseDir = null;
  const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.includes(phaseArg)) {
      phaseDir = path.join(phasesDir, entry.name);
      break;
    }
  }

  // Also try exact match
  if (!phaseDir) {
    const exact = path.join(phasesDir, phaseArg);
    if (fs.existsSync(exact)) phaseDir = exact;
  }

  if (!phaseDir) {
    output({ drift_detected: false, blocking: false, message: `Phase directory not found: ${phaseArg}` }, raw);
    return;
  }

  // Collect files_modified from all PLAN.md files in the phase
  const allFiles = [];
  const planFiles = fs.readdirSync(phaseDir).filter(f => f.endsWith('-PLAN.md'));
  for (const pf of planFiles) {
    const content = fs.readFileSync(path.join(phaseDir, pf), 'utf-8');
    // Extract files_modified from frontmatter
    const fmMatch = content.match(/files_modified:\s*\[([^\]]*)\]/);
    if (fmMatch) {
      const files = fmMatch[1].split(',').map(f => f.trim()).filter(Boolean);
      allFiles.push(...files);
    }
  }

  // Collect execution log from SUMMARY.md files
  let executionLog = '';
  const summaryFiles = fs.readdirSync(phaseDir).filter(f => f.endsWith('-SUMMARY.md'));
  for (const sf of summaryFiles) {
    executionLog += fs.readFileSync(path.join(phaseDir, sf), 'utf-8') + '\n';
  }

  // Also check git commit messages for push evidence
  const gitLog = execGit(cwd, ['log', '--oneline', '--all', '-50']);
  if (gitLog.exitCode === 0) {
    executionLog += '\n' + gitLog.stdout;
  }

  const result = checkSchemaDrift(allFiles, executionLog, { skipCheck: !!skipFlag });

  output({
    drift_detected: result.driftDetected,
    blocking: result.blocking,
    schema_files: result.schemaFiles,
    orms: result.orms,
    unpushed_orms: result.unpushedOrms,
    message: result.message,
    skipped: result.skipped || false,
  }, raw);
}

// ─── Codebase Drift Detection (#2003) ────────────────────────────────────────

/**
 * Detect structural drift between the committed tree and
 * `.planning/codebase/STRUCTURE.md`. Non-blocking: any failure returns a
 * `{ skipped: true }` JSON result with a reason; the command never exits
 * non-zero so `execute-phase`'s drift gate cannot fail the phase.
 */
function cmdVerifyCodebaseDrift(cwd, raw) {
  const drift = require('./drift.cjs');

  const emit = (payload) => output(payload, raw);

  try {
    const codebaseDir = path.join(planningDir(cwd), 'codebase');
    const structurePath = path.join(codebaseDir, 'STRUCTURE.md');
    if (!fs.existsSync(structurePath)) {
      emit({
        skipped: true,
        reason: 'no-structure-md',
        action_required: false,
        directive: 'none',
        elements: [],
      });
      return;
    }

    let structureMd;
    try {
      structureMd = fs.readFileSync(structurePath, 'utf-8');
    } catch (err) {
      emit({
        skipped: true,
        reason: 'cannot-read-structure-md: ' + err.message,
        action_required: false,
        directive: 'none',
        elements: [],
      });
      return;
    }

    const lastMapped = drift.readMappedCommit(structurePath);

    // Verify we're inside a git repo and resolve the diff range.
    const revProbe = execGit(cwd, ['rev-parse', 'HEAD']);
    if (revProbe.exitCode !== 0) {
      emit({
        skipped: true,
        reason: 'not-a-git-repo',
        action_required: false,
        directive: 'none',
        elements: [],
      });
      return;
    }

    // Empty-tree SHA is a stable fallback when no mapping commit is recorded.
    const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
    let base = lastMapped;
    if (!base) {
      base = EMPTY_TREE;
    } else {
      // Verify the commit is reachable; if not, fall back to EMPTY_TREE.
      const verify = execGit(cwd, ['cat-file', '-t', base]);
      if (verify.exitCode !== 0) base = EMPTY_TREE;
    }

    const diff = execGit(cwd, ['diff', '--name-status', base, 'HEAD']);
    if (diff.exitCode !== 0) {
      emit({
        skipped: true,
        reason: 'git-diff-failed',
        action_required: false,
        directive: 'none',
        elements: [],
      });
      return;
    }

    const added = [];
    const modified = [];
    const deleted = [];
    for (const line of diff.stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const m = line.match(/^([A-Z])\d*\t(.+?)(?:\t(.+))?$/);
      if (!m) continue;
      const status = m[1];
      // For renames (R), use the new path (m[3] if present, else m[2]).
      const file = m[3] || m[2];
      if (status === 'A' || status === 'R' || status === 'C') added.push(file);
      else if (status === 'M') modified.push(file);
      else if (status === 'D') deleted.push(file);
    }

    // Threshold and action read from config, with defaults.
    const config = loadConfig(cwd);
    const threshold = Number.isInteger(config?.workflow?.drift_threshold) && config.workflow.drift_threshold >= 1
      ? config.workflow.drift_threshold
      : 3;
    const action = config?.workflow?.drift_action === 'auto-remap' ? 'auto-remap' : 'warn';

    const result = drift.detectDrift({
      addedFiles: added,
      modifiedFiles: modified,
      deletedFiles: deleted,
      structureMd,
      threshold,
      action,
    });

    emit({
      skipped: !!result.skipped,
      reason: result.reason || null,
      action_required: !!result.actionRequired,
      directive: result.directive,
      spawn_mapper: !!result.spawnMapper,
      affected_paths: result.affectedPaths || [],
      elements: result.elements || [],
      threshold,
      action,
      last_mapped_commit: lastMapped,
      message: result.message || '',
    });
  } catch (err) {
    // Non-blocking: never bubble up an exception.
    emit({
      skipped: true,
      reason: 'exception: ' + (err && err.message ? err.message : String(err)),
      action_required: false,
      directive: 'none',
      elements: [],
    });
  }
}

module.exports = {
  cmdVerifySummary,
  cmdVerifyPlanStructure,
  cmdVerifyPhaseCompleteness,
  cmdVerifyReferences,
  cmdVerifyCommits,
  cmdVerifyArtifacts,
  cmdVerifyKeyLinks,
  cmdValidateConsistency,
  cmdValidateHealth,
  cmdValidateAgents,
  cmdVerifySchemaDrift,
  cmdVerifyCodebaseDrift,
};
