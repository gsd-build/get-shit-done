'use strict';

/**
 * gsd2-import — Reverse migration from GSD-2 (.gsd/) to GSD v1 (.planning/)
 *
 * Reads a GSD-2 project directory structure and produces a complete
 * .planning/ artifact tree in GSD v1 format.
 *
 * GSD-2 hierarchy:  Milestone → Slice → Task
 * GSD v1 hierarchy: Milestone (in ROADMAP.md) → Phase → Plan
 *
 * Mapping rules:
 *   - Slices are numbered sequentially across all milestones (01, 02, …)
 *   - Tasks within a slice become plans (01-01, 01-02, …)
 *   - Completed slices ([x] in ROADMAP) → [x] phases in ROADMAP.md
 *   - Tasks with a SUMMARY file → SUMMARY.md written
 *   - Slice RESEARCH.md → phase XX-RESEARCH.md
 */

const fs = require('node:fs');
const path = require('node:path');

// ─── Utilities ──────────────────────────────────────────────────────────────

function readOptional(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function zeroPad(n, width = 2) {
  return String(n).padStart(width, '0');
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── GSD-2 Parser ───────────────────────────────────────────────────────────

/**
 * Find the .gsd/ directory starting from a project root.
 * Returns the absolute path or null if not found.
 */
function findGsd2Root(startPath) {
  if (path.basename(startPath) === '.gsd' && fs.existsSync(startPath)) {
    return startPath;
  }
  const candidate = path.join(startPath, '.gsd');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return candidate;
  }
  return null;
}

/**
 * Parse the ## Slices section from a GSD-2 milestone ROADMAP.md.
 * Each slice entry looks like:
 *   - [x] **S01: Title** `risk:medium` `depends:[S00]`
 */
function parseSlicesFromRoadmap(content) {
  const slices = [];
  const sectionMatch = content.match(/## Slices\n([\s\S]*?)(?:\n## |\n# |$)/);
  if (!sectionMatch) return slices;

  for (const line of sectionMatch[1].split('\n')) {
    const m = line.match(/^- \[([x ])\]\s+\*\*(\w+):\s*([^*]+)\*\*/);
    if (!m) continue;
    slices.push({ done: m[1] === 'x', id: m[2].trim(), title: m[3].trim() });
  }
  return slices;
}

/**
 * Parse the milestone title from the first heading in a GSD-2 ROADMAP.md.
 * Format: # M001: Title
 */
function parseMilestoneTitle(content) {
  const m = content.match(/^# \w+:\s*(.+)/m);
  return m ? m[1].trim() : null;
}

/**
 * Parse a task title from a GSD-2 T##-PLAN.md.
 * Format: # T01: Title
 */
function parseTaskTitle(content, fallback) {
  const m = content.match(/^# \w+:\s*(.+)/m);
  return m ? m[1].trim() : fallback;
}

/**
 * Parse the ## Description body from a GSD-2 task plan.
 */
function parseTaskDescription(content) {
  const m = content.match(/## Description\n+([\s\S]+?)(?:\n## |\n# |$)/);
  return m ? m[1].trim() : '';
}

/**
 * Parse ## Must-Haves items from a GSD-2 task plan.
 */
function parseTaskMustHaves(content) {
  const m = content.match(/## Must-Haves\n+([\s\S]+?)(?:\n## |\n# |$)/);
  if (!m) return [];
  return m[1].split('\n')
    .map(l => l.match(/^- \[[ x]\]\s*(.+)/))
    .filter(Boolean)
    .map(match => match[1].trim());
}

/**
 * Read all task plan files from a GSD-2 tasks/ directory.
 */
function readTasksDir(tasksDir) {
  if (!fs.existsSync(tasksDir)) return [];

  return fs.readdirSync(tasksDir)
    .filter(f => f.endsWith('-PLAN.md'))
    .sort()
    .map(tf => {
      const tid = tf.replace('-PLAN.md', '');
      const plan = readOptional(path.join(tasksDir, tf));
      const summary = readOptional(path.join(tasksDir, `${tid}-SUMMARY.md`));
      return {
        id: tid,
        title: plan ? parseTaskTitle(plan, tid) : tid,
        description: plan ? parseTaskDescription(plan) : '',
        mustHaves: plan ? parseTaskMustHaves(plan) : [],
        plan,
        summary,
        done: !!summary,
      };
    });
}

/**
 * Parse a complete GSD-2 .gsd/ directory into a structured representation.
 */
function parseGsd2(gsdDir) {
  const data = {
    projectContent: readOptional(path.join(gsdDir, 'PROJECT.md')),
    requirements: readOptional(path.join(gsdDir, 'REQUIREMENTS.md')),
    milestones: [],
  };

  const milestonesBase = path.join(gsdDir, 'milestones');
  if (!fs.existsSync(milestonesBase)) return data;

  const milestoneIds = fs.readdirSync(milestonesBase)
    .filter(d => fs.statSync(path.join(milestonesBase, d)).isDirectory())
    .sort();

  for (const mid of milestoneIds) {
    const mDir = path.join(milestonesBase, mid);
    const roadmapContent = readOptional(path.join(mDir, `${mid}-ROADMAP.md`));
    const slicesDir = path.join(mDir, 'slices');

    const sliceInfos = roadmapContent ? parseSlicesFromRoadmap(roadmapContent) : [];

    const slices = sliceInfos.map(info => {
      const sDir = path.join(slicesDir, info.id);
      const hasSDir = fs.existsSync(sDir);
      return {
        id: info.id,
        title: info.title,
        done: info.done,
        plan: hasSDir ? readOptional(path.join(sDir, `${info.id}-PLAN.md`)) : null,
        summary: hasSDir ? readOptional(path.join(sDir, `${info.id}-SUMMARY.md`)) : null,
        research: hasSDir ? readOptional(path.join(sDir, `${info.id}-RESEARCH.md`)) : null,
        context: hasSDir ? readOptional(path.join(sDir, `${info.id}-CONTEXT.md`)) : null,
        tasks: hasSDir ? readTasksDir(path.join(sDir, 'tasks')) : [],
      };
    });

    data.milestones.push({
      id: mid,
      title: roadmapContent ? (parseMilestoneTitle(roadmapContent) ?? mid) : mid,
      research: readOptional(path.join(mDir, `${mid}-RESEARCH.md`)),
      slices,
    });
  }

  return data;
}

// ─── Artifact Builders ──────────────────────────────────────────────────────

/**
 * Build a GSD v1 PLAN.md from a GSD-2 task.
 */
function buildPlanMd(task, phasePrefix, planPrefix, phaseSlug, milestoneTitle) {
  const lines = [
    '---',
    `phase: "${phasePrefix}"`,
    `plan: "${planPrefix}"`,
    'type: "implementation"',
    '---',
    '',
    '<objective>',
    task.title,
    '</objective>',
    '',
    '<context>',
    `Phase: ${phasePrefix} (${phaseSlug}) — Milestone: ${milestoneTitle}`,
  ];

  if (task.description) {
    lines.push('', task.description);
  }

  lines.push('</context>');

  if (task.mustHaves.length > 0) {
    lines.push('', '<must_haves>');
    for (const mh of task.mustHaves) {
      lines.push(`- ${mh}`);
    }
    lines.push('</must_haves>');
  }

  return lines.join('\n') + '\n';
}

/**
 * Build a GSD v1 SUMMARY.md from a GSD-2 task summary.
 * Strips the GSD-2 frontmatter and preserves the body.
 */
function buildSummaryMd(task, phasePrefix, planPrefix) {
  const raw = task.summary || '';
  // Strip GSD-2 frontmatter block (--- ... ---) if present
  const bodyMatch = raw.match(/^---[\s\S]*?---\n+([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1].trim() : raw.trim();

  return [
    '---',
    `phase: "${phasePrefix}"`,
    `plan: "${planPrefix}"`,
    '---',
    '',
    body || 'Task completed (migrated from GSD-2).',
    '',
  ].join('\n');
}

/**
 * Build a GSD v1 XX-CONTEXT.md from a GSD-2 slice.
 */
function buildContextMd(slice, phasePrefix) {
  const lines = [
    `# Phase ${phasePrefix} Context`,
    '',
    `Migrated from GSD-2 slice ${slice.id}: ${slice.title}`,
  ];

  const extra = slice.context || '';
  if (extra.trim()) {
    lines.push('', extra.trim());
  }

  return lines.join('\n') + '\n';
}

/**
 * Build the GSD v1 ROADMAP.md with milestone-sectioned format.
 */
function buildRoadmapMd(milestones, phaseMap) {
  const lines = ['# Roadmap', ''];

  for (const milestone of milestones) {
    lines.push(`## ${milestone.id}: ${milestone.title}`, '');
    const mPhases = phaseMap.filter(p => p.milestoneId === milestone.id);
    for (const { slice, phaseNum } of mPhases) {
      const prefix = zeroPad(phaseNum);
      const slug = slugify(slice.title);
      const check = slice.done ? 'x' : ' ';
      lines.push(`- [${check}] **Phase ${prefix}: ${slug}** — ${slice.title}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build the GSD v1 STATE.md reflecting the current position in the project.
 */
function buildStateMd(phaseMap) {
  const currentEntry = phaseMap.find(p => !p.slice.done);
  const totalPhases = phaseMap.length;
  const donePhases = phaseMap.filter(p => p.slice.done).length;
  const pct = totalPhases > 0 ? Math.round((donePhases / totalPhases) * 100) : 0;

  const currentPhaseNum = currentEntry ? zeroPad(currentEntry.phaseNum) : zeroPad(totalPhases);
  const currentSlug = currentEntry ? slugify(currentEntry.slice.title) : 'complete';
  const status = currentEntry ? 'Ready to plan' : 'All phases complete';

  const filled = Math.round(pct / 10);
  const bar = `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
  const today = new Date().toISOString().split('T')[0];

  return [
    '# Project State',
    '',
    '## Project Reference',
    '',
    'See: .planning/PROJECT.md',
    '',
    `**Current focus:** Phase ${currentPhaseNum} (${currentSlug})`,
    '',
    '## Current Position',
    '',
    `Phase: ${currentPhaseNum} of ${zeroPad(totalPhases)} (${currentSlug})`,
    `Status: ${status}`,
    `Last activity: ${today} — Migrated from GSD-2`,
    '',
    `Progress: ${bar} ${pct}%`,
    '',
    '## Accumulated Context',
    '',
    '### Decisions',
    '',
    'Migrated from GSD-2. Review PROJECT.md for key decisions.',
    '',
    '### Blockers/Concerns',
    '',
    'None.',
    '',
    '## Session Continuity',
    '',
    `Last session: ${today}`,
    'Stopped at: Migration from GSD-2 completed',
    'Resume file: None',
    '',
  ].join('\n');
}

// ─── Transformer ─────────────────────────────────────────────────────────────

/**
 * Convert parsed GSD-2 data into a map of relative path → file content.
 * All paths are relative to the .planning/ root.
 */
function buildPlanningArtifacts(gsd2Data) {
  const artifacts = new Map();

  // Passthrough files
  artifacts.set('PROJECT.md', gsd2Data.projectContent || '# Project\n\n(Migrated from GSD-2)\n');
  if (gsd2Data.requirements) {
    artifacts.set('REQUIREMENTS.md', gsd2Data.requirements);
  }

  // Minimal valid v1 config
  artifacts.set('config.json', JSON.stringify({ version: 1 }, null, 2) + '\n');

  // Build sequential phase map: flatten Milestones → Slices into numbered phases
  const phaseMap = [];
  let phaseNum = 1;
  for (const milestone of gsd2Data.milestones) {
    for (const slice of milestone.slices) {
      phaseMap.push({ milestoneId: milestone.id, milestoneTitle: milestone.title, slice, phaseNum });
      phaseNum++;
    }
  }

  artifacts.set('ROADMAP.md', buildRoadmapMd(gsd2Data.milestones, phaseMap));
  artifacts.set('STATE.md', buildStateMd(phaseMap));

  for (const { slice, phaseNum, milestoneTitle } of phaseMap) {
    const prefix = zeroPad(phaseNum);
    const slug = slugify(slice.title);
    const dir = `phases/${prefix}-${slug}`;

    artifacts.set(`${dir}/${prefix}-CONTEXT.md`, buildContextMd(slice, prefix));

    if (slice.research) {
      artifacts.set(`${dir}/${prefix}-RESEARCH.md`, slice.research);
    }

    for (let i = 0; i < slice.tasks.length; i++) {
      const task = slice.tasks[i];
      const planPrefix = zeroPad(i + 1);

      artifacts.set(
        `${dir}/${prefix}-${planPrefix}-PLAN.md`,
        buildPlanMd(task, prefix, planPrefix, slug, milestoneTitle)
      );

      if (task.done && task.summary) {
        artifacts.set(
          `${dir}/${prefix}-${planPrefix}-SUMMARY.md`,
          buildSummaryMd(task, prefix, planPrefix)
        );
      }
    }
  }

  return artifacts;
}

// ─── Preview ─────────────────────────────────────────────────────────────────

/**
 * Format a dry-run preview string for display before writing.
 */
function buildPreview(gsd2Data, artifacts) {
  const lines = ['Preview — files that will be created in .planning/:'];

  for (const rel of artifacts.keys()) {
    lines.push(`  ${rel}`);
  }

  const totalSlices = gsd2Data.milestones.reduce((s, m) => s + m.slices.length, 0);
  const doneSlices = gsd2Data.milestones.reduce((s, m) => s + m.slices.filter(sl => sl.done).length, 0);
  const allTasks = gsd2Data.milestones.flatMap(m => m.slices.flatMap(sl => sl.tasks));
  const doneTasks = allTasks.filter(t => t.done).length;

  lines.push('');
  lines.push(`Milestones: ${gsd2Data.milestones.length}`);
  lines.push(`Phases (slices): ${totalSlices} (${doneSlices} completed)`);
  lines.push(`Plans (tasks): ${allTasks.length} (${doneTasks} completed)`);
  lines.push('');
  lines.push('Cannot migrate automatically:');
  lines.push('  - GSD-2 cost/token ledger (no v1 equivalent)');
  lines.push('  - GSD-2 database state (rebuilt from files on first /gsd:health)');
  lines.push('  - VS Code extension state');

  return lines.join('\n');
}

// ─── Writer ───────────────────────────────────────────────────────────────────

/**
 * Write all artifacts to the .planning/ directory.
 */
function writePlanningDir(artifacts, planningRoot) {
  for (const [rel, content] of artifacts) {
    const absPath = path.join(planningRoot, rel);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf8');
  }
}

// ─── Command Handler ──────────────────────────────────────────────────────────

/**
 * Entry point called from gsd-tools.cjs.
 * Supports: --force, --dry-run, --path <dir>
 */
function cmdFromGsd2(args, cwd, raw) {
  const { output, error } = require('./core.cjs');

  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  const pathIdx = args.indexOf('--path');
  const projectDir = pathIdx >= 0 && args[pathIdx + 1]
    ? path.resolve(cwd, args[pathIdx + 1])
    : cwd;

  const gsdDir = findGsd2Root(projectDir);
  if (!gsdDir) {
    return output({ success: false, error: `No .gsd/ directory found in ${projectDir}` }, raw);
  }

  const planningRoot = path.join(path.dirname(gsdDir), '.planning');
  if (fs.existsSync(planningRoot) && !force) {
    return output({
      success: false,
      error: `.planning/ already exists at ${planningRoot}. Pass --force to overwrite.`,
    }, raw);
  }

  const gsd2Data = parseGsd2(gsdDir);
  const artifacts = buildPlanningArtifacts(gsd2Data);
  const preview = buildPreview(gsd2Data, artifacts);

  if (dryRun) {
    return output({ success: true, dryRun: true, preview }, raw);
  }

  writePlanningDir(artifacts, planningRoot);

  return output({
    success: true,
    planningDir: planningRoot,
    filesWritten: artifacts.size,
    milestones: gsd2Data.milestones.length,
    preview,
  }, raw);
}

module.exports = {
  findGsd2Root,
  parseGsd2,
  buildPlanningArtifacts,
  buildPreview,
  writePlanningDir,
  cmdFromGsd2,
  // Exported for unit tests
  parseSlicesFromRoadmap,
  parseMilestoneTitle,
  parseTaskTitle,
  parseTaskDescription,
  parseTaskMustHaves,
  buildPlanMd,
  buildSummaryMd,
  buildContextMd,
  buildRoadmapMd,
  buildStateMd,
  slugify,
  zeroPad,
};
