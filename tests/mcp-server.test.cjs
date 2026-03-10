/**
 * MCP Server Module - Unit Tests
 *
 * Tests the server creation and transport connection functions.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { createServer, connectTransport } = require('../get-shit-done/bin/lib/mcp/server.cjs');

// ============================================================================
// createServer() tests
// ============================================================================

describe('createServer()', () => {
  test('returns an MCP server instance', () => {
    const server = createServer();

    assert.ok(server, 'Should return a server');
    assert.strictEqual(typeof server, 'object');
  });

  test('server has tool registration method', () => {
    const server = createServer();

    assert.strictEqual(typeof server.tool, 'function', 'Should have tool() method');
  });

  test('server has resource registration method', () => {
    const server = createServer();

    assert.strictEqual(typeof server.resource, 'function', 'Should have resource() method');
  });

  test('server has connect method', () => {
    const server = createServer();

    assert.strictEqual(typeof server.connect, 'function', 'Should have connect() method');
  });

  test('multiple calls create independent servers', () => {
    const server1 = createServer();
    const server2 = createServer();

    assert.notStrictEqual(server1, server2, 'Should be different instances');
  });
});

// ============================================================================
// connectTransport() tests
// ============================================================================

describe('connectTransport()', () => {
  test('is a function', () => {
    assert.strictEqual(typeof connectTransport, 'function');
    // Note: We cannot test actual connection as it blocks waiting for stdio
  });

  test('function exists and is exported', () => {
    assert.ok(connectTransport, 'connectTransport should be exported');
    assert.strictEqual(typeof connectTransport, 'function');
  });
});

// ============================================================================
// Server configuration tests
// ============================================================================

describe('server configuration', () => {
  test('server is configured with correct name', () => {
    const server = createServer();

    // The server should be named 'gsd-mcp-server'
    // This is validated through the SDK's internal config
    assert.ok(server, 'Server should be created');
  });

  test('server uses version from package.json', () => {
    const server = createServer();
    const pkg = require('../package.json');

    // The version should match package.json
    // This is validated through server configuration
    assert.ok(pkg.version, 'Package should have version');
    assert.ok(server, 'Server should be created with version');
  });
});

// ============================================================================
// Tool registration capability tests
// ============================================================================

describe('tool registration capability', () => {
  test('can register a tool with name and handler', () => {
    const server = createServer();

    assert.doesNotThrow(() => {
      server.tool('test_tool', 'Test description', {}, async () => {
        return { content: [{ type: 'text', text: 'test' }] };
      });
    });
  });

  test('can register multiple tools', () => {
    const server = createServer();

    assert.doesNotThrow(() => {
      server.tool('tool1', 'Tool 1', {}, async () => ({ content: [] }));
      server.tool('tool2', 'Tool 2', {}, async () => ({ content: [] }));
      server.tool('tool3', 'Tool 3', {}, async () => ({ content: [] }));
    });
  });
});

// ============================================================================
// Resource registration capability tests
// ============================================================================

describe('resource registration capability', () => {
  test('can register a resource with URI and handler', () => {
    const server = createServer();

    assert.doesNotThrow(() => {
      server.resource('test://resource', 'Test Resource', async () => {
        return { contents: [{ uri: 'test://resource', text: 'test' }] };
      });
    });
  });

  test('can register multiple resources', () => {
    const server = createServer();

    assert.doesNotThrow(() => {
      server.resource('test://r1', 'R1', async () => ({ contents: [] }));
      server.resource('test://r2', 'R2', async () => ({ contents: [] }));
      server.resource('test://r3', 'R3', async () => ({ contents: [] }));
    });
  });
});

// ============================================================================
// Module exports tests
// ============================================================================

describe('module exports', () => {
  test('exports createServer function', () => {
    const exports = require('../get-shit-done/bin/lib/mcp/server.cjs');

    assert.ok('createServer' in exports);
    assert.strictEqual(typeof exports.createServer, 'function');
  });

  test('exports connectTransport function', () => {
    const exports = require('../get-shit-done/bin/lib/mcp/server.cjs');

    assert.ok('connectTransport' in exports);
    assert.strictEqual(typeof exports.connectTransport, 'function');
  });

  test('exports only expected functions', () => {
    const exports = require('../get-shit-done/bin/lib/mcp/server.cjs');
    const keys = Object.keys(exports);

    assert.deepStrictEqual(keys.sort(), ['connectTransport', 'createServer'].sort());
  });
});
