/**
 * Migrate — Migration functions for restructuring GSD projects
 *
 * Enables migration from legacy .planning/phases/ structure to
 * parallel milestones structure with .planning/milestones/{id}-{slug}/
 */

const fs = require('fs');
const path = require('path');
const { generateSlugInternal } = require('./core.cjs');

// ─── Migration Analysis ───────────────────────────────────────────────────────

/**
 * Analyze project for migration to parallel milestones
 * @param {string} cwd - Current working directory
 * @returns {{ can_migrate: boolean, phases: Array, suggested_milestones: Array, warnings: Array, has_parallel: boolean }}
 */
function analyzeMigration(cwd) {
  const result = {
    can_migrate: false,
    phases: [],
    suggested_milestones: [],
    warnings: [],
    has_parallel: false,
  };

  const planningDir = path.join(cwd, '.planning');
  const phasesDir = path.join(planningDir, 'phases');
  const milestonesDir = path.join(planningDir, 'milestones');

  // Check if project is initialized
  if (!fs.existsSync(planningDir)) {
    result.warnings.push('No .planning/ directory found - project not initialized');
    return result;
  }

  // Check if already has parallel milestones
  if (fs.existsSync(milestonesDir)) {
    try {
      const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
      const milestones = entries.filter(e =>
        e.isDirectory() && /^M\d+-/i.test(e.name)
      );
      if (milestones.length > 0) {
        result.has_parallel = true;
        result.warnings.push(`Project already has ${milestones.length} milestone(s)`);
      }
    } catch {
      // Ignore errors
    }
  }

  // Analyze existing phases
  if (!fs.existsSync(phasesDir)) {
    result.warnings.push('No .planning/phases/ directory found');
    return result;
  }

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const phaseDirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => {
        const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    for (const dirName of phaseDirs) {
      const phaseMatch = dirName.match(/^(\d+[A-Z]?(?:\.\d+)*)-(.+)$/i);
      if (!phaseMatch) continue;

      const phaseNum = phaseMatch[1];
      const phaseName = phaseMatch[2];
      const phasePath = path.join(phasesDir, dirName);

      // Count plans and summaries
      const files = fs.readdirSync(phasePath);
      const plans = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

      result.phases.push({
        number: phaseNum,
        name: phaseName,
        directory: dirName,
        plans: plans.length,
        summaries: summaries.length,
        completed: summaries.length === plans.length && plans.length > 0,
      });
    }

    // Can migrate if we have phases
    result.can_migrate = result.phases.length > 0;

    // Generate suggested milestone groupings (simple heuristic: all in M1)
    if (result.phases.length > 0) {
      result.suggested_milestones = [{
        id: 'M1',
        name: 'Migration',
        phases: result.phases.map(p => p.directory),
      }];
    }

  } catch (err) {
    result.warnings.push(`Error analyzing phases: ${err.message}`);
  }

  return result;
}

// ─── Migration Preview ────────────────────────────────────────────────────────

/**
 * Preview migration changes without executing
 * @param {string} cwd - Current working directory
 * @param {Object} milestoneMapping - Mapping of milestone IDs to phase directories
 * @returns {{ actions: Array<{type: string, from: string, to: string}>, warnings: Array }}
 */
function previewMigration(cwd, milestoneMapping) {
  const result = {
    actions: [],
    warnings: [],
    milestones_to_create: [],
    phases_to_move: [],
    files_to_copy: [],
  };

  if (!milestoneMapping || Object.keys(milestoneMapping).length === 0) {
    result.warnings.push('No milestone mapping provided');
    return result;
  }

  const planningDir = path.join(cwd, '.planning');
  const phasesDir = path.join(planningDir, 'phases');
  const milestonesDir = path.join(planningDir, 'milestones');

  // Validate source phases exist
  const existingPhases = new Set();
  try {
    if (fs.existsSync(phasesDir)) {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      entries.filter(e => e.isDirectory()).forEach(e => existingPhases.add(e.name));
    }
  } catch {
    result.warnings.push('Could not read phases directory');
    return result;
  }

  // Process each milestone in the mapping
  for (const [milestoneId, phases] of Object.entries(milestoneMapping)) {
    if (milestoneId === 'default') continue; // Skip default bucket for now

    const normalizedId = milestoneId.toUpperCase();
    if (!/^M\d+$/.test(normalizedId)) {
      result.warnings.push(`Invalid milestone ID: ${milestoneId} - must be M<number>`);
      continue;
    }

    // Determine milestone name from first phase or use ID
    let milestoneName = normalizedId;
    if (typeof phases === 'object' && phases.name) {
      milestoneName = phases.name;
    } else if (Array.isArray(phases) && phases.length > 0) {
      const firstPhase = phases[0];
      const match = firstPhase.match(/^\d+[A-Z]?(?:\.\d+)*-(.+)$/i);
      if (match) {
        milestoneName = match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    }

    const slug = generateSlugInternal(milestoneName);
    const milestoneDir = path.join(milestonesDir, `${normalizedId}-${slug}`);
    const milestonePhasesDir = path.join(milestoneDir, 'phases');

    // Check if milestone already exists
    if (fs.existsSync(milestoneDir)) {
      result.warnings.push(`Milestone directory already exists: ${normalizedId}-${slug}`);
    } else {
      result.milestones_to_create.push({
        id: normalizedId,
        name: milestoneName,
        slug,
        path: milestoneDir,
      });
      result.actions.push({
        type: 'create_milestone',
        target: `${normalizedId}-${slug}`,
        path: path.join('.planning', 'milestones', `${normalizedId}-${slug}`),
      });
    }

    // Process phases for this milestone
    const phaseList = Array.isArray(phases) ? phases : (phases.phases || []);
    for (const phaseDirName of phaseList) {
      if (!existingPhases.has(phaseDirName)) {
        result.warnings.push(`Phase not found: ${phaseDirName}`);
        continue;
      }

      const from = path.join('.planning', 'phases', phaseDirName);
      const to = path.join('.planning', 'milestones', `${normalizedId}-${slug}`, 'phases', phaseDirName);

      result.phases_to_move.push({
        directory: phaseDirName,
        from: path.join(phasesDir, phaseDirName),
        to: path.join(milestonePhasesDir, phaseDirName),
      });
      result.actions.push({
        type: 'move_phase',
        from,
        to,
      });
    }

    // Plan to copy ROADMAP.md and create milestone-specific one
    result.actions.push({
      type: 'create_roadmap',
      target: `${normalizedId}-${slug}/ROADMAP.md`,
      path: path.join('.planning', 'milestones', `${normalizedId}-${slug}`, 'ROADMAP.md'),
    });

    result.actions.push({
      type: 'create_requirements',
      target: `${normalizedId}-${slug}/REQUIREMENTS.md`,
      path: path.join('.planning', 'milestones', `${normalizedId}-${slug}`, 'REQUIREMENTS.md'),
    });
  }

  // Handle 'default' bucket - phases not explicitly mapped
  if (milestoneMapping.default) {
    const defaultPhases = Array.isArray(milestoneMapping.default)
      ? milestoneMapping.default
      : (milestoneMapping.default.phases || []);

    for (const phaseDirName of defaultPhases) {
      if (!existingPhases.has(phaseDirName)) {
        result.warnings.push(`Default phase not found: ${phaseDirName}`);
        continue;
      }
      // Default phases stay in .planning/phases/ (mixed mode)
      result.actions.push({
        type: 'keep_legacy',
        target: phaseDirName,
        path: path.join('.planning', 'phases', phaseDirName),
      });
    }
  }

  return result;
}

// ─── Migration Execution ──────────────────────────────────────────────────────

/**
 * Execute migration with backup
 * @param {string} cwd - Current working directory
 * @param {Object} milestoneMapping - Mapping of milestone IDs to phase directories
 * @param {Object} options - Migration options
 * @returns {{ success: boolean, backup_path: string, actions_taken: Array, errors: Array }}
 */
function executeMigration(cwd, milestoneMapping, options = {}) {
  const result = {
    success: false,
    backup_path: null,
    actions_taken: [],
    errors: [],
    warnings: [],
  };

  const planningDir = path.join(cwd, '.planning');
  const phasesDir = path.join(planningDir, 'phases');
  const milestonesDir = path.join(planningDir, 'milestones');
  const backupsDir = path.join(planningDir, 'backups');

  // Create backup first
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `pre-migration-${timestamp}`;
  const backupPath = path.join(backupsDir, backupName);

  try {
    // Create backups directory
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.mkdirSync(backupPath, { recursive: true });

    // Create manifest
    const manifest = {
      created: new Date().toISOString(),
      type: 'pre-migration',
      files: [],
      directories: [],
    };

    // Backup phases directory
    if (fs.existsSync(phasesDir)) {
      const backupPhasesDir = path.join(backupPath, 'phases');
      copyDirectoryRecursive(phasesDir, backupPhasesDir);
      manifest.directories.push('phases');
    }

    // Backup ROADMAP.md
    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      fs.copyFileSync(roadmapPath, path.join(backupPath, 'ROADMAP.md'));
      manifest.files.push('ROADMAP.md');
    }

    // Backup STATE.md
    const statePath = path.join(planningDir, 'STATE.md');
    if (fs.existsSync(statePath)) {
      fs.copyFileSync(statePath, path.join(backupPath, 'STATE.md'));
      manifest.files.push('STATE.md');
    }

    // Backup REQUIREMENTS.md
    const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
    if (fs.existsSync(reqPath)) {
      fs.copyFileSync(reqPath, path.join(backupPath, 'REQUIREMENTS.md'));
      manifest.files.push('REQUIREMENTS.md');
    }

    // Backup config.json
    const configPath = path.join(planningDir, 'config.json');
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, path.join(backupPath, 'config.json'));
      manifest.files.push('config.json');
    }

    // Write manifest
    fs.writeFileSync(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    result.backup_path = path.join('.planning', 'backups', backupName);
    result.actions_taken.push({ type: 'backup_created', path: result.backup_path });

  } catch (err) {
    result.errors.push(`Failed to create backup: ${err.message}`);
    return result;
  }

  // Preview to get actions
  const preview = previewMigration(cwd, milestoneMapping);
  result.warnings.push(...preview.warnings);

  if (preview.warnings.length > 0 && !options.force) {
    // Check for critical warnings
    const criticalWarnings = preview.warnings.filter(w =>
      w.includes('already exists') || w.includes('not found')
    );
    if (criticalWarnings.length > 0 && !options.force) {
      result.errors.push('Critical warnings found. Use --force to proceed anyway.');
      return result;
    }
  }

  try {
    // Create milestones directory
    fs.mkdirSync(milestonesDir, { recursive: true });

    // Create each milestone
    for (const milestone of preview.milestones_to_create) {
      fs.mkdirSync(milestone.path, { recursive: true });
      fs.mkdirSync(path.join(milestone.path, 'phases'), { recursive: true });

      // Create ROADMAP.md for milestone
      const roadmapContent = generateMilestoneRoadmap(milestone.name, []);
      fs.writeFileSync(path.join(milestone.path, 'ROADMAP.md'), roadmapContent, 'utf-8');

      // Create REQUIREMENTS.md for milestone
      const reqContent = generateMilestoneRequirements(milestone.name);
      fs.writeFileSync(path.join(milestone.path, 'REQUIREMENTS.md'), reqContent, 'utf-8');

      result.actions_taken.push({
        type: 'milestone_created',
        id: milestone.id,
        name: milestone.name,
        path: path.join('.planning', 'milestones', `${milestone.id}-${milestone.slug}`),
      });
    }

    // Move phases
    for (const phase of preview.phases_to_move) {
      // Ensure destination parent exists
      const destParent = path.dirname(phase.to);
      fs.mkdirSync(destParent, { recursive: true });

      // Move the phase directory
      if (options.copy) {
        copyDirectoryRecursive(phase.from, phase.to);
      } else {
        fs.renameSync(phase.from, phase.to);
      }

      result.actions_taken.push({
        type: options.copy ? 'phase_copied' : 'phase_moved',
        directory: phase.directory,
        from: path.relative(cwd, phase.from),
        to: path.relative(cwd, phase.to),
      });
    }

    // Update config.json to enable parallel milestones
    const configPath = path.join(planningDir, 'config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch {
        // Start fresh if parse fails
      }
    }
    config.parallel_milestones = true;

    // Set default milestone to first created
    if (preview.milestones_to_create.length > 0 && !config.default_milestone) {
      config.default_milestone = preview.milestones_to_create[0].id;
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    result.actions_taken.push({ type: 'config_updated', parallel_milestones: true });

    result.success = true;

  } catch (err) {
    result.errors.push(`Migration failed: ${err.message}`);
    result.errors.push('Backup available at: ' + result.backup_path);
  }

  return result;
}

// ─── Backup Restoration ───────────────────────────────────────────────────────

/**
 * Restore from migration backup
 * @param {string} cwd - Current working directory
 * @param {string} backupPath - Path to backup directory (relative or absolute)
 * @returns {{ success: boolean, restored: Array, errors: Array }}
 */
function restoreMigrationBackup(cwd, backupPath) {
  const result = {
    success: false,
    restored: [],
    errors: [],
  };

  // Resolve backup path
  const fullBackupPath = path.isAbsolute(backupPath)
    ? backupPath
    : path.join(cwd, backupPath);

  if (!fs.existsSync(fullBackupPath)) {
    result.errors.push(`Backup not found: ${backupPath}`);
    return result;
  }

  // Read manifest
  const manifestPath = path.join(fullBackupPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    result.errors.push('Invalid backup: manifest.json not found');
    return result;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    result.errors.push(`Failed to read manifest: ${err.message}`);
    return result;
  }

  const planningDir = path.join(cwd, '.planning');

  try {
    // Restore directories
    for (const dirName of manifest.directories || []) {
      const backupDir = path.join(fullBackupPath, dirName);
      const targetDir = path.join(planningDir, dirName);

      if (fs.existsSync(backupDir)) {
        // Remove current directory if exists
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Copy from backup
        copyDirectoryRecursive(backupDir, targetDir);
        result.restored.push(dirName + '/');
      }
    }

    // Restore files
    for (const fileName of manifest.files || []) {
      const backupFile = path.join(fullBackupPath, fileName);
      const targetFile = path.join(planningDir, fileName);

      if (fs.existsSync(backupFile)) {
        fs.copyFileSync(backupFile, targetFile);
        result.restored.push(fileName);
      }
    }

    // Remove milestones directory if it was created during migration
    const milestonesDir = path.join(planningDir, 'milestones');
    if (fs.existsSync(milestonesDir) && !manifest.directories?.includes('milestones')) {
      // Only remove if milestones wasn't in original backup
      fs.rmSync(milestonesDir, { recursive: true, force: true });
      result.restored.push('(removed milestones/)');
    }

    result.success = true;

  } catch (err) {
    result.errors.push(`Restore failed: ${err.message}`);
  }

  return result;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Recursively copy a directory
 */
function copyDirectoryRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Generate milestone ROADMAP.md content
 */
function generateMilestoneRoadmap(name, phases) {
  const today = new Date().toISOString().split('T')[0];

  let phasesList = '- [ ] **Phase 1: TBD** - Description';
  let phaseDetails = `### Phase 1: TBD
**Goal**: [To be defined]
**Requirements**: TBD
**Success Criteria**:
  1. [To be defined]
**Plans:** 0/0 plans`;
  let progressTable = '| 1. TBD | 0/0 | Not started | - |';

  if (phases && phases.length > 0) {
    phasesList = phases.map((p, i) => {
      const num = i + 1;
      const name = p.name || p.directory?.replace(/^\d+-/, '') || 'TBD';
      return `- [ ] **Phase ${num}: ${name}** - ${p.completed ? 'Complete' : 'In progress'}`;
    }).join('\n');

    phaseDetails = phases.map((p, i) => {
      const num = i + 1;
      const name = p.name || p.directory?.replace(/^\d+-/, '') || 'TBD';
      return `### Phase ${num}: ${name}
**Goal**: [Migrated from legacy]
**Requirements**: TBD
**Plans:** ${p.summaries || 0}/${p.plans || 0} plans`;
    }).join('\n\n');

    progressTable = phases.map((p, i) => {
      const num = i + 1;
      const name = p.name || p.directory?.replace(/^\d+-/, '') || 'TBD';
      const status = p.completed ? 'Complete' : 'In progress';
      return `| ${num}. ${name} | ${p.summaries || 0}/${p.plans || 0} | ${status} | - |`;
    }).join('\n');
  }

  return `# Roadmap: ${name}

## Overview

[Milestone description - migrated from legacy structure]

## Phases

${phasesList}

## Phase Details

${phaseDetails}

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
${progressTable}

---
*Roadmap created: ${today} (migrated)*
`;
}

/**
 * Generate milestone REQUIREMENTS.md content
 */
function generateMilestoneRequirements(name) {
  const today = new Date().toISOString().split('T')[0];

  return `# Requirements: ${name}

## Overview

Requirements for ${name} milestone (migrated from legacy structure).

## Functional Requirements

<!-- List functional requirements here -->

## Non-Functional Requirements

<!-- List non-functional requirements here -->

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|

---
*Requirements created: ${today} (migrated)*
`;
}

/**
 * List available backups
 * @param {string} cwd - Current working directory
 * @returns {Array<{name: string, path: string, created: string, type: string}>}
 */
function listBackups(cwd) {
  const backupsDir = path.join(cwd, '.planning', 'backups');
  const results = [];

  if (!fs.existsSync(backupsDir)) return results;

  try {
    const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort().reverse();

    for (const dirName of dirs) {
      const manifestPath = path.join(backupsDir, dirName, 'manifest.json');
      let created = 'unknown';
      let type = 'unknown';

      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          created = manifest.created || 'unknown';
          type = manifest.type || 'unknown';
        } catch {
          // Ignore parse errors
        }
      }

      results.push({
        name: dirName,
        path: path.join('.planning', 'backups', dirName),
        created,
        type,
      });
    }
  } catch {
    // Ignore errors
  }

  return results;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  analyzeMigration,
  previewMigration,
  executeMigration,
  restoreMigrationBackup,
  listBackups,
  copyDirectoryRecursive,
};
