/**
 * lib/intel.cjs -- Intel storage and query operations for GSD.
 *
 * Provides a persistent, queryable intelligence system for project metadata.
 * Intel files live in .planning/intel/ and store structured data about
 * the project's files, APIs, dependencies, architecture, and tech stack.
 *
 * All public functions gate on intel.enabled config (no-op when false).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Constants ───────────────────────────────────────────────────────────────

const INTEL_DIR = '.planning/intel';

const INTEL_FILES = {
  files: 'file-roles.json',
  apis: 'api-map.json',
  deps: 'dependency-graph.json',
  arch: 'arch-decisions.json',
  stack: 'stack.json'
};

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Ensure the intel directory exists under the given planning dir.
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {string} Full path to .planning/intel/
 */
function ensureIntelDir(planningDir) {
  const intelPath = path.join(planningDir, 'intel');
  if (!fs.existsSync(intelPath)) {
    fs.mkdirSync(intelPath, { recursive: true });
  }
  return intelPath;
}

/**
 * Check whether intel is enabled in the project config.
 * Reads config.json directly via fs. Returns false by default
 * (when no config, no intel key, or on error).
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {boolean}
 */
function isIntelEnabled(planningDir) {
  try {
    const configPath = path.join(planningDir, 'config.json');
    if (!fs.existsSync(configPath)) return false;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config && config.intel && config.intel.enabled === true) return true;
    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * Return the standard disabled response object.
 * @returns {{ disabled: true, message: string }}
 */
function disabledResponse() {
  return { disabled: true, message: 'Intel system disabled. Set intel.enabled=true in config.json to activate.' };
}

/**
 * Resolve full path to an intel file.
 * @param {string} planningDir
 * @param {string} filename
 * @returns {string}
 */
function intelFilePath(planningDir, filename) {
  return path.join(planningDir, 'intel', filename);
}

/**
 * Safely read and parse a JSON intel file.
 * Returns null if file doesn't exist or can't be parsed.
 *
 * @param {string} filePath
 * @returns {object|null}
 */
function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_e) {
    return null;
  }
}

/**
 * Compute SHA-256 hash of a file's contents.
 * Returns null if the file doesn't exist.
 *
 * @param {string} filePath
 * @returns {string|null}
 */
function hashFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (_e) {
    return null;
  }
}

/**
 * Search for a term (case-insensitive) in a JSON object's keys and string values.
 * Returns an array of matching entries.
 *
 * @param {object} data - The JSON data (expects { _meta, entries } or flat object)
 * @param {string} term - Search term
 * @returns {Array<{ key: string, value: * }>}
 */
function searchJsonEntries(data, term) {
  if (!data || typeof data !== 'object') return [];

  const entries = data.entries || data;
  if (!entries || typeof entries !== 'object') return [];

  const lowerTerm = term.toLowerCase();
  const matches = [];

  for (const [key, value] of Object.entries(entries)) {
    if (key === '_meta') continue;

    // Check key match
    if (key.toLowerCase().includes(lowerTerm)) {
      matches.push({ key, value });
      continue;
    }

    // Check string value match (recursive for objects)
    if (matchesInValue(value, lowerTerm)) {
      matches.push({ key, value });
    }
  }

  return matches;
}

/**
 * Recursively check if a term appears in any string value.
 *
 * @param {*} value
 * @param {string} lowerTerm
 * @returns {boolean}
 */
function matchesInValue(value, lowerTerm) {
  if (typeof value === 'string') {
    return value.toLowerCase().includes(lowerTerm);
  }
  if (Array.isArray(value)) {
    return value.some(v => matchesInValue(v, lowerTerm));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(v => matchesInValue(v, lowerTerm));
  }
  return false;
}

/**
 * Search for a term in arch.md text content.
 * Returns matching lines.
 *
 * @param {string} filePath - Path to arch.md
 * @param {string} term - Search term
 * @returns {string[]}
 */
function searchArchMd(filePath, term) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lowerTerm = term.toLowerCase();
    const lines = content.split(/\r?\n/);
    return lines.filter(line => line.toLowerCase().includes(lowerTerm));
  } catch (_e) {
    return [];
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Query intel files for a search term.
 * Searches across all JSON intel files (keys and values) and arch.md (text lines).
 *
 * @param {string} term - Search term (case-insensitive)
 * @param {string} planningDir - Path to .planning directory
 * @returns {{ matches: Array<{ source: string, entries: Array }>, term: string, total: number } | { disabled: true, message: string }}
 */
function intelQuery(term, planningDir) {
  if (!isIntelEnabled(planningDir)) return disabledResponse();

  const matches = [];
  let total = 0;

  // Search all JSON intel files
  for (const [_key, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(planningDir, filename);
    const data = safeReadJson(filePath);
    if (!data) continue;

    const found = searchJsonEntries(data, term);
    if (found.length > 0) {
      matches.push({ source: filename, entries: found });
      total += found.length;
    }
  }

  return { matches, term, total };
}

/**
 * Report status and staleness of each intel file.
 * A file is considered stale if its updated_at is older than 24 hours.
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {{ files: object, overall_stale: boolean } | { disabled: true, message: string }}
 */
function intelStatus(planningDir) {
  if (!isIntelEnabled(planningDir)) return disabledResponse();

  const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();
  const files = {};
  let overallStale = false;

  for (const [_key, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(planningDir, filename);
    const exists = fs.existsSync(filePath);

    if (!exists) {
      files[filename] = { exists: false, updated_at: null, stale: true };
      overallStale = true;
      continue;
    }

    let updatedAt = null;

    // All intel files are JSON — read _meta.updated_at
    const data = safeReadJson(filePath);
    if (data && data._meta && data._meta.updated_at) {
      updatedAt = data._meta.updated_at;
    }

    let stale = true;
    if (updatedAt) {
      const age = now - new Date(updatedAt).getTime();
      stale = age > STALE_MS;
    }

    if (stale) overallStale = true;
    files[filename] = { exists: true, updated_at: updatedAt, stale };
  }

  return { files, overall_stale: overallStale };
}

/**
 * Show changes since the last full refresh by comparing file hashes.
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {{ changed: string[], added: string[], removed: string[] } | { no_baseline: true } | { disabled: true, message: string }}
 */
function intelDiff(planningDir) {
  if (!isIntelEnabled(planningDir)) return disabledResponse();

  const snapshotPath = intelFilePath(planningDir, '.last-refresh.json');
  const snapshot = safeReadJson(snapshotPath);

  if (!snapshot) {
    return { no_baseline: true };
  }

  const prevHashes = snapshot.hashes || {};
  const changed = [];
  const added = [];
  const removed = [];

  // Check current files against snapshot
  for (const [_key, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(planningDir, filename);
    const currentHash = hashFile(filePath);

    if (currentHash && !prevHashes[filename]) {
      added.push(filename);
    } else if (currentHash && prevHashes[filename] && currentHash !== prevHashes[filename]) {
      changed.push(filename);
    } else if (!currentHash && prevHashes[filename]) {
      removed.push(filename);
    }
  }

  return { changed, added, removed };
}

/**
 * Stub for triggering an intel update.
 * The actual update is performed by the intel-updater agent (PLAN-02).
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {{ action: string, message: string } | { disabled: true, message: string }}
 */
function intelUpdate(planningDir) {
  if (!isIntelEnabled(planningDir)) return disabledResponse();

  return {
    action: 'spawn_agent',
    message: 'Run gsd-tools intel update or spawn gsd-intel-updater agent for full refresh'
  };
}

/**
 * Save a refresh snapshot with hashes of all current intel files.
 * Called by the intel-updater agent after completing a refresh.
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {{ saved: boolean, timestamp: string, files: number }}
 */
function saveRefreshSnapshot(planningDir) {
  const intelPath = ensureIntelDir(planningDir);
  const hashes = {};
  let fileCount = 0;

  for (const [_key, filename] of Object.entries(INTEL_FILES)) {
    const filePath = path.join(intelPath, filename);
    const hash = hashFile(filePath);
    if (hash) {
      hashes[filename] = hash;
      fileCount++;
    }
  }

  const timestamp = new Date().toISOString();
  const snapshotPath = path.join(intelPath, '.last-refresh.json');
  fs.writeFileSync(snapshotPath, JSON.stringify({
    hashes,
    timestamp,
    version: 1
  }, null, 2), 'utf8');

  return { saved: true, timestamp, files: fileCount };
}

// ─── CLI Subcommands ─────────────────────────────────────────────────────────

/**
 * Thin wrapper around saveRefreshSnapshot for CLI dispatch.
 * Writes .last-refresh.json with accurate timestamps and hashes.
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {{ saved: boolean, timestamp: string, files: number } | { disabled: true, message: string }}
 */
function intelSnapshot(planningDir) {
  if (!isIntelEnabled(planningDir)) return disabledResponse();
  return saveRefreshSnapshot(planningDir);
}

/**
 * Validate all intel files for correctness and freshness.
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {{ valid: boolean, errors: string[], warnings: string[] } | { disabled: true, message: string }}
 */
function intelValidate(planningDir) {
  if (!isIntelEnabled(planningDir)) return disabledResponse();

  const errors = [];
  const warnings = [];
  const STALE_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const [key, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(planningDir, filename);

    // Check existence
    if (!fs.existsSync(filePath)) {
      errors.push(`${filename}: file does not exist`);
      continue;
    }

    // All intel files are JSON — validate _meta and entries structure

    // Parse JSON
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      errors.push(`${filename}: invalid JSON — ${e.message}`);
      continue;
    }

    // Check _meta.updated_at recency
    if (data._meta && data._meta.updated_at) {
      const age = now - new Date(data._meta.updated_at).getTime();
      if (age > STALE_MS) {
        warnings.push(`${filename}: _meta.updated_at is ${Math.round(age / 3600000)} hours old (>24 hr)`);
      }
    } else {
      warnings.push(`${filename}: missing _meta.updated_at`);
    }

    // Validate entries are objects with expected fields
    if (data.entries && typeof data.entries === 'object') {
      // files.json: check exports are actual symbol names (no spaces)
      if (key === 'files') {
        for (const [entryPath, entry] of Object.entries(data.entries)) {
          if (entry.exports && Array.isArray(entry.exports)) {
            for (const exp of entry.exports) {
              if (typeof exp === 'string' && exp.includes(' ')) {
                warnings.push(`${filename}: "${entryPath}" export "${exp}" looks like a description (contains space)`);
              }
            }
          }
        }
        // Spot-check first 5 file paths exist on disk
        const entryPaths = Object.keys(data.entries).slice(0, 5);
        for (const ep of entryPaths) {
          if (!fs.existsSync(ep)) {
            warnings.push(`${filename}: entry path "${ep}" does not exist on disk`);
          }
        }
      }

      // deps.json: check entries have version, type, used_by
      if (key === 'deps') {
        for (const [depName, entry] of Object.entries(data.entries)) {
          const missing = [];
          if (!entry.version) missing.push('version');
          if (!entry.type) missing.push('type');
          if (!entry.used_by) missing.push('used_by');
          if (missing.length > 0) {
            warnings.push(`${filename}: "${depName}" missing fields: ${missing.join(', ')}`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Patch _meta.updated_at in a JSON intel file to the current timestamp.
 * Reads the file, updates _meta.updated_at, increments version, writes back.
 *
 * NOTE: Does not gate on isIntelEnabled — operates on arbitrary file paths
 * for use by agents patching individual files outside the intel store.
 *
 * @param {string} filePath - Absolute or relative path to the JSON intel file
 * @returns {{ patched: boolean, file: string, timestamp: string } | { patched: false, error: string }}
 */
function intelPatchMeta(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { patched: false, error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      return { patched: false, error: `Invalid JSON: ${e.message}` };
    }

    if (!data._meta) {
      data._meta = {};
    }

    const timestamp = new Date().toISOString();
    data._meta.updated_at = timestamp;
    data._meta.version = (data._meta.version || 0) + 1;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');

    return { patched: true, file: filePath, timestamp };
  } catch (e) {
    return { patched: false, error: e.message };
  }
}

/**
 * Extract exports from a JS/CJS file by parsing module.exports or exports.X patterns.
 *
 * NOTE: Does not gate on isIntelEnabled — operates on arbitrary source files
 * for use by agents building intel data from project files.
 *
 * @param {string} filePath - Path to the JS/CJS file
 * @returns {{ file: string, exports: string[], method: string }}
 */
function intelExtractExports(filePath) {
  if (!fs.existsSync(filePath)) {
    return { file: filePath, exports: [], method: 'none' };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let exports = [];
  let method = 'none';

  // Try module.exports = { ... } pattern (handle multi-line)
  // Find the LAST module.exports assignment (the actual one, not references in code)
  const allMatches = [...content.matchAll(/module\.exports\s*=\s*\{/g)];
  if (allMatches.length > 0) {
    const lastMatch = allMatches[allMatches.length - 1];
    const startIdx = lastMatch.index + lastMatch[0].length;
    // Find matching closing brace by counting braces
    let depth = 1;
    let endIdx = startIdx;
    while (endIdx < content.length && depth > 0) {
      if (content[endIdx] === '{') depth++;
      else if (content[endIdx] === '}') depth--;
      if (depth > 0) endIdx++;
    }
    const block = content.substring(startIdx, endIdx);
    method = 'module.exports';
    // Extract key names from lines like "  keyName," or "  keyName: value,"
    const lines = block.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      // Match identifier at start of line (before comma, colon, end of line)
      const keyMatch = trimmed.match(/^(\w+)\s*[,}:]/) || trimmed.match(/^(\w+)$/);
      if (keyMatch) {
        exports.push(keyMatch[1]);
      }
    }
  }

  // Also try individual exports.X = patterns (only at start of line, not inside strings/regex)
  const individualPattern = /^exports\.(\w+)\s*=/gm;
  let im;
  while ((im = individualPattern.exec(content)) !== null) {
    if (!exports.includes(im[1])) {
      exports.push(im[1]);
      if (method === 'none') method = 'exports.X';
    }
  }

  const hadCjs = exports.length > 0;

  // ESM patterns
  const esmExports = [];

  // export default function X / export default class X
  const defaultNamedPattern = /^export\s+default\s+(?:function|class)\s+(\w+)/gm;
  let em;
  while ((em = defaultNamedPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1])) esmExports.push(em[1]);
  }

  // export default (without named function/class)
  const defaultAnonPattern = /^export\s+default\s+(?!function\s|class\s)/gm;
  if (defaultAnonPattern.test(content) && esmExports.length === 0) {
    if (!esmExports.includes('default')) esmExports.push('default');
  }

  // export function X( / export async function X(
  const exportFnPattern = /^export\s+(?:async\s+)?function\s+(\w+)\s*\(/gm;
  while ((em = exportFnPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1])) esmExports.push(em[1]);
  }

  // export const X = / export let X = / export var X =
  const exportVarPattern = /^export\s+(?:const|let|var)\s+(\w+)\s*=/gm;
  while ((em = exportVarPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1])) esmExports.push(em[1]);
  }

  // export class X
  const exportClassPattern = /^export\s+class\s+(\w+)/gm;
  while ((em = exportClassPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1])) esmExports.push(em[1]);
  }

  // export { X, Y, Z } — strip "as alias" parts
  const exportBlockPattern = /^export\s*\{([^}]+)\}/gm;
  while ((em = exportBlockPattern.exec(content)) !== null) {
    const items = em[1].split(',');
    for (const item of items) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      // "foo as bar" -> extract "foo"
      const name = trimmed.split(/\s+as\s+/)[0].trim();
      if (name && !esmExports.includes(name)) esmExports.push(name);
    }
  }

  // Merge ESM exports into the result
  for (const e of esmExports) {
    if (!exports.includes(e)) exports.push(e);
  }

  // Determine method
  const hadEsm = esmExports.length > 0;
  if (hadCjs && hadEsm) {
    method = 'mixed';
  } else if (hadEsm && !hadCjs) {
    method = 'esm';
  }

  return { file: filePath, exports, method };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Public API
  intelQuery,
  intelUpdate,
  intelStatus,
  intelDiff,
  saveRefreshSnapshot,

  // CLI subcommands
  intelSnapshot,
  intelValidate,
  intelExtractExports,
  intelPatchMeta,

  // Utilities
  ensureIntelDir,
  isIntelEnabled,

  // Constants
  INTEL_FILES,
  INTEL_DIR
};
