/**
 * Milestone Parallel — Parallel milestone management functions
 *
 * Enables multiple milestones to run in parallel with independent phase numbering.
 * Milestones are stored in .planning/milestones/{id}-{slug}/ with their own
 * ROADMAP.md, REQUIREMENTS.md, and phases/ subdirectory.
 */

const fs = require('fs');
const path = require('path');
const { output, error, loadConfig, generateSlugInternal } = require('./core.cjs');

// ─── Detection & Parsing ──────────────────────────────────────────────────────

/**
 * Detect if project uses parallel milestones
 * @param {string} cwd - Current working directory
 * @returns {boolean} true if .planning/milestones/ exists with content
 */
function isParallelMilestoneProject(cwd) {
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  if (!fs.existsSync(milestonesDir)) return false;

  try {
    const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    // Check for milestone directories (not archived phases)
    const milestones = entries.filter(e =>
      e.isDirectory() && /^M\d+-/i.test(e.name)
    );
    return milestones.length > 0;
  } catch {
    return false;
  }
}

/**
 * Parse milestone/phase reference (e.g., "M7/01" or just "01")
 * @param {string} ref - Reference string
 * @returns {{ milestone: string|null, phase: string }}
 */
function parseMilestonePhaseRef(ref) {
  if (!ref) return { milestone: null, phase: '' };

  const str = String(ref).trim();

  // Match M<number>/<phase> pattern
  const match = str.match(/^(M\d+)\/(.+)$/i);
  if (match) {
    return {
      milestone: match[1].toUpperCase(),
      phase: match[2],
    };
  }

  // No milestone prefix - just a phase
  return {
    milestone: null,
    phase: str,
  };
}

// ─── Path Resolution ──────────────────────────────────────────────────────────

/**
 * Get milestone directory path
 * @param {string} cwd - Current working directory
 * @param {string} milestoneId - Milestone ID (e.g., "M7")
 * @returns {string|null} Path like ".planning/milestones/M7-patient-engagement" or null if not found
 */
function getMilestonePath(cwd, milestoneId) {
  if (!milestoneId) return null;

  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  if (!fs.existsSync(milestonesDir)) return null;

  const normalized = milestoneId.toUpperCase();

  try {
    const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    // Find directory starting with milestone ID
    const match = dirs.find(d => d.toUpperCase().startsWith(normalized + '-'));
    if (match) {
      return path.join('.planning', 'milestones', match);
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get absolute milestone directory path
 * @param {string} cwd - Current working directory
 * @param {string} milestoneId - Milestone ID (e.g., "M7")
 * @returns {string|null} Absolute path or null if not found
 */
function getMilestoneAbsolutePath(cwd, milestoneId) {
  const relPath = getMilestonePath(cwd, milestoneId);
  if (!relPath) return null;
  return path.join(cwd, relPath);
}

// ─── Milestone Listing ────────────────────────────────────────────────────────

/**
 * List all milestones with metadata
 * @param {string} cwd - Current working directory
 * @returns {Array<{id: string, name: string, slug: string, path: string, status: string, phase_count: number, completed_count: number, progress_percent: number}>}
 */
function listMilestones(cwd) {
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  const results = [];

  if (!fs.existsSync(milestonesDir)) return results;

  try {
    const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && /^M\d+-/i.test(e.name))
      .map(e => e.name)
      .sort((a, b) => {
        // Sort by milestone number
        const numA = parseInt(a.match(/^M(\d+)/i)?.[1] || '0', 10);
        const numB = parseInt(b.match(/^M(\d+)/i)?.[1] || '0', 10);
        return numA - numB;
      });

    for (const dirName of dirs) {
      const match = dirName.match(/^(M\d+)-(.+)$/i);
      if (!match) continue;

      const id = match[1].toUpperCase();
      const slug = match[2];
      const milestonePath = path.join(milestonesDir, dirName);
      const relPath = path.join('.planning', 'milestones', dirName);

      // Read ROADMAP.md for name, phase count, and completion status
      const roadmapPath = path.join(milestonePath, 'ROADMAP.md');
      let name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let phaseCount = 0;
      let completedCount = 0;
      let status = 'unknown';

      if (fs.existsSync(roadmapPath)) {
        try {
          const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');

          // Extract name from heading
          const headingMatch = roadmapContent.match(/^#\s+Roadmap:\s*(.+)$/m);
          if (headingMatch) {
            name = headingMatch[1].trim();
          }

          // Count phases - look for checkbox patterns in phase list
          const phaseMatches = roadmapContent.match(/^-\s*\[([ xX])\]\s*\*\*Phase\s+\d+/gm) || [];
          phaseCount = phaseMatches.length;
          completedCount = phaseMatches.filter(m => /\[x\]/i.test(m)).length;

          // Determine status
          if (phaseCount === 0) {
            status = 'active'; // No phases yet defined
          } else if (completedCount === phaseCount) {
            status = 'complete';
          } else {
            // Check for blockers section
            const hasBlocker = /##\s*Blockers/i.test(roadmapContent) &&
              roadmapContent.match(/##\s*Blockers[\s\S]*?(?=##|$)/)?.[0]?.includes('-');
            status = hasBlocker ? 'blocked' : 'active';
          }
        } catch {
          status = 'unknown';
        }
      }

      const progressPercent = phaseCount > 0
        ? Math.round((completedCount / phaseCount) * 100)
        : 0;

      results.push({
        id,
        name,
        slug,
        path: relPath,
        status,
        phase_count: phaseCount,
        completed_count: completedCount,
        progress_percent: progressPercent,
      });
    }
  } catch {
    // Ignore errors
  }

  return results;
}

// ─── Milestone Creation ───────────────────────────────────────────────────────

/**
 * Create new milestone directory structure
 * @param {string} cwd - Current working directory
 * @param {string} id - Milestone ID (e.g., "M7")
 * @param {string} name - Milestone name (e.g., "Patient Engagement")
 * @returns {{ created: boolean, path: string } | { error: string }}
 */
function createMilestone(cwd, id, name) {
  if (!id || !name) {
    return { error: 'Milestone ID and name are required' };
  }

  // Validate ID format
  const normalizedId = id.toUpperCase();
  if (!/^M\d+$/.test(normalizedId)) {
    return { error: `Invalid milestone ID format: ${id}. Must be M<number> (e.g., M7)` };
  }

  // Check if milestone already exists
  const existingPath = getMilestonePath(cwd, normalizedId);
  if (existingPath) {
    return { error: `Milestone ${normalizedId} already exists at ${existingPath}` };
  }

  // Generate slug from name
  const slug = generateSlugInternal(name);
  if (!slug) {
    return { error: 'Could not generate slug from milestone name' };
  }

  // Create directory structure
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  const milestoneDir = path.join(milestonesDir, `${normalizedId}-${slug}`);
  const phasesDir = path.join(milestoneDir, 'phases');

  try {
    // Ensure milestones directory exists
    fs.mkdirSync(milestonesDir, { recursive: true });

    // Create milestone directory
    fs.mkdirSync(milestoneDir, { recursive: true });

    // Create phases subdirectory
    fs.mkdirSync(phasesDir, { recursive: true });

    // Create ROADMAP.md
    const roadmapContent = `# Roadmap: ${name}

## Overview

[Milestone description to be filled]

## Phases

- [ ] **Phase 1: TBD** - Description

## Phase Details

### Phase 1: TBD
**Goal**: [To be defined]
**Requirements**: TBD
**Success Criteria**:
  1. [To be defined]
**Plans:** 0/0 plans

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. TBD | 0/0 | Not started | - |

---
*Roadmap created: ${new Date().toISOString().split('T')[0]}*
`;
    fs.writeFileSync(path.join(milestoneDir, 'ROADMAP.md'), roadmapContent, 'utf-8');

    // Create REQUIREMENTS.md
    const requirementsContent = `# Requirements: ${name}

## Overview

Requirements for ${name} milestone.

## Functional Requirements

<!-- List functional requirements here -->

## Non-Functional Requirements

<!-- List non-functional requirements here -->

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|

---
*Requirements created: ${new Date().toISOString().split('T')[0]}*
`;
    fs.writeFileSync(path.join(milestoneDir, 'REQUIREMENTS.md'), requirementsContent, 'utf-8');

    return {
      created: true,
      path: path.join('.planning', 'milestones', `${normalizedId}-${slug}`),
      id: normalizedId,
      name,
      slug,
    };
  } catch (err) {
    return { error: `Failed to create milestone: ${err.message}` };
  }
}

// ─── Default Milestone Context ────────────────────────────────────────────────

/**
 * Get default milestone context from config
 * @param {string} cwd - Current working directory
 * @returns {string|null} Current default milestone ID or null
 */
function getDefaultMilestone(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');

  try {
    if (!fs.existsSync(configPath)) return null;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.default_milestone || null;
  } catch {
    return null;
  }
}

/**
 * Set default milestone context in config
 * @param {string} cwd - Current working directory
 * @param {string} milestoneId - Milestone ID to set as default
 * @returns {{ success: boolean, error?: string }}
 */
function setDefaultMilestone(cwd, milestoneId) {
  if (!milestoneId) {
    return { success: false, error: 'Milestone ID is required' };
  }

  const normalizedId = milestoneId.toUpperCase();

  // Verify milestone exists
  const milestonePath = getMilestonePath(cwd, normalizedId);
  if (!milestonePath) {
    return { success: false, error: `Milestone ${normalizedId} not found` };
  }

  const configPath = path.join(cwd, '.planning', 'config.json');

  try {
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    config.default_milestone = normalizedId;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    return { success: true, milestone: normalizedId };
  } catch (err) {
    return { success: false, error: `Failed to update config: ${err.message}` };
  }
}

// ─── Milestone Info ───────────────────────────────────────────────────────────

/**
 * Get detailed info about a specific milestone
 * @param {string} cwd - Current working directory
 * @param {string} milestoneId - Milestone ID
 * @returns {object|null} Milestone info or null if not found
 */
function getMilestoneInfo(cwd, milestoneId) {
  if (!milestoneId) return null;

  const milestonePath = getMilestoneAbsolutePath(cwd, milestoneId);
  if (!milestonePath) return null;

  const normalizedId = milestoneId.toUpperCase();
  const dirName = path.basename(milestonePath);
  const slug = dirName.replace(/^M\d+-/i, '');

  const result = {
    id: normalizedId,
    slug,
    path: path.join('.planning', 'milestones', dirName),
    name: null,
    status: 'unknown',
    phases: [],
    phase_count: 0,
    completed_count: 0,
    progress_percent: 0,
  };

  // Read ROADMAP.md
  const roadmapPath = path.join(milestonePath, 'ROADMAP.md');
  if (fs.existsSync(roadmapPath)) {
    try {
      const content = fs.readFileSync(roadmapPath, 'utf-8');

      // Extract name
      const headingMatch = content.match(/^#\s+Roadmap:\s*(.+)$/m);
      if (headingMatch) {
        result.name = headingMatch[1].trim();
      }

      // Extract phases
      const phaseMatches = content.matchAll(/^-\s*\[([ xX])\]\s*\*\*Phase\s+(\d+):\s*([^*]+)\*\*/gm);
      for (const match of phaseMatches) {
        result.phases.push({
          number: match[2],
          name: match[3].trim(),
          completed: /x/i.test(match[1]),
        });
      }

      result.phase_count = result.phases.length;
      result.completed_count = result.phases.filter(p => p.completed).length;
      result.progress_percent = result.phase_count > 0
        ? Math.round((result.completed_count / result.phase_count) * 100)
        : 0;

      // Determine status
      if (result.phase_count === 0) {
        result.status = 'active';
      } else if (result.completed_count === result.phase_count) {
        result.status = 'complete';
      } else {
        result.status = 'active';
      }
    } catch {
      // Keep defaults
    }
  }

  if (!result.name) {
    result.name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return result;
}

// ─── Milestone Config ─────────────────────────────────────────────────────────

/**
 * Load milestone-specific configuration from config.json
 * @param {string} cwd - Current working directory
 * @returns {object} Milestone config with defaults
 */
function loadMilestoneConfig(cwd) {
  const defaults = {
    parallel_milestones: false,
    milestones: {},
    default_milestone: null,
    dependency_mode: 'advisory', // 'advisory' | 'strict'
  };

  const configPath = path.join(cwd, '.planning', 'config.json');

  try {
    if (!fs.existsSync(configPath)) return defaults;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    return {
      parallel_milestones: config.parallel_milestones ?? defaults.parallel_milestones,
      milestones: config.milestones ?? defaults.milestones,
      default_milestone: config.default_milestone ?? defaults.default_milestone,
      dependency_mode: config.dependency_mode ?? defaults.dependency_mode,
    };
  } catch {
    return defaults;
  }
}

// ─── CLI Command Handlers ─────────────────────────────────────────────────────

/**
 * Handle `milestone create` command
 */
function cmdMilestoneCreate(cwd, id, name, raw) {
  const result = createMilestone(cwd, id, name);
  if (result.error) {
    error(result.error);
  }
  output(result, raw, result.path);
}

/**
 * Handle `milestone list` command
 */
function cmdMilestoneList(cwd, raw) {
  const milestones = listMilestones(cwd);
  output(milestones, raw, milestones.map(m =>
    `${m.id}: ${m.name} (${m.status}) - ${m.completed_count}/${m.phase_count} phases`
  ).join('\n'));
}

/**
 * Handle `milestone switch` command
 */
function cmdMilestoneSwitch(cwd, milestoneId, raw) {
  const result = setDefaultMilestone(cwd, milestoneId);
  if (!result.success) {
    error(result.error);
  }
  output(result, raw, `Switched to milestone ${result.milestone}`);
}

/**
 * Handle `milestone info` command
 */
function cmdMilestoneInfo(cwd, milestoneId, raw) {
  const info = getMilestoneInfo(cwd, milestoneId);
  if (!info) {
    error(`Milestone ${milestoneId} not found`);
  }
  output(info, raw, `${info.id}: ${info.name}\nStatus: ${info.status}\nProgress: ${info.completed_count}/${info.phase_count} phases (${info.progress_percent}%)`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Core functions
  isParallelMilestoneProject,
  parseMilestonePhaseRef,
  getMilestonePath,
  getMilestoneAbsolutePath,
  listMilestones,
  createMilestone,
  getDefaultMilestone,
  setDefaultMilestone,
  getMilestoneInfo,
  loadMilestoneConfig,

  // CLI handlers
  cmdMilestoneCreate,
  cmdMilestoneList,
  cmdMilestoneSwitch,
  cmdMilestoneInfo,
};
