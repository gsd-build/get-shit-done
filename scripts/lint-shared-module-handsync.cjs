#!/usr/bin/env node
'use strict';

/**
 * Shared Module hand-sync drift lint — Phase 6 of #3524 (#3575).
 *
 * Scans get-shit-done/bin/lib/ for .cjs files and checks whether a matching
 * TypeScript file exists in sdk/src/<name>.ts, sdk/src/query/<name>.ts, or
 * sdk/src/<name>/index.ts (excluding *.generated.ts and *.test.ts).
 *
 * Allowlist entries are keyed by the (cjs, ts) PAIR. An entry with cjs
 * `bin/lib/foo.cjs` and ts `sdk/src/foo.ts` only allow-throughs that exact
 * pair — a sibling at `sdk/src/query/foo.ts` is still flagged.
 *
 * If a pair is found:
 *   - cooperatingSiblings (matching cjs + ts): accepted silently (exit 0).
 *   - migrateMeBacklog (matching cjs + ts): emits a WARNING only when
 *     --warn-all is set; otherwise the pair passes silently. Backlog
 *     pairs never fail CI.
 *   - Unlisted pairs (cjs or ts not on either list): ERROR — exit 1.
 *
 * Usage:
 *   node scripts/lint-shared-module-handsync.cjs
 *   node scripts/lint-shared-module-handsync.cjs --root /path/to/repo
 *   node scripts/lint-shared-module-handsync.cjs --warn-all
 *   node scripts/lint-shared-module-handsync.cjs --cjs-dir custom/bin/lib --sdk-src custom/sdk/src
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let ROOT = path.resolve(__dirname, '..');
let CJS_DIR = null;          // resolved below
let SDK_SRC = null;          // resolved below
let ALLOWLIST_OVERRIDE = null; // resolved below
let WARN_ALL = false;
let JSON_OUTPUT = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root' && args[i + 1]) {
    ROOT = path.resolve(args[++i]);
  } else if (args[i] === '--cjs-dir' && args[i + 1]) {
    CJS_DIR = path.resolve(args[++i]);
  } else if (args[i] === '--sdk-src' && args[i + 1]) {
    SDK_SRC = path.resolve(args[++i]);
  } else if (args[i] === '--allowlist' && args[i + 1]) {
    ALLOWLIST_OVERRIDE = path.resolve(args[++i]);
  } else if (args[i] === '--warn-all') {
    WARN_ALL = true;
  } else if (args[i] === '--json') {
    JSON_OUTPUT = true;
  }
}

if (!CJS_DIR) CJS_DIR = path.join(ROOT, 'get-shit-done', 'bin', 'lib');
if (!SDK_SRC) SDK_SRC = path.join(ROOT, 'sdk', 'src');

// ---------------------------------------------------------------------------
// Load allowlist
// When --root is given (e.g. in tests), prefer <ROOT>/scripts/allowlist.json
// so fixture trees can supply their own allowlist. Fall back to the copy
// co-located with this script (default production path).
// ---------------------------------------------------------------------------
const ALLOWLIST_PATH = ALLOWLIST_OVERRIDE
  ? ALLOWLIST_OVERRIDE
  : fs.existsSync(path.join(ROOT, 'scripts', 'shared-module-handsync-allowlist.json'))
    ? path.join(ROOT, 'scripts', 'shared-module-handsync-allowlist.json')
    : path.join(__dirname, 'shared-module-handsync-allowlist.json');
let allowlist;
try {
  allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
} catch (err) {
  process.stderr.write(
    `lint-shared-module-handsync: failed to read allowlist at ${ALLOWLIST_PATH}: ${err.message}\n`
  );
  process.exit(1);
}

/**
 * Pair identity = `${cjs}::${ts}`. Keying on the pair (not just cjs)
 * prevents an allowlisted entry from silently passing an unintended
 * sibling at a different ts path with the same basename.
 *
 * @type {Set<string>} pair identities in cooperatingSiblings
 */
const cooperatingPairs = new Set(
  (allowlist.cooperatingSiblings || []).map((e) => `${e.cjs}::${e.ts}`)
);

/** @type {Map<string, object>} pair identity -> entry for migrateMeBacklog */
const migrateMap = new Map(
  (allowlist.migrateMeBacklog || []).map((e) => [`${e.cjs}::${e.ts}`, e])
);

// ---------------------------------------------------------------------------
// Build SDK name index: name -> array of absolute TS paths
// (excludes *.generated.ts and *.test.ts)
// ---------------------------------------------------------------------------
function buildSdkIndex(sdkSrc) {
  const index = new Map(); // name -> [absPath, ...]

  function addEntry(name, absPath) {
    if (!index.has(name)) index.set(name, []);
    index.get(name).push(absPath);
  }

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
      } else if (ent.isFile() && ent.name.endsWith('.ts') &&
                 !ent.name.endsWith('.generated.ts') &&
                 !ent.name.endsWith('.test.ts')) {
        const rel = path.relative(sdkSrc, abs);
        const parts = rel.split(path.sep);

        // sdk/src/<name>.ts  (direct child, not in a subdir)
        if (parts.length === 1) {
          const name = parts[0].slice(0, -3); // strip .ts
          addEntry(name, abs);
        }
        // sdk/src/<name>/index.ts  (one subdir deep, file is index.ts)
        else if (parts.length === 2 && parts[1] === 'index.ts') {
          const name = parts[0];
          addEntry(name, abs);
        }
        // sdk/src/query/<name>.ts  (exactly: query/<something>.ts)
        else if (parts.length === 2 && parts[0] === 'query' && parts[1] !== 'index.ts') {
          const name = parts[1].slice(0, -3); // strip .ts
          addEntry(name, abs);
        }
      }
    }
  }

  walk(sdkSrc);
  return index;
}

// ---------------------------------------------------------------------------
// Scan CJS files (direct children only; exclude *.generated.cjs)
// ---------------------------------------------------------------------------
function scanCjsFiles(cjsDir) {
  let entries;
  try {
    entries = fs.readdirSync(cjsDir, { withFileTypes: true });
  } catch (err) {
    process.stderr.write(
      `lint-shared-module-handsync: cannot read CJS dir ${cjsDir}: ${err.message}\n`
    );
    process.exit(1);
  }
  return entries
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith('.cjs') &&
        !e.name.endsWith('.generated.cjs')
    )
    .map((e) => ({
      name: e.name.slice(0, -4), // strip .cjs
      absPath: path.join(cjsDir, e.name),
    }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function emitJson(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function main() {
  // Check that the directories exist
  if (!fs.existsSync(CJS_DIR)) {
    if (JSON_OUTPUT) {
      emitJson({ ok: false, reason: 'cjs_dir_missing', path: CJS_DIR });
    } else {
      process.stderr.write(
        `lint-shared-module-handsync: CJS dir not found: ${CJS_DIR}\n` +
          `  Pass --root <repo-root> or --cjs-dir <path> to override.\n`
      );
    }
    process.exit(1);
  }
  if (!fs.existsSync(SDK_SRC)) {
    if (JSON_OUTPUT) {
      emitJson({ ok: false, reason: 'sdk_src_missing', path: SDK_SRC });
    } else {
      process.stderr.write(
        `lint-shared-module-handsync: SDK src dir not found: ${SDK_SRC}\n` +
          `  Pass --root <repo-root> or --sdk-src <path> to override.\n`
      );
    }
    process.exit(1);
  }

  const sdkIndex = buildSdkIndex(SDK_SRC);
  const cjsFiles = scanCjsFiles(CJS_DIR);

  const errors = [];
  const warnings = [];

  for (const { name, absPath } of cjsFiles) {
    // Is there a matching TS file?
    if (!sdkIndex.has(name)) continue;

    // Compute the relative paths the allowlist uses
    const relCjs = path.relative(ROOT, absPath).replace(/\\/g, '/');
    const tsPaths = sdkIndex.get(name).map((p) => path.relative(ROOT, p).replace(/\\/g, '/'));

    // Pair-aware matching, per ts sibling. Each ts candidate is classified
    // independently against the allowlist so a partially-allowlisted set of
    // siblings still surfaces the unauthorized ones. See #3632.
    const unauthorizedTs = [];
    const backlogTsForCjs = [];
    for (const relTs of tsPaths) {
      const pairKey = `${relCjs}::${relTs}`;
      if (cooperatingPairs.has(pairKey)) continue;
      if (migrateMap.has(pairKey)) {
        backlogTsForCjs.push(relTs);
        continue;
      }
      unauthorizedTs.push(relTs);
    }

    if (unauthorizedTs.length > 0) {
      errors.push({ relCjs, tsPaths: unauthorizedTs });
    }
    if (backlogTsForCjs.length > 0) {
      const entry = migrateMap.get(`${relCjs}::${backlogTsForCjs[0]}`);
      warnings.push({ relCjs, tsPaths: backlogTsForCjs, entry });
    }
  }

  // Count cjs files whose pair identity (cjs+ts) is on cooperatingSiblings.
  // A file with multiple ts candidates is counted once if any pair matches.
  const cooperatingCount = cjsFiles.filter((f) => {
    if (!sdkIndex.has(f.name)) return false;
    const relCjs = path.relative(ROOT, f.absPath).replace(/\\/g, '/');
    return sdkIndex.get(f.name).some((tsAbs) => {
      const relTs = path.relative(ROOT, tsAbs).replace(/\\/g, '/');
      return cooperatingPairs.has(`${relCjs}::${relTs}`);
    });
  }).length;

  // -------------------------------------------------------------------------
  // Report errors (exit 1)
  // -------------------------------------------------------------------------
  if (errors.length > 0) {
    if (JSON_OUTPUT) {
      emitJson({
        ok: false,
        reason: 'unauthorized_pairs',
        errors,
        warnings,
        cooperatingCount,
      });
    } else {
      process.stderr.write(
        `\nERROR lint-shared-module-handsync: ${errors.length} unauthorized hand-sync pair(s) found.\n\n`
      );
      for (const { relCjs, tsPaths } of errors) {
        process.stderr.write(`  CJS: ${relCjs}\n`);
        for (const ts of tsPaths) {
          process.stderr.write(`   TS: ${ts}\n`);
        }
        process.stderr.write('\n');
      }
      process.stderr.write(
        'To resolve, choose one of:\n' +
          '  1. Migrate to a Shared Module (preferred): create sdk/src/<name>/index.ts as the\n' +
          '     source-of-truth, write a generator script (sdk/scripts/gen-<name>.mjs), add a\n' +
          '     freshness check, and update CI. See docs/agents/cjs-sdk-seam.md for the pattern.\n' +
          '  2. Add an explicit allowlist entry to scripts/shared-module-handsync-allowlist.json\n' +
          '     with a justification explaining why this pair is a legitimate cooperating sibling\n' +
          '     rather than a drift anti-pattern. Requires maintainer review via CODEOWNERS.\n\n'
      );
    }
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Report warnings (no exit code change)
  // -------------------------------------------------------------------------
  if (warnings.length > 0 && WARN_ALL && !JSON_OUTPUT) {
    process.stderr.write(
      `\nWARNING lint-shared-module-handsync: ${warnings.length} known drift anti-pattern pair(s) in migrateMeBacklog.\n` +
        `These are tracked for future Shared Module migration but do not block CI.\n\n`
    );
    for (const { relCjs, tsPaths, entry } of warnings) {
      process.stderr.write(`  CJS: ${relCjs}\n`);
      for (const ts of tsPaths) {
        process.stderr.write(`   TS: ${ts}\n`);
      }
      process.stderr.write(`  Tracked: ${entry.trackedIn}\n`);
      process.stderr.write(`  Hint: ${entry.justification}\n\n`);
    }
  }

  // -------------------------------------------------------------------------
  // Success
  // -------------------------------------------------------------------------
  if (JSON_OUTPUT) {
    emitJson({
      ok: true,
      cooperatingCount,
      backlogCount: warnings.length,
      warnings,
    });
  } else {
    process.stdout.write(
      `ok lint-shared-module-handsync: no unauthorized hand-sync pairs found` +
        ` (${cooperatingCount} cooperating sibling(s), ${warnings.length} backlog pair(s))\n`
    );
  }
  process.exit(0);
}

main();
