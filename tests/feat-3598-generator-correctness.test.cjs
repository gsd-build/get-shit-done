'use strict';
/**
 * Generator correctness, parity, and atomicity (#3598).
 *
 * Existing per-generator tests (configuration-generator.test.cjs et al.)
 * assert positive-path behavior and CJS/ESM API parity for one or two
 * generators each. None of them assert:
 *
 *   1. The committed `.generated.cjs` is byte-equal to a fresh re-run
 *      of the generator's `build*Cjs()` export (stale-but-timestamp-valid
 *      detection — issue #3598 AC #4).
 *   2. The generator is deterministic — two back-to-back calls return
 *      identical strings (AC #1, defends against time/random/env-order
 *      sneaking into output).
 *   3. The runtime CJS alias surface and the SDK TS alias surface
 *      expose the same canonical/alias set (AC #3, beyond timestamp
 *      freshness).
 *   4. The live command registry contains no duplicate aliases
 *      (AC #1: "duplicate aliases" — translated to a behavioral
 *      structural invariant on the in-memory registry the generator
 *      reads from, since the generator has no fixture/--source seam).
 *   5. `build-hooks.js` is idempotent (running twice leaves `hooks/dist/`
 *      byte-identical and clears its per-PID staging directory — proves
 *      the atomic-write seam does not leak partial artifacts; AC #2).
 *
 * This suite fills those gaps without duplicating any happy-path
 * coverage that already exists.
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// ─── Helpers ────────────────────────────────────────────────────────────────

const sdkScriptUrl = (script) =>
  new URL(`file://${path.join(REPO_ROOT, 'sdk', 'scripts', script)}`).href;

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function normalizeEol(text) {
  return String(text).replace(/\r\n/g, '\n');
}

/** Read a directory recursively into a Map<relPath, sha256>. */
function snapshotDir(dir) {
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  const walk = (sub) => {
    for (const e of fs.readdirSync(sub, { withFileTypes: true })) {
      const full = path.join(sub, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) out.set(path.relative(dir, full), sha256(fs.readFileSync(full)));
    }
  };
  walk(dir);
  return out;
}

// ─── Suite 1: build*Cjs() === committed file (stale-detection) ──────────────

// Each row: { script, exportName, committed }
// `committed` is the path the generator writes to. The generator's exported
// build*Cjs() must produce a string equal to fs.readFileSync(committed). If
// the committed file has drifted (manual edit, partial generator run,
// stale-but-timestamp-valid), this assertion fails — which is the
// behavioral coverage the issue's AC #4 calls for.
const CJS_GENERATORS = [
  { script: 'gen-configuration.mjs',                  exportName: 'buildConfigurationCjs',              committed: 'get-shit-done/bin/lib/configuration.generated.cjs' },
  { script: 'gen-project-root.mjs',                   exportName: 'buildProjectRootCjs',                committed: 'get-shit-done/bin/lib/project-root.generated.cjs' },
  { script: 'gen-state-document.ts',                  exportName: 'buildStateDocumentCjs',              committed: 'get-shit-done/bin/lib/state-document.generated.cjs' },
  { script: 'gen-workstream-inventory-builder.mjs',   exportName: 'buildWorkstreamInventoryBuilderCjs', committed: 'get-shit-done/bin/lib/workstream-inventory-builder.generated.cjs' },
  { script: 'gen-decisions.mjs',                      exportName: 'buildDecisionsCjs',                  committed: 'get-shit-done/bin/lib/decisions.generated.cjs' },
  { script: 'gen-plan-scan.mjs',                      exportName: 'buildPlanScanCjs',                   committed: 'get-shit-done/bin/lib/plan-scan.generated.cjs' },
  { script: 'gen-schema-detect.mjs',                  exportName: 'buildSchemaDetectCjs',               committed: 'get-shit-done/bin/lib/schema-detect.generated.cjs' },
  { script: 'gen-secrets.mjs',                        exportName: 'buildSecretsCjs',                    committed: 'get-shit-done/bin/lib/secrets.generated.cjs' },
  { script: 'gen-workstream-name-policy.mjs',         exportName: 'buildWorkstreamNamePolicyCjs',       committed: 'get-shit-done/bin/lib/workstream-name-policy.generated.cjs' },
];

describe('feat-3598: build*Cjs() output matches committed .generated.cjs (stale-detection)', () => {
  for (const g of CJS_GENERATORS) {
    test(`${g.script} → ${path.basename(g.committed)} is fresh`, async () => {
      // `.ts` generators need ts-node/loader to import directly from .cjs
      // tests. Skip them here — their fresh-check covers the same property
      // via the `check-*-fresh.mjs` subprocess pathway, which runs in CI.
      if (g.script.endsWith('.ts')) {
        return; // covered by sdk/scripts/check-state-document-fresh.mjs
      }
      const mod = await import(sdkScriptUrl(g.script));
      const builder = mod[g.exportName];
      assert.equal(typeof builder, 'function',
        `${g.script} must export ${g.exportName} as a function`);

      const fresh = await builder();
      assert.equal(typeof fresh, 'string', `${g.exportName}() must return a string`);
      const committedPath = path.join(REPO_ROOT, g.committed);
      const committed = fs.readFileSync(committedPath, 'utf-8');
      assert.equal(normalizeEol(fresh), normalizeEol(committed),
        `${g.committed} drifted from generator output — run "cd sdk && npm run gen:${g.script.replace(/^gen-/, '').replace(/\.mjs$/, '')}" to regenerate`);
    });
  }
});

// ─── Suite 2: generators are deterministic ──────────────────────────────────

describe('feat-3598: build*Cjs() is deterministic across calls', () => {
  for (const g of CJS_GENERATORS) {
    test(`${g.exportName} produces identical output on back-to-back calls`, async () => {
      if (g.script.endsWith('.ts')) return; // see suite 1 note
      const mod = await import(sdkScriptUrl(g.script));
      const builder = mod[g.exportName];
      const a = await builder();
      const b = await builder();
      assert.equal(a, b,
        `${g.exportName}() output differed between two calls — generator has non-deterministic input ` +
        `(time, random, env-order, Map/Set iteration)`);
    });
  }
});

// ─── Suite 3: runtime CJS ↔ SDK TS alias parity ─────────────────────────────

describe('feat-3598: command-aliases CJS and TS surfaces expose the same alias set', () => {
  const CJS_PATH = path.join(REPO_ROOT, 'get-shit-done', 'bin', 'lib', 'command-aliases.generated.cjs');
  const TS_PATH = path.join(REPO_ROOT, 'sdk', 'src', 'query', 'command-aliases.generated.ts');

  test('both files exist', () => {
    assert.ok(fs.existsSync(CJS_PATH), `missing ${CJS_PATH}`);
    assert.ok(fs.existsSync(TS_PATH), `missing ${TS_PATH}`);
  });

  test('canonical command names are identical between runtimes', () => {
    const cjs = require(CJS_PATH);
    const cjsArrays = [
      'STATE_COMMAND_ALIASES',
      'VERIFY_COMMAND_ALIASES',
      'INIT_COMMAND_ALIASES',
      'PHASE_COMMAND_ALIASES',
      'PHASES_COMMAND_ALIASES',
      'VALIDATE_COMMAND_ALIASES',
      'ROADMAP_COMMAND_ALIASES',
      'NON_FAMILY_COMMAND_ALIASES',
    ];
    const cjsCanonicals = new Set();
    for (const key of cjsArrays) {
      assert.ok(Array.isArray(cjs[key]), `CJS export ${key} must be an array`);
      for (const e of cjs[key]) cjsCanonicals.add(e.canonical);
    }

    // The TS file is the same data emitted as a TS source. Read it and
    // extract canonical strings via a structural pattern (`canonical: '...'`)
    // restricted to the generated-file format the generator emits — never
    // a free-form text scan. This satisfies the CONTRIBUTING typed-IR
    // requirement because the source file *is* the generator's output:
    // its lexical shape is part of the deployed contract.
    // allow-test-rule: source-text-is-the-product
    const ts = fs.readFileSync(TS_PATH, 'utf-8');
    const tsCanonicals = new Set(
      [...ts.matchAll(/canonical:\s*'([^']+)'/g)].map((m) => m[1]),
    );

    assert.deepEqual(
      [...tsCanonicals].sort(),
      [...cjsCanonicals].sort(),
      'TS and CJS surfaces must expose the same canonical command set — regenerate via "cd sdk && npm run gen:command-aliases"',
    );
  });

  test('alias strings are identical between runtimes (set equality)', () => {
    const cjs = require(CJS_PATH);
    const cjsAliases = new Set();
    for (const key of [
      'STATE_COMMAND_ALIASES',
      'VERIFY_COMMAND_ALIASES',
      'INIT_COMMAND_ALIASES',
      'PHASE_COMMAND_ALIASES',
      'PHASES_COMMAND_ALIASES',
      'VALIDATE_COMMAND_ALIASES',
      'ROADMAP_COMMAND_ALIASES',
      'NON_FAMILY_COMMAND_ALIASES',
    ]) {
      for (const e of cjs[key]) for (const a of e.aliases || []) cjsAliases.add(a);
    }

    // allow-test-rule: source-text-is-the-product
    const ts = fs.readFileSync(TS_PATH, 'utf-8');
    // Aliases are emitted as: aliases: ['foo', 'bar', 'baz']
    // Match the literal-array bodies, then extract individual quoted strings.
    const tsAliases = new Set();
    for (const m of ts.matchAll(/aliases:\s*\[([^\]]*)\]/g)) {
      for (const a of m[1].matchAll(/'([^']+)'/g)) tsAliases.add(a[1]);
    }

    assert.deepEqual(
      [...tsAliases].sort(),
      [...cjsAliases].sort(),
      'TS and CJS alias sets must be identical — regenerate via "cd sdk && npm run gen:command-aliases"',
    );
  });
});

// ─── Suite 4: no duplicate aliases in the live registry ─────────────────────

describe('feat-3598: live command registry has no duplicate aliases', () => {
  // This is the behavioral equivalent of the issue's example test
  // "generator rejects duplicate command aliases with actionable error".
  // The generator has no fixture seam — it reads in-memory
  // COMMAND_DEFINITIONS_BY_FAMILY. The structural invariant that the
  // generator MUST emit a registry with no duplicates is what we assert
  // here, on the deployed surface. If two definitions ever collide,
  // this test fails with the colliding alias named — actionable in the
  // same way the issue's example error would be.
  test('no alias appears twice across all command families', () => {
    const cjs = require(path.join(
      REPO_ROOT, 'get-shit-done', 'bin', 'lib', 'command-aliases.generated.cjs',
    ));
    const seen = new Map(); // alias → canonical
    const collisions = [];
    for (const key of [
      'STATE_COMMAND_ALIASES',
      'VERIFY_COMMAND_ALIASES',
      'INIT_COMMAND_ALIASES',
      'PHASE_COMMAND_ALIASES',
      'PHASES_COMMAND_ALIASES',
      'VALIDATE_COMMAND_ALIASES',
      'ROADMAP_COMMAND_ALIASES',
      'NON_FAMILY_COMMAND_ALIASES',
    ]) {
      for (const e of cjs[key]) {
        for (const a of e.aliases || []) {
          if (seen.has(a)) {
            collisions.push(`alias "${a}" claimed by both "${seen.get(a)}" and "${e.canonical}"`);
          } else {
            seen.set(a, e.canonical);
          }
        }
      }
    }
    assert.equal(collisions.length, 0,
      `duplicate aliases in command registry:\n  ${collisions.join('\n  ')}`);
  });

  test('no canonical command appears twice', () => {
    const cjs = require(path.join(
      REPO_ROOT, 'get-shit-done', 'bin', 'lib', 'command-aliases.generated.cjs',
    ));
    const seen = new Set();
    const duplicates = [];
    for (const key of [
      'STATE_COMMAND_ALIASES',
      'VERIFY_COMMAND_ALIASES',
      'INIT_COMMAND_ALIASES',
      'PHASE_COMMAND_ALIASES',
      'PHASES_COMMAND_ALIASES',
      'VALIDATE_COMMAND_ALIASES',
      'ROADMAP_COMMAND_ALIASES',
      'NON_FAMILY_COMMAND_ALIASES',
    ]) {
      for (const e of cjs[key]) {
        if (seen.has(e.canonical)) duplicates.push(e.canonical);
        seen.add(e.canonical);
      }
    }
    assert.deepEqual(duplicates, [],
      `canonical command appears in more than one family: ${duplicates.join(', ')}`);
  });
});

// ─── Suite 5: build-hooks atomicity (idempotence + no orphan staging) ───────

describe('feat-3598: build-hooks.js is idempotent and leaves no staging residue', () => {
  const HOOKS_DIR = path.join(REPO_ROOT, 'hooks');
  const DIST_DIR = path.join(HOOKS_DIR, 'dist');

  // A baseline snapshot taken once before either run. The "fresh dist" the
  // first run produces is compared to the second run's dist. We do NOT
  // compare against the disk state before the first run, because the
  // baseline dist on disk could itself be stale at the time the suite
  // happens to run (e.g. a fresh clone with an old build artifact).
  let snapshotA;
  let stagingBefore;

  before(() => {
    // Run build:hooks once to land a known-fresh dist.
    const r1 = spawnSync(process.execPath, [path.join('scripts', 'build-hooks.js')], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 60000,
    });
    assert.equal(r1.status, 0,
      `build-hooks first run must exit 0; stderr=${r1.stderr.slice(0, 400)}`);
    snapshotA = snapshotDir(DIST_DIR);
    assert.ok(snapshotA.size > 0, 'build-hooks must produce at least one file in hooks/dist/');

    stagingBefore = fs.readdirSync(HOOKS_DIR)
      .filter((n) => n.startsWith('.dist-staging-'));
  });

  test('second run produces byte-identical hooks/dist/ contents', () => {
    const r2 = spawnSync(process.execPath, [path.join('scripts', 'build-hooks.js')], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 60000,
    });
    assert.equal(r2.status, 0,
      `build-hooks second run must exit 0; stderr=${r2.stderr.slice(0, 400)}`);

    const snapshotB = snapshotDir(DIST_DIR);
    assert.equal(snapshotB.size, snapshotA.size,
      `hooks/dist/ file count must be stable: a=${snapshotA.size} b=${snapshotB.size}`);
    for (const [rel, hashA] of snapshotA) {
      const hashB = snapshotB.get(rel);
      assert.equal(hashB, hashA,
        `hooks/dist/${rel} changed between consecutive runs (atomic-write must produce identical output)`);
    }
  });

  test('no orphaned .dist-staging-* directories remain after the run', () => {
    // The second run (just above) creates and cleans its own staging dir.
    // Any leftover with the second-run's PID would prove the cleanup
    // step failed. We can only check the *current* state — that is, any
    // staging directory that was not present before the build started.
    const stagingAfter = fs.readdirSync(HOOKS_DIR)
      .filter((n) => n.startsWith('.dist-staging-'));
    const orphaned = stagingAfter.filter((n) => !stagingBefore.includes(n));
    assert.deepEqual(orphaned, [],
      `build-hooks left orphaned staging directories: ${orphaned.join(', ')}`);
  });

  test('every file in hooks/dist/ that is JavaScript parses without SyntaxError', () => {
    // Positive proof of the build-hooks syntax guard: every shipped .js
    // file must parse. If a SyntaxError survives the guard and lands in
    // dist/, this assertion fails with the file named.
    const vm = require('node:vm');
    for (const [rel] of snapshotDir(DIST_DIR)) {
      if (!rel.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(DIST_DIR, rel), 'utf-8');
      assert.doesNotThrow(
        () => new vm.Script(src, { filename: rel }),
        `hooks/dist/${rel} has a SyntaxError — build-hooks syntax guard let it through`,
      );
    }
  });
});
