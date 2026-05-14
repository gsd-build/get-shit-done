/**
 * Milestone — Milestone and requirements lifecycle operations
 */

const fs = require('fs');
const path = require('path');
const { escapeRegex, getMilestonePhaseFilter, extractOneLinerFromBody, output, error } = require('./core.cjs');
const { platformWriteSync, platformEnsureDir } = require('./shell-command-projection.cjs');
const { planningPaths } = require('./planning-workspace.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');
const { writeStateMd, stateReplaceFieldWithFallback } = require('./state.cjs');

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

  const reqPath = planningPaths(cwd).requirements;
  if (!fs.existsSync(reqPath)) {
    output({ updated: false, reason: 'REQUIREMENTS.md not found', ids: reqIds }, raw, 'no requirements file');
    return;
  }

  let reqContent = fs.readFileSync(reqPath, 'utf-8');
  const updated = [];
  const alreadyComplete = [];
  const notFound = [];

  for (const reqId of reqIds) {
    let found = false;
    const reqEscaped = escapeRegex(reqId);

    // Update checkbox: - [ ] **REQ-ID** → - [x] **REQ-ID**
    // Use replace() directly and compare — avoids test()+replace() global regex
    // lastIndex bug where test() advances state and replace() misses matches.
    const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqEscaped}\\*\\*)`, 'gi');
    const afterCheckbox = reqContent.replace(checkboxPattern, '$1x$2');
    if (afterCheckbox !== reqContent) {
      reqContent = afterCheckbox;
      found = true;
    }

    // Update traceability table: | REQ-ID | Phase N | Pending | → | REQ-ID | Phase N | Complete |
    const tablePattern = new RegExp(`(\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi');
    const afterTable = reqContent.replace(tablePattern, '$1 Complete $2');
    if (afterTable !== reqContent) {
      reqContent = afterTable;
      found = true;
    }

    if (found) {
      updated.push(reqId);
    } else {
      // Check if already complete before declaring not_found.
      // Non-global flag is fine here — we only need to know if a match exists.
      const doneCheckbox = new RegExp(`-\\s*\\[x\\]\\s*\\*\\*${reqEscaped}\\*\\*`, 'i');
      const doneTable = new RegExp(`\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|\\s*Complete\\s*\\|`, 'i');
      if (doneCheckbox.test(reqContent) || doneTable.test(reqContent)) {
        alreadyComplete.push(reqId);
      } else {
        notFound.push(reqId);
      }
    }
  }

  if (updated.length > 0) {
    platformWriteSync(reqPath, reqContent);
  }

  output({
    updated: updated.length > 0,
    marked_complete: updated,
    already_complete: alreadyComplete,
    not_found: notFound,
    total: reqIds.length,
  }, raw, `${updated.length}/${reqIds.length} requirements marked complete`);
}

function cmdMilestoneComplete(cwd, version, options, raw) {
  if (!version) {
    error('version required for milestone complete (e.g., v1.0)');
  }

  const roadmapPath = planningPaths(cwd).roadmap;
  const reqPath = planningPaths(cwd).requirements;
  const statePath = planningPaths(cwd).state;
  const milestonesPath = path.join(cwd, '.planning', 'MILESTONES.md');
  const archiveDir = path.join(cwd, '.planning', 'milestones');
  const phasesDir = planningPaths(cwd).phases;
  const today = new Date().toISOString().split('T')[0];
  const milestoneName = options.name || version;

  // Ensure archive directory exists
  platformEnsureDir(archiveDir);

  // Scope stats and accomplishments to only the phases belonging to the
  // current milestone's ROADMAP.  Uses the shared filter from core.cjs
  // (same logic used by cmdPhasesList and other callers).
  const isDirInMilestone = getMilestonePhaseFilter(cwd, version);
  if (isDirInMilestone.missingExplicitVersion) {
    error(`no phases found for milestone ${version} in ROADMAP.md`);
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
          const oneLiner = fm['one-liner'] || extractOneLinerFromBody(content);
          if (oneLiner) {
            accomplishments.push(oneLiner);
          }
          // Count tasks: prefer **Tasks:** N from Performance section,
          // then <task XML tags, then ## Task N markdown headers
          const tasksFieldMatch = content.match(/\*\*Tasks:\*\*\s*(\d+)/);
          if (tasksFieldMatch) {
            totalTasks += parseInt(tasksFieldMatch[1], 10);
          } else {
            const xmlTaskMatches = content.match(/<task[\s>]/gi) || [];
            const mdTaskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
            totalTasks += xmlTaskMatches.length || mdTaskMatches.length;
          }
        } catch { /* intentionally empty */ }
      }
    }
  } catch { /* intentionally empty */ }

  // Archive ROADMAP.md
  if (fs.existsSync(roadmapPath)) {
    const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    platformWriteSync(path.join(archiveDir, `${version}-ROADMAP.md`), roadmapContent);
  }

  // Archive REQUIREMENTS.md
  if (fs.existsSync(reqPath)) {
    const reqContent = fs.readFileSync(reqPath, 'utf-8');
    const archiveHeader = `# Requirements Archive: ${version} ${milestoneName}\n\n**Archived:** ${today}\n**Status:** SHIPPED\n\nFor current requirements, see \`.planning/REQUIREMENTS.md\`.\n\n---\n\n`;
    platformWriteSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`), archiveHeader + reqContent);
  }

  // Archive audit file if exists
  const auditFile = path.join(cwd, '.planning', `${version}-MILESTONE-AUDIT.md`);
  if (fs.existsSync(auditFile)) {
    fs.renameSync(auditFile, path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`));
  }

  // Create/append MILESTONES.md entry
  const accomplishmentsList = accomplishments.map(a => `- ${a}`).join('\n');
  const milestoneEntry = `## ${version} ${milestoneName} (Shipped: ${today})\n\n**Phases completed:** ${phaseCount} phases, ${totalPlans} plans, ${totalTasks} tasks\n\n**Key accomplishments:**\n${accomplishmentsList || '- (none recorded)'}\n\n---\n\n`;

  if (fs.existsSync(milestonesPath)) {
    const existing = fs.readFileSync(milestonesPath, 'utf-8');
    if (!existing.trim()) {
      // Empty file — treat like new
      platformWriteSync(milestonesPath, `# Milestones\n\n${milestoneEntry}`);
    } else {
      // Insert after the header line(s) for reverse chronological order (newest first)
      const headerMatch = existing.match(/^(#{1,3}\s+[^\n]*\n\n?)/);
      if (headerMatch) {
        const header = headerMatch[1];
        const rest = existing.slice(header.length);
        platformWriteSync(milestonesPath, header + milestoneEntry + rest);
      } else {
        // No recognizable header — prepend the entry
        platformWriteSync(milestonesPath, milestoneEntry + existing);
      }
    }
  } else {
    platformWriteSync(milestonesPath, `# Milestones\n\n${milestoneEntry}`);
  }

  // Update STATE.md — keep frontmatter/body semantically aligned after closure
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');

    stateContent = stateReplaceFieldWithFallback(stateContent, 'Status', null, `${version} milestone complete`);
    stateContent = stateReplaceFieldWithFallback(stateContent, 'Last Activity', 'Last activity', today);
    stateContent = stateReplaceFieldWithFallback(stateContent, 'Last Activity Description', null,
      `${version} milestone completed and archived`);

    // Reset Current Position narrative so resume/progress flows do not keep
    // pointing at closed-phase execution instructions.
    const positionPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
    const closedPositionBody =
      `\nPhase: Milestone ${version} complete\n` +
      `Plan: —\n` +
      `Status: Awaiting next milestone\n` +
      `Last activity: ${today} — Milestone ${version} completed and archived\n\n`;
    if (positionPattern.test(stateContent)) {
      stateContent = stateContent.replace(positionPattern, (_m, header) => `${header}${closedPositionBody}`);
    } else {
      stateContent = `${stateContent.trimEnd()}\n\n## Current Position\n${closedPositionBody}`;
    }

    // Normalize operator-next-step tails that can become stale after close.
    const operatorPattern = /(##\s*Operator Next Steps\s*\n)([\s\S]*?)(?=\n##|$)/i;
    if (operatorPattern.test(stateContent)) {
      stateContent = stateContent.replace(
        operatorPattern,
        `$1\n- Start the next milestone with /gsd:new-milestone\n\n`,
      );
    } else {
      stateContent = `${stateContent.trimEnd()}\n\n## Operator Next Steps\n\n- Start the next milestone with /gsd:new-milestone\n`;
    }

    writeStateMd(statePath, stateContent, cwd);
  }

  // Archive phase directories if requested
  let phasesArchived = false;
  if (options.archivePhases) {
    try {
      const phaseArchiveDir = path.join(archiveDir, `${version}-phases`);
      platformEnsureDir(phaseArchiveDir);

      const phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const phaseDirNames = phaseEntries.filter(e => e.isDirectory()).map(e => e.name);
      let archivedCount = 0;
      for (const dir of phaseDirNames) {
        if (!isDirInMilestone(dir)) continue;
        fs.renameSync(path.join(phasesDir, dir), path.join(phaseArchiveDir, dir));
        archivedCount++;
      }
      phasesArchived = archivedCount > 0;
    } catch { /* intentionally empty */ }
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

function cmdPhasesClear(cwd, raw, args) {
  const phasesDir = planningPaths(cwd).phases;
  const confirm = Array.isArray(args) && args.includes('--confirm');
  let cleared = 0;

  if (fs.existsSync(phasesDir)) {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory() && !/^999(?:\.|$)/.test(e.name));

    if (dirs.length > 0 && !confirm) {
      error(
        `phases clear would delete ${dirs.length} phase director${dirs.length === 1 ? 'y' : 'ies'}. ` +
        `Pass --confirm to proceed.`
      );
    }

    try {
      for (const entry of dirs) {
        fs.rmSync(path.join(phasesDir, entry.name), { recursive: true, force: true });
        cleared++;
      }
    } catch (e) {
      error('Failed to clear phases directory: ' + e.message);
    }
  }

  output({ cleared }, raw, `${cleared} phase director${cleared === 1 ? 'y' : 'ies'} cleared`);
}

module.exports = {
  cmdRequirementsMarkComplete,
  cmdMilestoneComplete,
  cmdPhasesClear,
};
