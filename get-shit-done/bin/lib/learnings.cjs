/**
 * Learnings — Global knowledge store with CRUD operations
 *
 * Provides a cross-project learnings store at ~/.gsd/knowledge/.
 * Each learning is stored as an individual JSON file with content-hash
 * deduplication. Supports write, read, list, query, delete, copy-from-project,
 * and prune operations.
 *
 * Storage format: { id, source_project, date, context, learning, tags, content_hash }
 * File naming: {id}.json
 * Deduplication: SHA-256 of learning text + source_project
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { output, error: coreError } = require('./core.cjs');

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_STORE_DIR = path.join(os.homedir(), '.gsd', 'knowledge');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the store directory, allowing override for testing.
 * @param {object} [opts]
 * @param {string} [opts.storeDir] - Override store directory
 * @returns {string}
 */
function getStoreDir(opts) {
  return (opts && opts.storeDir) || DEFAULT_STORE_DIR;
}

/**
 * Ensure the store directory exists. Created on first write, not on install.
 * @param {string} dir
 */
function ensureStoreDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate a content hash for deduplication.
 * Uses SHA-256 of learning text combined with source_project.
 * @param {string} learning
 * @param {string} sourceProject
 * @returns {string}
 */
function contentHash(learning, sourceProject) {
  return crypto.createHash('sha256')
    .update(learning + '\n' + sourceProject)
    .digest('hex');
}

/**
 * Generate a unique ID based on timestamp + random suffix.
 * @returns {string}
 */
function generateId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${ts}-${rand}`;
}

/**
 * Read and parse a single learning JSON file.
 * Returns null (with stderr warning) for malformed files.
 * @param {string} filePath
 * @returns {object|null}
 */
function readLearningFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    process.stderr.write(`Warning: skipping malformed file ${filePath}: ${err.message}\n`);
    return null;
  }
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

/**
 * Write a learning to the global store.
 * Deduplicates by content hash — same content from same project is not stored twice.
 *
 * @param {object} entry
 * @param {string} entry.source_project - Project name or path
 * @param {string} entry.learning - The learning text
 * @param {string} [entry.context] - Additional context
 * @param {string[]} [entry.tags] - Tags for querying
 * @param {object} [opts]
 * @param {string} [opts.storeDir] - Override store directory
 * @returns {{ id: string, created: boolean, content_hash: string }}
 */
function learningsWrite(entry, opts) {
  const dir = getStoreDir(opts);
  ensureStoreDir(dir);

  const hash = contentHash(entry.learning, entry.source_project);

  // Check for duplicate by scanning existing files
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const existing = readLearningFile(path.join(dir, file));
    if (existing && existing.content_hash === hash) {
      return { id: existing.id, created: false, content_hash: hash };
    }
  }

  const id = generateId();
  const record = {
    id,
    source_project: entry.source_project,
    date: new Date().toISOString(),
    context: entry.context || '',
    learning: entry.learning,
    tags: entry.tags || [],
    content_hash: hash,
  };

  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(record, null, 2), 'utf-8');
  return { id, created: true, content_hash: hash };
}

/**
 * Read a single learning by ID.
 *
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.storeDir] - Override store directory
 * @returns {object|null}
 */
function learningsRead(id, opts) {
  if (!/^[a-z0-9]+-[a-f0-9]+$/.test(id)) return null;
  const dir = getStoreDir(opts);
  const filePath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return readLearningFile(filePath);
}

/**
 * List all learnings, sorted by date (newest first).
 *
 * @param {object} [opts]
 * @param {string} [opts.storeDir] - Override store directory
 * @returns {object[]}
 */
function learningsList(opts) {
  const dir = getStoreDir(opts);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const results = [];
  for (const file of files) {
    const record = readLearningFile(path.join(dir, file));
    if (record) results.push(record);
  }

  // Sort by date descending (newest first)
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return results;
}

/**
 * Query learnings by tag.
 *
 * @param {object} query
 * @param {string} [query.tag] - Tag to filter by
 * @param {object} [opts]
 * @param {string} [opts.storeDir] - Override store directory
 * @returns {object[]}
 */
function learningsQuery(query, opts) {
  const all = learningsList(opts);
  if (query && query.tag) {
    return all.filter(r => r.tags && r.tags.includes(query.tag));
  }
  return all;
}

/**
 * Delete a learning by ID.
 *
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.storeDir] - Override store directory
 * @returns {boolean} true if deleted, false if not found
 */
function learningsDelete(id, opts) {
  if (!/^[a-z0-9]+-[a-f0-9]+$/.test(id)) return false;
  const dir = getStoreDir(opts);
  const filePath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Copy learnings from a project's LEARNINGS.md into the global store.
 * Parses markdown sections as individual learnings. Deduplicates by content hash.
 *
 * Expected LEARNINGS.md format:
 *   ## Section Title
 *   Learning content paragraph(s)...
 *
 *   ## Another Section
 *   More content...
 *
 * @param {string} planningDir - Path to .planning/ directory (or directory containing LEARNINGS.md)
 * @param {object} [opts]
 * @param {string} [opts.storeDir] - Override store directory
 * @param {string} [opts.sourceProject] - Project name (defaults to directory basename)
 * @returns {{ total: number, created: number, skipped: number }}
 */
function learningsCopyFromProject(planningDir, opts) {
  const learningsPath = path.join(planningDir, 'LEARNINGS.md');
  if (!fs.existsSync(learningsPath)) {
    return { total: 0, created: 0, skipped: 0 };
  }

  const content = fs.readFileSync(learningsPath, 'utf-8');
  const sourceProject = (opts && opts.sourceProject) || path.basename(path.resolve(planningDir, '..'));

  // Parse markdown: split on ## headings
  const sections = content.split(/^## /m).slice(1); // skip preamble before first ##
  let created = 0;
  let skipped = 0;

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const title = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();
    if (!body) continue;

    // Extract tags from title (simple: use words as tags)
    const tags = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const result = learningsWrite({
      source_project: sourceProject,
      learning: body,
      context: title,
      tags,
    }, opts);

    if (result.created) {
      created++;
    } else {
      skipped++;
    }
  }

  return { total: created + skipped, created, skipped };
}

/**
 * Prune learnings older than a given threshold.
 *
 * @param {string} olderThan - Duration string like "90d", "30d", "7d"
 * @param {object} [opts]
 * @param {string} [opts.storeDir] - Override store directory
 * @returns {{ removed: number, kept: number }}
 */
function learningsPrune(olderThan, opts) {
  const match = /^(\d+)d$/.exec(olderThan);
  if (!match) {
    throw new Error(`Invalid duration format: "${olderThan}" — expected format like "90d"`);
  }

  const days = parseInt(match[1], 10);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dir = getStoreDir(opts);

  if (!fs.existsSync(dir)) return { removed: 0, kept: 0 };

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let removed = 0;
  let kept = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const record = readLearningFile(filePath);
    if (!record) continue;

    const recordDate = new Date(record.date);
    if (recordDate < cutoff) {
      fs.unlinkSync(filePath);
      removed++;
    } else {
      kept++;
    }
  }

  return { removed, kept };
}

// ─── CLI Command Handlers ────────────────────────────────────────────────────

/**
 * Handle `gsd-tools learnings list`
 * @param {boolean} raw - Raw output flag
 */
function cmdLearningsList(raw) {
  const results = learningsList();
  output({ learnings: results, count: results.length }, raw);
}

/**
 * Handle `gsd-tools learnings query --tag <tag>`
 * @param {string} tag
 * @param {boolean} raw - Raw output flag
 */
function cmdLearningsQuery(tag, raw) {
  const results = learningsQuery({ tag });
  output({ learnings: results, count: results.length, tag }, raw);
}

/**
 * Handle `gsd-tools learnings copy`
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - Raw output flag
 */
function cmdLearningsCopy(cwd, raw) {
  const planningDir = path.join(cwd, '.planning');
  const result = learningsCopyFromProject(planningDir);
  output(result, raw);
}

/**
 * Handle `gsd-tools learnings prune --older-than <duration>`
 * @param {string} olderThan - Duration string like "90d"
 * @param {boolean} raw - Raw output flag
 */
function cmdLearningsPrune(olderThan, raw) {
  try {
    const result = learningsPrune(olderThan);
    output(result, raw);
  } catch (err) {
    coreError(err.message);
  }
}

/**
 * Handle `gsd-tools learnings delete <id>`
 * @param {string} id
 * @param {boolean} raw - Raw output flag
 */
function cmdLearningsDelete(id, raw) {
  if (!/^[a-z0-9]+-[a-f0-9]+$/.test(id)) {
    coreError(`Invalid learning ID: "${id}"`);
  }
  const deleted = learningsDelete(id);
  output({ id, deleted }, raw);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  learningsWrite,
  learningsRead,
  learningsList,
  learningsQuery,
  learningsDelete,
  learningsCopyFromProject,
  learningsPrune,
  cmdLearningsList,
  cmdLearningsQuery,
  cmdLearningsCopy,
  cmdLearningsPrune,
  cmdLearningsDelete,
  DEFAULT_STORE_DIR,
};
