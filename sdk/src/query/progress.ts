/**
 * Progress query handlers — milestone progress rendering in JSON format.
 *
 * Ported from get-shit-done/bin/lib/commands.cjs (cmdProgressRender, determinePhaseStatus).
 * Provides progress handler that scans disk for plan/summary counts per phase
 * and determines status via VERIFICATION.md inspection.
 *
 * @example
 * ```typescript
 * import { progressJson } from './progress.js';
 *
 * const result = await progressJson([], '/project');
 * // { data: { milestone_version: 'v3.0', phases: [...], total_plans: 6, percent: 83 } }
 * ```
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { comparePhaseNum, normalizePhaseName, planningPaths, toPosixPath } from './helpers.js';
import { getMilestoneInfo, extractCurrentMilestone, roadmapGetPhase } from './roadmap.js';
import { getMilestonePhaseFilter } from './state.js';
import { findPhase } from './phase.js';
import type { QueryHandler } from './utils.js';

// ─── Internal helpers ─────────────────────────────────────────────────────

/**
 * Determine the status of a phase based on plan/summary counts and verification state.
 *
 * Port of determinePhaseStatus from commands.cjs lines 15-36.
 *
 * @param plans - Number of PLAN.md files in the phase directory
 * @param summaries - Number of SUMMARY.md files in the phase directory
 * @param phaseDir - Absolute path to the phase directory
 * @returns Status string: Pending, Planned, In Progress, Executed, Complete, Needs Review
 */
export async function determinePhaseStatus(
  plans: number,
  summaries: number,
  phaseDir: string,
  defaultWhenNoPlans: string = 'Pending',
): Promise<string> {
  if (plans === 0) return defaultWhenNoPlans;
  if (summaries < plans && summaries > 0) return 'In Progress';
  if (summaries < plans) return 'Planned';

  // summaries >= plans — check verification
  try {
    const files = await readdir(phaseDir);
    const verificationFile = files.find(f => f === 'VERIFICATION.md' || f.endsWith('-VERIFICATION.md'));
    if (verificationFile) {
      const content = await readFile(join(phaseDir, verificationFile), 'utf-8');
      if (/status:\s*passed/i.test(content)) return 'Complete';
      if (/status:\s*human_needed/i.test(content)) return 'Needs Review';
      if (/status:\s*gaps_found/i.test(content)) return 'Executed';
      // Verification exists but unrecognized status — treat as executed
      return 'Executed';
    }
  } catch { /* directory read failed — fall through */ }

  // No verification file — executed but not verified
  return 'Executed';
}

// ─── Exported handlers ────────────────────────────────────────────────────

/**
 * Query handler for progress / progress.json.
 *
 * Port of cmdProgressRender (JSON format) from commands.cjs lines 535-597.
 * Scans phases directory, counts plans/summaries, determines status per phase.
 *
 * @param args - Unused
 * @param projectDir - Project root directory
 * @returns QueryResult with milestone progress data
 */
export const progressJson: QueryHandler = async (_args, projectDir, workstream) => {
  const phasesDir = planningPaths(projectDir, workstream).phases;
  const milestone = await getMilestoneInfo(projectDir, workstream);

  const phases: Array<Record<string, unknown>> = [];
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => comparePhaseNum(a, b));

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)*)-?(.*)/);
      const phaseNum = dm ? dm[1] : dir;
      const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
      const phaseFiles = await readdir(join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;

      totalPlans += plans;
      totalSummaries += summaries;

      const status = await determinePhaseStatus(plans, summaries, join(phasesDir, dir));

      phases.push({ number: phaseNum, name: phaseName, plans, summaries, status });
    }
  } catch { /* intentionally empty */ }

  const percent = totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0;

  return {
    data: {
      milestone_version: milestone.version,
      milestone_name: milestone.name,
      phases,
      total_plans: totalPlans,
      total_summaries: totalSummaries,
      percent,
    },
  };
};

// ─── progressBar ─────────────────────────────────────────────────────────

/**
 * Progress bar line — port of `cmdProgressRender` `format === 'bar'` from commands.cjs (lines 588–593).
 * Uses the same plan/summary counts as `progressJson` / CJS (not `roadmap.analyze` percent).
 */
export const progressBar: QueryHandler = async (_args, projectDir, workstream) => {
  const json = await progressJson([], projectDir, workstream);
  const d = json.data as {
    total_plans: number;
    total_summaries: number;
    percent: number;
  };
  const totalPlans = d.total_plans;
  const totalSummaries = d.total_summaries;
  const percent = d.percent;
  const barWidth = 20;
  const filled = Math.round((percent / 100) * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const text = `[${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)`;
  return { data: { bar: text, percent, completed: totalSummaries, total: totalPlans } };
};

/**
 * Markdown progress table — port of `cmdProgressRender` `format === 'table'` from commands.cjs (lines 575–587).
 */
export const progressTable: QueryHandler = async (_args, projectDir, workstream) => {
  const json = await progressJson([], projectDir, workstream);
  const d = json.data as {
    milestone_version: string;
    milestone_name: string;
    phases: Array<{
      number: string;
      name: string;
      plans: number;
      summaries: number;
      status: string;
    }>;
    total_plans: number;
    total_summaries: number;
    percent: number;
  };
  const { milestone_version, milestone_name, phases, total_plans, total_summaries, percent } = d;
  const barWidth = 10;
  const filled = Math.round((percent / 100) * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  let out = `# ${milestone_version} ${milestone_name}\n\n`;
  out += `**Progress:** [${bar}] ${total_summaries}/${total_plans} plans (${percent}%)\n\n`;
  out += '| Phase | Name | Plans | Status |\n';
  out += '|-------|------|-------|--------|\n';
  for (const p of phases) {
    out += `| ${p.number} | ${p.name} | ${p.summaries}/${p.plans} | ${p.status} |\n`;
  }
  return { data: { rendered: out } };
};

// ─── statsJson ───────────────────────────────────────────────────────────

/**
 * Statistics aggregate — port of `cmdStats` JSON/table output from commands.cjs lines 816–971.
 */
export const statsJson: QueryHandler = async (args, projectDir, workstream) => {
  const format = args[0] || 'json';
  const phasesDir = planningPaths(projectDir, workstream).phases;
  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  const reqPath = planningPaths(projectDir, workstream).requirements;
  const statePath = planningPaths(projectDir, workstream).state;
  const milestone = await getMilestoneInfo(projectDir, workstream);
  const isDirInMilestone = await getMilestonePhaseFilter(projectDir, workstream);

  const phasesByNumber = new Map<
    string,
    { number: string; name: string; plans: number; summaries: number; status: string }
  >();

  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const roadmapContent = await extractCurrentMilestone(await readFile(roadmapPath, 'utf-8'), projectDir, workstream);
    const headingPattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = headingPattern.exec(roadmapContent)) !== null) {
      const key = normalizePhaseName(match[1]);
      phasesByNumber.set(key, {
        number: key,
        name: match[2].replace(/\(INSERTED\)/i, '').trim(),
        plans: 0,
        summaries: 0,
        status: 'Not Started',
      });
    }
  } catch { /* intentionally empty */ }

  try {
    const entries = readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(isDirInMilestone)
      .sort((a, b) => comparePhaseNum(a, b));

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
      const phaseNum = dm ? dm[1] : dir;
      const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
      const phaseFiles = readdirSync(join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;

      totalPlans += plans;
      totalSummaries += summaries;

      const status = await determinePhaseStatus(plans, summaries, join(phasesDir, dir), 'Not Started');

      const normalizedNum = normalizePhaseName(phaseNum);
      const existing = phasesByNumber.get(normalizedNum);
      phasesByNumber.set(normalizedNum, {
        number: normalizedNum,
        name: existing?.name || phaseName,
        plans: (existing?.plans || 0) + plans,
        summaries: (existing?.summaries || 0) + summaries,
        status,
      });
    }
  } catch { /* intentionally empty */ }

  const phases = [...phasesByNumber.values()].sort((a, b) => comparePhaseNum(a.number, b.number));
  const completedPhases = phases.filter(p => p.status === 'Complete').length;
  const planPercent = totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0;
  const percent =
    phases.length > 0 ? Math.min(100, Math.round((completedPhases / phases.length) * 100)) : 0;

  let requirementsTotal = 0;
  let requirementsComplete = 0;
  try {
    if (existsSync(reqPath)) {
      const reqContent = readFileSync(reqPath, 'utf-8');
      const checked = reqContent.match(/^- \[x\] \*\*/gm);
      const unchecked = reqContent.match(/^- \[ \] \*\*/gm);
      requirementsComplete = checked ? checked.length : 0;
      requirementsTotal = requirementsComplete + (unchecked ? unchecked.length : 0);
    }
  } catch { /* intentionally empty */ }

  let lastActivity: string | null = null;
  try {
    if (existsSync(statePath)) {
      const stateContent = readFileSync(statePath, 'utf-8');
      const activityMatch =
        stateContent.match(/^last_activity:\s*(.+)$/im)
        || stateContent.match(/\*\*Last Activity:\*\*\s*(.+)/i)
        || stateContent.match(/^Last Activity:\s*(.+)$/im)
        || stateContent.match(/^Last activity:\s*(.+)$/im);
      if (activityMatch) lastActivity = activityMatch[1].trim();
    }
  } catch { /* intentionally empty */ }

  const { execGit } = await import('./commit.js');
  let gitCommits = 0;
  let gitFirstCommitDate: string | null = null;
  const commitCount = execGit(projectDir, ['rev-list', '--count', 'HEAD']);
  if (commitCount.exitCode === 0) {
    gitCommits = parseInt(commitCount.stdout, 10) || 0;
  }
  const rootHash = execGit(projectDir, ['rev-list', '--max-parents=0', 'HEAD']);
  if (rootHash.exitCode === 0 && rootHash.stdout) {
    const firstCommit = rootHash.stdout.split('\n')[0].trim();
    const firstDate = execGit(projectDir, ['show', '-s', '--format=%as', firstCommit]);
    if (firstDate.exitCode === 0) {
      gitFirstCommitDate = firstDate.stdout.trim() || null;
    }
  }

  const result = {
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    phases,
    phases_completed: completedPhases,
    phases_total: phases.length,
    total_plans: totalPlans,
    total_summaries: totalSummaries,
    percent,
    plan_percent: planPercent,
    requirements_total: requirementsTotal,
    requirements_complete: requirementsComplete,
    git_commits: gitCommits,
    git_first_commit_date: gitFirstCommitDate,
    last_activity: lastActivity,
  };

  if (format === 'table') {
    const barWidth = 10;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    let out = `# ${milestone.version} ${milestone.name} \u2014 Statistics\n\n`;
    out += `**Progress:** [${bar}] ${completedPhases}/${phases.length} phases (${percent}%)\n`;
    if (totalPlans > 0) {
      out += `**Plans:** ${totalSummaries}/${totalPlans} complete (${planPercent}%)\n`;
    }
    out += `**Phases:** ${completedPhases}/${phases.length} complete\n`;
    if (requirementsTotal > 0) {
      out += `**Requirements:** ${requirementsComplete}/${requirementsTotal} complete\n`;
    }
    out += '\n';
    out += '| Phase | Name | Plans | Completed | Status |\n';
    out += '|-------|------|-------|-----------|--------|\n';
    for (const p of phases) {
      out += `| ${p.number} | ${p.name} | ${p.plans} | ${p.summaries} | ${p.status} |\n`;
    }
    if (gitCommits > 0) {
      out += `\n**Git:** ${gitCommits} commits`;
      if (gitFirstCommitDate) out += ` (since ${gitFirstCommitDate})`;
      out += '\n';
    }
    if (lastActivity) out += `**Last activity:** ${lastActivity}\n`;
    return { data: { rendered: out } };
  }

  return { data: result };
};

/**
 * Markdown statistics table — port of `cmdStats` `format === 'table'` from commands.cjs (lines 942–967).
 * Delegates to `statsJson` with `['table']` (same `rendered` string as CJS).
 */
export const statsTable: QueryHandler = async (_args, projectDir, workstream) => {
  return statsJson(['table'], projectDir, workstream);
};

// ─── todoMatchPhase ──────────────────────────────────────────────────────

/**
 * Match pending todos against a phase — port of `cmdTodoMatchPhase` from commands.cjs lines 612–729.
 */
export const todoMatchPhase: QueryHandler = async (args, projectDir) => {
  const phase = args[0];
  if (!phase) {
    throw new GSDError('phase required for todo match-phase', ErrorClassification.Validation);
  }

  const pendingDir = join(projectDir, '.planning', 'todos', 'pending');
  const todos: Array<{
    file: string;
    title: string;
    area: string;
    files: string[];
    body: string;
  }> = [];

  try {
    const files = readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = readFileSync(join(pendingDir, file), 'utf-8');
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);
        const filesMatch = content.match(/^files:\s*(.+)$/m);
        const body = content.replace(/^(title|area|files|created|priority):.*$/gm, '').trim();

        todos.push({
          file,
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: areaMatch ? areaMatch[1].trim() : 'general',
          files: filesMatch ? filesMatch[1].trim().split(/[,\s]+/).filter(Boolean) : [],
          body: body.slice(0, 200),
        });
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  if (todos.length === 0) {
    return { data: { phase, matches: [], todo_count: 0 } };
  }

  const rp = await roadmapGetPhase([phase], projectDir);
  const pd = rp.data as Record<string, unknown>;
  let phaseName = '';
  let phaseGoal = '';
  let phaseSection = '';
  if (pd && pd.found === true) {
    phaseName = String(pd.phase_name || '');
    phaseGoal = pd.goal != null ? String(pd.goal) : '';
    phaseSection = String(pd.section || '');
  }

  const phaseText = `${phaseName} ${phaseGoal} ${phaseSection}`.toLowerCase();
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'are', 'was', 'has', 'have',
    'been', 'not', 'but', 'all', 'can', 'into', 'each', 'when', 'any', 'use', 'new',
  ]);
  const phaseKeywords = new Set(
    phaseText
      .split(/[\s\-_/.,;:()\[\]{}|]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 2 && !stopWords.has(w)),
  );

  const fp = await findPhase([phase], projectDir);
  const phaseInfoDisk = fp.data as Record<string, unknown>;
  const phasePlans: string[] = [];
  if (phaseInfoDisk && phaseInfoDisk.found) {
    try {
      const phaseDir = join(projectDir, phaseInfoDisk.directory as string);
      const planFiles = readdirSync(phaseDir).filter(f => f.endsWith('-PLAN.md'));
      for (const pf of planFiles) {
        try {
          const planContent = readFileSync(join(phaseDir, pf), 'utf-8');
          const fmFiles = planContent.match(/files_modified:\s*\[([^\]]*)\]/);
          if (fmFiles) {
            phasePlans.push(
              ...fmFiles[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean),
            );
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  const matches: Array<{ file: string; title: string; area: string; score: number; reasons: string[] }> = [];
  for (const todo of todos) {
    let score = 0;
    const reasons: string[] = [];

    const todoWords = `${todo.title} ${todo.body}`
      .toLowerCase()
      .split(/[\s\-_/.,;:()\[\]{}|]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 2 && !stopWords.has(w));

    const matchedKeywords = todoWords.filter(w => phaseKeywords.has(w));
    if (matchedKeywords.length > 0) {
      score += Math.min(matchedKeywords.length * 0.2, 0.6);
      reasons.push(`keywords: ${[...new Set(matchedKeywords)].slice(0, 5).join(', ')}`);
    }

    if (todo.area !== 'general' && phaseText.includes(todo.area.toLowerCase())) {
      score += 0.3;
      reasons.push(`area: ${todo.area}`);
    }

    if (todo.files.length > 0 && phasePlans.length > 0) {
      const fileOverlap = todo.files.filter(f =>
        phasePlans.some(pf => pf.includes(f) || f.includes(pf)),
      );
      if (fileOverlap.length > 0) {
        score += 0.4;
        reasons.push(`files: ${fileOverlap.slice(0, 3).join(', ')}`);
      }
    }

    if (score > 0) {
      matches.push({
        file: todo.file,
        title: todo.title,
        area: todo.area,
        score: Math.round(score * 100) / 100,
        reasons,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);

  return { data: { phase, matches, todo_count: todos.length } };
};

// ─── listTodos ──────────────────────────────────────────────────────────

/**
 * List pending todos from .planning/todos/pending/, optionally filtered by area.
 *
 * Port of `cmdListTodos` from commands.cjs lines 74-109.
 *
 * @param args - args[0]: optional area filter
 */
export const listTodos: QueryHandler = async (args, projectDir) => {
  const area = args[0] || null;
  const pendingDir = join(projectDir, '.planning', 'todos', 'pending');

  const todos: Array<{ file: string; created: string; title: string; area: string; path: string }> = [];

  try {
    const files = readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = readFileSync(join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);

        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';
        if (area && todoArea !== area) continue;

        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: toPosixPath(relative(projectDir, join(pendingDir, file))),
        });
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  return { data: { count: todos.length, todos } };
};

// ─── todoComplete ───────────────────────────────────────────────────────

/**
 * Move a todo from pending to completed, adding a completion timestamp.
 *
 * Port of `cmdTodoComplete` from commands.cjs lines 724-749.
 *
 * @param args - args[0]: filename (required)
 */
export const todoComplete: QueryHandler = async (args, projectDir) => {
  const filename = args[0];
  if (!filename) {
    throw new GSDError('filename required for todo complete', ErrorClassification.Validation);
  }

  const pendingDir = join(projectDir, '.planning', 'todos', 'pending');
  const completedDir = join(projectDir, '.planning', 'todos', 'completed');
  const sourcePath = join(pendingDir, filename);

  if (!existsSync(sourcePath)) {
    throw new GSDError(`Todo not found: ${filename}`, ErrorClassification.Validation);
  }

  mkdirSync(completedDir, { recursive: true });

  let content = readFileSync(sourcePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  content = `completed: ${today}\n` + content;

  writeFileSync(join(completedDir, filename), content, 'utf-8');
  unlinkSync(sourcePath);

  return { data: { completed: true, file: filename, date: today } };
};
