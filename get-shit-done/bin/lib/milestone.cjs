/**
 * Milestone — Milestone and requirements lifecycle operations
 */

const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');
const { writeStateMd } = require('./state.cjs');
const { resolvePlanningPaths } = require('./paths.cjs');

function cmdRequirementsMarkComplete(cwd, reqIdsRaw, raw) {
  if (!reqIdsRaw || reqIdsRaw.length === 0) {
    error('requirement IDs required. Usage: requirements mark-complete REQ-01,REQ-02 or REQ-01 REQ-02');
  }

  // Accept comma-separated, space-separated, or bracket-wrapped: [REQ-01, REQ-02]
  const reqIds = reqIdsRaw
    .join(' ')
    .replace(/[\[\]]/g, '')
    .split(/[,\s]+/)
    .map(r => r.trim())
    .filter(Boolean);

  if (reqIds.length === 0) {
    error('no valid requirement IDs found');
  }

  const reqPath = resolvePlanningPaths(cwd).abs.requirements;
  if (!fs.existsSync(reqPath)) {
    output({ updated: false, reason: 'REQUIREMENTS.md not found', ids: reqIds }, raw, 'no requirements file');
    return;
  }

  let reqContent = fs.readFileSync(reqPath, 'utf-8');
  const updated = [];
  const notFound = [];

  for (const reqId of reqIds) {
    let found = false;

    // Update checkbox: - [ ] **REQ-ID** → - [x] **REQ-ID**
    const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqId}\\*\\*)`, 'gi');
    if (checkboxPattern.test(reqContent)) {
      reqContent = reqContent.replace(checkboxPattern, '$1x$2');
      found = true;
    }

    // Update traceability table: | REQ-ID | Phase N | Pending | → | REQ-ID | Phase N | Complete |
    const tablePattern = new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi');
    if (tablePattern.test(reqContent)) {
      // Re-read since test() advances lastIndex for global regex
      reqContent = reqContent.replace(
        new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi'),
        '$1 Complete $2'
      );
      found = true;
    }

    if (found) {
      updated.push(reqId);
    } else {
      notFound.push(reqId);
    }
  }

  if (updated.length > 0) {
    fs.writeFileSync(reqPath, reqContent, 'utf-8');
  }

  output({
    updated: updated.length > 0,
    marked_complete: updated,
    not_found: notFound,
    total: reqIds.length,
  }, raw, `${updated.length}/${reqIds.length} requirements marked complete`);
}

function cmdMilestoneComplete(cwd, version, options, raw) {
  if (!version) {
    error('version required for milestone complete (e.g., v1.0)');
  }

  const paths = resolvePlanningPaths(cwd);
  const roadmapPath = paths.abs.roadmap;
  const reqPath = paths.abs.requirements;
  const statePath = paths.abs.state;
  const milestonesPath = path.join(paths.abs.planningRoot, 'MILESTONES.md');
  const archiveDir = path.join(paths.abs.planningRoot, 'milestones');
  const phasesDir = paths.abs.phases;
  const today = new Date().toISOString().split('T')[0];
  const milestoneName = options.name || version;

  // Ensure archive directory exists
  fs.mkdirSync(archiveDir, { recursive: true });

  // Extract milestone phase numbers from ROADMAP.md to scope stats.
  // Only phases listed in the current ROADMAP are counted — phases from
  // prior milestones that remain on disk are excluded.
  //
  // Related upstream PRs (getMilestoneInfo, not milestone complete):
  //   #756 — fix(core): detect current milestone correctly in getMilestoneInfo
  //   #783 — fix: getMilestoneInfo() returns wrong version after completion
  // Those PRs fix *which* milestone is detected; this fix scopes *stats*
  // and *accomplishments* to only the phases belonging to that milestone.
  const milestonePhaseNums = new Set();
  if (fs.existsSync(roadmapPath)) {
    try {
      const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
      const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
      let phaseMatch;
      while ((phaseMatch = phasePattern.exec(roadmapContent)) !== null) {
        milestonePhaseNums.add(phaseMatch[1]);
      }
    } catch {}
  }

  // Pre-normalize phase numbers for O(1) lookup — strip leading zeros
  // and lowercase for case-insensitive matching of letter suffixes (e.g. 3A/3a).
  const normalizedPhaseNums = new Set(
    [...milestonePhaseNums].map(num => (num.replace(/^0+/, '') || '0').toLowerCase())
  );

  // Match a phase directory name to the milestone's phase set.
  // Handles: "01-foo" → "1", "3A-bar" → "3a", "3.1-baz" → "3.1"
  // Returns false for non-phase directories (no leading digit).
  function isDirInMilestone(dirName) {
    if (normalizedPhaseNums.size === 0) return true; // no scoping
    const m = dirName.match(/^0*(\d+[A-Za-z]?(?:\.\d+)*)/);
    if (!m) return false; // not a phase directory
    return normalizedPhaseNums.has(m[1].toLowerCase());
  }

  // Gather stats from phases (scoped to current milestone only)
  let phaseCount = 0;
  let totalPlans = 0;
  let totalTasks = 0;
  const accomplishments = [];

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      if (!isDirInMilestone(dir)) continue;

      phaseCount++;
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      totalPlans += plans.length;

      // Extract one-liners from summaries
      for (const s of summaries) {
        try {
          const content = fs.readFileSync(path.join(phasesDir, dir, s), 'utf-8');
          const fm = extractFrontmatter(content);
          if (fm['one-liner']) {
            accomplishments.push(fm['one-liner']);
          }
          // Count tasks
          const taskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
          totalTasks += taskMatches.length;
        } catch {}
      }
    }
  } catch {}

  // Archive ROADMAP.md
  if (fs.existsSync(roadmapPath)) {
    const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    fs.writeFileSync(path.join(archiveDir, `${version}-ROADMAP.md`), roadmapContent, 'utf-8');
  }

  // Archive REQUIREMENTS.md
  if (fs.existsSync(reqPath)) {
    const reqContent = fs.readFileSync(reqPath, 'utf-8');
    const archiveHeader = `# Requirements Archive: ${version} ${milestoneName}\n\n**Archived:** ${today}\n**Status:** SHIPPED\n\nFor current requirements, see \`.planning/REQUIREMENTS.md\`.\n\n---\n\n`;
    fs.writeFileSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`), archiveHeader + reqContent, 'utf-8');
  }

  // Archive audit file if exists
  const auditFile = path.join(paths.abs.planningRoot, `${version}-MILESTONE-AUDIT.md`);
  if (fs.existsSync(auditFile)) {
    fs.renameSync(auditFile, path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`));
  }

  // Create/append MILESTONES.md entry
  const accomplishmentsList = accomplishments.map(a => `- ${a}`).join('\n');
  const milestoneEntry = `## ${version} ${milestoneName} (Shipped: ${today})\n\n**Phases completed:** ${phaseCount} phases, ${totalPlans} plans, ${totalTasks} tasks\n\n**Key accomplishments:**\n${accomplishmentsList || '- (none recorded)'}\n\n---\n\n`;

  if (fs.existsSync(milestonesPath)) {
    const existing = fs.readFileSync(milestonesPath, 'utf-8');
    // Insert after the header line(s) for reverse chronological order (newest first)
    const headerMatch = existing.match(/^(#{1,3}\s+[^\n]*\n\n?)/);
    if (headerMatch) {
      const header = headerMatch[1];
      const rest = existing.slice(header.length);
      fs.writeFileSync(milestonesPath, header + milestoneEntry + rest, 'utf-8');
    } else {
      // No recognizable header — prepend the entry
      fs.writeFileSync(milestonesPath, milestoneEntry + existing, 'utf-8');
    }
  } else {
    fs.writeFileSync(milestonesPath, `# Milestones\n\n${milestoneEntry}`, 'utf-8');
  }

  // Update STATE.md
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');
    stateContent = stateContent.replace(
      /(\*\*Status:\*\*\s*).*/,
      `$1${version} milestone complete`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity:\*\*\s*).*/,
      `$1${today}`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity Description:\*\*\s*).*/,
      `$1${version} milestone completed and archived`
    );
    writeStateMd(statePath, stateContent, cwd);
  }

  // Archive phase directories if requested
  let phasesArchived = false;
  if (options.archivePhases) {
    try {
      const phaseArchiveDir = path.join(archiveDir, `${version}-phases`);
      fs.mkdirSync(phaseArchiveDir, { recursive: true });

      const phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const phaseDirNames = phaseEntries.filter(e => e.isDirectory()).map(e => e.name);
      let archivedCount = 0;
      for (const dir of phaseDirNames) {
        if (!isDirInMilestone(dir)) continue;
        fs.renameSync(path.join(phasesDir, dir), path.join(phaseArchiveDir, dir));
        archivedCount++;
      }
      phasesArchived = archivedCount > 0;
    } catch {}
  }

  const result = {
    version,
    name: milestoneName,
    date: today,
    phases: phaseCount,
    plans: totalPlans,
    tasks: totalTasks,
    accomplishments,
    archived: {
      roadmap: fs.existsSync(path.join(archiveDir, `${version}-ROADMAP.md`)),
      requirements: fs.existsSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`)),
      audit: fs.existsSync(path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`)),
      phases: phasesArchived,
    },
    milestones_updated: true,
    state_updated: fs.existsSync(statePath),
  };

  output(result, raw);
}

function cmdMilestoneCreate(cwd, name, raw) {
  if (!name) {
    error('milestone name required. Usage: milestone create <name>');
  }

  const today = new Date().toISOString().split('T')[0];
  const planningRoot = path.join(cwd, '.planning');
  const milestonesDir = path.join(planningRoot, 'milestones');
  const activeMilestonePath = path.join(planningRoot, 'ACTIVE_MILESTONE');
  const targetDir = path.join(milestonesDir, name);
  let migratedFrom = null;

  // Check if this is the first milestone AND legacy mode exists
  const legacyStateExists = fs.existsSync(path.join(planningRoot, 'STATE.md'));
  let existingMilestones = [];
  try {
    existingMilestones = fs.readdirSync(milestonesDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && fs.existsSync(path.join(milestonesDir, e.name, 'STATE.md')))
      .map(e => e.name);
  } catch {}

  if (existingMilestones.length === 0 && legacyStateExists) {
    // Auto-migrate existing global files to a milestone directory
    // Determine a name for the current milestone from STATE.md
    let currentMilestoneName = 'initial';
    try {
      const stateContent = fs.readFileSync(path.join(planningRoot, 'STATE.md'), 'utf-8');
      const milestoneMatch = stateContent.match(/\*\*Milestone:\*\*\s*(.+)/);
      if (milestoneMatch) {
        currentMilestoneName = milestoneMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'initial';
      }
    } catch {}

    const migrationDir = path.join(milestonesDir, currentMilestoneName);
    fs.mkdirSync(migrationDir, { recursive: true });
    fs.mkdirSync(path.join(migrationDir, 'phases'), { recursive: true });

    // Copy legacy files
    const filesToMigrate = [
      { src: 'STATE.md', dest: 'STATE.md' },
      { src: 'ROADMAP.md', dest: 'ROADMAP.md' },
      { src: 'REQUIREMENTS.md', dest: 'REQUIREMENTS.md' },
      { src: 'config.json', dest: 'config.json' },
    ];
    for (const { src, dest } of filesToMigrate) {
      const srcPath = path.join(planningRoot, src);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(migrationDir, dest));
      }
    }

    // Set ACTIVE_MILESTONE to the migrated milestone first
    fs.writeFileSync(activeMilestonePath, currentMilestoneName, 'utf-8');
    migratedFrom = currentMilestoneName;
  }

  // Create the new milestone directory
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'phases'), { recursive: true });

  // STATE.md template
  const stateTemplate = `# Session State

## Position

**Milestone:** ${name}
**Current Phase:** Not started
**Current Phase Name:** TBD
**Total Phases:** 0
**Current Plan:** Not started
**Total Plans in Phase:** 0
**Status:** Ready to plan
**Progress:** [░░░░░░░░░░] 0%
**Last Activity:** ${today}
**Last Activity Description:** Milestone created

## Decisions Made
None yet.

## Blockers
None

## Performance Metrics
| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
None yet

## Session
**Last Date:** ${today}
**Stopped At:** N/A
**Resume File:** None
`;
  fs.writeFileSync(path.join(targetDir, 'STATE.md'), stateTemplate, 'utf-8');

  // ROADMAP.md template
  const roadmapTemplate = `# ${name} Roadmap

> Milestone roadmap — run /gsd:new-milestone to populate

## Progress Overview

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|

## Phase Summary

(No phases yet — run /gsd:new-milestone to create roadmap)
`;
  fs.writeFileSync(path.join(targetDir, 'ROADMAP.md'), roadmapTemplate, 'utf-8');

  // config.json — copy from current milestone or use defaults
  let configContent = JSON.stringify({ commit_docs: true, research: true, verifier: true, plan_checker: true, nyquist_validation: true, parallelization: false, branching_strategy: 'none' }, null, 2);
  try {
    const currentPaths = resolvePlanningPaths(cwd);
    if (fs.existsSync(currentPaths.abs.config)) {
      configContent = fs.readFileSync(currentPaths.abs.config, 'utf-8');
    }
  } catch {}
  fs.writeFileSync(path.join(targetDir, 'config.json'), configContent, 'utf-8');

  // Set ACTIVE_MILESTONE to the new milestone
  fs.writeFileSync(activeMilestonePath, name, 'utf-8');

  const directory = '.planning/milestones/' + name;
  output({ created: true, name, directory, migrated_from: migratedFrom }, raw, `milestone "${name}" created at ${directory}`);
}

function cmdMilestoneSwitch(cwd, name, raw) {
  if (!name) {
    error('milestone name required. Usage: milestone switch <name>');
  }

  const planningRoot = path.join(cwd, '.planning');
  const milestoneDir = path.join(planningRoot, 'milestones', name);
  const activeMilestonePath = path.join(planningRoot, 'ACTIVE_MILESTONE');

  if (!fs.existsSync(milestoneDir)) {
    error(`milestone "${name}" not found in .planning/milestones/`);
  }

  // Write ACTIVE_MILESTONE
  fs.writeFileSync(activeMilestonePath, name, 'utf-8');

  // Read status from target milestone's STATE.md
  let status = 'unknown';
  const statePath = path.join(milestoneDir, 'STATE.md');
  if (fs.existsSync(statePath)) {
    try {
      const content = fs.readFileSync(statePath, 'utf-8');
      const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/);
      if (statusMatch) status = statusMatch[1].trim();
    } catch {}
  }

  const state_path = '.planning/milestones/' + name + '/STATE.md';
  output({ switched: true, name, status, state_path }, raw, `switched to milestone "${name}" (${status})`);
}

function cmdMilestoneList(cwd, raw) {
  const planningRoot = path.join(cwd, '.planning');
  const milestonesDir = path.join(planningRoot, 'milestones');
  const activeMilestonePath = path.join(planningRoot, 'ACTIVE_MILESTONE');

  // Read active milestone
  let active = null;
  try {
    const content = fs.readFileSync(activeMilestonePath, 'utf-8').trim();
    if (content) active = content;
  } catch {}

  // List milestone directories that contain STATE.md (skip archived v*-phases dirs)
  const milestones = [];
  try {
    const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip archived phase directories (e.g. v1.0-phases)
      if (/^v[\d.]+-phases$/.test(entry.name)) continue;
      const stateFile = path.join(milestonesDir, entry.name, 'STATE.md');
      if (!fs.existsSync(stateFile)) continue;

      let status = 'unknown';
      try {
        const content = fs.readFileSync(stateFile, 'utf-8');
        const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/);
        if (statusMatch) status = statusMatch[1].trim();
      } catch {}

      milestones.push({
        name: entry.name,
        status,
        active: entry.name === active,
      });
    }
  } catch {}

  output({ milestones, active, count: milestones.length }, raw, `${milestones.length} milestone(s) found`);
}

function cmdMilestoneStatus(cwd, raw) {
  const planningRoot = path.join(cwd, '.planning');
  const activeMilestonePath = path.join(planningRoot, 'ACTIVE_MILESTONE');

  let active = null;
  try {
    const content = fs.readFileSync(activeMilestonePath, 'utf-8').trim();
    if (content) active = content;
  } catch {}

  const isMultiMilestone = !!active;
  const paths = resolvePlanningPaths(cwd);

  output({
    active,
    is_multi_milestone: isMultiMilestone,
    state_path: paths.rel.state,
    roadmap_path: paths.rel.roadmap,
  }, raw, active ? `active milestone: ${active}` : 'legacy mode (no active milestone)');
}

module.exports = {
  cmdRequirementsMarkComplete,
  cmdMilestoneComplete,
  cmdMilestoneCreate,
  cmdMilestoneSwitch,
  cmdMilestoneList,
  cmdMilestoneStatus,
};
