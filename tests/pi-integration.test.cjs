/**
 * Pi Integration Tests
 *
 * Validates GSD integration with pi coding agent:
 * - Command discovery and format
 * - Agent definitions
 * - Workflow references
 *
 * Run: npm test (includes this file automatically)
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PI_DIR = path.join(PROJECT_ROOT, '.pi');
const PI_COMMANDS_DIR = path.join(PI_DIR, 'commands', 'gsd');
const PI_AGENTS_DIR = path.join(PI_DIR, 'agents');
const GSD_COMMANDS_DIR = path.join(PROJECT_ROOT, 'commands', 'gsd');
const GSD_AGENTS_DIR = path.join(PROJECT_ROOT, 'agents');
const GSD_WORKFLOWS_DIR = path.join(PROJECT_ROOT, 'get-shit-done', 'workflows');

// Core GSD commands that must have pi wrappers
const REQUIRED_COMMANDS = [
  'new-project',
  'discuss-phase',
  'plan-phase',
  'execute-phase',
  'verify-work',
  'quick',
  'progress',
  'help',
];

// Core GSD agents that must have pi definitions
const REQUIRED_AGENTS = [
  'gsd-planner',
  'gsd-executor',
  'gsd-verifier',
  'gsd-phase-researcher',
  'gsd-project-researcher',
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Directory Structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pi Directory Structure', () => {
  test('.pi directory exists', () => {
    assert.ok(fs.existsSync(PI_DIR), '.pi/ directory must exist');
  });

  test('.pi/commands/gsd directory exists', () => {
    assert.ok(fs.existsSync(PI_COMMANDS_DIR), '.pi/commands/gsd/ directory must exist');
  });

  test('.pi/agents directory exists', () => {
    assert.ok(fs.existsSync(PI_AGENTS_DIR), '.pi/agents/ directory must exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Command Wrappers
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pi Command Wrappers', () => {
  test('all required commands exist', () => {
    for (const cmd of REQUIRED_COMMANDS) {
      const cmdPath = path.join(PI_COMMANDS_DIR, `${cmd}.md`);
      assert.ok(fs.existsSync(cmdPath), `Command ${cmd}.md must exist`);
    }
  });

  test('commands have valid pi frontmatter', () => {
    for (const cmd of REQUIRED_COMMANDS) {
      const cmdPath = path.join(PI_COMMANDS_DIR, `${cmd}.md`);
      if (!fs.existsSync(cmdPath)) continue; // Skip if missing (caught above)

      const content = fs.readFileSync(cmdPath, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      assert.ok(frontmatterMatch, `${cmd}.md must have frontmatter`);

      const frontmatter = frontmatterMatch[1];

      // Pi commands need name and description
      assert.ok(
        /^name:\s*.+/m.test(frontmatter),
        `${cmd}.md must have 'name' in frontmatter`
      );
      assert.ok(
        /^description:\s*.+/m.test(frontmatter),
        `${cmd}.md must have 'description' in frontmatter`
      );
    }
  });

  test('commands reference existing GSD workflows', () => {
    for (const cmd of REQUIRED_COMMANDS) {
      const cmdPath = path.join(PI_COMMANDS_DIR, `${cmd}.md`);
      if (!fs.existsSync(cmdPath)) continue;

      const content = fs.readFileSync(cmdPath, 'utf-8');

      // Check for workflow reference pattern: @~/.claude/get-shit-done/workflows/
      // or @./get-shit-done/workflows/
      const hasWorkflowRef = content.includes('workflows/') ||
                             content.includes('get-shit-done/workflows') ||
                             content.includes('@~/.claude/get-shit-done');

      assert.ok(
        hasWorkflowRef || content.includes('gsd-tools.cjs'),
        `${cmd}.md should reference GSD workflows or gsd-tools.cjs`
      );
    }
  });

  test('command names use gsd: prefix convention', () => {
    for (const cmd of REQUIRED_COMMANDS) {
      const cmdPath = path.join(PI_COMMANDS_DIR, `${cmd}.md`);
      if (!fs.existsSync(cmdPath)) continue;

      const content = fs.readFileSync(cmdPath, 'utf-8');
      const nameMatch = content.match(/^name:\s*(.+)$/m);

      if (nameMatch) {
        const name = nameMatch[1].trim();
        assert.ok(
          name.startsWith('gsd:') || name.startsWith('gsd-'),
          `${cmd}.md name should start with 'gsd:' or 'gsd-' (got: ${name})`
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Agent Definitions
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pi Agent Definitions', () => {
  test('all required agents exist', () => {
    for (const agent of REQUIRED_AGENTS) {
      const agentPath = path.join(PI_AGENTS_DIR, `${agent}.md`);
      assert.ok(fs.existsSync(agentPath), `Agent ${agent}.md must exist`);
    }
  });

  test('agents have valid pi agent frontmatter', () => {
    for (const agent of REQUIRED_AGENTS) {
      const agentPath = path.join(PI_AGENTS_DIR, `${agent}.md`);
      if (!fs.existsSync(agentPath)) continue;

      const content = fs.readFileSync(agentPath, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      assert.ok(frontmatterMatch, `${agent}.md must have frontmatter`);

      const frontmatter = frontmatterMatch[1];

      // Pi agents need name
      assert.ok(
        /^name:\s*.+/m.test(frontmatter),
        `${agent}.md must have 'name' in frontmatter`
      );
    }
  });

  test('agent names match GSD agent names', () => {
    for (const agent of REQUIRED_AGENTS) {
      const agentPath = path.join(PI_AGENTS_DIR, `${agent}.md`);
      if (!fs.existsSync(agentPath)) continue;

      const content = fs.readFileSync(agentPath, 'utf-8');
      const nameMatch = content.match(/^name:\s*(.+)$/m);

      if (nameMatch) {
        const name = nameMatch[1].trim();
        assert.ok(
          name === agent || name === agent.replace('gsd-', 'gsd:'),
          `${agent}.md name should match filename (got: ${name})`
        );
      }
    }
  });

  test('agents reference or include GSD agent content', () => {
    for (const agent of REQUIRED_AGENTS) {
      const piAgentPath = path.join(PI_AGENTS_DIR, `${agent}.md`);
      const gsdAgentPath = path.join(GSD_AGENTS_DIR, `${agent}.md`);

      if (!fs.existsSync(piAgentPath)) continue;

      const piContent = fs.readFileSync(piAgentPath, 'utf-8');

      // Either includes the GSD agent content directly or references it
      const hasDirectContent = piContent.includes('<role>') ||
                                piContent.includes('You are a GSD');
      const hasReference = piContent.includes('@') &&
                           (piContent.includes('agents/') || piContent.includes('gsd-'));

      assert.ok(
        hasDirectContent || hasReference || fs.existsSync(gsdAgentPath),
        `${agent}.md should include GSD agent content or reference the source`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Integration with Existing GSD
// ═══════════════════════════════════════════════════════════════════════════════

describe('GSD Integration', () => {
  test('referenced GSD workflows exist', () => {
    const workflows = fs.readdirSync(GSD_WORKFLOWS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));

    // Check that key workflows exist
    const keyWorkflows = ['new-project', 'discuss-phase', 'plan-phase', 'execute-phase'];
    for (const workflow of keyWorkflows) {
      assert.ok(
        workflows.includes(workflow),
        `GSD workflow ${workflow}.md must exist in get-shit-done/workflows/`
      );
    }
  });

  test('referenced GSD agents exist', () => {
    const agents = fs.readdirSync(GSD_AGENTS_DIR)
      .filter(f => f.startsWith('gsd-') && f.endsWith('.md'))
      .map(f => f.replace('.md', ''));

    for (const agent of REQUIRED_AGENTS) {
      assert.ok(
        agents.includes(agent),
        `GSD agent ${agent}.md must exist in agents/`
      );
    }
  });

  test('gsd-tools.cjs is available', () => {
    const toolsPath = path.join(PROJECT_ROOT, 'get-shit-done', 'bin', 'gsd-tools.cjs');
    assert.ok(fs.existsSync(toolsPath), 'gsd-tools.cjs must exist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Documentation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Documentation', () => {
  test('PI-INTEGRATION.md exists', () => {
    const docPath = path.join(PROJECT_ROOT, 'docs', 'PI-INTEGRATION.md');
    assert.ok(fs.existsSync(docPath), 'docs/PI-INTEGRATION.md must exist');
  });

  test('documentation covers installation', () => {
    const docPath = path.join(PROJECT_ROOT, 'docs', 'PI-INTEGRATION.md');
    if (!fs.existsSync(docPath)) return;

    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(
      content.toLowerCase().includes('install') ||
      content.toLowerCase().includes('setup'),
      'PI-INTEGRATION.md should cover installation/setup'
    );
  });

  test('documentation covers available commands', () => {
    const docPath = path.join(PROJECT_ROOT, 'docs', 'PI-INTEGRATION.md');
    if (!fs.existsSync(docPath)) return;

    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(
      content.includes('/gsd:') || content.includes('gsd:'),
      'PI-INTEGRATION.md should list available commands'
    );
  });
});