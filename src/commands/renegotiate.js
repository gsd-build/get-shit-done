// @ts-check
'use strict';

/**
 * renegotiate command logic.
 *
 * Archives a declaration to FUTURE-ARCHIVE.md, marks it RENEGOTIATED
 * in FUTURE.md, and identifies orphaned milestones.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { parseFutureFile, writeFutureFile, appendToArchive } = require('../artifacts/future');
const { isCompleted } = require('../graph/engine');

/**
 * Run the renegotiate command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Command arguments (--declaration D-XX --reason "...")
 * @returns {{ archived: {id: string, title: string, archivedAt: string}, orphanedMilestones: Array<{id: string, title: string, status: string, actions: Array<{id: string, title: string, status: string}>}>, archivePath: string, nextStep: string } | { error: string }}
 */
function runRenegotiate(cwd, args) {
  const declId = parseFlag(args || [], 'declaration');
  const reason = parseFlag(args || [], 'reason');

  if (!declId) {
    return { error: 'Missing --declaration flag. Usage: renegotiate --declaration D-XX --reason "..."' };
  }
  if (!reason) {
    return { error: 'Missing --reason flag. Usage: renegotiate --declaration D-XX --reason "..."' };
  }

  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag } = graphResult;

  // Validate declaration exists
  const declNode = dag.getNode(declId);
  if (!declNode || declNode.type !== 'declaration') {
    return { error: `Declaration not found: ${declId}` };
  }

  const planningDir = join(cwd, '.planning');
  const futurePath = join(planningDir, 'FUTURE.md');
  const archivePath = join(planningDir, 'FUTURE-ARCHIVE.md');

  // Read and update FUTURE.md
  const futureContent = existsSync(futurePath) ? readFileSync(futurePath, 'utf-8') : '';
  const declarations = parseFutureFile(futureContent);

  const declEntry = declarations.find(d => d.id === declId);
  if (!declEntry) {
    return { error: `Declaration ${declId} not found in FUTURE.md` };
  }

  // Mark as RENEGOTIATED
  declEntry.status = 'RENEGOTIATED';

  // Determine project name from existing file header
  const headerMatch = futureContent.match(/^# Future: (.+)/m);
  const projectName = headerMatch ? headerMatch[1].trim() : 'Project';

  writeFileSync(futurePath, writeFutureFile(declarations, projectName));

  // Archive the declaration
  const archivedAt = new Date().toISOString();
  const existingArchive = existsSync(archivePath) ? readFileSync(archivePath, 'utf-8') : '';
  const updatedArchive = appendToArchive(existingArchive, {
    id: declId,
    title: declEntry.title,
    statement: declEntry.statement,
    archivedAt,
    reason,
    replacedBy: '',
    statusAtArchive: 'RENEGOTIATED',
  });
  writeFileSync(archivePath, updatedArchive);

  // Find orphaned milestones: milestones that realize ONLY this declaration
  const downstream = dag.getDownstream(declId);
  const milestones = downstream.filter(n => n.type === 'milestone');

  const orphanedMilestones = [];
  for (const m of milestones) {
    const upstream = dag.getUpstream(m.id);
    const realizesOnlyThis = upstream.length === 1 && upstream[0].id === declId;

    if (realizesOnlyThis) {
      // Get actions for this milestone
      const mDownstream = dag.getDownstream(m.id);
      const actions = mDownstream
        .filter(n => n.type === 'action')
        .map(a => ({ id: a.id, title: a.title, status: a.status }));

      orphanedMilestones.push({
        id: m.id,
        title: m.title,
        status: m.status,
        actions,
      });
    }
  }

  return {
    archived: { id: declId, title: declEntry.title, archivedAt },
    orphanedMilestones,
    archivePath,
    nextStep: 'Create replacement declaration or reassign milestones',
  };
}

module.exports = { runRenegotiate };
