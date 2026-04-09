/**
 * GSD Tools Tests - Schema Drift Detection
 *
 * Tests for schema-relevant file detection (plan-phase injection)
 * and post-execution schema drift gate (execute-phase verification).
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, createTempGitProject, cleanup, runGsdTools } = require('./helpers.cjs');

// ─── Unit: detectSchemaFiles ─────────────────────────────────────────────────

const { detectSchemaFiles, detectSchemaOrm, checkSchemaDrift } = require(
  path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'schema-detect.cjs')
);

describe('detectSchemaFiles', () => {
  test('detects Payload CMS collection files', () => {
    const files = ['src/collections/Posts.ts', 'src/collections/Users.ts', 'src/lib/utils.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected, 'should detect schema files');
    assert.deepStrictEqual(result.matches, [
      'src/collections/Posts.ts',
      'src/collections/Users.ts',
    ]);
    assert.ok(result.orms.includes('payload'), 'should identify Payload CMS');
  });

  test('detects Payload CMS globals files', () => {
    const files = ['src/globals/Settings.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.ok(result.orms.includes('payload'));
  });

  test('detects Prisma schema file', () => {
    const files = ['prisma/schema.prisma', 'src/index.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.deepStrictEqual(result.matches, ['prisma/schema.prisma']);
    assert.ok(result.orms.includes('prisma'));
  });

  test('detects Prisma multi-file schema', () => {
    const files = ['prisma/schema/user.prisma', 'prisma/schema/post.prisma'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.strictEqual(result.matches.length, 2);
    assert.ok(result.orms.includes('prisma'));
  });

  test('detects Drizzle schema files', () => {
    const files = ['drizzle/schema.ts', 'src/routes/api.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.ok(result.orms.includes('drizzle'));
  });

  test('detects Drizzle schema in src/db/', () => {
    const files = ['src/db/schema.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.ok(result.orms.includes('drizzle'));
  });

  test('detects Drizzle multi-file schemas', () => {
    const files = ['drizzle/users.ts', 'drizzle/posts.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.ok(result.orms.includes('drizzle'));
  });

  test('detects Supabase migration files', () => {
    const files = ['supabase/migrations/20240101_add_users.sql'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.ok(result.orms.includes('supabase'));
  });

  test('detects TypeORM entity files', () => {
    const files = ['src/entities/User.ts', 'src/entities/Post.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.ok(result.orms.includes('typeorm'));
  });

  test('detects TypeORM migration files', () => {
    const files = ['src/migrations/1234567890-CreateUsers.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.ok(result.orms.includes('typeorm'));
  });

  test('returns not detected for non-schema files', () => {
    const files = ['src/index.ts', 'src/utils/helpers.ts', 'package.json', 'README.md'];
    const result = detectSchemaFiles(files);
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.matches.length, 0);
    assert.strictEqual(result.orms.length, 0);
  });

  test('returns empty for empty file list', () => {
    const result = detectSchemaFiles([]);
    assert.strictEqual(result.detected, false);
    assert.strictEqual(result.matches.length, 0);
  });

  test('detects multiple ORMs in same file list', () => {
    const files = ['prisma/schema.prisma', 'src/collections/Posts.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected);
    assert.ok(result.orms.includes('prisma'));
    assert.ok(result.orms.includes('payload'));
  });

  test('handles Windows-style paths', () => {
    const files = ['src\\collections\\Posts.ts', 'src\\globals\\Settings.ts'];
    const result = detectSchemaFiles(files);
    assert.ok(result.detected, 'should detect schema files with backslash paths');
  });
});

// ─── Unit: detectSchemaOrm ───────────────────────────────────────────────────

describe('detectSchemaOrm', () => {
  test('returns push command for Payload CMS', () => {
    const info = detectSchemaOrm('payload');
    assert.ok(info.pushCommand);
    assert.ok(info.pushCommand.includes('payload'));
    assert.ok(info.envHint, 'should include env hint for non-TTY');
  });

  test('returns push command for Prisma', () => {
    const info = detectSchemaOrm('prisma');
    assert.ok(info.pushCommand.includes('prisma'));
  });

  test('returns push command for Drizzle', () => {
    const info = detectSchemaOrm('drizzle');
    assert.ok(info.pushCommand.includes('drizzle'));
  });

  test('returns push command for Supabase', () => {
    const info = detectSchemaOrm('supabase');
    assert.ok(info.pushCommand.includes('supabase'));
  });

  test('returns push command for TypeORM', () => {
    const info = detectSchemaOrm('typeorm');
    assert.ok(info.pushCommand.includes('typeorm'));
  });

  test('returns null for unknown ORM', () => {
    const info = detectSchemaOrm('unknown-orm');
    assert.strictEqual(info, null);
  });
});

// ─── Unit: checkSchemaDrift ──────────────────────────────────────────────────

describe('checkSchemaDrift', () => {
  test('returns no drift when no schema files changed', () => {
    const changedFiles = ['src/index.ts', 'package.json'];
    const executionLog = '';
    const result = checkSchemaDrift(changedFiles, executionLog);
    assert.strictEqual(result.driftDetected, false);
    assert.strictEqual(result.blocking, false);
  });

  test('detects drift when schema files changed but no push executed', () => {
    const changedFiles = ['src/collections/Posts.ts', 'src/index.ts'];
    const executionLog = 'npm run build\nnpm run test';
    const result = checkSchemaDrift(changedFiles, executionLog);
    assert.strictEqual(result.driftDetected, true);
    assert.strictEqual(result.blocking, true);
    assert.ok(result.schemaFiles.length > 0);
    assert.ok(result.orms.includes('payload'));
    assert.ok(result.message.length > 0);
  });

  test('no drift when schema files changed AND push was executed (payload)', () => {
    const changedFiles = ['src/collections/Posts.ts'];
    const executionLog = 'npx payload migrate\nnpm run build';
    const result = checkSchemaDrift(changedFiles, executionLog);
    assert.strictEqual(result.driftDetected, false);
    assert.strictEqual(result.blocking, false);
  });

  test('no drift when schema files changed AND push was executed (prisma)', () => {
    const changedFiles = ['prisma/schema.prisma'];
    const executionLog = 'npx prisma db push\nnpm run build';
    const result = checkSchemaDrift(changedFiles, executionLog);
    assert.strictEqual(result.driftDetected, false);
    assert.strictEqual(result.blocking, false);
  });

  test('no drift when schema files changed AND push was executed (drizzle)', () => {
    const changedFiles = ['drizzle/schema.ts'];
    const executionLog = 'npx drizzle-kit push\nnpm run test';
    const result = checkSchemaDrift(changedFiles, executionLog);
    assert.strictEqual(result.driftDetected, false);
    assert.strictEqual(result.blocking, false);
  });

  test('no drift when schema files changed AND push was executed (supabase)', () => {
    const changedFiles = ['supabase/migrations/001_init.sql'];
    const executionLog = 'supabase db push\nnpm run test';
    const result = checkSchemaDrift(changedFiles, executionLog);
    assert.strictEqual(result.driftDetected, false);
    assert.strictEqual(result.blocking, false);
  });

  test('no drift when schema files changed AND push was executed (typeorm)', () => {
    const changedFiles = ['src/entities/User.ts'];
    const executionLog = 'npx typeorm migration:run\nnpm run test';
    const result = checkSchemaDrift(changedFiles, executionLog);
    assert.strictEqual(result.driftDetected, false);
    assert.strictEqual(result.blocking, false);
  });

  test('respects GSD_SKIP_SCHEMA_CHECK override', () => {
    const changedFiles = ['src/collections/Posts.ts'];
    const executionLog = 'npm run build';
    const result = checkSchemaDrift(changedFiles, executionLog, { skipCheck: true });
    assert.strictEqual(result.driftDetected, true);
    assert.strictEqual(result.blocking, false, 'should not block when skip override is set');
    assert.ok(result.skipped, 'should indicate the check was skipped');
  });

  test('detects drift with multiple ORMs and partial push', () => {
    const changedFiles = ['prisma/schema.prisma', 'src/collections/Posts.ts'];
    const executionLog = 'npx prisma db push';
    const result = checkSchemaDrift(changedFiles, executionLog);
    // Prisma was pushed but Payload was not
    assert.strictEqual(result.driftDetected, true);
    assert.strictEqual(result.blocking, true);
    assert.ok(result.unpushedOrms.includes('payload'));
    assert.ok(!result.unpushedOrms.includes('prisma'));
  });

  test('includes actionable message with push commands', () => {
    const changedFiles = ['prisma/schema.prisma'];
    const executionLog = '';
    const result = checkSchemaDrift(changedFiles, executionLog);
    assert.ok(result.message.includes('prisma'));
  });
});

// ─── CLI: verify schema-drift ────────────────────────────────────────────────

describe('verify schema-drift CLI command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-schema-drift-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('passes when no schema files in phase diff', () => {
    // Create a phase dir with a plan that modifies non-schema files
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), [
      '---',
      'files_modified: [src/index.ts, src/utils.ts]',
      '---',
      '',
      'Plan content',
    ].join('\n'));

    const result = runGsdTools(['verify', 'schema-drift', '01-setup'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.drift_detected, false);
    assert.strictEqual(output.blocking, false);
  });

  test('detects drift when schema files in plan but no push evidence', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), [
      '---',
      'files_modified: [src/collections/Posts.ts, src/index.ts]',
      '---',
      '',
      'Plan content',
    ].join('\n'));
    // No SUMMARY.md with push evidence
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), [
      '# Summary',
      '',
      '## Accomplishments',
      '- Added Post collection',
      '',
      '## Commands Run',
      '- npm run build',
      '- npm run test',
    ].join('\n'));

    const result = runGsdTools(['verify', 'schema-drift', '01-setup'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.drift_detected, true);
    assert.strictEqual(output.blocking, true);
  });

  test('passes when schema files in plan AND push evidence in summary', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), [
      '---',
      'files_modified: [src/collections/Posts.ts]',
      '---',
      '',
      'Plan content',
    ].join('\n'));
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), [
      '# Summary',
      '',
      '## Accomplishments',
      '- Added Post collection',
      '',
      '## Commands Run',
      '- npx payload migrate',
      '- npm run build',
    ].join('\n'));

    const result = runGsdTools(['verify', 'schema-drift', '01-setup'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.drift_detected, false);
    assert.strictEqual(output.blocking, false);
  });

  test('respects skip flag', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), [
      '---',
      'files_modified: [src/collections/Posts.ts]',
      '---',
      '',
      'Plan content',
    ].join('\n'));
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');

    const result = runGsdTools(['verify', 'schema-drift', '01-setup', '--skip'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.blocking, false);
  });
});
