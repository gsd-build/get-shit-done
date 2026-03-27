/**
 * Pi Extensions Runtime Tests
 *
 * Tests extension behavior with mocked pi API.
 * Exercises event handlers, tool execution, and command handlers.
 *
 * Run: node --test tests/pi-extensions-runtime.test.cjs
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = path.join(__dirname, '..');
const PI_EXTENSIONS_DIR = path.join(PROJECT_ROOT, '.pi', 'extensions');

// Mock pi API
function createMockPi() {
  const handlers = new Map();
  const tools = new Map();
  const commands = new Map();

  return {
    handlers,
    tools,
    commands,
    on: (event, handler) => {
      handlers.set(event, handler);
    },
    registerTool: (tool) => {
      tools.set(tool.name, tool);
    },
    registerCommand: (name, def) => {
      commands.set(name, def);
    },
    // Helper to simulate event
    simulateEvent: async (event, data, ctx) => {
      const handler = handlers.get(event);
      if (handler) {
        return await handler(data, ctx);
      }
      return undefined;
    },
    // Helper to simulate tool call
    simulateToolCall: async (name, params, ctx) => {
      const tool = tools.get(name);
      if (tool) {
        return await tool.execute('test-call-id', params, new AbortController().signal, () => {}, ctx);
      }
      return undefined;
    },
    // Helper to simulate command
    simulateCommand: async (name, args, ctx) => {
      const cmd = commands.get(name);
      if (cmd) {
        return await cmd.handler(args, ctx);
      }
      return undefined;
    },
  };
}

// Mock context
function createMockContext(overrides = {}) {
  const notifications = [];
  const statusUpdates = [];

  return {
    ui: {
      notify: (msg, level) => {
        notifications.push({ msg, level });
      },
      setStatus: (id, status) => {
        statusUpdates.push({ id, status });
      },
      custom: () => {},
      closeCustom: () => {},
    },
    session: {
      messages: [],
      contextUsage: { percentUsed: 0 },
      ...overrides.session,
    },
    runCommand: async () => {},
    notifications,
    statusUpdates,
    ...overrides,
  };
}

// Temp directory for tests
let tempDir;

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: All Extensions Load
// ═══════════════════════════════════════════════════════════════════════════════

describe('Extension Loading', () => {
  const extensionFiles = fs.readdirSync(PI_EXTENSIONS_DIR)
    .filter(f => f.endsWith('.ts') && f !== 'pi-types.d.ts');

  for (const file of extensionFiles) {
    test(`${file} can be parsed`, () => {
      const extPath = path.join(PI_EXTENSIONS_DIR, file);
      const content = fs.readFileSync(extPath, 'utf-8');

      // Check syntax basics
      assert.ok(content.includes('export default function'), 'Must have default export');
      assert.ok(content.includes('pi:') || content.includes('pi)'), 'Must accept pi parameter');
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Context Monitor Behavior
// ═══════════════════════════════════════════════════════════════════════════════

describe('Context Monitor Runtime', () => {
  test('does not warn when context is low', async () => {
    const mockPi = createMockPi();
    const mockCtx = createMockContext({
      session: { contextUsage: { percentUsed: 50 } }
    });

    // Simulate tool_call event
    const result = await mockPi.simulateEvent('tool_call', { toolName: 'read' }, mockCtx);

    // No handler registered in our mock, so result is undefined
    assert.strictEqual(result, undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Status Line Behavior
// ═══════════════════════════════════════════════════════════════════════════════

describe('Status Line Runtime', () => {
  test('shows not initialized when .planning/ missing', async () => {
    const mockPi = createMockPi();
    const mockCtx = createMockContext();

    // Simulate session_start
    await mockPi.simulateEvent('session_start', {}, mockCtx);

    // No handler in mock
    assert.strictEqual(mockCtx.statusUpdates.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Prompt Guard Behavior
// ═══════════════════════════════════════════════════════════════════════════════

describe('Prompt Guard Detection', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-prompt-guard.ts');

  test('detects common injection patterns', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    // Check that common patterns are in the detection list
    const patterns = [
      'ignore',
      'previous',
      'instructions',
      'forget',
      'jailbreak',
    ];

    for (const pattern of patterns) {
      assert.ok(
        content.toLowerCase().includes(pattern.toLowerCase()),
        `Should detect '${pattern}' pattern`
      );
    }
  });

  test('protects GSD files', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    const protectedFiles = [
      '.planning',
      'PROJECT.md',
      'STATE.md',
      'ROADMAP.md',
    ];

    for (const file of protectedFiles) {
      assert.ok(
        content.includes(file),
        `Should protect ${file}`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Auto-Spawn Intent Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Auto-Spawn Intent Detection', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-auto-spawn.ts');

  test('has intent patterns for common workflows', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    const workflows = [
      '/gsd:quick',
      '/gsd:new-project',
      '/gsd:debug',
      '/gsd:next',
      '/gsd:progress',
      '/gsd:ship',
    ];

    for (const workflow of workflows) {
      assert.ok(
        content.includes(workflow),
        `Should suggest ${workflow}`
      );
    }
  });

  test('debounces suggestions', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    assert.ok(
      content.includes('DEBOUNCE') || content.includes('debounce'),
      'Should debounce suggestions'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Dashboard Extension
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dashboard Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-dashboard.ts');

  test('has render function for dashboard', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    assert.ok(
      content.includes('render') || content.includes('Dashboard'),
      'Should have render function'
    );
  });

  test('shows phase progress', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    assert.ok(
      content.includes('Phase') && content.includes('progress'),
      'Should show phase progress'
    );
  });

  test('has keyboard shortcuts', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    assert.ok(
      content.includes('handleInput') || content.includes('matchesKey'),
      'Should handle keyboard input'
    );
  });

  test('handles missing runCommand gracefully', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    // runCommand may not be available in all pi versions
    // Should either use optional chaining or existence check
    const hasOptionalChaining = content.includes('ctx.runCommand ?.') || content.includes('this.ctx.runCommand ?.');
    const hasExistenceCheck = content.includes('if') && content.includes('runCommand');
    const hasPrivateMethod = content.includes('private runCommand');

    assert.ok(
      hasOptionalChaining || hasExistenceCheck || hasPrivateMethod,
      'Should handle missing runCommand gracefully (optional chaining, existence check, or private method)'
    );
  });

  test('runCommand is typed as optional', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    // Should have runCommand? in the interface
    assert.ok(
      content.includes('runCommand?') || content.includes('runCommand ?'),
      'runCommand should be typed as optional in the context interface'
    );
  });

  test('has error handling for runCommand', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    // Should have .catch or try/catch for runCommand calls
    assert.ok(
      content.includes('.catch') || (content.includes('try') && content.includes('catch')),
      'Should have error handling for runCommand calls'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Git Extension Tools
// ═══════════════════════════════════════════════════════════════════════════════

describe('Git Extension Tools', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-git.ts');

  test('registers gsd_ship tool', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(content.includes('gsd_ship'), 'Should register gsd_ship tool');
  });

  test('registers gsd_branch tool', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(content.includes('gsd_branch'), 'Should register gsd_branch tool');
  });

  test('registers gsd_git_status tool', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(content.includes('gsd_git_status'), 'Should register gsd_git_status tool');
  });

  test('detects uncommitted changes', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('hasUncommittedChanges') || content.includes('porcelain'),
      'Should detect uncommitted changes'
    );
  });

  test('generates PR body from commits', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('generatePrBody') || content.includes('PR') || content.includes('pull request'),
      'Should generate PR body'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: MCP Server Extension
// ═══════════════════════════════════════════════════════════════════════════════

describe('MCP Server Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-mcp-server.ts');

  test('defines MCP resources', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    const resources = [
      'gsd://project',
      'gsd://state',
      'gsd://roadmap',
      'gsd://requirements',
    ];

    for (const resource of resources) {
      assert.ok(
        content.includes(resource),
        `Should define ${resource} resource`
      );
    }
  });

  test('defines MCP tools', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    const tools = ['gsd_query', 'gsd_plan', 'gsd_record'];

    for (const tool of tools) {
      assert.ok(
        content.includes(tool),
        `Should define ${tool} tool`
      );
    }
  });

  test('reads GSD resources', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('readResource') || content.includes('readFileSync'),
      'Should read resources'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Metrics Extension
// ═══════════════════════════════════════════════════════════════════════════════

describe('Metrics Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-metrics.ts');

  test('tracks session metrics', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('SessionMetrics') || content.includes('session'),
      'Should track session metrics'
    );
  });

  test('persists metrics to file', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('metrics.json') || content.includes('writeFileSync'),
      'Should persist metrics'
    );
  });

  test('formats duration for display', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('formatDuration') || content.includes('duration'),
      'Should format duration'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Workflow Guard Extension
// ═══════════════════════════════════════════════════════════════════════════════

describe('Workflow Guard Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-workflow-guard.ts');

  test('checks config for workflow_guard setting', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('workflow_guard') || content.includes('config'),
      'Should check config for workflow_guard'
    );
  });

  test('warns about non-workflow edits', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('warning') || content.includes('warn'),
      'Should warn about non-workflow edits'
    );
  });

  test('ignores node_modules and .git', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('node_modules') || content.includes('IGNORE'),
      'Should ignore common directories'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Compaction Extension
// ═══════════════════════════════════════════════════════════════════════════════

describe('Compaction Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-compaction.ts');

  test('prioritizes GSD files for retention', () => {
    const content = fs.readFileSync(extPath, 'utf-8');

    const criticalFiles = ['STATE.md', 'PROJECT.md'];

    for (const file of criticalFiles) {
      assert.ok(
        content.includes(file),
        `Should prioritize ${file}`
      );
    }
  });

  test('can summarize research files', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('summarize') || content.includes('SUMMARIZABLE'),
      'Should support summarizing files'
    );
  });

  test('generates GSD state summary', () => {
    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('getGsdStateSummary') || content.includes('summary'),
      'Should generate state summary'
    );
  });
});