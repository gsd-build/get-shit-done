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
 *   applySurface(runtimeConfigDir, layout, manifest, clusterMap)
 *   listSurface(runtimeConfigDir, layout, manifest, clusterMap)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { platformWriteSync } = require('./shell-command-projection.cjs');

const {
  readActiveProfile,
  resolveProfile,
  stageSkillsForProfile,
  stageAgentsForProfile,
  loadSkillsManifest,
  PROFILES,
} = require('./install-profiles.cjs');
const { CLUSTERS, allClusteredSkills } = require('./clusters.cjs');
const { findInstallSourceRoot } = require('./runtime-artifact-layout.cjs');

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
 * Write the surface state atomically via the platform seam (mkdir + tmp+rename).
 *
 * @param {string} runtimeConfigDir
 * @param {SurfaceState} surfaceState
 */
function writeSurface(runtimeConfigDir, surfaceState) {
  platformWriteSync(path.join(runtimeConfigDir, SURFACE_FILE_NAME), JSON.stringify(surfaceState, null, 2) + '\n');
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
 * Re-stage the active surface using the resolved layout.
 * Iterates layout.kinds and syncs each artifact kind to its destination.
 *
 * @param {string} runtimeConfigDir
 * @param {import('./runtime-artifact-layout.cjs').Layout} layout
 * @param {Map<string, string[]>} manifest
 * @param {Object} [clusterMap]
 */
function applySurface(runtimeConfigDir, layout, manifest, clusterMap) {
  if (path.resolve(runtimeConfigDir) !== path.resolve(layout.configDir)) {
    throw new TypeError('applySurface runtimeConfigDir must match layout.configDir');
  }
  const resolved = resolveSurface(layout.configDir, manifest, clusterMap);
  for (const kind of layout.kinds) {
    const staged = kind.stage(resolved);
    const dest = path.join(layout.configDir, kind.destSubpath);
    _syncGsdDir(staged, dest, kind, manifest);
  }
  return resolved;
}

/**
 * Sync destination directory from staged source.
 *
 * For 'commands' kind: iterate *.md files in destDir, remove if not in staged set.
 * For 'agents' kind: same, but only remove files starting with 'gsd-' prefix.
 * For 'skills' kind: iterate directories in destDir matching kind.prefix; add missing
 *   by copying recursively; remove dirs not in staged set. Preserves dirs not matching
 *   the prefix (user-owned skills).
 *
 * For Hermes (empty prefix): uses manifest membership to discriminate GSD-owned vs
 * user-owned dirs. GSD-owned = stem in manifest; removal targets = in manifest AND
 * not in staged set. User-owned (not in manifest) are always preserved.
 *
 * @param {string} stagedDir source (staged temp dir or original)
 * @param {string} destDir runtime destination
 * @param {import('./runtime-artifact-layout.cjs').ArtifactKind|'commands'|'agents'} kind
 * @param {Map<string, string[]>} [manifest] optional; required for Hermes empty-prefix removal
 */
function _syncGsdDir(stagedDir, destDir, kind, manifest) {
  if (!fs.existsSync(stagedDir)) return;
  fs.mkdirSync(destDir, { recursive: true });

  // Normalize: allow legacy string context for backward-compat with internal callers
  const kindName = (typeof kind === 'string') ? kind : kind.kind;
  const kindPrefix = (typeof kind === 'object' && kind !== null) ? kind.prefix : 'gsd-';

  if (kindName === 'skills') {
    // Skills kind: work with directories, not files.
    // Each staged entry is a directory named ${prefix}${stem}.
    const stagedDirs = new Set(
      fs.readdirSync(stagedDir).filter(entry => {
        return fs.statSync(path.join(stagedDir, entry)).isDirectory();
      })
    );

    // Copy missing dirs from staged to dest
    for (const dirName of stagedDirs) {
      const destSubDir = path.join(destDir, dirName);
      if (!fs.existsSync(destSubDir)) {
        fs.cpSync(path.join(stagedDir, dirName), destSubDir, { recursive: true });
      } else {
        // Overwrite to ensure content is current
        fs.cpSync(path.join(stagedDir, dirName), destSubDir, { recursive: true });
      }
    }

    // Removal: discriminator depends on prefix shape.
    // Non-empty prefix: GSD namespace IS the prefix; remove prefix-matching dirs not in staged set.
    // Empty prefix (Hermes): GSD-owned = stem in manifest (i.e. canonically-shipped GSD skill).
    //                        User-owned skills not in manifest are preserved.
    // No manifest available: be conservative, don't remove anything.
    const canonicalStems = manifest
      ? new Set([...manifest.keys()].filter(k => !k.startsWith('_calls_agents_')))
      : null;

    const destEntries = fs.readdirSync(destDir);
    for (const entry of destEntries) {
      const entryPath = path.join(destDir, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;

      let isGsdOwned;
      if (kindPrefix !== '') {
        isGsdOwned = entry.startsWith(kindPrefix);
      } else if (canonicalStems) {
        // Hermes: empty prefix, destSubpath is the namespace.
        // GSD-owned iff the directory name (stem) appears in the canonical manifest.
        isGsdOwned = canonicalStems.has(entry);
      } else {
        // No manifest available: be conservative, don't remove anything.
        continue;
      }

      if (!isGsdOwned) continue;           // preserve user-owned
      if (stagedDirs.has(entry)) continue; // current GSD-owned, keep
      try { fs.rmSync(entryPath, { recursive: true, force: true }); } catch {}
    }
  } else {
    // commands / agents kind: work with .md files
    const stagedFiles = new Set(
      fs.readdirSync(stagedDir).filter(f => f.endsWith('.md'))
    );

    // Copy files from staged to dest (overwrite to keep content current)
    for (const file of stagedFiles) {
      fs.copyFileSync(path.join(stagedDir, file), path.join(destDir, file));
    }

    // Remove gsd-only files from dest that aren't in staged set
    // For commands dir: all .md files are gsd skills
    // For agents dir: only gsd-* files
    const destEntries = fs.readdirSync(destDir).filter(f => f.endsWith('.md'));
    for (const file of destEntries) {
      if (kindName === 'agents' && !file.startsWith('gsd-')) continue;
      if (!stagedFiles.has(file)) {
        try { fs.unlinkSync(path.join(destDir, file)); } catch {}
      }
    }
  }
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * List the currently enabled and disabled skills with token cost.
 *
 * Token cost = sum of description lengths ÷ 4 (mirrors audit script).
 * Descriptions are read from the install source (findInstallSourceRoot).
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
  const srcCommandsDir = findInstallSourceRoot(runtimeConfigDir);
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
  _syncGsdDir,
};
