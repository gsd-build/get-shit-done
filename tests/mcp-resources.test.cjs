/**
 * MCP Resources Module - Unit Tests
 *
 * Tests the resource handlers and registration functions.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  registerResources,
  handleStateResource,
  handleRoadmapResource,
  handleCurrentPhaseResource,
  handleHealthResource,
} = require('../get-shit-done/bin/lib/mcp/resources.cjs');

// ============================================================================
// Test helpers
// ============================================================================

function createTestProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-mcp-res-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-current'), { recursive: true });

  // Create STATE.md with comprehensive content
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Major Release
status: in_progress
last_updated: "2024-03-15T14:30:00Z"
last_activity: 2024-03-15 — Added new feature
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 15
  completed_plans: 7
---

# Project State: Test Project

**Phase:** 03
**Plan:** 03-02
**Status:** In progress

\`\`\`
[######----] 60%
\`\`\`

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Use TypeScript | Better type safety | 2024-03-01 |
`
  );

  // Create ROADMAP.md
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap: Test Project v2.0

## Phase 1: Foundation (INSERTED)

**Goal:** Set up project foundation

## Phase 2: Core Features

**Goal:** Implement core features
**Requirements**: FEAT-01, FEAT-02

## Phase 3: Current Work

**Goal:** Current active phase
**Requirements**: FEAT-03

## Phase 4: Polish

**Goal:** Final polish

## Phase 5: Release

**Goal:** Release preparation
`
  );

  // Create config.json
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ gsd_config_version: 1, default_milestone: 'v2.0' }, null, 2)
  );

  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ============================================================================
// registerResources() tests
// ============================================================================

describe('registerResources()', () => {
  test('is a function', () => {
    assert.strictEqual(typeof registerResources, 'function');
  });

  test('registers resources on server object', () => {
    const registered = [];
    const mockServer = {
      resource(uri, name, handler) {
        registered.push({ uri, name, handler });
      },
    };

    registerResources(mockServer);

    assert.strictEqual(registered.length, 4);
  });

  test('registers gsd://state resource', () => {
    const registered = new Map();
    const mockServer = {
      resource(uri, name, handler) {
        registered.set(uri, { name, handler });
      },
    };

    registerResources(mockServer);

    assert.ok(registered.has('gsd://state'));
    assert.strictEqual(registered.get('gsd://state').name, 'GSD Project State');
  });

  test('registers gsd://roadmap resource', () => {
    const registered = new Map();
    const mockServer = {
      resource(uri, name, handler) {
        registered.set(uri, { name, handler });
      },
    };

    registerResources(mockServer);

    assert.ok(registered.has('gsd://roadmap'));
    assert.strictEqual(registered.get('gsd://roadmap').name, 'GSD Roadmap');
  });

  test('registers gsd://phase/current resource', () => {
    const registered = new Map();
    const mockServer = {
      resource(uri, name, handler) {
        registered.set(uri, { name, handler });
      },
    };

    registerResources(mockServer);

    assert.ok(registered.has('gsd://phase/current'));
    assert.strictEqual(registered.get('gsd://phase/current').name, 'Current Phase Context');
  });

  test('registers gsd://health resource', () => {
    const registered = new Map();
    const mockServer = {
      resource(uri, name, handler) {
        registered.set(uri, { name, handler });
      },
    };

    registerResources(mockServer);

    assert.ok(registered.has('gsd://health'));
    assert.strictEqual(registered.get('gsd://health').name, 'GSD Health Status');
  });

  test('all handlers are functions', () => {
    const registered = new Map();
    const mockServer = {
      resource(uri, name, handler) {
        registered.set(uri, { name, handler });
      },
    };

    registerResources(mockServer);

    for (const [uri, { handler }] of registered) {
      assert.strictEqual(typeof handler, 'function', `${uri} handler should be function`);
    }
  });
});

// ============================================================================
// handleStateResource() tests
// ============================================================================

describe('handleStateResource()', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = createTestProject();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  test('returns envelope with success=true', async () => {
    const result = await handleStateResource();

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.strictEqual(result.error, null);
  });

  test('includes exists flag', async () => {
    const result = await handleStateResource();

    assert.strictEqual(result.data.exists, true);
  });

  test('parses milestone from frontmatter', async () => {
    const result = await handleStateResource();

    assert.strictEqual(result.data.milestone, 'v2.0');
    assert.strictEqual(result.data.milestone_name, 'Major Release');
  });

  test('parses status', async () => {
    const result = await handleStateResource();

    assert.strictEqual(result.data.status, 'in_progress');
  });

  test('extracts current phase number', async () => {
    const result = await handleStateResource();

    assert.strictEqual(result.data.current_phase, '03');
  });

  test('extracts current plan', async () => {
    const result = await handleStateResource();

    assert.strictEqual(result.data.current_plan, '03-02');
  });

  test('parses progress percentage', async () => {
    const result = await handleStateResource();

    assert.strictEqual(result.data.progress_percent, 60);
  });

  test('includes next_actions', async () => {
    const result = await handleStateResource();

    assert.ok(Array.isArray(result.next_actions));
    assert.ok(result.next_actions.length > 0);
  });

  test('handles missing STATE.md gracefully', async () => {
    fs.unlinkSync(path.join(tmpDir, '.planning', 'STATE.md'));

    const result = await handleStateResource();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.exists, false);
  });
});

// ============================================================================
// handleRoadmapResource() tests
// ============================================================================

describe('handleRoadmapResource()', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = createTestProject();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  test('returns envelope with success=true', async () => {
    const result = await handleRoadmapResource();

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
  });

  test('includes exists flag', async () => {
    const result = await handleRoadmapResource();

    assert.strictEqual(result.data.exists, true);
  });

  test('includes next_actions', async () => {
    const result = await handleRoadmapResource();

    assert.ok(Array.isArray(result.next_actions));
  });

  test('handles missing ROADMAP.md gracefully', async () => {
    fs.unlinkSync(path.join(tmpDir, '.planning', 'ROADMAP.md'));

    const result = await handleRoadmapResource();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.exists, false);
  });
});

// ============================================================================
// handleCurrentPhaseResource() tests
// ============================================================================

describe('handleCurrentPhaseResource()', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = createTestProject();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  test('returns envelope with success=true', async () => {
    const result = await handleCurrentPhaseResource();

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
  });

  test('extracts phase_number from STATE.md', async () => {
    const result = await handleCurrentPhaseResource();

    assert.strictEqual(result.data.phase_number, '03');
  });

  test('includes exists flag', async () => {
    const result = await handleCurrentPhaseResource();

    assert.strictEqual(result.data.exists, true);
  });

  test('handles missing STATE.md', async () => {
    fs.unlinkSync(path.join(tmpDir, '.planning', 'STATE.md'));

    const result = await handleCurrentPhaseResource();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.exists, false);
    assert.ok(result.data.error);
  });

  test('handles STATE.md without phase marker', async () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State

No phase marker here.
`
    );

    const result = await handleCurrentPhaseResource();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.exists, false);
  });
});

// ============================================================================
// handleHealthResource() tests
// ============================================================================

describe('handleHealthResource()', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = createTestProject();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  test('returns envelope with success=true', async () => {
    const result = await handleHealthResource();

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
  });

  test('includes status field', async () => {
    const result = await handleHealthResource();

    assert.ok('status' in result.data);
    assert.ok(['healthy', 'degraded', 'unknown'].includes(result.data.status));
  });

  test('includes issues array', async () => {
    const result = await handleHealthResource();

    assert.ok(Array.isArray(result.data.issues));
  });

  test('includes issue_count', async () => {
    const result = await handleHealthResource();

    assert.ok('issue_count' in result.data);
    assert.strictEqual(typeof result.data.issue_count, 'number');
  });

  test('includes next_actions', async () => {
    const result = await handleHealthResource();

    assert.ok(Array.isArray(result.next_actions));
  });
});

// ============================================================================
// Error handling tests
// ============================================================================

describe('resource error handling', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    // Create empty dir (no .planning)
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-mcp-res-err-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  test('handleStateResource throws GsdError on missing project', async () => {
    await assert.rejects(
      async () => handleStateResource(),
      (err) => {
        return err.code === 'PROJECT_NOT_FOUND';
      }
    );
  });

  test('handleRoadmapResource throws GsdError on missing project', async () => {
    await assert.rejects(
      async () => handleRoadmapResource(),
      (err) => {
        return err.code === 'PROJECT_NOT_FOUND';
      }
    );
  });

  test('handleCurrentPhaseResource throws GsdError on missing project', async () => {
    await assert.rejects(
      async () => handleCurrentPhaseResource(),
      (err) => {
        return err.code === 'PROJECT_NOT_FOUND';
      }
    );
  });

  test('handleHealthResource throws GsdError on missing project', async () => {
    await assert.rejects(
      async () => handleHealthResource(),
      (err) => {
        return err.code === 'PROJECT_NOT_FOUND';
      }
    );
  });
});

// ============================================================================
// Module exports tests
// ============================================================================

describe('module exports', () => {
  test('exports registerResources function', () => {
    const exports = require('../get-shit-done/bin/lib/mcp/resources.cjs');

    assert.ok('registerResources' in exports);
    assert.strictEqual(typeof exports.registerResources, 'function');
  });

  test('exports handler functions for testing', () => {
    const exports = require('../get-shit-done/bin/lib/mcp/resources.cjs');

    assert.ok('handleStateResource' in exports);
    assert.ok('handleRoadmapResource' in exports);
    assert.ok('handleCurrentPhaseResource' in exports);
    assert.ok('handleHealthResource' in exports);
  });

  test('all exported handlers are functions', () => {
    const exports = require('../get-shit-done/bin/lib/mcp/resources.cjs');

    assert.strictEqual(typeof exports.handleStateResource, 'function');
    assert.strictEqual(typeof exports.handleRoadmapResource, 'function');
    assert.strictEqual(typeof exports.handleCurrentPhaseResource, 'function');
    assert.strictEqual(typeof exports.handleHealthResource, 'function');
  });
});
