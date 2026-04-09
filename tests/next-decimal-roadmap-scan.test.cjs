/**
 * GSD Tools Tests — phase next-decimal ROADMAP.md scanning
 *
 * Covers issue #1865: next-decimal only scanned directory names in
 * .planning/phases/ to determine the next available decimal number.
 * It did not check ROADMAP.md entries.  When agents add backlog items
 * by writing ROADMAP.md + creating dirs without calling next-decimal,
 * collisions occur.
 *
 * After the fix, next-decimal unions directory names AND ROADMAP.md
 * phase headers before computing the next available number.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('phase next-decimal ROADMAP.md scanning (#1865)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('directory-only scan still works (existing behavior)', () => {
    // Create directory-based decimal phases
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '999-backlog'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '999.1-idea-one'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '999.2-idea-two'), { recursive: true });

    const result = runGsdTools('phase next-decimal 999', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '999.3');
    assert.deepStrictEqual(output.existing, ['999.1', '999.2']);
  });

  test('detects ROADMAP.md entries that have no directory', () => {
    // Only ROADMAP.md has 999.1 and 999.2 — no directories exist
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '',
        '## v1.0',
        '',
        '### Phase 999: Backlog',
        '**Goal:** Parking lot',
        '',
        '### Phase 999.1: First idea',
        '**Goal:** Something',
        '',
        '### Phase 999.2: Second idea',
        '**Goal:** Something else',
      ].join('\n')
    );

    const result = runGsdTools('phase next-decimal 999', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '999.3', 'should skip past ROADMAP.md entries');
    assert.deepStrictEqual(output.existing, ['999.1', '999.2']);
  });

  test('unions directories and ROADMAP.md entries (no duplicates)', () => {
    // Directory has 999.1, ROADMAP.md has 999.1 and 999.3
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '999.1-idea-one'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '',
        '### Phase 999.1: First idea',
        '**Goal:** Something',
        '',
        '### Phase 999.3: Third idea',
        '**Goal:** Something more',
      ].join('\n')
    );

    const result = runGsdTools('phase next-decimal 999', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '999.4', 'should be max of union + 1');
    assert.deepStrictEqual(output.existing, ['999.1', '999.3']);
  });

  test('ROADMAP.md with higher decimal wins over directories', () => {
    // Directories: 999.1, 999.2.  ROADMAP.md: 999.1, 999.5
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '999.1-one'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '999.2-two'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '',
        '### Phase 999.1: One',
        '**Goal:** A',
        '',
        '### Phase 999.5: Five',
        '**Goal:** E',
      ].join('\n')
    );

    const result = runGsdTools('phase next-decimal 999', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '999.6');
    assert.deepStrictEqual(output.existing, ['999.1', '999.2', '999.5']);
  });

  test('handles missing ROADMAP.md gracefully', () => {
    // No ROADMAP.md, just directories
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '05.1-patch'), { recursive: true });

    const result = runGsdTools('phase next-decimal 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '05.2');
  });

  test('handles empty phases dir with ROADMAP.md entries', () => {
    // Empty phases dir but ROADMAP.md has entries
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '',
        '### Phase 10.1: Widget',
        '**Goal:** Build widget',
        '',
        '### Phase 10.2: Gadget',
        '**Goal:** Build gadget',
      ].join('\n')
    );

    const result = runGsdTools('phase next-decimal 10', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '10.3');
    assert.deepStrictEqual(output.existing, ['10.1', '10.2']);
  });

  test('handles no phases dir and no ROADMAP.md', () => {
    // Remove the phases directory entirely
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });

    const result = runGsdTools('phase next-decimal 999', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '999.1');
    assert.deepStrictEqual(output.existing, []);
  });

  test('does not match unrelated phase numbers in ROADMAP.md', () => {
    // ROADMAP.md has 99.1 and 9.1 — neither should match when querying 999
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '',
        '### Phase 99.1: Close but not 999',
        '**Goal:** Unrelated',
        '',
        '### Phase 9.1: Also unrelated',
        '**Goal:** Nope',
        '',
        '### Phase 9990.1: Prefix mismatch',
        '**Goal:** Should not match 999',
      ].join('\n')
    );

    const result = runGsdTools('phase next-decimal 999', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '999.1', 'should not be confused by unrelated phases');
    assert.deepStrictEqual(output.existing, []);
  });

  test('handles leading-zero phase numbers in ROADMAP.md', () => {
    // ROADMAP.md uses zero-padded phase numbers
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '',
        '### Phase 007.1: Secret agent fix',
        '**Goal:** Classified',
        '',
        '### Phase 007.2: Another fix',
        '**Goal:** Also classified',
      ].join('\n')
    );

    const result = runGsdTools('phase next-decimal 7', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // normalizePhaseName('7') pads to '07'
    assert.strictEqual(output.next, '07.3');
    assert.deepStrictEqual(output.existing, ['07.1', '07.2']);
  });
});
