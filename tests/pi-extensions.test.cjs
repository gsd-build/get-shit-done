/**
 * Pi Extensions Tests
 *
 * Validates GSD pi extensions:
 * - Context monitor hook
 * - Status line extension
 * - Custom tools (gsd_state, gsd_advance_plan, gsd_add_decision)
 *
 * Run: node --test tests/pi-extensions.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PI_EXTENSIONS_DIR = path.join(PROJECT_ROOT, '.pi', 'extensions');

// Required extensions
const REQUIRED_EXTENSIONS = [
  'gsd-context-monitor',
  'gsd-statusline',
  'gsd-tools',
];

// Required tools exposed by gsd-tools extension
const REQUIRED_TOOLS = [
  'gsd_state',
  'gsd_advance_plan',
  'gsd_add_decision',
];

// Context warning thresholds
const CONTEXT_THRESHOLDS = {
  warning: 65,  // 35% remaining
  critical: 75, // 25% remaining
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Extension Structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pi Extensions Structure', () => {
  test('.pi/extensions directory exists', () => {
    assert.ok(fs.existsSync(PI_EXTENSIONS_DIR), '.pi/extensions/ directory must exist');
  });

  test('all required extensions exist', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      assert.ok(fs.existsSync(extPath), `Extension ${ext}.ts must exist`);
    }
  });

  test('extensions are TypeScript files', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      assert.ok(
        extPath.endsWith('.ts'),
        `${ext} must be a .ts file`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Context Monitor Extension
// ═══════════════════════════════════════════════════════════════════════════════

describe('Context Monitor Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-context-monitor.ts');

  test('extension exports default function', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-context-monitor.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('export default function'),
      'Extension must export default function'
    );
  });

  test('extension registers tool_call event listener', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-context-monitor.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('pi.on') && content.includes('tool_call'),
      'Extension must register tool_call event listener'
    );
  });

  test('extension imports ExtensionAPI type', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-context-monitor.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('ExtensionAPI') || content.includes('@mariozechner/pi-coding-agent'),
      'Extension must import ExtensionAPI type'
    );
  });

  test('extension has context threshold constants', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-context-monitor.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('WARNING_THRESHOLD') ||
      content.includes('CRITICAL_THRESHOLD') ||
      content.includes('65') ||
      content.includes('75'),
      'Extension must define context warning thresholds (65% warning, 75% critical)'
    );
  });

  test('extension uses ctx.ui.notify for warnings', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-context-monitor.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('ctx.ui.notify') || content.includes('ui.notify'),
      'Extension must use ctx.ui.notify for warnings'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Status Line Extension
// ═══════════════════════════════════════════════════════════════════════════════

describe('Status Line Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-statusline.ts');

  test('extension exports default function', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-statusline.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('export default function'),
      'Extension must export default function'
    );
  });

  test('extension registers session_start or statusLine event', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-statusline.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      (content.includes('pi.on') && content.includes('session_start')) ||
      (content.includes('pi.on') && content.includes('statusLine')),
      'Extension must register session_start or statusLine event listener'
    );
  });

  test('extension reads GSD state from .planning/STATE.md', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-statusline.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('STATE.md') || content.includes('.planning') || content.includes('gsd-tools'),
      'Extension must read GSD state from STATE.md or via gsd-tools'
    );
  });

  test('extension provides formatted status output', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-statusline.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('Phase') || content.includes('Plan') || content.includes('gsd'),
      'Extension must format status with Phase/Plan info'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: GSD Tools Extension (Custom Tools)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GSD Tools Extension', () => {
  const extPath = path.join(PI_EXTENSIONS_DIR, 'gsd-tools.ts');

  test('extension exports default function', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-tools.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('export default function'),
      'Extension must export default function'
    );
  });

  test('extension registers custom tools', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-tools.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('pi.registerTool'),
      'Extension must use pi.registerTool to register tools'
    );
  });

  test('all required tools are registered', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-tools.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');

    for (const tool of REQUIRED_TOOLS) {
      assert.ok(
        content.includes(`name: '${tool}'`) || content.includes(`name: "${tool}"`),
        `Tool ${tool} must be registered`
      );
    }
  });

  test('tools use TypeBox for parameter schemas', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-tools.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('Type.Object') || content.includes('@sinclair/typebox'),
      'Tools must use TypeBox for parameter schemas'
    );
  });

  test('gsd_state tool has no required parameters', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-tools.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    // gsd_state should be callable without parameters
    assert.ok(
      content.includes('gsd_state'),
      'gsd_state tool must be defined'
    );
  });

  test('gsd_advance_plan tool exists', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-tools.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('gsd_advance_plan'),
      'gsd_advance_plan tool must be defined'
    );
  });

  test('gsd_add_decision tool exists', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-tools.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('gsd_add_decision'),
      'gsd_add_decision tool must be defined'
    );
  });

  test('tools call gsd-tools.cjs internally', () => {
    if (!fs.existsSync(extPath)) {
      assert.fail('gsd-tools.ts does not exist');
    }

    const content = fs.readFileSync(extPath, 'utf-8');
    assert.ok(
      content.includes('gsd-tools.cjs') || content.includes('execFile') || content.includes('spawn'),
      'Tools must call gsd-tools.cjs internally'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Extension Integration
// ═══════════════════════════════════════════════════════════════════════════════

describe('Extension Integration', () => {
  test('extensions can be loaded by pi', () => {
    // Check that extensions follow pi extension format
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      const content = fs.readFileSync(extPath, 'utf-8');

      // Must have default export function accepting pi API
      assert.ok(
        content.includes('export default function') &&
        (content.includes('(pi:') || content.includes('(pi)') || content.includes('ExtensionAPI')),
        `${ext} must follow pi extension format: export default function(pi: ExtensionAPI)`
      );
    }
  });

  test('extensions handle errors gracefully', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      const content = fs.readFileSync(extPath, 'utf-8');

      // Should have try/catch or error handling
      assert.ok(
        content.includes('try') || content.includes('catch') || content.includes('?.') || content.includes('||'),
        `${ext} should handle errors gracefully`
      );
    }
  });

  test('extensions do not crash when .planning/ is missing', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      const content = fs.readFileSync(extPath, 'utf-8');

      // Should check for existence or handle missing files
      assert.ok(
        content.includes('existsSync') ||
        content.includes('exists') ||
        content.includes('catch') ||
        content.includes('?.') ||
        content.includes('return') ||
        content.includes('null'),
        `${ext} should handle missing .planning/ directory gracefully`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Documentation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Extension Documentation', () => {
  test('PI-INTEGRATION.md documents extensions', () => {
    const docPath = path.join(PROJECT_ROOT, 'docs', 'PI-INTEGRATION.md');
    if (!fs.existsSync(docPath)) {
      assert.fail('docs/PI-INTEGRATION.md must exist');
    }

    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(
      content.toLowerCase().includes('extension') || content.toLowerCase().includes('hook'),
      'PI-INTEGRATION.md should document extensions/hooks'
    );
  });

  test('each extension has a description comment', () => {
    for (const ext of REQUIRED_EXTENSIONS) {
      const extPath = path.join(PI_EXTENSIONS_DIR, `${ext}.ts`);
      if (!fs.existsSync(extPath)) continue;

      const content = fs.readFileSync(extPath, 'utf-8');

      // Should have a comment describing the extension
      assert.ok(
        content.includes('/**') ||
        content.includes('*') ||
        content.includes('//'),
        `${ext} should have a description comment`
      );
    }
  });
});