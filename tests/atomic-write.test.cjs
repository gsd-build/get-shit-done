/**
 * Tests for atomicWriteFileSync helper (issue #1915)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempDir, cleanup } = require('./helpers.cjs');

const CORE_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'core.cjs');

describe('atomicWriteFileSync', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('is exported from core.cjs', () => {
    const core = require(CORE_PATH);
    assert.strictEqual(typeof core.atomicWriteFileSync, 'function', 'atomicWriteFileSync must be exported');
  });

  test('writes correct content to the target file', () => {
    const { atomicWriteFileSync } = require(CORE_PATH);
    const filePath = path.join(tmpDir, 'test.md');
    const content = '# Hello\nworld\n';

    atomicWriteFileSync(filePath, content, 'utf-8');

    const written = fs.readFileSync(filePath, 'utf-8');
    assert.strictEqual(written, content, 'written content must match');
  });

  test('does not leave .tmp.* files after successful write', () => {
    const { atomicWriteFileSync } = require(CORE_PATH);
    const filePath = path.join(tmpDir, 'STATE.md');

    atomicWriteFileSync(filePath, '# State\n', 'utf-8');

    const entries = fs.readdirSync(tmpDir);
    const tmpFiles = entries.filter(e => e.includes('.tmp.'));
    assert.deepStrictEqual(tmpFiles, [], 'no .tmp.* files should remain after write');
  });

  test('overwrites an existing file with new content', () => {
    const { atomicWriteFileSync } = require(CORE_PATH);
    const filePath = path.join(tmpDir, 'config.json');

    atomicWriteFileSync(filePath, '{"first":true}', 'utf-8');
    atomicWriteFileSync(filePath, '{"second":true}', 'utf-8');

    const written = fs.readFileSync(filePath, 'utf-8');
    assert.strictEqual(written, '{"second":true}', 'second write must replace first');
  });

  test('cleans up stale tmp file if present before write', () => {
    const { atomicWriteFileSync } = require(CORE_PATH);
    const filePath = path.join(tmpDir, 'ROADMAP.md');
    // Place a stale tmp file matching the pattern used by atomicWriteFileSync
    const staleTmp = filePath + '.tmp.' + process.pid;
    fs.writeFileSync(staleTmp, 'stale content', 'utf-8');

    atomicWriteFileSync(filePath, '# Roadmap\n', 'utf-8');

    const entries = fs.readdirSync(tmpDir);
    const tmpFiles = entries.filter(e => e.includes('.tmp.'));
    assert.deepStrictEqual(tmpFiles, [], 'stale .tmp.* file must be gone after write');

    const written = fs.readFileSync(filePath, 'utf-8');
    assert.strictEqual(written, '# Roadmap\n', 'target file must have correct content');
  });
});
