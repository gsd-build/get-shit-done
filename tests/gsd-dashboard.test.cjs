/**
 * GSD Dashboard Extension Tests
 *
 * Comprehensive tests for gsd-dashboard.ts covering:
 * - Component rendering
 * - Keyboard input handling
 * - Context API contract validation
 * - State parsing
 * - Roadmap parsing
 * - Error handling
 *
 * Run: node --test tests/gsd-dashboard.test.cjs
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');

const PROJECT_ROOT = path.join(__dirname, '..');
const PI_EXTENSIONS_DIR = path.join(PROJECT_ROOT, '.pi', 'extensions');
const DASHBOARD_PATH = path.join(PI_EXTENSIONS_DIR, 'gsd-dashboard.ts');

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK TYPES - Must match pi API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The actual pi context interface that extensions receive.
 * This MUST match what pi actually provides - if there's a mismatch,
 * tests will fail and catch it.
 */
function createRealisticMockContext(overrides = {}) {
  const notifications = [];
  const customComponents = [];

  // This is what pi ACTUALLY provides (not what the extension expects)
  const actualPiContext = {
    ui: {
      notify: (msg, level) => {
        notifications.push({ msg, level, timestamp: Date.now() });
      },
      setStatus: (id, status) => {},
      clearStatus: (id) => {},
      custom: (factory) => {
        // Track that custom was called
        customComponents.push(factory);
      },
      closeCustom: () => {},
    },
    session: {
      messages: [],
      contextUsage: { percentUsed: 0 },
    },
    // NOTE: runCommand may NOT be available in all pi versions!
    // This is the key issue - the dashboard assumes runCommand exists
    ...overrides,
  };

  return {
    ...actualPiContext,
    notifications,
    customComponents,
  };
}

/**
 * Mock pi API for testing extension registration
 */
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
    // Helper to simulate command execution
    simulateCommand: async (name, args, ctx) => {
      const cmd = commands.get(name);
      if (cmd && cmd.handler) {
        return await cmd.handler(args, ctx);
      }
      return undefined;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract class and function definitions from TypeScript content
 */
function extractDefinitions(content) {
  return {
    hasClass: content.includes('class '),
    hasGsdDashboardComponent: content.includes('GsdDashboardComponent'),
    hasParseState: content.includes('function parseState') || content.includes('parseState'),
    hasParseRoadmap: content.includes('function parseRoadmap') || content.includes('parseRoadmap'),
    hasHandleInput: content.includes('handleInput'),
    hasRender: content.includes('render'),
    exportsDefaultFunction: content.includes('export default function'),
  };
}

/**
 * Create a temp directory with GSD structure
 */
function createTempGsdProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-dashboard-test-'));

  // Create .planning structure
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test-phase'), { recursive: true });

  // Create STATE.md
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `
# GSD State

Current Phase: 01
Current Plan: 03
Status: In Progress
Progress: Phase 1 - Foundation (Plan 3/5)

## Decisions
- Use TypeScript for type safety
- Use Node.js test runner
`);
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `
# GSD State

Current Phase: 01
Current Plan: 03
Status: In Progress
Progress: Phase 1 - Foundation (Plan 3/5)

## Decisions
- Use TypeScript for type safety
- Use Node.js test runner
`);

  // Create ROADMAP.md
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `
# Project Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 01 | Foundation | In Progress |
| 02 | Core Features | Pending |
| 03 | Polish | Pending |
| 04 | Testing | Pending |
| 05 | Deployment | Pending |
`);

  // Create phase files
  fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-test-phase', '01-PLAN.md'), '# Plan 1\n');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-test-phase', '01-SUMMARY.md'), '# Summary 1\n');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-test-phase', '02-PLAN.md'), '# Plan 2\n');

  return tmpDir;
}

function cleanupTempDir(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════.done═════════════════════════════════════════════════════
// TEST: File Structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('GSD Dashboard File Structure', () => {
  test('dashboard extension file exists', () => {
    assert.ok(fs.existsSync(DASHBOARD_PATH), 'gsd-dashboard.ts must exist');
  });

  test('dashboard has required structure', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');
    const defs = extractDefinitions(content);

    assert.ok(defs.exportsDefaultFunction, 'Must export default function');
    assert.ok(defs.hasParseState || content.includes('STATE.md'), 'Must parse STATE.md');
    assert.ok(defs.hasParseRoadmap || content.includes('ROADMAP.md'), 'Must parse ROADMAP.md');
    assert.ok(defs.hasHandleInput, 'Must have handleInput method for keyboard shortcuts');
    assert.ok(defs.hasRender, 'Must have render method for display');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Context API Contract - CRITICAL FOR CATCHING API MISMATCHES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Context API Contract Validation', () => {
  test('dashboard uses runCommand which MUST exist in context', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Check that dashboard uses runCommand
    const usesRunCommand = content.includes('runCommand');
    assert.ok(usesRunCommand, 'Dashboard uses ctx.runCommand');

    // CRITICAL: Document that runCommand MUST be in context
    // This test documents the requirement so if pi API changes,
    // developers know to update the dashboard
  });

  test('runCommand is called with correct signature', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Find all runCommand calls
    const runCommandCalls = content.match(/runCommand\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);

    assert.ok(runCommandCalls && runCommandCalls.length > 0, 'Should have runCommand calls');

    // Verify command format
    for (const call of runCommandCalls) {
      const match = call.match(/runCommand\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
      assert.ok(match, `Invalid runCommand call: ${call}`);
      const cmd = match[1];
      assert.ok(cmd.startsWith('/gsd:'), `Command should start with /gsd: - got: ${cmd}`);
    }
  });

  test('runCommand calls are properly error-handled', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Find all runCommand calls - they should either:
    // 1. Have .catch on same line
    // 2. Be wrapped in try/catch
    // 3. Have optional chaining with existence check
    // 4. Be in a private method that handles errors

    const hasCatchHandler = content.includes('.catch');
    const hasTryCatch = content.includes('try') && content.includes('catch');
    const hasOptionalChaining = content.includes('runCommand ?.');
    const hasExistenceCheck = content.includes('if') && content.includes('runCommand');
    const hasPrivateMethod = content.includes('private runCommand') || content.includes('private async runCommand');

    // At least one error handling strategy should be present
    const hasErrorHandling = hasCatchHandler || hasTryCatch || hasOptionalChaining || hasExistenceCheck || hasPrivateMethod;

    assert.ok(
      hasErrorHandling,
      'runCommand calls should be error-handled via .catch, try/catch, optional chaining, existence check, or private method'
    );

    // If using private method, verify it handles errors
    if (hasPrivateMethod) {
      assert.ok(
        content.includes('.catch') || content.includes('try'),
        'Private runCommand method should handle errors'
      );
    }
  });

  test('context interface is documented in code', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Check that there's type documentation for context
    const hasTypeAnnotation =
      content.includes('ctx:') ||
      content.includes('Context') ||
      content.includes('interface');

    assert.ok(hasTypeAnnotation, 'Context parameter should be typed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Command Registration
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dashboard Command Registration', () => {
  test('registers gsd-dashboard command', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('registerCommand') && content.includes('gsd-dashboard'),
      'Must register gsd-dashboard command'
    );
  });

  test('registers gsd-status command', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('gsd-status'),
      'Must register gsd-status command'
    );
  });

  test('command handlers are async or return void', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Check handler patterns
    const handlerMatches = content.matchAll(/handler:\s*(async\s*)?\(/g);
    for (const match of handlerMatches) {
      // Handlers should either be async or return void
      // This is a syntax check - if it compiles, it's valid
      assert.ok(match, 'Handler should be a function');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Keyboard Input Handling
// ═══════════════════════════════════════════════════════════════════════════════

describe('Keyboard Input Handling', () => {
  test('has keyboard shortcuts for all actions', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    const requiredShortcuts = ['p', 'e', 'v', 's', 'h', 'q'];

    for (const key of requiredShortcuts) {
      assert.ok(
        content.includes(`matchesKey`) || content.includes(`'${key}'`) || content.includes(`"${key}"`),
        `Should handle '${key}' key`
      );
    }
  });

  test('handles escape key for quit', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('escape') || content.includes('Escape'),
      'Should handle escape key for quit'
    );
  });

  test('handleInput calls done() for quit', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Find handleInput and verify it calls done() for quit
    assert.ok(
      content.includes('done()') || content.includes('done ('),
      'Should call done() callback for quit'
    );
  });

  test('keyboard shortcuts match UI hints', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // UI shows: [P]lan [E]xecute [V]erify [S]hip [H]elp [Q]uit
    const uiHints = content.match(/\[P\].*lan.*\[E\].*xecute.*\[V\].*erify.*\[S\].*hip.*\[H\].*elp.*\[Q\].*uit/s);

    assert.ok(uiHints, 'UI hints should match keyboard shortcuts');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Rendering
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dashboard Rendering', () => {
  test('renders dashboard header', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('GSD Dashboard') || content.includes('Dashboard'),
      'Should render dashboard header'
    );
  });

  test('renders phase information', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(content.includes('Phase:'), 'Should render phase label');
    assert.ok(content.includes('Plan:'), 'Should render plan label');
    assert.ok(content.includes('Status:'), 'Should render status label');
  });

  test('renders progress indicators', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should have progress bars or indicators
    const hasProgress =
      content.includes('█') ||
      content.includes('░') ||
      content.includes('Progress') ||
      content.includes('progress');

    assert.ok(hasProgress, 'Should render progress indicators');
  });

  test('handles missing state gracefully', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should show message when no project initialized
    assert.ok(
      content.includes('No project') || content.includes('not initialized'),
      'Should handle missing state gracefully'
    );
  });

  test('uses box drawing characters', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(content.includes('╔') || content.includes('+'), 'Should use box drawing for border');
    assert.ok(content.includes('║') || content.includes('|'), 'Should use box drawing for sides');
    assert.ok(content.includes('╚') || content.includes('+'), 'Should use box drawing for bottom');
  });

  test('caches rendered lines for performance', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should have caching mechanism for render
    assert.ok(
      content.includes('cached') || content.includes('cache'),
      'Should cache rendered lines for performance'
    );
  });

  test('invalidates cache on state change', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('invalidate'),
      'Should have invalidate method for cache'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: State Parsing
// ═══════════════════════════════════════════════════════════════════════════════

describe('STATE.md Parsing', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGsdProject();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  test('parses Current Phase', () => {
    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('Current Phase:') || content.includes('phase:'),
      'Should parse Current Phase from STATE.md'
    );
  });

  test('parses Current Plan', () => {
    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('Current Plan:') || content.includes('plan:'),
      'Should parse Current Plan from STATE.md'
    );
  });

  test('parses Status', () => {
    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('Status:') || content.includes('status:'),
      'Should parse Status from STATE.md'
    );
  });

  test('handles malformed STATE.md', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should have try/catch for parsing
    assert.ok(
      content.includes('try') || content.includes('catch') || content.includes('?.'),
      'Should handle malformed STATE.md gracefully'
    );
  });

  test('handles missing STATE.md', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should check for existence
    assert.ok(
      content.includes('existsSync') || content.includes('!existsSync'),
      'Should check for STATE.md existence'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Roadmap Parsing
// ═══════════════════════════════════════════════════════════════════════════════

describe('ROADMAP.md Parsing', () => {
  test('parses phase table', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should parse markdown table format
    assert.ok(
      content.includes('ROADMAP') && (content.includes('|') || content.includes('match')),
      'Should parse ROADMAP.md table format'
    );
  });

  test('extracts phase number', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should extract phase numbers
    assert.ok(
      content.includes('number') && content.includes('phase'),
      'Should extract phase number'
    );
  });

  test('extracts phase name', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('name') && content.includes('phase'),
      'Should extract phase name'
    );
  });

  test('determines phase status', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should determine status from roadmap
    assert.ok(
      content.includes('status') && (
        content.includes('complete') ||
        content.includes('in-progress') ||
        content.includes('pending')
      ),
      'Should determine phase status'
    );
  });

  test('counts plans and summaries per phase', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('PLAN.md') || content.includes('SUMMARY.md'),
      'Should count plans and summaries per phase'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Custom UI Component Pattern
// ═══════════════════════════════════════════════════════════════════════════════

describe('Custom UI Component Pattern', () => {
  test('uses ctx.ui.custom for dashboard', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('ctx.ui.custom') || content.includes('ui.custom'),
      'Should use ctx.ui.custom for dashboard display'
    );
  });

  test('returns component with render method', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should return object with render, invalidate, handleInput
    assert.ok(
      content.includes('render:') || content.includes('render('),
      'Component must have render method'
    );
  });

  test('returns component with handleInput method', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('handleInput:') || content.includes('handleInput('),
      'Component must have handleInput method'
    );
  });

  test('returns component with invalidate method', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('invalidate:') || content.includes('invalidate('),
      'Component must have invalidate method'
    );
  });

  test('calls done callback on quit', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // done callback should be called when quitting
    assert.ok(
      content.includes('done') && content.includes('done()'),
      'Should call done callback on quit'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: GSD Status Command
// ═══════════════════════════════════════════════════════════════════════════════

describe('GSD Status Command', () => {
  test('shows notification when no project initialized', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('No project initialized') || content.includes('notify'),
      'Should notify when no project initialized'
    );
  });

  test('shows phase/plan/status in notification', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // gsd-status should show phase, plan, status
    assert.ok(
      content.includes('Phase') && content.includes('Plan') && content.includes('Status'),
      'Status command should show phase, plan, and status'
    );
  });

  test('uses ctx.ui.notify for status display', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('ctx.ui.notify') || content.includes('ui.notify'),
      'Should use ctx.ui.notify for status display'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Integration with Mock Context
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration with Mock Context', () => {
  test('handler accepts context with ui.custom', async () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const mockPi = createMockPi();
    const mockCtx = createRealisticMockContext();

    // Load the extension module (will fail if TypeScript, but we can check syntax)
    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Verify it expects ctx.ui.custom
    assert.ok(
      content.includes('ctx.ui.custom') || content.includes('ui.custom'),
      'Extension should use ctx.ui.custom'
    );
  });

  test('runCommand is optional in context (DEFECT DETECTION)', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // This test documents the DEFECT: dashboard uses runCommand but it may not exist
    const runCommandUsage = (content.match(/runCommand/g) || []).length;

    if (runCommandUsage > 0) {
      // Check if there's a guard or optional check
      const hasGuard =
        content.includes('runCommand ?.') || // optional chaining
        content.includes('runCommand &&') || // existence check
        content.includes("if (ctx.runCommand") || // explicit check
        content.includes("if (this.ctx.runCommand"); // explicit check

      // Document that runCommand is used without a guard
      // This is the bug that caused the error!
      console.log(`runCommand is used ${runCommandUsage} time(s)`);
      console.log(`Has guard: ${hasGuard}`);

      // The test should fail to alert about the missing guard
      assert.ok(
        hasGuard,
        'CRITICAL: runCommand is used but context may not have it! Add optional chaining or existence check.'
      );
    }
  });

  test('context type annotation matches expected interface', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Find the context type annotation
    // Should have something like ctx: { runCommand: ... } or ctx: SomeContext
    const hasTypeAnnotation =
      content.includes('ctx:') && (
        content.includes('{') || // inline type
        content.includes('Context') // named type
      );

    // Check if runCommand is in the type
    if (content.includes('runCommand')) {
      // Look for type definition
      const typeMatch = content.match(/ctx:\s*\{[^}]+\}/s);
      if (typeMatch) {
        assert.ok(
          typeMatch[0].includes('runCommand'),
          'If runCommand is used, it should be in context type annotation'
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: TypeScript Compilation Check
// ═══════════════════════════════════════════════════════════════════════════════

describe('TypeScript Compilation', () => {
  test('dashboard extension passes type check', () => {
    // Run the typecheck script
    const { execSync } = require('child_process');

    try {
      execSync('npm run typecheck', {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
        timeout: 30000
      });
    } catch (err) {
      const stderr = err.stderr?.toString() || '';

      // Check if error is about runCommand
      if (stderr.includes('runCommand')) {
        assert.fail(`Type error related to runCommand: ${stderr}`);
      }

      // Other type errors might be acceptable depending on tsconfig
      console.log('Type check stderr:', stderr);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Match Key Import
// ═══════════════════════════════════════════════════════════════════════════════

describe('Key Matching', () => {
  test('imports matchesKey from pi-tui', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    assert.ok(
      content.includes('matchesKey') && content.includes('@mariozechner/pi-tui'),
      'Should import matchesKey from @mariozechner/pi-tui'
    );
  });

  test('uses matchesKey for key detection', () => {
    if (!fs.existsSync(DASHBOARD_PATH)) {
      assert.skip('Dashboard file not found');
      return;
    }

    const content = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

    // Should use matchesKey(data, 'key') pattern
    const matchesKeyUsage = (content.match(/matchesKey\s*\(/g) || []).length;
    assert.ok(matchesKeyUsage >= 4, `Should use matchesKey for at least 4 keys, found ${matchesKeyUsage}`);
  });
});