'use strict';

const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runStateMutationTransaction } = require('../get-shit-done/bin/lib/state-transaction.cjs');

let tmpDir;

function makeTempDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-state-transaction-'));
  return tmpDir;
}

function stripFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, '');
}

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fm = {};
  let currentObject = fm;
  for (const line of match[1].split(/\r?\n/)) {
    const nested = line.match(/^  ([a-z_]+):\s*(.+)$/);
    if (nested) {
      currentObject[nested[1]] = Number.isNaN(Number(nested[2])) ? nested[2] : Number(nested[2]);
      continue;
    }
    const root = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!root) continue;
    if (root[2] === '') {
      currentObject = {};
      fm[root[1]] = currentObject;
    } else {
      fm[root[1]] = root[2];
      currentObject = fm;
    }
  }
  return fm;
}

function reconstructFrontmatter(fm) {
  const lines = [];
  for (const [key, value] of Object.entries(fm)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        lines.push(`  ${nestedKey}: ${nestedValue}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join('\n');
}

describe('STATE.md Mutation Transaction Module', () => {
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  test('runs read-modify-write under a lock and releases it', () => {
    const dir = makeTempDir();
    const statePath = path.join(dir, 'STATE.md');
    const lockPath = `${statePath}.lock`;
    fs.writeFileSync(statePath, '# State\n\nStatus: Planning\n', 'utf-8');

    const written = runStateMutationTransaction({
      statePath,
      cwd: dir,
      transform: (content) => content.replace('Status: Planning', 'Status: Complete'),
      acquireStateLock: (p) => {
        fs.writeFileSync(`${p}.lock`, String(process.pid), 'utf-8');
        return `${p}.lock`;
      },
      releaseStateLock: (p) => fs.rmSync(p, { force: true }),
      buildStateFrontmatter: () => ({ status: 'completed' }),
      normalizeMd: (content) => content,
      atomicWriteFileSync: fs.writeFileSync,
      extractFrontmatter,
      stripFrontmatter,
      reconstructFrontmatter,
      fs,
      mutationSurface: 'full',
    });

    assert.equal(fs.existsSync(lockPath), false);
    assert.match(written, /status: completed/);
    assert.match(fs.readFileSync(statePath, 'utf-8'), /Status: Complete/);
  });

  test('preserves existing progress frontmatter when resync is disabled', () => {
    const dir = makeTempDir();
    const statePath = path.join(dir, 'STATE.md');
    fs.writeFileSync(
      statePath,
      [
        '---',
        'status: executing',
        'progress:',
        '  total_plans: 12',
        '  completed_plans: 6',
        '---',
        '',
        '# State',
        '',
        'Status: Executing',
        '',
      ].join('\n'),
      'utf-8',
    );

    runStateMutationTransaction({
      statePath,
      cwd: dir,
      transform: (body) => body.replace('Status: Executing', 'Status: Ready'),
      acquireStateLock: (p) => `${p}.lock`,
      releaseStateLock: () => {},
      buildStateFrontmatter: () => ({
        status: 'ready',
        progress: {
          total_plans: 1,
          completed_plans: 1,
        },
      }),
      normalizeMd: (content) => content,
      atomicWriteFileSync: fs.writeFileSync,
      extractFrontmatter,
      stripFrontmatter,
      reconstructFrontmatter,
      fs,
      resync: false,
      mutationSurface: 'body',
    });

    const after = fs.readFileSync(statePath, 'utf-8');
    assert.match(after, /total_plans: 12/);
    assert.match(after, /completed_plans: 6/);
    assert.match(after, /Status: Ready/);
  });

  test('preserves existing frontmatter status when projected status is unknown', () => {
    const dir = makeTempDir();
    const statePath = path.join(dir, 'STATE.md');
    fs.writeFileSync(
      statePath,
      [
        '---',
        'status: executing',
        '---',
        '',
        '# State',
        '',
        'Current Phase: 02',
        '',
      ].join('\n'),
      'utf-8',
    );

    runStateMutationTransaction({
      statePath,
      cwd: dir,
      transform: (content) => content.replace('Current Phase: 02', 'Current Phase: 03'),
      acquireStateLock: (p) => `${p}.lock`,
      releaseStateLock: () => {},
      buildStateFrontmatter: () => ({ status: 'unknown', current_phase: '03' }),
      normalizeMd: (content) => content,
      atomicWriteFileSync: fs.writeFileSync,
      extractFrontmatter,
      stripFrontmatter,
      reconstructFrontmatter,
      fs,
      mutationSurface: 'full',
    });

    const after = fs.readFileSync(statePath, 'utf-8');
    assert.match(after, /status: executing/);
    assert.match(after, /current_phase: 03/);
  });

  test('dry run returns projected content without writing but still releases lock', () => {
    const dir = makeTempDir();
    const statePath = path.join(dir, 'STATE.md');
    fs.writeFileSync(statePath, '# State\n\nStatus: Planning\n', 'utf-8');
    const lockPath = `${statePath}.lock`;

    const projected = runStateMutationTransaction({
      statePath,
      cwd: dir,
      transform: (content) => content.replace('Status: Planning', 'Status: Complete'),
      acquireStateLock: (p) => {
        fs.writeFileSync(`${p}.lock`, String(process.pid), 'utf-8');
        return `${p}.lock`;
      },
      releaseStateLock: (p) => fs.rmSync(p, { force: true }),
      buildStateFrontmatter: () => ({ status: 'completed' }),
      normalizeMd: (content) => content,
      atomicWriteFileSync: fs.writeFileSync,
      extractFrontmatter,
      stripFrontmatter,
      reconstructFrontmatter,
      fs,
      dryRun: true,
      mutationSurface: 'full',
    });

    assert.equal(fs.existsSync(lockPath), false);
    assert.match(projected, /Status: Complete/);
    assert.doesNotMatch(fs.readFileSync(statePath, 'utf-8'), /Status: Complete/);
  });

  test('releases lock when mutation throws', () => {
    const dir = makeTempDir();
    const statePath = path.join(dir, 'STATE.md');
    fs.writeFileSync(statePath, '# State\n\nStatus: Planning\n', 'utf-8');
    const lockPath = `${statePath}.lock`;

    assert.throws(() => {
      runStateMutationTransaction({
        statePath,
        cwd: dir,
        transform: () => {
          throw new Error('boom');
        },
        acquireStateLock: (p) => {
          fs.writeFileSync(`${p}.lock`, String(process.pid), 'utf-8');
          return `${p}.lock`;
        },
        releaseStateLock: (p) => fs.rmSync(p, { force: true }),
        buildStateFrontmatter: () => ({ status: 'completed' }),
        normalizeMd: (content) => content,
        atomicWriteFileSync: fs.writeFileSync,
        extractFrontmatter,
        stripFrontmatter,
        reconstructFrontmatter,
        fs,
        mutationSurface: 'full',
      });
    }, /boom/);

    assert.equal(fs.existsSync(lockPath), false);
  });
});
