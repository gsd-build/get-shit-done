/**
 * MCP Integration Tests
 *
 * Tests the MCP tools and resources with a real GSD project structure.
 * Uses a mock server to capture registrations and invoke handlers directly.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { registerCoreTools, registerExtendedTools } = require('../get-shit-done/bin/lib/mcp/tools.cjs');
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
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-mcp-int-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test-phase'), { recursive: true });

  // Create STATE.md
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Test Milestone
status: in_progress
last_updated: "2024-01-15T10:00:00Z"
last_activity: 2024-01-15 — Completed task 1
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 10
  completed_plans: 4
---

# Project State

**Phase:** 01
**Plan:** 01-02
**Status:** In progress

\`\`\`
[####------] 40%
\`\`\`

## Accumulated Context

### Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Use MCP SDK | Official SDK is well-maintained | 2024-01-10 |
`
  );

  // Create ROADMAP.md
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap: Test Project

## Phase 1: Foundation

**Goal:** Set up project foundation
**Requirements**: REQ-01, REQ-02
**Success Criteria**:
  1. Basic structure created
  2. Tests passing

Plans:
- [x] 01-01-PLAN.md — Initial setup
- [ ] 01-02-PLAN.md — Core functionality

## Phase 2: Features

**Goal:** Add main features
**Requirements**: REQ-03
**Success Criteria**:
  1. Feature A works
  2. Feature B works

## Phase 3: Polish

**Goal:** Final polish
**Requirements**: REQ-04
`
  );

  // Create config.json
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ gsd_config_version: 1, default_milestone: 'v1.0' }, null, 2)
  );

  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

/**
 * Mock MCP server that captures tool/resource registrations
 */
function createMockServer() {
  const tools = new Map();
  const resources = new Map();

  return {
    tool(name, description, schema, handler) {
      tools.set(name, { description, schema, handler });
    },
    resource(uri, name, handler) {
      resources.set(uri, { name, handler });
    },
    getTools() {
      return tools;
    },
    getResources() {
      return resources;
    },
    async invokeTool(name, params = {}) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool not found: ${name}`);
      return tool.handler(params);
    },
    async invokeResource(uri) {
      const resource = resources.get(uri);
      if (!resource) throw new Error(`Resource not found: ${uri}`);
      return resource.handler({ href: uri });
    },
  };
}

// ============================================================================
// Tool registration tests
// ============================================================================

describe('registerCoreTools()', () => {
  test('registers all 5 core tools', () => {
    const server = createMockServer();
    registerCoreTools(server);

    const tools = server.getTools();
    assert.strictEqual(tools.size, 5);
    assert.ok(tools.has('progress'));
    assert.ok(tools.has('health'));
    assert.ok(tools.has('state_get'));
    assert.ok(tools.has('phase_info'));
    assert.ok(tools.has('roadmap_get'));
  });

  test('each tool has description', () => {
    const server = createMockServer();
    registerCoreTools(server);

    const tools = server.getTools();
    for (const [name, tool] of tools) {
      assert.ok(tool.description, `${name} should have description`);
      assert.ok(tool.description.length > 10, `${name} description too short`);
    }
  });

  test('each tool has handler function', () => {
    const server = createMockServer();
    registerCoreTools(server);

    const tools = server.getTools();
    for (const [name, tool] of tools) {
      assert.strictEqual(typeof tool.handler, 'function', `${name} handler should be function`);
    }
  });
});

describe('registerExtendedTools()', () => {
  test('registers all 4 extended tools', () => {
    const server = createMockServer();
    registerExtendedTools(server);

    const tools = server.getTools();
    assert.strictEqual(tools.size, 4);
    assert.ok(tools.has('plan_phase'));
    assert.ok(tools.has('execute_phase'));
    assert.ok(tools.has('state_update'));
    assert.ok(tools.has('phase_complete'));
  });

  test('each tool has description', () => {
    const server = createMockServer();
    registerExtendedTools(server);

    const tools = server.getTools();
    for (const [name, tool] of tools) {
      assert.ok(tool.description, `${name} should have description`);
    }
  });
});

// ============================================================================
// Resource registration tests
// ============================================================================

describe('registerResources()', () => {
  test('registers all 4 resources', () => {
    const server = createMockServer();
    registerResources(server);

    const resources = server.getResources();
    assert.strictEqual(resources.size, 4);
    assert.ok(resources.has('gsd://state'));
    assert.ok(resources.has('gsd://roadmap'));
    assert.ok(resources.has('gsd://phase/current'));
    assert.ok(resources.has('gsd://health'));
  });

  test('each resource has name', () => {
    const server = createMockServer();
    registerResources(server);

    const resources = server.getResources();
    for (const [uri, resource] of resources) {
      assert.ok(resource.name, `${uri} should have name`);
    }
  });

  test('each resource has handler function', () => {
    const server = createMockServer();
    registerResources(server);

    const resources = server.getResources();
    for (const [uri, resource] of resources) {
      assert.strictEqual(typeof resource.handler, 'function', `${uri} handler should be function`);
    }
  });
});

// ============================================================================
// Tool invocation tests (with real project)
// ============================================================================

describe('core tool invocation', () => {
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

  test('health tool returns envelope on valid project', async () => {
    const server = createMockServer();
    registerCoreTools(server);

    const result = await server.invokeTool('health', { repair: false });

    assert.ok(result.content);
    assert.strictEqual(result.content[0].type, 'text');

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, true);
    assert.ok('data' in parsed);
    assert.ok(Array.isArray(parsed.next_actions));
  });

  test('state_get tool returns state data', async () => {
    const server = createMockServer();
    registerCoreTools(server);

    const result = await server.invokeTool('state_get', {});

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, true);
    assert.ok(parsed.data);
  });

  test('roadmap_get tool returns roadmap data', async () => {
    const server = createMockServer();
    registerCoreTools(server);

    const result = await server.invokeTool('roadmap_get', {});

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, true);
    assert.ok(parsed.data);
  });
});

describe('extended tool invocation', () => {
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

  test('plan_phase returns long_running_operation status', async () => {
    const server = createMockServer();
    registerExtendedTools(server);

    const result = await server.invokeTool('plan_phase', { phase: '1' });

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.data.status, 'long_running_operation');
    assert.ok(parsed.data.cli_command.includes('/gsd:plan-phase'));
  });

  test('execute_phase returns long_running_operation status', async () => {
    const server = createMockServer();
    registerExtendedTools(server);

    const result = await server.invokeTool('execute_phase', { phase: '1' });

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.data.status, 'long_running_operation');
    assert.ok(parsed.data.cli_command.includes('/gsd:execute-phase'));
  });

  test('plan_phase includes gaps flag in cli_command', async () => {
    const server = createMockServer();
    registerExtendedTools(server);

    const result = await server.invokeTool('plan_phase', { phase: '2', gaps: true });

    const parsed = JSON.parse(result.content[0].text);
    assert.ok(parsed.data.cli_command.includes('--gaps'));
  });
});

// ============================================================================
// Error handling tests
// ============================================================================

describe('tool error handling', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    // Create empty temp dir (no .planning)
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-mcp-err-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  test('health tool returns error when no project', async () => {
    const server = createMockServer();
    registerCoreTools(server);

    const result = await server.invokeTool('health', {});

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, false);
    assert.ok(parsed.error);
    assert.strictEqual(parsed.error.code, 'PROJECT_NOT_FOUND');
    assert.ok(parsed.error.recovery);
  });

  test('state_get tool returns error when no project', async () => {
    const server = createMockServer();
    registerCoreTools(server);

    const result = await server.invokeTool('state_get', {});

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, false);
    assert.strictEqual(parsed.error.code, 'PROJECT_NOT_FOUND');
  });

  test('extended tools return error when no project', async () => {
    const server = createMockServer();
    registerExtendedTools(server);

    const result = await server.invokeTool('plan_phase', { phase: '1' });

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, false);
    assert.strictEqual(parsed.error.code, 'PROJECT_NOT_FOUND');
  });
});

// ============================================================================
// Resource handler tests
// ============================================================================

describe('resource handlers', () => {
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

  test('handleStateResource returns envelope with state data', async () => {
    const result = await handleStateResource();

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.ok(result.data.exists);
    assert.ok(result.data.milestone);
    assert.ok(result.next_actions.length > 0);
  });

  test('handleStateResource parses frontmatter', async () => {
    const result = await handleStateResource();

    assert.strictEqual(result.data.milestone, 'v1.0');
    assert.strictEqual(result.data.milestone_name, 'Test Milestone');
    assert.ok(result.data.status);
  });

  test('handleRoadmapResource returns envelope with roadmap data', async () => {
    const result = await handleRoadmapResource();

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.ok(result.data.exists);
    assert.ok(result.next_actions.length > 0);
  });

  test('handleHealthResource returns envelope with health data', async () => {
    const result = await handleHealthResource();

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.ok('status' in result.data);
    assert.ok('issues' in result.data);
  });

  test('handleCurrentPhaseResource returns current phase info', async () => {
    const result = await handleCurrentPhaseResource();

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.strictEqual(result.data.phase_number, '01');
  });
});

describe('resource error handling', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-mcp-res-err-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  test('handleStateResource throws on missing project', async () => {
    await assert.rejects(
      async () => handleStateResource(),
      (err) => err.code === 'PROJECT_NOT_FOUND'
    );
  });

  test('handleRoadmapResource throws on missing project', async () => {
    await assert.rejects(
      async () => handleRoadmapResource(),
      (err) => err.code === 'PROJECT_NOT_FOUND'
    );
  });

  test('handleHealthResource throws on missing project', async () => {
    await assert.rejects(
      async () => handleHealthResource(),
      (err) => err.code === 'PROJECT_NOT_FOUND'
    );
  });
});

// ============================================================================
// Full server integration tests
// ============================================================================

describe('full server integration', () => {
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

  test('all tools and resources register without error', () => {
    const server = createMockServer();

    assert.doesNotThrow(() => {
      registerCoreTools(server);
      registerExtendedTools(server);
      registerResources(server);
    });

    assert.strictEqual(server.getTools().size, 9);
    assert.strictEqual(server.getResources().size, 4);
  });

  test('tool and resource invocations are independent', async () => {
    const server = createMockServer();
    registerCoreTools(server);
    registerResources(server);

    // Invoke tool
    const toolResult = await server.invokeTool('health', {});
    const toolParsed = JSON.parse(toolResult.content[0].text);
    assert.strictEqual(toolParsed.success, true);

    // Invoke resource
    const resourceResult = await server.invokeResource('gsd://health');
    assert.ok(resourceResult.contents);
    assert.strictEqual(resourceResult.contents[0].mimeType, 'application/json');
  });
});
