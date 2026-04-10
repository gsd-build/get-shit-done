/**
 * GSD AI Evals Framework Tests
 *
 * Validates the /gsd-ai-integration-phase + /gsd-eval-review contribution:
 * - workflow.ai_integration_phase key in config defaults and config-set/get
 * - W016 validate-health warning when ai_integration_phase absent
 * - addAiIntegrationPhaseKey repair action
 * - AI-SPEC.md template section completeness
 * - New agent frontmatter (picked up by agent-frontmatter.test.cjs — covered there)
 * - plan-phase.md Step 4.5 AI-keyword nudge block
 * - ai-integration-phase and eval-review command frontmatter
 * - ai-evals.md and ai-frameworks.md reference files exist and are non-empty
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const REPO_ROOT      = path.join(__dirname, '..');
const AGENTS_DIR     = path.join(REPO_ROOT, 'agents');
const COMMANDS_DIR   = path.join(REPO_ROOT, 'commands', 'gsd');
const WORKFLOWS_DIR  = path.join(REPO_ROOT, 'get-shit-done', 'workflows');
const TEMPLATES_DIR  = path.join(REPO_ROOT, 'get-shit-done', 'templates');
const REFERENCES_DIR = path.join(REPO_ROOT, 'get-shit-done', 'references');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readConfig(tmpDir) {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
}

function writeConfig(tmpDir, obj) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify(obj, null, 2),
    'utf-8'
  );
}

function writeMinimalHealth(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'),
    '# Project\n\n## What This Is\n\nFoo.\n\n## Core Value\n\nBar.\n\n## Requirements\n\nBaz.\n');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
    '# Roadmap\n\n### Phase 1: Setup\n');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
    '# Session State\n\nPhase 1 in progress.\n');
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
}

// ─── Config: workflow.ai_integration_phase default ───────────────────────────────────────

describe('CONFIG: workflow.ai_integration_phase default', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('config-ensure-section includes workflow.ai_integration_phase as boolean', () => {
    const result = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.ok(config.workflow && typeof config.workflow === 'object', 'workflow should exist');
    assert.strictEqual(typeof config.workflow.ai_integration_phase, 'boolean', 'workflow.ai_integration_phase should be boolean');
  });

  test('workflow.ai_integration_phase defaults to true', () => {
    runGsdTools('config-ensure-section', tmpDir);
    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.ai_integration_phase, true, 'workflow.ai_integration_phase should default to true');
  });
});

// ─── Config: config-set / config-get workflow.ai_integration_phase ───────────────────────

describe('CONFIG: config-set / config-get workflow.ai_integration_phase', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    runGsdTools('config-ensure-section', tmpDir);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('config-set workflow.ai_integration_phase false persists as boolean false', () => {
    const result = runGsdTools('config-set workflow.ai_integration_phase false', tmpDir);
    assert.ok(result.success, `config-set failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.ai_integration_phase, false);
    assert.strictEqual(typeof config.workflow.ai_integration_phase, 'boolean');
  });

  test('config-set workflow.ai_integration_phase true persists as boolean true', () => {
    runGsdTools('config-set workflow.ai_integration_phase false', tmpDir);
    const result = runGsdTools('config-set workflow.ai_integration_phase true', tmpDir);
    assert.ok(result.success, `config-set failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.ai_integration_phase, true);
  });

  test('config-get workflow.ai_integration_phase returns the stored value', () => {
    runGsdTools('config-set workflow.ai_integration_phase false', tmpDir);
    const result = runGsdTools('config-get workflow.ai_integration_phase', tmpDir);
    assert.ok(result.success, `config-get failed: ${result.error}`);
    assert.strictEqual(JSON.parse(result.output), false);
  });
});

// ─── Validate Health: W016 ────────────────────────────────────────────────────

describe('HEALTH: W016 — workflow.ai_integration_phase absent', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('emits W016 when workflow.ai_integration_phase absent from config', () => {
    writeMinimalHealth(tmpDir);
    writeConfig(tmpDir, { model_profile: 'balanced', workflow: { research: true, nyquist_validation: true } });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W016'),
      `Expected W016 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('does not emit W016 when workflow.ai_integration_phase is explicitly set', () => {
    writeMinimalHealth(tmpDir);
    writeConfig(tmpDir, {
      model_profile: 'balanced',
      workflow: { research: true, nyquist_validation: true, ai_integration_phase: true },
    });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W016'),
      `Should not have W016: ${JSON.stringify(output.warnings)}`
    );
  });

  test('does not emit W016 when workflow.ai_integration_phase is false (explicit opt-out)', () => {
    writeMinimalHealth(tmpDir);
    writeConfig(tmpDir, {
      model_profile: 'balanced',
      workflow: { research: true, nyquist_validation: true, ai_integration_phase: false },
    });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W016'),
      `Should not have W016: ${JSON.stringify(output.warnings)}`
    );
  });
});

// ─── Validate Health --repair: addAiIntegrationPhaseKey ─────────────────────────────────

describe('HEALTH --repair: addAiIntegrationPhaseKey', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('adds workflow.ai_integration_phase via addAiIntegrationPhaseKey repair', () => {
    writeMinimalHealth(tmpDir);
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath,
      JSON.stringify({ model_profile: 'balanced', workflow: { research: true, nyquist_validation: true } }, null, 2)
    );

    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const addAction = output.repairs_performed.find(r => r.action === 'addAiIntegrationPhaseKey');
    assert.ok(addAction, `Expected addAiIntegrationPhaseKey action: ${JSON.stringify(output.repairs_performed)}`);
    assert.strictEqual(addAction.success, true);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.ai_integration_phase, true);
  });
});

// ─── AI-SPEC.md Template Structure ───────────────────────────────────────────

describe('TEMPLATE: AI-SPEC.md section completeness', () => {
  const templatePath = path.join(TEMPLATES_DIR, 'AI-SPEC.md');
  let content;

  test('AI-SPEC.md template exists', () => {
    assert.ok(fs.existsSync(templatePath), 'AI-SPEC.md template should exist');
    content = fs.readFileSync(templatePath, 'utf-8');
    assert.ok(content.length > 100, 'AI-SPEC.md should be non-empty');
  });

  const requiredSections = [
    ['## 1. System Classification',   'Section 1 (System Classification)'],
    ['## 1b. Domain Context',          'Section 1b (Domain Context)'],
    ['## 2. Framework Decision',       'Section 2 (Framework Decision)'],
    ['## 3. Framework Quick Reference','Section 3 (Framework Quick Reference)'],
    ['## 4. Implementation Guidance',  'Section 4 (Implementation Guidance)'],
    ['## 4b. AI Systems Best Practices','Section 4b (AI Systems Best Practices)'],
    ['## 5. Evaluation Strategy',      'Section 5 (Evaluation Strategy)'],
    ['## 6. Guardrails',               'Section 6 (Guardrails)'],
    ['## 7. Production Monitoring',    'Section 7 (Production Monitoring)'],
    ['## Checklist',                   'Checklist section'],
  ];

  for (const [heading, label] of requiredSections) {
    test(`template contains ${label}`, () => {
      const c = fs.readFileSync(templatePath, 'utf-8');
      assert.ok(c.includes(heading), `Template missing: ${heading}`);
    });
  }

  test('template checklist has at least 10 items', () => {
    const c = fs.readFileSync(templatePath, 'utf-8');
    const items = (c.match(/^- \[[ x]\]/gm) || []);
    assert.ok(items.length >= 10, `Expected ≥10 checklist items, found ${items.length}`);
  });

  test('template Section 1b has domain rubric table columns (Good/Bad/Stakes)', () => {
    const c = fs.readFileSync(templatePath, 'utf-8');
    assert.ok(c.includes('What Domain Experts Evaluate Against'), 'Missing domain rubric subsection');
  });

  test('template Section 4b has Pydantic structured outputs guidance', () => {
    const c = fs.readFileSync(templatePath, 'utf-8');
    assert.ok(c.includes('Pydantic'), 'Section 4b missing Pydantic guidance');
  });

  test('template Section 6 has online guardrails and offline flywheel tables', () => {
    const c = fs.readFileSync(templatePath, 'utf-8');
    assert.ok(c.includes('Online'), 'Section 6 missing Online guardrails');
    assert.ok(c.includes('Offline'), 'Section 6 missing Offline flywheel');
  });
});

// ─── Command Frontmatter ──────────────────────────────────────────────────────

describe('COMMAND: ai-integration-phase and eval-review frontmatter', () => {
  const commands = ['ai-integration-phase', 'eval-review'];

  for (const cmd of commands) {
    test(`${cmd}.md exists`, () => {
      const p = path.join(COMMANDS_DIR, `${cmd}.md`);
      assert.ok(fs.existsSync(p), `commands/gsd/${cmd}.md should exist`);
    });

    test(`${cmd}.md has name, description, argument-hint`, () => {
      const content = fs.readFileSync(path.join(COMMANDS_DIR, `${cmd}.md`), 'utf-8');
      const frontmatter = content.split('---')[1] || '';
      assert.ok(frontmatter.includes('name:'), `${cmd}.md missing name:`);
      assert.ok(frontmatter.includes('description:'), `${cmd}.md missing description:`);
      assert.ok(frontmatter.includes('argument-hint:'), `${cmd}.md missing argument-hint:`);
    });
  }

  test('ai-integration-phase.md name is gsd:ai-integration-phase', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'ai-integration-phase.md'), 'utf-8');
    assert.ok(content.includes('name: gsd:ai-integration-phase'), 'ai-integration-phase command name mismatch');
  });

  test('eval-review.md name is gsd:eval-review', () => {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, 'eval-review.md'), 'utf-8');
    assert.ok(content.includes('name: gsd:eval-review'), 'eval-review command name mismatch');
  });
});

// ─── New Agents Exist ─────────────────────────────────────────────────────────

describe('AGENTS: new AI-evals agents exist', () => {
  const newAgents = [
    'gsd-framework-selector',
    'gsd-ai-researcher',
    'gsd-domain-researcher',
    'gsd-eval-planner',
    'gsd-eval-auditor',
  ];

  for (const agent of newAgents) {
    test(`${agent}.md exists`, () => {
      assert.ok(
        fs.existsSync(path.join(AGENTS_DIR, `${agent}.md`)),
        `agents/${agent}.md should exist`
      );
    });
  }
});

// ─── Reference Files ──────────────────────────────────────────────────────────

describe('REFERENCES: ai-frameworks.md and ai-evals.md', () => {
  const refs = ['ai-frameworks.md', 'ai-evals.md'];

  for (const ref of refs) {
    test(`${ref} exists and is non-empty`, () => {
      const p = path.join(REFERENCES_DIR, ref);
      assert.ok(fs.existsSync(p), `references/${ref} should exist`);
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.length > 200, `references/${ref} should have substantial content`);
    });
  }

  test('ai-frameworks.md covers key frameworks', () => {
    const content = fs.readFileSync(path.join(REFERENCES_DIR, 'ai-frameworks.md'), 'utf-8');
    for (const fw of ['CrewAI', 'LlamaIndex', 'LangChain', 'LangGraph']) {
      assert.ok(content.includes(fw), `ai-frameworks.md should mention ${fw}`);
    }
  });

  test('ai-evals.md covers eval tooling defaults', () => {
    const content = fs.readFileSync(path.join(REFERENCES_DIR, 'ai-evals.md'), 'utf-8');
    assert.ok(content.includes('Arize Phoenix') || content.includes('Phoenix'), 'ai-evals.md should mention Arize Phoenix');
    assert.ok(content.includes('RAGAS'), 'ai-evals.md should mention RAGAS');
  });
});

// ─── Workflow: plan-phase Step 4.5 AI keyword nudge ──────────────────────────

describe('WORKFLOW: plan-phase.md AI nudge integration', () => {
  const planPhasePath = path.join(WORKFLOWS_DIR, 'plan-phase.md');

  test('plan-phase.md exists', () => {
    assert.ok(fs.existsSync(planPhasePath), 'workflows/plan-phase.md should exist');
  });

  test('plan-phase.md contains AI keyword detection for LLM/agent/RAG terms', () => {
    const content = fs.readFileSync(planPhasePath, 'utf-8');
    assert.ok(
      content.includes('agent') && content.includes('llm') || content.includes('rag') || content.includes('AI'),
      'plan-phase.md should contain AI keyword detection'
    );
  });

  test('plan-phase.md references /gsd-ai-integration-phase nudge', () => {
    const content = fs.readFileSync(planPhasePath, 'utf-8');
    assert.ok(
      content.includes('ai-integration-phase') || content.includes('ai_integration_phase'),
      'plan-phase.md should reference ai-integration-phase workflow'
    );
  });

  test('plan-phase.md references workflow.ai_integration_phase config toggle', () => {
    const content = fs.readFileSync(planPhasePath, 'utf-8');
    assert.ok(
      content.includes('ai_integration_phase'),
      'plan-phase.md should check workflow.ai_integration_phase config'
    );
  });
});

// ─── Workflow: ai-integration-phase and eval-review workflows exist ──────────────────────

describe('WORKFLOW: ai-integration-phase and eval-review workflow files', () => {
  const workflows = ['ai-integration-phase', 'eval-review'];

  for (const wf of workflows) {
    test(`${wf}.md workflow exists`, () => {
      assert.ok(
        fs.existsSync(path.join(WORKFLOWS_DIR, `${wf}.md`)),
        `workflows/${wf}.md should exist`
      );
    });
  }

  test('ai-integration-phase.md orchestrates 4 agents', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'ai-integration-phase.md'), 'utf-8');
    for (const agent of ['gsd-framework-selector', 'gsd-ai-researcher', 'gsd-domain-researcher', 'gsd-eval-planner']) {
      assert.ok(content.includes(agent), `ai-integration-phase.md should reference ${agent}`);
    }
  });

  test('eval-review.md references gsd-eval-auditor', () => {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'eval-review.md'), 'utf-8');
    assert.ok(content.includes('gsd-eval-auditor'), 'eval-review.md should reference gsd-eval-auditor');
  });

  test('select-framework.md does NOT exist (removed per design)', () => {
    assert.ok(
      !fs.existsSync(path.join(WORKFLOWS_DIR, 'select-framework.md')),
      'select-framework.md should not exist — removed in favour of ai-integration-phase nudge'
    );
  });
});
