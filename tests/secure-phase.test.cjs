// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Secure-Phase Tests
 *
 * Validates the security-first enforcement layer:
 * - gsd-security-auditor agent frontmatter and structure
 * - secure-phase command file
 * - secure-phase workflow file
 * - SECURITY.md template
 * - config.json security defaults
 * - VALIDATION.md security columns
 * - Threat-model-anchored behaviour (structural)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const AGENTS_DIR = path.join(REPO_ROOT, 'agents');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands', 'gsd');
const WORKFLOWS_DIR = path.join(REPO_ROOT, 'get-shit-done', 'workflows');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'get-shit-done', 'templates');

// ─── 1. Agent frontmatter — gsd-security-auditor.md ─────────────────────────

describe('SECURE: gsd-security-auditor agent', () => {
  const agentPath = path.join(AGENTS_DIR, 'gsd-security-auditor.md');

  test('agent file exists', () => {
    assert.ok(
      fs.existsSync(agentPath),
      'gsd-security-auditor.md must exist in agents/'
    );
  });

  test('has valid frontmatter with name, description, tools, color', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(frontmatter.includes('name:'), 'missing name:');
    assert.ok(frontmatter.includes('description:'), 'missing description:');
    assert.ok(frontmatter.includes('tools:'), 'missing tools:');
    assert.ok(frontmatter.includes('color:'), 'missing color:');
  });

  test('name is gsd-security-auditor', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('name: gsd-security-auditor'),
      'name must be gsd-security-auditor'
    );
  });

  test('tools include Read, Write, Bash, Glob, Grep', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    const requiredTools = ['Read', 'Write', 'Bash', 'Glob', 'Grep'];
    for (const tool of requiredTools) {
      assert.ok(
        content.includes(`- ${tool}`),
        `tools must include ${tool}`
      );
    }
  });

  test('has <role> section', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('<role>'), 'must have <role> section');
    assert.ok(content.includes('</role>'), 'must close <role> section');
  });

  test('has <execution_flow> section', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('<execution_flow>'), 'must have <execution_flow> section');
    assert.ok(content.includes('</execution_flow>'), 'must close <execution_flow> section');
  });

  test('has <structured_returns> with SECURED, OPEN_THREATS, ESCALATE', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('<structured_returns>'), 'must have <structured_returns> section');
    assert.ok(content.includes('## SECURED'), 'must have SECURED return type');
    assert.ok(content.includes('## OPEN_THREATS'), 'must have OPEN_THREATS return type');
    assert.ok(content.includes('## ESCALATE'), 'must have ESCALATE return type');
  });

  test('has <success_criteria> section', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('<success_criteria>'), 'must have <success_criteria> section');
    assert.ok(content.includes('</success_criteria>'), 'must close <success_criteria> section');
  });

  test('has READ-ONLY rule — does NOT modify implementation files', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(
      content.includes('READ-ONLY'),
      'must contain READ-ONLY rule for implementation files'
    );
  });
});

// ─── 2. Command file — secure-phase.md ──────────────────────────────────────

describe('SECURE: secure-phase command file', () => {
  const cmdPath = path.join(COMMANDS_DIR, 'secure-phase.md');

  test('command file exists', () => {
    assert.ok(
      fs.existsSync(cmdPath),
      'secure-phase.md must exist in commands/gsd/'
    );
  });

  test('has valid frontmatter with name gsd:secure-phase', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('name: gsd:secure-phase'),
      'name must be gsd:secure-phase'
    );
  });

  test('has allowed-tools list', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('allowed-tools:'),
      'must have allowed-tools in frontmatter'
    );
  });

  test('contains reference to secure-phase.md workflow', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    assert.ok(
      content.includes('secure-phase.md'),
      'must reference secure-phase.md workflow'
    );
  });

  test('has <objective> section mentioning states A, B, C', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    assert.ok(content.includes('<objective>'), 'must have <objective> section');
    assert.ok(content.includes('(A)'), 'must mention state A');
    assert.ok(content.includes('(B)'), 'must mention state B');
    assert.ok(content.includes('(C)'), 'must mention state C');
  });
});

// ─── 3. Workflow file — secure-phase.md ─────────────────────────────────────

describe('SECURE: secure-phase workflow file', () => {
  const wfPath = path.join(WORKFLOWS_DIR, 'secure-phase.md');

  test('workflow file exists', () => {
    assert.ok(
      fs.existsSync(wfPath),
      'secure-phase.md must exist in get-shit-done/workflows/'
    );
  });

  test('contains gsd-security-auditor reference', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('gsd-security-auditor'),
      'must reference gsd-security-auditor agent'
    );
  });

  test('contains threats_open enforcement logic', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('threats_open'),
      'must contain threats_open enforcement logic'
    );
  });

  test('contains security_enforcement config check', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('security_enforcement'),
      'must check security_enforcement config setting'
    );
  });

  test('contains SECURITY.md template reference', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('SECURITY.md'),
      'must reference SECURITY.md template'
    );
  });

  test('has success_criteria section', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('<success_criteria>'),
      'must have <success_criteria> section'
    );
    assert.ok(
      content.includes('</success_criteria>'),
      'must close <success_criteria> section'
    );
  });
});

// ─── 4. SECURITY.md template ────────────────────────────────────────────────

describe('SECURE: SECURITY.md template', () => {
  const tplPath = path.join(TEMPLATES_DIR, 'SECURITY.md');

  test('template exists', () => {
    assert.ok(
      fs.existsSync(tplPath),
      'SECURITY.md must exist in get-shit-done/templates/'
    );
  });

  test('has YAML frontmatter with required fields', () => {
    const content = fs.readFileSync(tplPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    const requiredFields = ['phase', 'slug', 'status', 'threats_open', 'asvs_level', 'created'];
    for (const field of requiredFields) {
      assert.ok(
        frontmatter.includes(`${field}:`),
        `frontmatter must have ${field}: field`
      );
    }
  });

  test('has ## Trust Boundaries section', () => {
    const content = fs.readFileSync(tplPath, 'utf-8');
    assert.ok(
      content.includes('## Trust Boundaries'),
      'must have ## Trust Boundaries section'
    );
  });

  test('has ## Threat Register table with required columns', () => {
    const content = fs.readFileSync(tplPath, 'utf-8');
    assert.ok(content.includes('## Threat Register'), 'must have ## Threat Register section');
    const requiredColumns = ['Threat ID', 'Category', 'Component', 'Disposition', 'Mitigation', 'Status'];
    for (const col of requiredColumns) {
      assert.ok(
        content.includes(col),
        `Threat Register table must have ${col} column`
      );
    }
  });

  test('has ## Accepted Risks Log section', () => {
    const content = fs.readFileSync(tplPath, 'utf-8');
    assert.ok(
      content.includes('## Accepted Risks Log'),
      'must have ## Accepted Risks Log section'
    );
  });

  test('has ## Security Audit Trail section', () => {
    const content = fs.readFileSync(tplPath, 'utf-8');
    assert.ok(
      content.includes('## Security Audit Trail'),
      'must have ## Security Audit Trail section'
    );
  });

  test('has sign-off checklist', () => {
    const content = fs.readFileSync(tplPath, 'utf-8');
    assert.ok(
      content.includes('## Sign-Off'),
      'must have ## Sign-Off section'
    );
    assert.ok(
      content.includes('- [ ]'),
      'sign-off must have checklist items'
    );
  });

  test('threats_open field is present (terminal condition field)', () => {
    const content = fs.readFileSync(tplPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('threats_open:'),
      'threats_open must be present in frontmatter as terminal condition field'
    );
  });
});

// ─── 5. Config defaults ─────────────────────────────────────────────────────

describe('SECURE: config.json security defaults', () => {
  const configPath = path.join(TEMPLATES_DIR, 'config.json');

  test('config template exists', () => {
    assert.ok(
      fs.existsSync(configPath),
      'config.json must exist in get-shit-done/templates/'
    );
  });

  test('has workflow.security_enforcement set to true', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(
      config.workflow.security_enforcement,
      true,
      'security_enforcement must default to true'
    );
  });

  test('has workflow.security_asvs_level set to 1', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(
      config.workflow.security_asvs_level,
      1,
      'security_asvs_level must default to 1'
    );
  });

  test('has workflow.security_block_on set to "high"', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(
      config.workflow.security_block_on,
      'high',
      'security_block_on must default to "high"'
    );
  });

  test('security_enforcement appears after nyquist_validation (opt-out pattern parity)', () => {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const nyquistPos = raw.indexOf('nyquist_validation');
    const securityPos = raw.indexOf('security_enforcement');
    assert.ok(nyquistPos > -1, 'nyquist_validation must exist in config');
    assert.ok(securityPos > -1, 'security_enforcement must exist in config');
    assert.ok(
      securityPos > nyquistPos,
      'security_enforcement must appear after nyquist_validation for opt-out pattern parity'
    );
  });
});

// ─── 6. VALIDATION.md template security columns ────────────────────────────

describe('SECURE: VALIDATION.md security columns', () => {
  const valPath = path.join(TEMPLATES_DIR, 'VALIDATION.md');

  test('VALIDATION.md template exists', () => {
    assert.ok(
      fs.existsSync(valPath),
      'VALIDATION.md must exist in get-shit-done/templates/'
    );
  });

  test('contains Threat Ref column header', () => {
    const content = fs.readFileSync(valPath, 'utf-8');
    assert.ok(
      content.includes('Threat Ref'),
      'must have Threat Ref column in Per-Task Verification Map'
    );
  });

  test('contains Secure Behavior column header', () => {
    const content = fs.readFileSync(valPath, 'utf-8');
    assert.ok(
      content.includes('Secure Behavior'),
      'must have Secure Behavior column in Per-Task Verification Map'
    );
  });

  test('both columns appear in the Per-Task Verification Map table', () => {
    const content = fs.readFileSync(valPath, 'utf-8');
    // Find the table header row containing both columns
    const lines = content.split('\n');
    const headerLine = lines.find(
      line => line.includes('Threat Ref') && line.includes('Secure Behavior')
    );
    assert.ok(
      headerLine,
      'Threat Ref and Secure Behavior must appear in the same table header row'
    );
    // Verify this is in the Per-Task Verification Map section
    const mapIdx = content.indexOf('## Per-Task Verification Map');
    const threatRefIdx = content.indexOf('Threat Ref');
    assert.ok(mapIdx > -1, 'must have Per-Task Verification Map section');
    assert.ok(
      threatRefIdx > mapIdx,
      'Threat Ref column must appear after Per-Task Verification Map heading'
    );
  });
});

// ─── 7. Threat-model-anchored behaviour (structural) ────────────────────────

describe('SECURE: threat-model-anchored behaviour', () => {
  const agentPath = path.join(AGENTS_DIR, 'gsd-security-auditor.md');
  const wfPath = path.join(WORKFLOWS_DIR, 'secure-phase.md');

  test('agent does NOT contain "scan for vulnerabilities" (verifies, not scans)', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(
      !content.toLowerCase().includes('scan for vulnerabilities'),
      'agent must NOT scan for vulnerabilities — it verifies threat mitigations'
    );
  });

  test('agent does NOT contain "find vulnerabilities" (verifies, not scans)', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(
      !content.toLowerCase().includes('find vulnerabilities'),
      'agent must NOT find vulnerabilities — it verifies threat mitigations'
    );
  });

  test('agent contains mitigate, accept, transfer disposition types', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('mitigate'), 'must contain mitigate disposition');
    assert.ok(content.includes('accept'), 'must contain accept disposition');
    assert.ok(content.includes('transfer'), 'must contain transfer disposition');
  });

  test('agent contains OPEN and CLOSED status values', () => {
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('OPEN'), 'must contain OPEN status');
    assert.ok(content.includes('CLOSED'), 'must contain CLOSED status');
  });

  test('workflow contains enforcing gate (threats_open + block pattern)', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('threats_open'),
      'workflow must reference threats_open for enforcement'
    );
    assert.ok(
      content.includes('BLOCKED') || content.includes('blocked'),
      'workflow must contain a blocking pattern when threats are open'
    );
    // Verify it does NOT emit next-phase routing when blocked
    assert.ok(
      content.includes('Do NOT emit next-phase routing'),
      'workflow must explicitly prevent next-phase routing when blocked'
    );
  });
});
