/**
 * Codebase Drift Detection (#2003)
 *
 * Detects structural drift between a committed codebase and the
 * `.planning/codebase/STRUCTURE.md` map produced by `gsd-codebase-mapper`.
 *
 * Four categories of drift element:
 *   - new_dir    → a newly-added file whose directory prefix does not appear
 *                  in STRUCTURE.md
 *   - barrel     → a newly-added barrel export at
 *                  (packages|apps)/<name>/src/index.(ts|tsx|js|mjs|cjs)
 *   - migration  → a newly-added migration file under one of the recognized
 *                  migration directories (supabase, prisma, drizzle, src/migrations, …)
 *   - route      → a newly-added route module under a `routes/` or `api/` dir
 *
 * Each file is counted at most once; when a file matches multiple categories
 * the most specific category wins (migration > route > barrel > new_dir).
 *
 * Design decisions (see PR for full rubber-duck):
 *   - The library is pure. It takes parsed git diff output and returns a
 *     structured result. The CLI/workflow layer is responsible for running
 *     git and for spawning mappers.
 *   - `last_mapped_commit` is stored as YAML-style frontmatter at the top of
 *     each `.planning/codebase/*.md` file. This keeps the baseline attached
 *     to the file, survives git moves, and avoids a sidecar JSON.
 *   - The detector NEVER throws on malformed input — it returns a
 *     `{ skipped: true }` result. The phase workflow depends on this
 *     non-blocking guarantee.
 */

'use strict';

const fs = require('node:fs');

// ─── Constants ───────────────────────────────────────────────────────────────

const DRIFT_CATEGORIES = Object.freeze(['new_dir', 'barrel', 'migration', 'route']);

// Category priority when a single file matches multiple rules.
// Higher index = more specific = wins.
const CATEGORY_PRIORITY = { new_dir: 0, barrel: 1, route: 2, migration: 3 };

const BARREL_RE = /^(packages|apps)\/[^/]+\/src\/index\.(ts|tsx|js|mjs|cjs)$/;

const MIGRATION_RES = [
  /^supabase\/migrations\/.+\.sql$/,
  /^prisma\/migrations\/.+/,
  /^drizzle\/meta\/.+/,
  /^drizzle\/migrations\/.+/,
  /^src\/migrations\/.+\.(ts|js|sql)$/,
  /^db\/migrations\/.+\.(sql|ts|js)$/,
  /^migrations\/.+\.(sql|ts|js)$/,
];

const ROUTE_RES = [
  /^(apps|packages)\/[^/]+\/src\/routes\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /^src\/routes\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /^src\/api\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /^(apps|packages)\/[^/]+\/src\/api\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/,
];

// A conservative allowlist for `--paths` arguments passed to the mapper:
// repo-relative path components separated by /, containing only
// alphanumerics, dash, underscore, and dot (no `..`, no `/..`).
const SAFE_PATH_RE = /^(?!.*\.\.)(?:[A-Za-z0-9_.][A-Za-z0-9_.\-]*)(?:\/[A-Za-z0-9_.][A-Za-z0-9_.\-]*)*$/;

// ─── Classification ──────────────────────────────────────────────────────────

/**
 * Classify a single file path into a drift category or null.
 *
 * @param {string} file - repo-relative path, forward slashes.
 * @returns {'barrel'|'migration'|'route'|null}
 */
function classifyFile(file) {
  if (typeof file !== 'string' || !file) return null;
  const norm = file.replace(/\\/g, '/');
  if (MIGRATION_RES.some((r) => r.test(norm))) return 'migration';
  if (ROUTE_RES.some((r) => r.test(norm))) return 'route';
  if (BARREL_RE.test(norm)) return 'barrel';
  return null;
}

/**
 * True iff any prefix of `file` (dir1, dir1/dir2, …) appears as a substring
 * of `structureMd`. Used to decide whether a file is in "mapped territory".
 *
 * Matching is deliberately substring-based — STRUCTURE.md is free-form
 * markdown, not a structured manifest. If the map mentions `src/lib/` the
 * check `structureMd.includes('src/lib')` holds.
 */
function isPathMapped(file, structureMd) {
  const norm = file.replace(/\\/g, '/');
  const parts = norm.split('/');
  // Check prefixes from longest to shortest; any hit means "mapped".
  for (let i = parts.length - 1; i >= 1; i--) {
    const prefix = parts.slice(0, i).join('/');
    if (structureMd.includes(prefix)) return true;
  }
  // Finally, if even the top-level dir is mentioned, count as mapped.
  if (parts.length > 0 && structureMd.includes(parts[0] + '/')) return true;
  if (parts.length > 0 && structureMd.includes('`' + parts[0] + '`')) return true;
  return false;
}

// ─── Main detection ──────────────────────────────────────────────────────────

/**
 * Detect codebase drift.
 *
 * @param {object} input
 * @param {string[]} input.addedFiles - files with git status A (new)
 * @param {string[]} input.modifiedFiles - files with git status M
 * @param {string[]} input.deletedFiles - files with git status D
 * @param {string|null|undefined} input.structureMd - contents of STRUCTURE.md
 * @param {number} [input.threshold=3] - min number of drift elements that triggers action
 * @param {'warn'|'auto-remap'} [input.action='warn']
 * @returns {object} result
 */
function detectDrift(input) {
  try {
    if (!input || typeof input !== 'object') {
      return skipped('invalid-input');
    }
    const {
      addedFiles,
      modifiedFiles,
      deletedFiles,
      structureMd,
    } = input;
    const threshold = Number.isInteger(input.threshold) && input.threshold >= 1
      ? input.threshold
      : 3;
    const action = input.action === 'auto-remap' ? 'auto-remap' : 'warn';

    if (structureMd === null || structureMd === undefined) {
      return skipped('missing-structure-md');
    }
    if (typeof structureMd !== 'string') {
      return skipped('invalid-structure-md');
    }

    const added = Array.isArray(addedFiles) ? addedFiles.filter((x) => typeof x === 'string') : [];
    const modified = Array.isArray(modifiedFiles) ? modifiedFiles : [];
    const deleted = Array.isArray(deletedFiles) ? deletedFiles : [];

    // Build elements. One element per file, highest-priority category wins.
    /** @type {{category: string, path: string}[]} */
    const elements = [];
    const seen = new Map();

    for (const rawFile of added) {
      const file = rawFile.replace(/\\/g, '/');
      const specific = classifyFile(file);
      let category = specific;
      if (!category) {
        if (!isPathMapped(file, structureMd)) {
          category = 'new_dir';
        } else {
          continue; // mapped, known, ordinary file — not drift
        }
      }
      // Dedup: if we've already counted this path at higher-or-equal priority, skip
      const prior = seen.get(file);
      if (prior && CATEGORY_PRIORITY[prior] >= CATEGORY_PRIORITY[category]) continue;
      seen.set(file, category);
    }

    for (const [file, category] of seen.entries()) {
      elements.push({ category, path: file });
    }

    // Sort for stable output.
    elements.sort((a, b) =>
      a.category === b.category
        ? a.path.localeCompare(b.path)
        : a.category.localeCompare(b.category),
    );

    const actionRequired = elements.length >= threshold;
    let directive = 'none';
    let spawnMapper = false;
    let affectedPaths = [];
    let message = '';

    if (actionRequired) {
      directive = action;
      affectedPaths = chooseAffectedPaths(elements.map((e) => e.path));
      if (action === 'auto-remap') {
        spawnMapper = true;
      }
      message = buildMessage(elements, affectedPaths, action);
    }

    return {
      skipped: false,
      elements,
      actionRequired,
      directive,
      spawnMapper,
      affectedPaths,
      threshold,
      action,
      message,
      counts: {
        added: added.length,
        modified: modified.length,
        deleted: deleted.length,
      },
    };
  } catch (err) {
    // Non-blocking: never throw from this function.
    return skipped('exception:' + (err && err.message ? err.message : String(err)));
  }
}

function skipped(reason) {
  return {
    skipped: true,
    reason,
    elements: [],
    actionRequired: false,
    directive: 'none',
    spawnMapper: false,
    affectedPaths: [],
    message: '',
  };
}

function buildMessage(elements, affectedPaths, action) {
  const byCat = {};
  for (const e of elements) {
    (byCat[e.category] ||= []).push(e.path);
  }
  const lines = [
    `Codebase drift detected: ${elements.length} structural element(s) since last mapping.`,
    '',
  ];
  const labels = {
    new_dir: 'New directories',
    barrel: 'New barrel exports',
    migration: 'New migrations',
    route: 'New route modules',
  };
  for (const cat of ['new_dir', 'barrel', 'migration', 'route']) {
    if (byCat[cat]) {
      lines.push(`${labels[cat]}:`);
      for (const p of byCat[cat]) lines.push(`  - ${p}`);
    }
  }
  lines.push('');
  if (action === 'auto-remap') {
    lines.push(`Auto-remap scheduled for paths: ${affectedPaths.join(', ')}`);
  } else {
    lines.push(
      `Run /gsd-map-codebase --paths ${affectedPaths.join(',')} to refresh planning context.`,
    );
  }
  return lines.join('\n');
}

// ─── Affected paths ──────────────────────────────────────────────────────────

/**
 * Collapse a list of drifted file paths into a sorted, deduplicated list of
 * the top-level directory prefixes (depth 2 when the repo uses an
 * `<apps|packages>/<name>/…` layout; depth 1 otherwise).
 */
function chooseAffectedPaths(paths) {
  const out = new Set();
  for (const raw of paths || []) {
    if (typeof raw !== 'string' || !raw) continue;
    const file = raw.replace(/\\/g, '/');
    const parts = file.split('/');
    if (parts.length === 0) continue;
    const top = parts[0];
    if ((top === 'apps' || top === 'packages') && parts.length >= 2) {
      out.add(`${top}/${parts[1]}`);
    } else {
      out.add(top);
    }
  }
  return [...out].sort();
}

/**
 * Filter `paths` to only those that are safe to splice into a mapper prompt.
 * Any path that is absolute, contains traversal, or includes shell
 * metacharacters is dropped.
 */
function sanitizePaths(paths) {
  if (!Array.isArray(paths)) return [];
  const out = [];
  for (const p of paths) {
    if (typeof p !== 'string') continue;
    if (p.startsWith('/')) continue;
    if (!SAFE_PATH_RE.test(p)) continue;
    out.push(p);
  }
  return out;
}

// ─── Frontmatter helpers ─────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseFrontmatter(content) {
  if (typeof content !== 'string') return { data: {}, body: '' };
  const m = content.match(FRONTMATTER_RE);
  if (!m) return { data: {}, body: content };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    data[kv[1]] = kv[2];
  }
  return { data, body: content.slice(m[0].length) };
}

function serializeFrontmatter(data, body) {
  const keys = Object.keys(data);
  if (keys.length === 0) return body;
  const lines = ['---'];
  for (const k of keys) lines.push(`${k}: ${data[k]}`);
  lines.push('---');
  return lines.join('\n') + '\n' + body;
}

/**
 * Read `last_mapped_commit` from the frontmatter of a `.planning/codebase/*.md`
 * file. Returns null if the file does not exist or has no frontmatter.
 */
function readMappedCommit(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  const { data } = parseFrontmatter(content);
  const sha = data.last_mapped_commit;
  return typeof sha === 'string' && sha.length > 0 ? sha : null;
}

/**
 * Upsert `last_mapped_commit` and `last_mapped_at` into the frontmatter of
 * the given file, preserving any other frontmatter keys and the body.
 */
function writeMappedCommit(filePath, commitSha, isoDate) {
  // Symmetric with readMappedCommit (which returns null on missing files):
  // tolerate a missing target by creating a minimal frontmatter-only file
  // rather than throwing ENOENT. This matters when a mapper produces a new
  // doc and the caller stamps it before any prior content existed.
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const { data, body } = parseFrontmatter(content);
  data.last_mapped_commit = commitSha;
  if (isoDate) data.last_mapped_at = isoDate;
  fs.writeFileSync(filePath, serializeFrontmatter(data, body));
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  DRIFT_CATEGORIES,
  classifyFile,
  detectDrift,
  chooseAffectedPaths,
  sanitizePaths,
  readMappedCommit,
  writeMappedCommit,
  // Exposed for the CLI layer to reuse the same parser.
  parseFrontmatter,
};
