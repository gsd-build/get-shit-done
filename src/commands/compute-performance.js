// @ts-check
'use strict';

/**
 * compute-performance command logic.
 *
 * Computes per-declaration performance as alignment x integrity,
 * using qualitative labels (HIGH/MEDIUM/LOW) only.
 *
 * Zero runtime dependencies. CJS module.
 */

const { buildDagFromDisk } = require('./build-dag');
const { isCompleted } = require('../graph/engine');

/**
 * Map a ratio to a qualitative label.
 * @param {number} ratio - 0 to 1
 * @param {number} highThreshold
 * @param {number} medThreshold
 * @returns {'HIGH' | 'MEDIUM' | 'LOW'}
 */
function ratioToLabel(ratio, highThreshold, medThreshold) {
  if (ratio >= highThreshold) return 'HIGH';
  if (ratio >= medThreshold) return 'MEDIUM';
  return 'LOW';
}

/**
 * Combine two labels into a performance label.
 * If either is LOW -> LOW. If both HIGH -> HIGH. Otherwise MEDIUM.
 * @param {string} alignment
 * @param {string} integrity
 * @returns {'HIGH' | 'MEDIUM' | 'LOW'}
 */
function combineLabels(alignment, integrity) {
  if (alignment === 'LOW' || integrity === 'LOW') return 'LOW';
  if (alignment === 'HIGH' && integrity === 'HIGH') return 'HIGH';
  return 'MEDIUM';
}

/**
 * Run the compute-performance command.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ perDeclaration: Array<{declarationId: string, declarationTitle: string, statement: string, alignment: {level: string, milestonesTotal: number, milestonesWithActions: number}, integrity: {level: string, verified: number, broken: number, pending: number, total: number}, performance: string}>, rollup: {alignment: string, integrity: string, performance: string} } | { error: string }}
 */
function runComputePerformance(cwd) {
  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag } = graphResult;
  const declarations = dag.getDeclarations();

  if (declarations.length === 0) {
    return {
      perDeclaration: [],
      rollup: { alignment: 'HIGH', integrity: 'HIGH', performance: 'HIGH' },
    };
  }

  const perDeclaration = declarations.map(decl => {
    // Get downstream milestones
    const downstream = dag.getDownstream(decl.id);
    const milestones = downstream.filter(n => n.type === 'milestone');

    // Structural alignment: milestones with at least one action / total milestones
    let milestonesWithActions = 0;
    for (const m of milestones) {
      const mDownstream = dag.getDownstream(m.id);
      if (mDownstream.some(n => n.type === 'action')) {
        milestonesWithActions++;
      }
    }

    const alignmentRatio = milestones.length > 0
      ? milestonesWithActions / milestones.length
      : 0;
    const alignmentLevel = milestones.length === 0
      ? 'LOW'
      : ratioToLabel(alignmentRatio, 0.8, 0.5);

    // Integrity: verified vs broken vs pending
    let verified = 0;
    let broken = 0;
    let pending = 0;
    for (const m of milestones) {
      const status = m.status;
      if (status === 'KEPT' || status === 'HONORED' || status === 'RENEGOTIATED') {
        verified++;
      } else if (status === 'BROKEN') {
        broken++;
      } else {
        pending++;
      }
    }

    let integrityLevel;
    if (milestones.length === 0) {
      integrityLevel = 'HIGH'; // Vacuously true
    } else {
      const brokenRatio = broken / milestones.length;
      const verifiedRatio = verified / milestones.length;
      if (brokenRatio > 0.3) {
        integrityLevel = 'LOW';
      } else if (verifiedRatio >= 0.7 && broken === 0) {
        integrityLevel = 'HIGH';
      } else if (verifiedRatio >= 0.4) {
        integrityLevel = 'MEDIUM';
      } else {
        integrityLevel = 'LOW';
      }
    }

    const performance = combineLabels(alignmentLevel, integrityLevel);

    return {
      declarationId: decl.id,
      declarationTitle: decl.title,
      statement: decl.metadata?.statement || decl.title,
      alignment: {
        level: alignmentLevel,
        milestonesTotal: milestones.length,
        milestonesWithActions,
      },
      integrity: {
        level: integrityLevel,
        verified,
        broken,
        pending,
        total: milestones.length,
      },
      performance,
    };
  });

  // Project rollup: aggregate across declarations
  const hasAnyLowAlignment = perDeclaration.some(d => d.alignment.level === 'LOW');
  const hasAnyLowIntegrity = perDeclaration.some(d => d.integrity.level === 'LOW');
  const allHighAlignment = perDeclaration.every(d => d.alignment.level === 'HIGH');
  const allHighIntegrity = perDeclaration.every(d => d.integrity.level === 'HIGH');

  const rollupAlignment = hasAnyLowAlignment ? 'LOW' : allHighAlignment ? 'HIGH' : 'MEDIUM';
  const rollupIntegrity = hasAnyLowIntegrity ? 'LOW' : allHighIntegrity ? 'HIGH' : 'MEDIUM';
  const rollupPerformance = combineLabels(rollupAlignment, rollupIntegrity);

  return {
    perDeclaration,
    rollup: {
      alignment: rollupAlignment,
      integrity: rollupIntegrity,
      performance: rollupPerformance,
    },
  };
}

module.exports = { runComputePerformance };
