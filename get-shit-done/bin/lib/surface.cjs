'use strict';
/**
 * Runtime surface module — ADR-0011 Phase 2 (Option B).
 *
 * Manages the runtime enable/disable surface state (the `.gsd-surface.json` marker in
 * each runtime's skills dir) independently of the install-time profile marker
 * (`.gsd-profile`). Runtime config locations are resolved by callers.
 *
 * Effective skill set = base profile ∪ explicitAdds − disabledClusters − explicitRemoves,
 * then transitively closed via the manifest.
 *
 * Exports:
 *   readSurface(runtimeConfigDir)
 *   writeSurface(runtimeConfigDir, surfaceState)
 *   resolveSurface(runtimeConfigDir, manifest, clusterMap)
 *   applySurface(runtimeConfigDir, commandsDir, agentsDir, manifest, clusterMap)
 *   listSurface(runtimeConfigDir, manifest, clusterMap)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  readActiveProfile,
  resolveProfile,
  stageSkillsForProfile,
  stageAgentsForProfile,
  loadSkillsManifest,
  PROFILES,
} = require('./install-profiles.cjs');
const { CLUSTERS, allClusteredSkills } = require('./clusters.cjs');

const SURFACE_FILE_NAME = '.gsd-surface.json';

// ---------------------------------------------------------------------------
// State IO
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SurfaceState
 * @property {string} baseProfile
 * @property {string[]} disabledClusters
 * @property {string[]} explicitAdds
 * @property {string[]} explicitRemoves
 */

/**
 * Read the surface state from a runtime config directory.
 *
 * @param {string} runtimeConfigDir
 * @returns {SurfaceState|null} null if file missing or corrupt
 */
function readSurface(runtimeConfigDir) {
  const filePath = path.join(runtimeConfigDir, SURFACE_FILE_NAME);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    // Structural validation — must have these fields with expected types
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.baseProfile !== 'string') return null;
    if (!Array.isArray(parsed.disabledClusters)) return null;
    if (!Array.isArray(parsed.explicitAdds)) return null;
    if (!Array.isArray(parsed.explicitRemoves)) return null;
    return {
      baseProfile: parsed.baseProfile,
      disabledClusters: parsed.disabledClusters,
      explicitAdds: parsed.explicitAdds,
      explicitRemoves: parsed.explicitRemoves,
    };
  } catch {
    return null;
  }
}

/**
 * Write the surface state atomically (write to tmp then rename).
 *
 * @param {string} runtimeConfigDir
 * @param {SurfaceState} surfaceState
 */
function writeSurface(runtimeConfigDir, surfaceState) {
  fs.mkdirSync(runtimeConfigDir, { recursive: true });
  const finalPath = path.join(runtimeConfigDir, SURFACE_FILE_NAME);
  const tmpPath = finalPath + '.tmp.' + process.pid;
  fs.writeFileSync(tmpPath, JSON.stringify(surfaceState, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, finalPath);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Expand cluster names to skill stems using the provided clusterMap.
 *
 * @param {string[]} clusterNames
 * @param {Object} clusterMap CLUSTERS or override
 * @returns {Set<string>}
 */
function clustersToSkills(clusterNames, clusterMap) {
  const result = new Set();
  for (const name of clusterNames) {
    const members = clusterMap[name];
    if (members) {
      for (const s of members) result.add(s);
    }
  }
  return result;
}

/**
 * Resolve the effective surface to a typed profile-like object.
 * Shape: { name, skills: Set<string>|'*', agents: Set<string> }
 *
 * Resolution order:
 * 1. Start with base profile resolved via resolveProfile()
 * 2. Remove skills in disabled clusters
 * 3. Add explicitAdds (and their transitive closure)
 * 4. Remove explicitRemoves (only the stem itself, no cascade)
 *
 * @param {string} runtimeConfigDir
 * @param {Map<string, string[]>} manifest
 * @param {Object} [clusterMap] defaults to CLUSTERS
 * @returns {{ name: string, skills: Set<string>, agents: Set<string> }}
 */
function resolveSurface(runtimeConfigDir, manifest, clusterMap) {
  const cm = clusterMap || CLUSTERS;
  const surface = readSurface(runtimeConfigDir);

  // Determine base profile name: from surface state or from .gsd-profile marker
  const baseProfileName = (surface && surface.baseProfile)
    ? surface.baseProfile
    : (readActiveProfile(runtimeConfigDir) || 'full');

  // Resolve base profile
  const baseResolved = resolveProfile({
    modes: baseProfileName.split(',').map(s => s.trim()),
    manifest,
  });

  // If full, we need to enumerate all skills from the manifest
  let skills;
  if (baseResolved.skills === '*') {
    // Materialize all skill stems from manifest
    skills = new Set();
    for (const [key] of manifest) {
      if (!key.startsWith('_calls_agents_')) skills.add(key);
    }
  } else {
    skills = new Set(baseResolved.skills);
  }

  if (surface) {
    // Step 2: remove disabled cluster members
    const disabledSkills = clustersToSkills(surface.disabledClusters, cm);
    for (const s of disabledSkills) skills.delete(s);

    // Step 3: add explicitAdds with transitive closure
    if (surface.explicitAdds.length > 0) {
      const addSet = new Set(surface.explicitAdds);
      // Compute closure of adds
      const queue = [...addSet];
      const visited = new Set(addSet);
      while (queue.length > 0) {
        const stem = queue.pop();
        const deps = manifest.get(stem) || [];
        for (const dep of deps) {
          if (!visited.has(dep)) {
            visited.add(dep);
            queue.push(dep);
          }
        }
      }
      for (const s of visited) skills.add(s);
    }

    // Step 4: remove explicitRemoves (stem only, no cascade)
    for (const s of surface.explicitRemoves) {
      skills.delete(s);
    }
  }

  // Derive agents from skills
  const agents = new Set();
  for (const skillStem of skills) {
    const agentRefs = manifest.get(`_calls_agents_${skillStem}`) || [];
    for (const agentStem of agentRefs) agents.add(agentStem);
  }

  const name = surface ? `surface:${surface.baseProfile}` : `profile:${baseProfileName}`;
  return { name, skills, agents };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * Re-stage the active surface to commandsDir and agentsDir in-place.
 * Only touches files matching `gsd-` prefix or `*.md` in commandsDir.
 * Never touches non-`gsd-*` files.
 *
 * Steps:
 *  1. Resolve surface → active skill/agent sets
 *  2. Stage to temp dirs via stageSkillsForProfile / stageAgentsForProfile
 *  3. Find the install source (where skill files live)
 *  4. Sync: copy missing, delete superseded (gsd-only)
 *
 * @param {string} runtimeConfigDir
 * @param {string} commandsDir  runtime commands/gsd dir (resolved per-runtime by callers)
 * @param {string} agentsDir    runtime agents dir (resolved per-runtime by callers)
 * @param {Map<string, string[]>} manifest
 * @param {Object} [clusterMap]
 */
function applySurface(runtimeConfigDir, commandsDir, agentsDir, manifest, clusterMap) {
  const resolved = resolveSurface(runtimeConfigDir, manifest, clusterMap);

  // Find install source
  const srcCommandsDir = _findInstallSource(runtimeConfigDir);

  // Stage skills
  const stagedSkills = stageSkillsForProfile(srcCommandsDir, resolved);

  // Sync commandsDir from stagedSkills
  _syncGsdDir(stagedSkills, commandsDir, 'commands');

  // Stage and sync agents
  if (agentsDir && fs.existsSync(agentsDir)) {
    const srcAgentsDir = _findAgentsSource(runtimeConfigDir);
    if (srcAgentsDir) {
      const stagedAgents = stageAgentsForProfile(srcAgentsDir, resolved);
      _syncGsdDir(stagedAgents, agentsDir, 'agents');
    }
  }
}

/**
 * Sync destination directory from staged source.
 * Adds files present in staged but missing in dest.
 * Removes gsd-prefixed .md files in dest not present in staged.
 * Never touches non-gsd files.
 *
 * @param {string} stagedDir source (staged temp dir or original)
 * @param {string} destDir runtime destination
 * @param {'commands'|'agents'} context
 */
function _syncGsdDir(stagedDir, destDir, context) {
  if (!fs.existsSync(stagedDir)) return;
  fs.mkdirSync(destDir, { recursive: true });

  const stagedFiles = new Set(
    fs.readdirSync(stagedDir).filter(f => f.endsWith('.md'))
  );

  // Copy missing files from staged to dest
  for (const file of stagedFiles) {
    const destFile = path.join(destDir, file);
    if (!fs.existsSync(destFile)) {
      fs.copyFileSync(path.join(stagedDir, file), destFile);
    } else {
      // Overwrite to ensure content is current
      fs.copyFileSync(path.join(stagedDir, file), destFile);
    }
  }

  // Remove gsd-only files from dest that aren't in staged set
  // For commands dir: all .md files are gsd skills
  // For agents dir: only gsd-* files
  const destEntries = fs.readdirSync(destDir).filter(f => f.endsWith('.md'));
  for (const file of destEntries) {
    if (context === 'agents' && !file.startsWith('gsd-')) continue;
    if (!stagedFiles.has(file)) {
      try { fs.unlinkSync(path.join(destDir, file)); } catch {}
    }
  }
}

/**
 * Find the install source commands/gsd directory.
 * Checks the runtime's `.gsd-source` marker (sibling of the surface state file),
 * then walks up from __dirname to find the installed package source.
 *
 * @param {string} runtimeConfigDir
 * @returns {string} path to install source commands/gsd
 */
function _findInstallSource(runtimeConfigDir) {
  // Check for .gsd-source marker
  const sourceMarker = path.join(runtimeConfigDir, '.gsd-source');
  if (fs.existsSync(sourceMarker)) {
    try {
      const src = fs.readFileSync(sourceMarker, 'utf8').trim();
      if (src && fs.existsSync(src)) return src;
    } catch {}
  }

  // Walk up from this module's dir to find commands/gsd
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'commands', 'gsd');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback: the runtimeConfigDir itself
  return path.join(runtimeConfigDir, '..', 'commands', 'gsd');
}

/**
 * Find the install source agents directory.
 *
 * @param {string} runtimeConfigDir
 * @returns {string|null}
 */
function _findAgentsSource(runtimeConfigDir) {
  // Prefer .gsd-source sibling marker (commands/gsd) and derive agents from it.
  const sourceMarker = path.join(runtimeConfigDir, '.gsd-source');
  if (fs.existsSync(sourceMarker)) {
    try {
      const commandsSrc = fs.readFileSync(sourceMarker, 'utf8').trim();
      if (commandsSrc && fs.existsSync(commandsSrc)) {
        const commandsParent = path.dirname(commandsSrc); // .../commands
        const candidate = path.resolve(commandsParent, '..', 'agents');
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch {}
  }

  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'agents');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * List the currently enabled and disabled skills with token cost.
 *
 * Token cost = sum of description lengths ÷ 4 (mirrors audit script).
 * Descriptions are read from the installed commandsDir skill files.
 *
 * @param {string} runtimeConfigDir
 * @param {Map<string, string[]>} manifest
 * @param {Object} [clusterMap]
 * @returns {{ enabled: string[], disabled: string[], tokenCost: number }}
 */
function listSurface(runtimeConfigDir, manifest, clusterMap) {
  const resolved = resolveSurface(runtimeConfigDir, manifest, clusterMap);

  // All known stems from manifest (exclude _calls_agents_ meta keys)
  const allStems = [];
  for (const [key] of manifest) {
    if (!key.startsWith('_calls_agents_')) allStems.push(key);
  }

  const enabledSet = resolved.skills instanceof Set ? resolved.skills : new Set(allStems);

  const enabled = allStems.filter(s => enabledSet.has(s)).sort();
  const disabled = allStems.filter(s => !enabledSet.has(s)).sort();

  // Compute token cost by reading descriptions from the install source
  const srcCommandsDir = _findInstallSource(runtimeConfigDir);
  let tokenCost = 0;
  for (const stem of enabled) {
    const filePath = path.join(srcCommandsDir, `${stem}.md`);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const descMatch = content.match(/^description:\s*(.+)$/m);
      if (descMatch) {
        tokenCost += Math.ceil(descMatch[1].trim().length / 4);
      }
    } catch {}
  }

  return { enabled, disabled, tokenCost };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  readSurface,
  writeSurface,
  resolveSurface,
  applySurface,
  listSurface,
  // Exported for testing
  _findInstallSource,
  _syncGsdDir,
};
