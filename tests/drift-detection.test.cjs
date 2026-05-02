// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * GSD Tools Tests — Codebase Drift Detection (#2003)
 *
 * Unit tests for bin/lib/drift.cjs plus CLI surface via verify codebase-drift.
 * Exercises the four drift categories (new dir, barrel, migration, route),
 * threshold gating, warn vs. auto-remap, last_mapped_commit round-trip,
 * config validation, mapper --paths passthrough, and graceful failure paths.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  createTempProject,
  createTempGitProject,
  cleanup,
  runGsdTools,
} = require('./helpers.cjs');

const DRIFT_PATH = path.join(
  __dirname,
  '..',
  'get-shit-done',
  'bin',
  'lib',
  'drift.cjs',
);
const CONFIG_SCHEMA_PATH = path.join(
  __dirname,
  '..',
  'get-shit-done',
  'bin',
  'lib',
  'config-schema.cjs',
);

const {
  detectDrift,
  classifyFile,
  readMappedCommit,
  writeMappedCommit,
  chooseAffectedPaths,
  sanitizePaths,
  DRIFT_CATEGORIES,
} = require(DRIFT_PATH);

// Small wrapper around execFileSync so tests don't sprinkle shell=true calls.
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

// ─── Unit: classifyFile ──────────────────────────────────────────────────────

describe('classifyFile', () => {
  test('classifies packages barrel export', () => {
    assert.strictEqual(classifyFile('packages/foo/src/index.ts'), 'barrel');
  });

  test('classifies apps barrel export', () => {
    assert.strictEqual(classifyFile('apps/web/src/index.tsx'), 'barrel');
  });

  test('classifies supabase migration', () => {
    assert.strictEqual(
      classifyFile('supabase/migrations/20240101_init.sql'),
      'migration',
    );
  });

  test('classifies prisma migration folder', () => {
    assert.strictEqual(
      classifyFile('prisma/migrations/20240101_init/migration.sql'),
      'migration',
    );
  });

  test('classifies drizzle meta migration', () => {
    assert.strictEqual(classifyFile('drizzle/meta/_journal.json'), 'migration');
  });

  test('classifies route module', () => {
    assert.strictEqual(
      classifyFile('apps/web/src/routes/journal.ts'),
      'route',
    );
    assert.strictEqual(
      classifyFile('src/api/users.ts'),
      'route',
    );
  });

  test('returns null for ordinary source file', () => {
    assert.strictEqual(classifyFile('src/lib/util.ts'), null);
  });
});

// ─── Unit: detectDrift categories ────────────────────────────────────────────

describe('detectDrift — categories', () => {
  const baseStructure = [
    '# Codebase Structure',
    '',
    '- `src/lib/` — helpers',
    '- `bin/` — CLIs',
    '',
  ].join('\n');

  test('identifies new directory outside mapped paths', () => {
    const result = detectDrift({
      addedFiles: ['newpkg/src/thing.ts'],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: baseStructure,
    });
    const newDirs = result.elements.filter((e) => e.category === 'new_dir');
    assert.ok(newDirs.length >= 1, 'should find at least one new directory');
    assert.ok(
      newDirs.some((e) => e.path.startsWith('newpkg')),
      'should flag newpkg as new',
    );
  });

  test('does not flag files in already-mapped paths', () => {
    const result = detectDrift({
      addedFiles: ['src/lib/newhelper.ts'],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: baseStructure,
    });
    const newDirs = result.elements.filter((e) => e.category === 'new_dir');
    assert.strictEqual(
      newDirs.length,
      0,
      'src/lib is mapped — no new_dir drift',
    );
  });

  test('identifies new barrel export', () => {
    const result = detectDrift({
      addedFiles: ['packages/widgets/src/index.ts'],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: baseStructure,
    });
    assert.ok(result.elements.some((e) => e.category === 'barrel'));
  });

  test('identifies new migration', () => {
    const result = detectDrift({
      addedFiles: ['supabase/migrations/20240501_add_accounts.sql'],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: baseStructure,
    });
    assert.ok(result.elements.some((e) => e.category === 'migration'));
  });

  test('identifies new route module', () => {
    const result = detectDrift({
      addedFiles: ['apps/accounting/src/routes/journal.ts'],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: baseStructure,
    });
    assert.ok(result.elements.some((e) => e.category === 'route'));
  });

  test('prioritizes higher-specificity category per file', () => {
    const result = detectDrift({
      addedFiles: ['supabase/migrations/20240101_init.sql'],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: baseStructure,
    });
    const perFile = result.elements.filter(
      (e) => e.path === 'supabase/migrations/20240101_init.sql',
    );
    assert.strictEqual(perFile.length, 1, 'file counted once');
    assert.strictEqual(perFile[0].category, 'migration');
  });
});

// ─── Unit: threshold gating ──────────────────────────────────────────────────

describe('detectDrift — threshold gating', () => {
  test('2 elements under default threshold → no action', () => {
    const result = detectDrift({
      addedFiles: [
        'packages/a/src/index.ts',
        'packages/b/src/index.ts',
      ],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: '# only src/ mapped',
      threshold: 3,
    });
    assert.strictEqual(result.elements.length >= 2, true);
    assert.strictEqual(result.actionRequired, false);
  });

  test('3 elements at threshold → action required', () => {
    const result = detectDrift({
      addedFiles: [
        'packages/a/src/index.ts',
        'packages/b/src/index.ts',
        'packages/c/src/index.ts',
      ],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: '# only src/ mapped',
      threshold: 3,
    });
    assert.strictEqual(result.actionRequired, true);
  });

  test('4 elements exceeds threshold → action required', () => {
    const result = detectDrift({
      addedFiles: [
        'packages/a/src/index.ts',
        'packages/b/src/index.ts',
        'packages/c/src/index.ts',
        'supabase/migrations/1.sql',
      ],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: '# only src/ mapped',
      threshold: 3,
    });
    assert.strictEqual(result.actionRequired, true);
  });

  test('respects custom threshold value', () => {
    const result = detectDrift({
      addedFiles: ['packages/a/src/index.ts', 'packages/b/src/index.ts'],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: '# only src/ mapped',
      threshold: 2,
    });
    assert.strictEqual(result.actionRequired, true);
  });
});

// ─── Unit: action routing ────────────────────────────────────────────────────

describe('detectDrift — action routing', () => {
  const over = {
    addedFiles: [
      'packages/a/src/index.ts',
      'packages/b/src/index.ts',
      'packages/c/src/index.ts',
    ],
    modifiedFiles: [],
    deletedFiles: [],
    structureMd: '# only src/ mapped',
    threshold: 3,
  };

  test('warn action yields warn directive and no mapper spawn request', () => {
    const result = detectDrift({ ...over, action: 'warn' });
    assert.strictEqual(result.directive, 'warn');
    assert.strictEqual(result.spawnMapper, false);
    assert.ok(result.message.includes('drift'), 'message mentions drift');
  });

  test('auto-remap action yields spawn directive with affected paths', () => {
    const result = detectDrift({ ...over, action: 'auto-remap' });
    assert.strictEqual(result.directive, 'auto-remap');
    assert.strictEqual(result.spawnMapper, true);
    assert.ok(Array.isArray(result.affectedPaths));
    assert.ok(result.affectedPaths.length > 0);
    for (const p of result.affectedPaths) {
      assert.ok(!p.startsWith('/'), 'no absolute paths');
      assert.ok(!p.includes('..'), 'no traversal');
    }
  });

  test('below-threshold inputs produce no directive', () => {
    const result = detectDrift({
      addedFiles: ['packages/a/src/index.ts'],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: '# only src/ mapped',
      threshold: 3,
      action: 'auto-remap',
    });
    assert.strictEqual(result.actionRequired, false);
    assert.strictEqual(result.spawnMapper, false);
    assert.strictEqual(result.directive, 'none');
  });
});

// ─── Unit: affected-paths scoping ────────────────────────────────────────────

describe('chooseAffectedPaths', () => {
  test('collapses files into top-level prefixes', () => {
    const paths = chooseAffectedPaths([
      'apps/accounting/src/routes/a.ts',
      'apps/accounting/src/routes/b.ts',
      'packages/ui/src/index.ts',
    ]);
    assert.ok(paths.includes('apps/accounting'));
    assert.ok(paths.includes('packages/ui'));
  });

  test('deduplicates and sorts', () => {
    const paths = chooseAffectedPaths([
      'zzz/a.ts',
      'aaa/b.ts',
      'zzz/c.ts',
    ]);
    assert.deepStrictEqual(paths, ['aaa', 'zzz']);
  });

  test('returns [] for empty input', () => {
    assert.deepStrictEqual(chooseAffectedPaths([]), []);
  });
});

// ─── Unit: sanitizePaths ─────────────────────────────────────────────────────

describe('sanitizePaths', () => {
  test('rejects traversal', () => {
    assert.deepStrictEqual(sanitizePaths(['../evil']), []);
    assert.deepStrictEqual(sanitizePaths(['foo/../evil']), []);
  });

  test('rejects absolute paths', () => {
    assert.deepStrictEqual(sanitizePaths(['/etc/passwd']), []);
  });

  test('rejects shell metacharacters', () => {
    assert.deepStrictEqual(sanitizePaths(['foo;rm -rf /']), []);
    assert.deepStrictEqual(sanitizePaths(['foo`id`']), []);
    assert.deepStrictEqual(sanitizePaths(['foo$(id)']), []);
  });

  test('accepts normal repo-relative paths', () => {
    assert.deepStrictEqual(
      sanitizePaths(['apps/web', 'packages/ui']),
      ['apps/web', 'packages/ui'],
    );
  });
});

// ─── Unit: last_mapped_commit frontmatter round-trip ─────────────────────────

describe('last_mapped_commit frontmatter', () => {
  let tmp;
  beforeEach(() => {
    tmp = createTempProject('gsd-drift-');
    fs.mkdirSync(path.join(tmp, '.planning', 'codebase'), { recursive: true });
  });
  afterEach(() => cleanup(tmp));

  test('writeMappedCommit creates frontmatter on fresh file', () => {
    const file = path.join(tmp, '.planning', 'codebase', 'STRUCTURE.md');
    fs.writeFileSync(file, '# Codebase Structure\n\nBody\n');
    writeMappedCommit(file, 'deadbeef00000000000000000000000000000000', '2026-04-22');
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.startsWith('---\n'));
    assert.ok(content.includes('last_mapped_commit: deadbeef00000000000000000000000000000000'));
    assert.ok(content.includes('# Codebase Structure'));
  });

  test('writeMappedCommit updates existing frontmatter', () => {
    const file = path.join(tmp, '.planning', 'codebase', 'STRUCTURE.md');
    fs.writeFileSync(
      file,
      '---\nlast_mapped_commit: aaaa\nother: keep-me\n---\n# body\n',
    );
    writeMappedCommit(file, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '2026-04-22');
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.includes('last_mapped_commit: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'));
    assert.ok(content.includes('other: keep-me'), 'preserves other keys');
    assert.ok(content.includes('# body'));
  });

  test('readMappedCommit round-trips via write', () => {
    const file = path.join(tmp, '.planning', 'codebase', 'STRUCTURE.md');
    fs.writeFileSync(file, '# body\n');
    writeMappedCommit(file, 'cafebabe00000000000000000000000000000000', '2026-04-22');
    assert.strictEqual(
      readMappedCommit(file),
      'cafebabe00000000000000000000000000000000',
    );
  });

  test('readMappedCommit returns null when file missing', () => {
    assert.strictEqual(readMappedCommit('/nonexistent/path.md'), null);
  });

  test('readMappedCommit returns null when frontmatter absent', () => {
    const file = path.join(tmp, '.planning', 'codebase', 'STRUCTURE.md');
    fs.writeFileSync(file, '# No frontmatter\n');
    assert.strictEqual(readMappedCommit(file), null);
  });

  test('writeMappedCommit creates the file when it does not exist (symmetry with readMappedCommit)', () => {
    const file = path.join(tmp, '.planning', 'codebase', 'NEW-DOC.md');
    assert.strictEqual(fs.existsSync(file), false, 'precondition: file absent');
    // Must not throw — readMappedCommit returns null for missing files,
    // writeMappedCommit must defensively create them.
    writeMappedCommit(file, 'feedface00000000000000000000000000000000', '2026-04-22');
    assert.strictEqual(fs.existsSync(file), true, 'file created');
    assert.strictEqual(
      readMappedCommit(file),
      'feedface00000000000000000000000000000000',
    );
  });
});

// ─── Unit: negative / defensive ──────────────────────────────────────────────

describe('detectDrift — defensive paths', () => {
  test('missing structureMd → skipped result, no throw', () => {
    const result = detectDrift({
      addedFiles: ['foo/bar.ts'],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: null,
    });
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.actionRequired, false);
    assert.ok(result.reason);
  });

  test('empty inputs → no drift', () => {
    const result = detectDrift({
      addedFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
      structureMd: '# structure',
    });
    assert.strictEqual(result.elements.length, 0);
    assert.strictEqual(result.actionRequired, false);
  });

  test('categories constant is exposed and stable', () => {
    assert.ok(Array.isArray(DRIFT_CATEGORIES));
    assert.deepStrictEqual(
      [...DRIFT_CATEGORIES].sort(),
      ['barrel', 'migration', 'new_dir', 'route'],
    );
  });
});

// ─── Unit: non-blocking guarantee ────────────────────────────────────────────

describe('detectDrift — non-blocking guarantee', () => {
  test('never throws on malformed input', () => {
    assert.doesNotThrow(() => detectDrift({}));
    assert.doesNotThrow(() => detectDrift({ addedFiles: null }));
    assert.doesNotThrow(() => detectDrift({ addedFiles: ['x'], structureMd: undefined }));
  });

  test('malformed input returns a skipped result (never crashes the phase)', () => {
    const r = detectDrift({});
    assert.strictEqual(r.skipped, true);
    assert.strictEqual(r.actionRequired, false);
  });
});

// ─── Config validation: new keys present and restricted ──────────────────────

describe('config-schema — drift keys', () => {
  test('workflow.drift_threshold in VALID_CONFIG_KEYS', () => {
    const { VALID_CONFIG_KEYS } = require(CONFIG_SCHEMA_PATH);
    assert.ok(VALID_CONFIG_KEYS.has('workflow.drift_threshold'));
  });

  test('workflow.drift_action in VALID_CONFIG_KEYS', () => {
    const { VALID_CONFIG_KEYS } = require(CONFIG_SCHEMA_PATH);
    assert.ok(VALID_CONFIG_KEYS.has('workflow.drift_action'));
  });
});

describe('config-set drift validation via CLI', () => {
  let tmp;
  beforeEach(() => {
    tmp = createTempGitProject('gsd-drift-cfg-');
  });
  afterEach(() => cleanup(tmp));

  test('accepts warn', () => {
    const r = runGsdTools(['config-set', 'workflow.drift_action', 'warn'], tmp);
    assert.strictEqual(r.success, true, r.error);
  });

  test('accepts auto-remap', () => {
    const r = runGsdTools(['config-set', 'workflow.drift_action', 'auto-remap'], tmp);
    assert.strictEqual(r.success, true, r.error);
  });

  test('rejects bogus drift_action value', () => {
    const r = runGsdTools(['config-set', 'workflow.drift_action', 'sometimes'], tmp);
    assert.strictEqual(r.success, false);
  });

  test('drift_threshold accepts integer', () => {
    const r = runGsdTools(['config-set', 'workflow.drift_threshold', '5'], tmp);
    assert.strictEqual(r.success, true, r.error);
  });

  test('drift_threshold rejects non-numeric', () => {
    const r = runGsdTools(['config-set', 'workflow.drift_threshold', 'many'], tmp);
    assert.strictEqual(r.success, false);
  });
});

// ─── Docs parity for CONFIGURATION.md ────────────────────────────────────────

describe('docs parity', () => {
  test('workflow.drift_threshold mentioned in docs/CONFIGURATION.md', () => {
    const md = fs.readFileSync(
      path.join(__dirname, '..', 'docs', 'CONFIGURATION.md'),
      'utf8',
    );
    assert.ok(md.includes('`workflow.drift_threshold`'));
  });

  test('workflow.drift_action mentioned in docs/CONFIGURATION.md', () => {
    const md = fs.readFileSync(
      path.join(__dirname, '..', 'docs', 'CONFIGURATION.md'),
      'utf8',
    );
    assert.ok(md.includes('`workflow.drift_action`'));
  });
});

// ─── Mapper --paths flag documented ──────────────────────────────────────────

describe('gsd-codebase-mapper --paths flag', () => {
  test('agent doc mentions --paths', () => {
    const doc = fs.readFileSync(
      path.join(__dirname, '..', 'agents', 'gsd-codebase-mapper.md'),
      'utf8',
    );
    assert.ok(/--paths/.test(doc));
  });

  test('AGENTS.md mentions --paths for mapper', () => {
    const doc = fs.readFileSync(
      path.join(__dirname, '..', 'docs', 'AGENTS.md'),
      'utf8',
    );
    assert.ok(/--paths/.test(doc));
  });

  test('map-codebase workflow documents --paths passthrough', () => {
    const doc = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        'get-shit-done',
        'workflows',
        'map-codebase.md',
      ),
      'utf8',
    );
    assert.ok(/--paths/.test(doc));
  });
});

// ─── Execute-phase workflow integration ──────────────────────────────────────

describe('execute-phase integrates codebase_drift_gate', () => {
  test('workflow references a codebase drift step', () => {
    const doc = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        'get-shit-done',
        'workflows',
        'execute-phase.md',
      ),
      'utf8',
    );
    assert.ok(/codebase_drift_gate|codebase-drift/.test(doc));
  });

  test('workflow documents non-blocking guarantee for drift', () => {
    const doc = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        'get-shit-done',
        'workflows',
        'execute-phase.md',
      ),
      'utf8',
    );
    assert.ok(/non[- ]blocking/i.test(doc) || /continue on (error|failure)/i.test(doc));
  });
});

// ─── CLI: verify codebase-drift subcommand ───────────────────────────────────

describe('verify codebase-drift CLI', () => {
  let tmp;
  beforeEach(() => {
    tmp = createTempGitProject('gsd-drift-cli-');
    fs.mkdirSync(path.join(tmp, '.planning', 'codebase'), { recursive: true });
  });
  afterEach(() => cleanup(tmp));

  test('returns skipped JSON when STRUCTURE.md missing', () => {
    const r = runGsdTools(['verify', 'codebase-drift'], tmp);
    assert.strictEqual(r.success, true, r.error);
    const data = JSON.parse(r.output);
    assert.strictEqual(data.skipped, true);
    assert.strictEqual(data.action_required, false);
  });

  test('returns no-drift result when STRUCTURE.md is fresh', () => {
    const structure = path.join(tmp, '.planning', 'codebase', 'STRUCTURE.md');
    fs.writeFileSync(structure, '# Codebase Structure\n\n- `src/`\n');
    const head = git(tmp, 'rev-parse', 'HEAD');
    writeMappedCommit(structure, head, '2026-04-22');
    const r = runGsdTools(['verify', 'codebase-drift'], tmp);
    assert.strictEqual(r.success, true, r.error);
    const data = JSON.parse(r.output);
    assert.strictEqual(data.action_required, false);
  });

  test('detects drift when new files added after last_mapped_commit', () => {
    const structure = path.join(tmp, '.planning', 'codebase', 'STRUCTURE.md');
    fs.writeFileSync(structure, '# Codebase Structure\n\n- `src/`\n');
    const head = git(tmp, 'rev-parse', 'HEAD');
    writeMappedCommit(structure, head, '2026-04-22');
    git(tmp, 'add', '-A');
    git(tmp, 'commit', '-m', 'map codebase');
    for (const pkg of ['alpha', 'beta', 'gamma']) {
      const dir = path.join(tmp, 'packages', pkg, 'src');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.ts'), 'export {};\n');
    }
    git(tmp, 'add', '-A');
    git(tmp, 'commit', '-m', 'add packages');
    const r = runGsdTools(['verify', 'codebase-drift'], tmp);
    assert.strictEqual(r.success, true, r.error);
    const data = JSON.parse(r.output);
    assert.strictEqual(data.action_required, true);
    assert.strictEqual(data.directive, 'warn');
    assert.ok(data.elements.length >= 3);
  });

  test('never exits non-zero when git repo is missing (non-blocking)', () => {
    const nonGit = createTempProject('gsd-drift-nongit-');
    try {
      const r = runGsdTools(['verify', 'codebase-drift'], nonGit);
      assert.strictEqual(r.success, true, 'must exit 0 even without git');
      const data = JSON.parse(r.output);
      assert.strictEqual(data.skipped, true);
    } finally {
      cleanup(nonGit);
    }
  });
});
