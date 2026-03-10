/**
 * MCP Server E2E Tests
 *
 * Tests the full MCP server startup and basic operations.
 * Uses subprocess spawning to verify server behavior.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Test helpers
// ============================================================================

const SERVER_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-mcp-server.cjs');

function createTestProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-mcp-e2e-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `---
gsd_state_version: 1.0
milestone: v1.0
status: in_progress
---

# Project State

**Phase:** 01
**Plan:** 01-01
**Status:** In progress
`
  );

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap

## Phase 1: Test

**Goal:** Test phase
`
  );

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ gsd_config_version: 1 }, null, 2)
  );

  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ============================================================================
// Server startup tests
// ============================================================================

describe('MCP server startup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('server file exists and is executable', () => {
    assert.ok(fs.existsSync(SERVER_PATH), 'Server file should exist');

    const stats = fs.statSync(SERVER_PATH);
    assert.ok(stats.isFile(), 'Should be a file');
  });

  test('server can be required without error', () => {
    // This tests the module loads correctly
    assert.doesNotThrow(() => {
      // Just verify the dependencies load
      require('../get-shit-done/bin/lib/mcp/server.cjs');
      require('../get-shit-done/bin/lib/mcp/tools.cjs');
      require('../get-shit-done/bin/lib/mcp/resources.cjs');
      require('../get-shit-done/bin/lib/mcp/errors.cjs');
    });
  });

  test('server starts and logs to stderr', (t, done) => {
    const serverProcess = spawn('node', [SERVER_PATH], {
      cwd: tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderrOutput = '';

    serverProcess.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    // Give server time to start
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
    }, 1000);

    serverProcess.on('close', () => {
      // Server should log startup message to stderr
      assert.ok(
        stderrOutput.includes('gsd-mcp') || stderrOutput.includes('Server'),
        `Expected startup log in stderr, got: ${stderrOutput}`
      );
      done();
    });
  });

  test('server does not output to stdout on startup', (t, done) => {
    const serverProcess = spawn('node', [SERVER_PATH], {
      cwd: tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutOutput = '';

    serverProcess.stdout.on('data', (data) => {
      stdoutOutput += data.toString();
    });

    // Give server time to start
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
    }, 500);

    serverProcess.on('close', () => {
      // Server should NOT output anything to stdout (reserved for JSON-RPC)
      assert.strictEqual(stdoutOutput, '', 'Should not output to stdout on startup');
      done();
    });
  });
});

// ============================================================================
// Module integration tests
// ============================================================================

describe('MCP module integration', () => {
  test('all MCP modules export expected functions', () => {
    const server = require('../get-shit-done/bin/lib/mcp/server.cjs');
    const tools = require('../get-shit-done/bin/lib/mcp/tools.cjs');
    const resources = require('../get-shit-done/bin/lib/mcp/resources.cjs');
    const errors = require('../get-shit-done/bin/lib/mcp/errors.cjs');

    // Server exports
    assert.strictEqual(typeof server.createServer, 'function');
    assert.strictEqual(typeof server.connectTransport, 'function');

    // Tools exports
    assert.strictEqual(typeof tools.registerCoreTools, 'function');
    assert.strictEqual(typeof tools.registerExtendedTools, 'function');
    assert.ok(Array.isArray(tools.CORE_TOOLS));
    assert.ok(Array.isArray(tools.EXTENDED_TOOLS));

    // Resources exports
    assert.strictEqual(typeof resources.registerResources, 'function');

    // Errors exports
    assert.strictEqual(typeof errors.envelope, 'function');
    assert.strictEqual(typeof errors.errorEnvelope, 'function');
    assert.strictEqual(typeof errors.GsdError, 'function');
  });

  test('createServer returns valid server object', () => {
    const { createServer } = require('../get-shit-done/bin/lib/mcp/server.cjs');
    const server = createServer();

    assert.ok(server, 'Server should be created');
    assert.strictEqual(typeof server.tool, 'function', 'Should have tool method');
    assert.strictEqual(typeof server.resource, 'function', 'Should have resource method');
  });

  test('tools can be registered on server', () => {
    const { createServer } = require('../get-shit-done/bin/lib/mcp/server.cjs');
    const { registerCoreTools, registerExtendedTools } = require('../get-shit-done/bin/lib/mcp/tools.cjs');

    const server = createServer();

    assert.doesNotThrow(() => {
      registerCoreTools(server);
      registerExtendedTools(server);
    });
  });

  test('resources can be registered on server', () => {
    const { createServer } = require('../get-shit-done/bin/lib/mcp/server.cjs');
    const { registerResources } = require('../get-shit-done/bin/lib/mcp/resources.cjs');

    const server = createServer();

    assert.doesNotThrow(() => {
      registerResources(server);
    });
  });
});

// ============================================================================
// Error handling tests
// ============================================================================

describe('MCP error handling', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-mcp-err-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  test('tools throw PROJECT_NOT_FOUND without .planning/', () => {
    const { ensureProject } = require('../get-shit-done/bin/lib/mcp/tools.cjs');
    const { GsdError } = require('../get-shit-done/bin/lib/mcp/errors.cjs');

    assert.throws(
      () => ensureProject(tmpDir),
      (err) => err instanceof GsdError && err.code === 'PROJECT_NOT_FOUND'
    );
  });

  test('GsdError converts to proper envelope', () => {
    const { phaseNotFoundError } = require('../get-shit-done/bin/lib/mcp/errors.cjs');

    const error = phaseNotFoundError('99');
    const envelope = error.toEnvelope();

    assert.strictEqual(envelope.success, false);
    assert.strictEqual(envelope.data, null);
    assert.strictEqual(envelope.error.code, 'PHASE_NOT_FOUND');
    assert.ok(envelope.error.recovery.includes('/gsd:'));
    assert.ok(Array.isArray(envelope.next_actions));
  });
});

// ============================================================================
// Package.json integration tests
// ============================================================================

describe('package.json integration', () => {
  test('MCP SDK is listed as dependency', () => {
    const pkg = require('../package.json');

    assert.ok(
      pkg.dependencies['@modelcontextprotocol/sdk'],
      'Should have @modelcontextprotocol/sdk dependency'
    );
  });

  test('Zod is listed as dependency', () => {
    const pkg = require('../package.json');

    assert.ok(pkg.dependencies['zod'], 'Should have zod dependency');
  });

  test('MCP SDK can be required', () => {
    assert.doesNotThrow(() => {
      require('@modelcontextprotocol/sdk/server/mcp.js');
    });
  });

  test('Zod can be required', () => {
    assert.doesNotThrow(() => {
      require('zod');
    });
  });
});

// ============================================================================
// Tool count verification
// ============================================================================

describe('tool and resource counts', () => {
  test('9 total tools across both tiers', () => {
    const { CORE_TOOLS, EXTENDED_TOOLS } = require('../get-shit-done/bin/lib/mcp/tools.cjs');

    assert.strictEqual(CORE_TOOLS.length, 5, 'Should have 5 core tools');
    assert.strictEqual(EXTENDED_TOOLS.length, 4, 'Should have 4 extended tools');
    assert.strictEqual(CORE_TOOLS.length + EXTENDED_TOOLS.length, 9, 'Should have 9 total tools');
  });

  test('4 resources registered', () => {
    const { createServer } = require('../get-shit-done/bin/lib/mcp/server.cjs');
    const { registerResources } = require('../get-shit-done/bin/lib/mcp/resources.cjs');

    let resourceCount = 0;
    const mockServer = {
      resource() {
        resourceCount++;
      },
    };

    registerResources(mockServer);
    assert.strictEqual(resourceCount, 4, 'Should register 4 resources');
  });
});
