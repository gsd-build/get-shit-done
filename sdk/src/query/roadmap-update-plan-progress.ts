/**
 * roadmap.update-plan-progress — sync ROADMAP.md progress table + plan checkboxes
 * from on-disk PLAN/SUMMARY counts for a phase.
 *
 * Port of `cmdRoadmapUpdatePlanProgress` from get-shit-done/bin/lib/roadmap.cjs
 * (lines 257–354). Uses `findPhase` for disk stats and `readModifyWriteRoadmapMd`
 * for atomic writes (same pattern as `phase.complete`).
 */

import { findPhase } from './phase.js';
import { readModifyWriteRoadmapMd, replaceInCurrentMilestone } from './phase-lifecycle.js';
import { existsSync } from 'node:fs';
import { escapeRegex, planningPaths } from './helpers.js';
import { GSDError, ErrorClassification } from '../errors.js';
import type { QueryHandler } from './utils.js';

export const roadmapUpdatePlanProgress: QueryHandler = async (args, projectDir, workstream) => {
  const phaseNum = args[0];
  if (!phaseNum) {
    throw new GSDError('phase number required for roadmap update-plan-progress', ErrorClassification.Validation);
  }

  const phaseResult = await findPhase([phaseNum], projectDir, workstream);
  const info = phaseResult.data as {
    found: boolean;
    plans: string[];
    summaries: string[];
  };

  if (!info.found) {
    throw new GSDError(`Phase ${phaseNum} not found`, ErrorClassification.Validation);
  }

  const planCount = info.plans.length;
  const summaryCount = info.summaries.length;

  if (planCount === 0) {
    return {
      data: {
        updated: false,
        reason: 'No plans found',
        plan_count: 0,
        summary_count: 0,
      },
    };
  }

  const isComplete = summaryCount >= planCount;
  const status = isComplete ? 'Complete' : summaryCount > 0 ? 'In Progress' : 'Planned';
  const today = new Date().toISOString().split('T')[0]!;

  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  if (!existsSync(roadmapPath)) {
    return {
      data: {
        updated: false,
        reason: 'ROADMAP.md not found',
        plan_count: planCount,
        summary_count: summaryCount,
      },
    };
  }

  await readModifyWriteRoadmapMd(projectDir, (roadmapContent) => {
    const phaseEscaped = escapeRegex(phaseNum);

    const tableRowPattern = new RegExp(
      `^(\\|\\s*${phaseEscaped}\\.?\\s[^|]*(?:\\|[^\\n]*))$`,
      'im',
    );
    const dateField = isComplete ? ` ${today} ` : '  ';
    roadmapContent = roadmapContent.replace(tableRowPattern, (fullRow) => {
      const cells = fullRow.split('|').slice(1, -1);
      if (cells.length === 5) {
        cells[2] = ` ${summaryCount}/${planCount} `;
        cells[3] = ` ${status.padEnd(11)}`;
        cells[4] = dateField;
      } else if (cells.length === 4) {
        cells[1] = ` ${summaryCount}/${planCount} `;
        cells[2] = ` ${status.padEnd(11)}`;
        cells[3] = dateField;
      }
      return '|' + cells.join('|') + '|';
    });

    const planCountPattern = new RegExp(
      `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:\\*\\*\\s*)[^\\n]+`,
      'i',
    );
    const planCountText = isComplete
      ? `${summaryCount}/${planCount} plans complete`
      : `${summaryCount}/${planCount} plans executed`;
    roadmapContent = replaceInCurrentMilestone(roadmapContent, planCountPattern, `$1${planCountText}`);

    if (isComplete) {
      const checkboxPattern = new RegExp(
        `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseEscaped}[:\\s][^\\n]*)`,
        'i',
      );
      roadmapContent = replaceInCurrentMilestone(
        roadmapContent,
        checkboxPattern,
        `$1x$2 (completed ${today})`,
      );
    }

    const summaries = info.summaries;
    for (const summaryFile of summaries) {
      const planId = summaryFile.replace('-SUMMARY.md', '').replace('SUMMARY.md', '');
      if (!planId) continue;
      const planEscaped = escapeRegex(planId);
      const planCheckboxPattern = new RegExp(
        `(-\\s*\\[) (\\]\\s*(?:\\*\\*)?${planEscaped}(?:\\*\\*)?)`,
        'i',
      );
      roadmapContent = roadmapContent.replace(planCheckboxPattern, '$1x$2');
    }

    return roadmapContent;
  }, workstream);

  return {
    data: {
      updated: true,
      phase: phaseNum,
      plan_count: planCount,
      summary_count: summaryCount,
      status,
      complete: isComplete,
    },
  };
};
