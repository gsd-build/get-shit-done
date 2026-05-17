'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/workstream-inventory/builder.ts
 * Regenerate: cd sdk && npm run gen:workstream-inventory-builder
 *
 * Workstream Inventory Builder — pure projection from pre-collected
 * filesystem data to typed WorkstreamInventory. No I/O. No async.
 */

const path = require('path');
const relative = path.relative;

// Internal helpers
function toPosixPath(p) {
    return p.split('\\').join('/');
}

function isCompletedInventory(status) {
    const s = String(status ?? '').trim().toLowerCase();
    return /\bmilestone\s+complete\b/.test(s) || /\barchived\b/.test(s);
}

function buildWorkstreamInventory(inputs) {
    const { name, projectDir, workstreamDir, phaseDirNames, activeWorkstreamName, phaseFilesCounts, roadmapPhaseCount, stateProjection, filesExist, } = inputs;
    // Index counts by directory for O(1) lookup during sort/iteration
    const countsMap = new Map();
    for (const entry of phaseFilesCounts) {
        countsMap.set(entry.directory, { planCount: entry.planCount, summaryCount: entry.summaryCount });
    }
    const phases = [];
    let completedPhases = 0;
    let totalPlans = 0;
    let completedPlans = 0;
    for (const dir of [...phaseDirNames].sort()) {
        const counts = countsMap.get(dir) ?? { planCount: 0, summaryCount: 0 };
        const status = counts.summaryCount >= counts.planCount && counts.planCount > 0
            ? 'complete'
            : counts.planCount > 0
                ? 'in_progress'
                : 'pending';
        totalPlans += counts.planCount;
        completedPlans += Math.min(counts.summaryCount, counts.planCount);
        if (status === 'complete')
            completedPhases++;
        phases.push({
            directory: dir,
            status,
            plan_count: counts.planCount,
            summary_count: counts.summaryCount,
        });
    }
    return {
        name,
        path: toPosixPath(relative(projectDir, workstreamDir)),
        active: name === activeWorkstreamName,
        files: {
            roadmap: filesExist.roadmap,
            state: filesExist.state,
            requirements: filesExist.requirements,
        },
        status: stateProjection.status,
        current_phase: stateProjection.current_phase,
        last_activity: stateProjection.last_activity,
        phases,
        phase_count: phases.length,
        completed_phases: completedPhases,
        roadmap_phase_count: roadmapPhaseCount,
        total_plans: totalPlans,
        completed_plans: completedPlans,
        progress_percent: roadmapPhaseCount > 0
            ? Math.min(100, Math.round((completedPhases / roadmapPhaseCount) * 100))
            : 0,
    };
}

module.exports = { buildWorkstreamInventory, isCompletedInventory };
