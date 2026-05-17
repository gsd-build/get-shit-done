/**
 * Regression tests for issue #3167: configurable /gsd-ship PR body sections.
 */

// allow-test-rule: source-text-is-the-product
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test, afterEach } = require('node:test');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const repoRoot = path.resolve(__dirname, '..');
const tmpDirs = [];

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function makeProject() {
  const tmpDir = createTempProject('gsd-3167-');
  tmpDirs.push(tmpDir);
  return tmpDir;
}

afterEach(() => {
  while (tmpDirs.length) {
    cleanup(tmpDirs.pop());
  }
});

describe('ship.pr_body_sections config (#3167)', () => {
  test('CLI config-set accepts additional PR body section arrays', () => {
    const cwd = makeProject();
    const value = JSON.stringify([
      {
        heading: 'Risks & Rollback',
        enabled: true,
        source: 'PLAN.md ## Risks || PLAN.md ## Rollback',
        fallback: '- Rollback: revert this PR.',
      },
      {
        heading: 'Stakeholder Sign-off',
        enabled: false,
        template: '- Product owner: pending',
      },
    ]);

    const result = runGsdTools(['config-set', 'ship.pr_body_sections', value, '--raw'], cwd, { HOME: cwd });

    assert.equal(result.success, true, result.error);
    const config = JSON.parse(fs.readFileSync(path.join(cwd, '.planning', 'config.json'), 'utf8'));
    assert.deepEqual(config.ship.pr_body_sections, [
      {
        heading: 'Risks & Rollback',
        enabled: true,
        source: 'PLAN.md ## Risks || PLAN.md ## Rollback',
        fallback: '- Rollback: revert this PR.',
      },
      {
        heading: 'Stakeholder Sign-off',
        enabled: false,
        template: '- Product owner: pending',
      },
    ]);
  });

  test('CLI config-set rejects malformed PR body section values before writing config', () => {
    const cwd = makeProject();

    const notArray = runGsdTools(
      ['config-set', 'ship.pr_body_sections', JSON.stringify({ heading: 'Not an array' }), '--raw'],
      cwd,
      { HOME: cwd }
    );
    assert.equal(notArray.success, false);
    assert.match(notArray.error, /ship\.pr_body_sections.*JSON array/);

    const missingHeading = runGsdTools(
      ['config-set', 'ship.pr_body_sections', JSON.stringify([{ fallback: '- Missing heading' }]), '--raw'],
      cwd,
      { HOME: cwd }
    );
    assert.equal(missingHeading.success, false);
    assert.match(missingHeading.error, /heading/);

    const invalidEnabled = runGsdTools(
      ['config-set', 'ship.pr_body_sections', JSON.stringify([{ heading: 'Toggle', enabled: 'yes', fallback: '- item' }]), '--raw'],
      cwd,
      { HOME: cwd }
    );
    assert.equal(invalidEnabled.success, false);
    assert.match(invalidEnabled.error, /enabled/);

    assert.equal(fs.existsSync(path.join(cwd, '.planning', 'config.json')), false);
  });

  test('CLI config-new-project validates onboarded PR body sections before writing config', () => {
    const cwd = makeProject();
    const choices = JSON.stringify({
      ship: {
        pr_body_sections: [
          {
            heading: 'Invalid source',
            source: 'package.json ## Scripts',
          },
        ],
      },
    });

    const result = runGsdTools(['config-new-project', choices], cwd, { HOME: cwd });

    assert.equal(result.success, false);
    assert.match(result.error, /source must use selectors/);
    assert.equal(fs.existsSync(path.join(cwd, '.planning', 'config.json')), false);
  });

  test('ship workflow composes configured sections as append-only extensions', () => {
    const workflow = readRepoFile('get-shit-done/workflows/ship.md');

    assert.match(workflow, /config-get ship\.pr_body_sections --default '\[\]'/);
    assert.match(workflow, /append-only/i);
    assert.match(workflow, /enabled.*false/i);
    assert.match(workflow, /cannot replace/i);
    assert.match(workflow, /Summary[\s\S]*Changes[\s\S]*Requirements Addressed[\s\S]*Verification[\s\S]*Key Decisions/);
    assert.match(workflow, /\{phase_number\}[\s\S]*\{phase_name\}[\s\S]*\{phase_dir\}[\s\S]*\{base_branch\}[\s\S]*\{padded_phase\}/);
    assert.match(workflow, /User Stories & Acceptance Criteria/);
    assert.match(workflow, /Definition of Done/);
    assert.match(workflow, /--body-file/);
    assert.match(workflow, /trap 'rm -f "\$\{PR_BODY_FILE:-\}"' EXIT/);
  });

  test('default config and documentation describe ship.pr_body_sections', () => {
    const template = JSON.parse(readRepoFile('get-shit-done/templates/config.json'));
    assert.deepEqual(template.ship.pr_body_sections, []);

    const docs = readRepoFile('docs/CONFIGURATION.md');
    assert.match(docs, /`ship\.pr_body_sections`/);
    assert.match(docs, /additional PR body sections/i);
    assert.match(docs, /append-only/i);
    assert.match(docs, /lean\/agile PRD/i);
    assert.match(docs, /Definition of Done/);

    const planningConfig = readRepoFile('get-shit-done/references/planning-config.md');
    assert.match(planningConfig, /ship\.pr_body_sections/);
  });

  test('new-project onboarding can seed enabled or disabled PR body sections', () => {
    const workflow = readRepoFile('get-shit-done/workflows/new-project.md');

    assert.match(workflow, /ship\.pr_body_sections/);
    assert.match(workflow, /enabled.*true/);
    assert.match(workflow, /enabled.*false/);
    assert.match(workflow, /User Stories & Acceptance Criteria/);
    assert.match(workflow, /Risks & Dependencies/);
    assert.match(workflow, /Success Metrics & Release Criteria/);
    assert.match(workflow, /Stakeholder Review & Approval/);
  });
});
