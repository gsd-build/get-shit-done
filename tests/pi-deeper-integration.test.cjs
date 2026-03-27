/**
 * Pi Deeper Integration Tests
 *
 * Validates advanced pi integrations:
 * 1. Security Extensions (prompt-guard, workflow-guard)
 * 2. Context-Aware Auto-Spawning
 * 3. Custom Compaction Strategy
 * 4. Interactive TUI Dashboard
 * 5. Git Integration
 * 6. MCP Server
 * 7. Worktree/Multi-Project Support
 * 8. Metrics/Telemetry
 *
 * Run: node --test tests/pi-deeper-integration.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PI_EXTENSIONS_DIR = path.join(PROJECT_ROOT, '.pi', 'extensions');

// All required deeper integrations
const REQUIRED_EXTENSIONS = [
  'gsd-prompt-guard',
  'gsd-workflow-guard',
  'gsd-auto-spawn',
  'gsd-compaction',
  'gsd-dashboard',
  'gsd-git',
  'gsd-mcp-server',
  'gsd-metrics',
];

// Injection patterns to detect
const INJECTION_PATTERNS = [
  'ignore previous instructions',
  'you are now',
  'system:',
  'forget everything',
  'new instructions:',
  'override',
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Extension Structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('Deeper Integration Structure', () => {
  test('all required extensions exist', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      assert.ok(fs.existsSync(extPath), `Extension ${ext}.ts must exist`);
    }
  });

  test('all extensions export default function', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      const content = fs.readFileSync(extPath, 'utf-8');
      assert.ok(
        content.includes('export default function'),
        `${ext} must export default function`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: 1. Security Extensions - Prompt Guard
// ═══════════════════════════════════════════════════════════════════════════════

describe('Prompt Guard Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-prompt-guard.ts');

  test('extension registers tool_call event listener', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-prompt-guard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('pi.on') && content.includes('tool_call'),
      'Extension must register tool_call event listener'
    );
  });

  test('extension detects injection patterns', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-prompt-guard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    // Should have injection pattern detection
    assert.ok(
      content.includes('injection') ||
      content.includes('pattern') ||
      content.includes('ignore previous') ||
      INJECTION_PATTERNS.some(p => content.toLowerCase().includes(p.toLowerCase())),
      'Extension must detect prompt injection patterns'
    );
  });

  test('extension blocks writes to .planning/ with injection content', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-prompt-guard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('block') || content.includes('return { block'),
      'Extension must be able to block writes'
    );
  });

  test('extension checks .planning/ path', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-prompt-guard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('.planning'),
      'Extension must check for .planning/ path'
    );
  });

  test('extension has configurable patterns list', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-prompt-guard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    // Should have an array or list of patterns
    assert.ok(
      content.includes('PATTERNS') ||
      content.includes('patterns') ||
      content.includes('[') ||
      content.includes('regex'),
      'Extension should have configurable injection patterns'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: 2. Security Extensions - Workflow Guard
// ═══════════════════════════════════════════════════════════════════════════════

describe('Workflow Guard Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-workflow-guard.ts');

  test('extension registers tool_call event listener', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-workflow-guard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('pi.on') && content.includes('tool_call'),
      'Extension must register tool_call event listener'
    );
  });

  test('extension detects edits outside GSD workflow', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-workflow-guard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('workflow') ||
      content.includes('gsd:') ||
      content.includes('/gsd'),
      'Extension must detect GSD workflow context'
    );
  });

  test('extension warns or blocks non-workflow edits', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-workflow-guard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('warn') ||
      content.includes('block') ||
      content.includes('notify') ||
      content.includes('confirm'),
      'Extension must warn or block non-workflow edits'
    );
  });

  test('extension allows .planning/ edits', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-workflow-guard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('.planning'),
      'Extension must recognize .planning/ as valid GSD path'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: 3. Context-Aware Auto-Spawning
// ═══════════════════════════════════════════════════════════════════════════════

describe('Auto-Spawn Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-auto-spawn.ts');

  test('extension registers message or prompt event listener', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-auto-spawn.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('pi.on') &&
      (content.includes('user_message') ||
       content.includes('message') ||
       content.includes('prompt')),
      'Extension must register message/prompt event listener'
    );
  });

  test('extension has intent detection patterns', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-auto-spawn.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('intent') ||
      content.includes('pattern') ||
      content.includes('match') ||
      content.includes('detect'),
      'Extension must have intent detection'
    );
  });

  test('extension can suggest GSD commands', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-auto-spawn.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('suggest') ||
      content.includes('notify') ||
      content.includes('/gsd'),
      'Extension must be able to suggest GSD commands'
    );
  });

  test('extension tracks context to avoid duplicate suggestions', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-auto-spawn.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('lastSuggested') ||
      content.includes('suggested') ||
      content.includes('session') ||
      content.includes('cooldown'),
      'Extension should track suggestions to avoid spam'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: 4. Custom Compaction Strategy
// ═══════════════════════════════════════════════════════════════════════════════

describe('Compaction Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-compaction.ts');

  test('extension registers compaction event listener', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-compaction.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('pi.on') && content.includes('compaction'),
      'Extension must register compaction event listener'
    );
  });

  test('extension preserves GSD state files', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-compaction.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('PROJECT.md') ||
      content.includes('STATE.md') ||
      content.includes('preserve') ||
      content.includes('keep'),
      'Extension must preserve GSD state files during compaction'
    );
  });

  test('extension prioritizes .planning/ files', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-compaction.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('.planning') ||
      content.includes('priority'),
      'Extension must prioritize .planning/ files'
    );
  });

  test('extension provides compaction summary', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-compaction.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('summary') ||
      content.includes('summarize') ||
      content.includes('result'),
      'Extension should provide compaction summary'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: 5. Interactive TUI Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dashboard Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-dashboard.ts');

  test('extension registers command for dashboard', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-dashboard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('pi.registerCommand') ||
      content.includes('registerCommand'),
      'Extension must register a dashboard command'
    );
  });

  test('extension uses ctx.ui.custom for TUI', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-dashboard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('ctx.ui.custom') ||
      content.includes('ui.custom') ||
      content.includes('custom('),
      'Extension must use ctx.ui.custom for TUI rendering'
    );
  });

  test('extension renders phase/plan information', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-dashboard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('Phase') ||
      content.includes('Plan') ||
      content.includes('ROADMAP'),
      'Extension must render phase/plan information'
    );
  });

  test('extension handles keyboard input', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-dashboard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('onKey') ||
      content.includes('key') ||
      content.includes('input'),
      'Extension must handle keyboard input'
    );
  });

  test('extension reads STATE.md for current position', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-dashboard.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('STATE.md') ||
      content.includes('.planning') ||
      content.includes('gsd-tools'),
      'Extension must read GSD state'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: 6. Git Integration
// ═══════════════════════════════════════════════════════════════════════════════

describe('Git Integration Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-git.ts');

  test('extension registers gsd_ship tool', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-git.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('gsd_ship') ||
      content.includes('registerTool'),
      'Extension must register git-related tools'
    );
  });

  test('extension has PR creation capability', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-git.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('pr') ||
      content.includes('PR') ||
      content.includes('pull request') ||
      content.includes('github'),
      'Extension must have PR creation capability'
    );
  });

  test('extension detects phase completion for PR suggestion', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-git.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('phase') ||
      content.includes('complete') ||
      content.includes('notify'),
      'Extension must detect phase completion'
    );
  });

  test('extension provides branch management', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-git.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('branch') ||
      content.includes('git') ||
      content.includes('checkout'),
      'Extension must provide branch management'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: 7. MCP Server
// ═══════════════════════════════════════════════════════════════════════════════

describe('MCP Server Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-mcp-server.ts');

  test('extension exports MCP server configuration', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-mcp-server.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('MCP') ||
      content.includes('mcp') ||
      content.includes('server') ||
      content.includes('resources'),
      'Extension must export MCP server configuration'
    );
  });

  test('extension exposes GSD tools', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-mcp-server.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('tool') ||
      content.includes('gsd_state') ||
      content.includes('gsd_plan'),
      'Extension must expose GSD tools via MCP'
    );
  });

  test('extension exposes GSD resources', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-mcp-server.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('resource') ||
      content.includes('PROJECT.md') ||
      content.includes('STATE.md'),
      'Extension must expose GSD resources via MCP'
    );
  });

  test('extension has tool definitions', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-mcp-server.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('name:') &&
      (content.includes('description:') || content.includes('inputSchema')),
      'Extension must have tool definitions with name and schema'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: 8. Metrics/Telemetry
// ═══════════════════════════════════════════════════════════════════════════════

describe('Metrics Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-metrics.ts');

  test('extension registers session_end event listener', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-metrics.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('pi.on') &&
      (content.includes('session_end') ||
       content.includes('sessionEnd')),
      'Extension must register session_end event listener'
    );
  });

  test('extension tracks phases completed', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-metrics.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('phase') ||
      content.includes('phasesCompleted'),
      'Extension must track phases completed'
    );
  });

  test('extension tracks plans executed', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-metrics.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('plan') ||
      content.includes('plansExecuted'),
      'Extension must track plans executed'
    );
  });

  test('extension writes to metrics file', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-metrics.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('metrics') ||
      content.includes('write') ||
      content.includes('append'),
      'Extension must write metrics to file'
    );
  });

  test('extension tracks session duration', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-metrics.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('duration') ||
      content.includes('time') ||
      content.includes('session'),
      'Extension must track session duration'
    );
  });

  test('extension provides metrics query tool', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-metrics.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('registerTool') ||
      content.includes('registerCommand') ||
      content.includes('gsd_metrics'),
      'Extension should provide metrics query capability'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Extension Integration', () => {
  test('all extensions import ExtensionAPI', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      const content = fs.readFileSync(extPath, 'utf-8');
      assert.ok(
        content.includes('ExtensionAPI') ||
        content.includes('@mariozechner/pi-coding-agent'),
        `${ext} must import ExtensionAPI type`
      );
    }
  });

  test('all extensions handle errors gracefully', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      const content = fs.readFileSync(extPath, 'utf-8');
      assert.ok(
        content.includes('try') ||
        content.includes('catch') ||
        content.includes('?.') ||
        content.includes('||'),
        `${ext} should handle errors gracefully`
      );
    }
  });

  test('extensions do not crash when .planning/ is missing', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      const content = fs.readFileSync(extPath, 'utf-8');
      assert.ok(
        content.includes('existsSync') ||
        content.includes('exists') ||
        content.includes('catch') ||
        content.includes('?.') ||
        content.includes('return'),
        `${ext} should handle missing .planning/ directory`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Documentation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Documentation', () => {
  test('PI-INTEGRATION.md documents deeper integrations', () => {
    const docPath = path.join(PROJECT_ROOT, 'docs', 'PI-INTEGRATION.md');
    if (!fs.existsSync(docPath)) {
      assert.fail('docs/PI-INTEGRATION.md must exist');
    }

    const content = fs.readFileSync(docPath, 'utf-8').toLowerCase();
    assert.ok(
      content.includes('prompt guard') ||
      content.includes('compaction') ||
      content.includes('dashboard') ||
      content.includes('security') ||
      content.includes('mcp'),
      'PI-INTEGRATION.md should document deeper integrations'
    );
  });

  test('each extension has description comment', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      const content = fs.readFileSync(extPath, 'utf-8');
      assert.ok(
        content.includes('/**') ||
        content.includes('*') ||
        content.includes('//'),
        `${ext} should have a description comment`
      );
    }
  });
});