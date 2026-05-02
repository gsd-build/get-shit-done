// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Phase Researcher Flow Diagram Tests (#2139)
 *
 * Validates that gsd-phase-researcher enforces data-flow architecture
 * diagrams instead of file-listing diagrams. Also validates that the
 * research template includes the matching directive.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');
const TEMPLATES_DIR = path.join(__dirname, '..', 'get-shit-done', 'templates');

// ─── Phase Researcher: System Architecture Diagram Directive ─────────────────

describe('phase-researcher: System Architecture Diagram directive', () => {
  const researcherPath = path.join(AGENTS_DIR, 'gsd-phase-researcher.md');
  const content = fs.readFileSync(researcherPath, 'utf-8');

  test('contains System Architecture Diagram section', () => {
    assert.ok(
      content.includes('### System Architecture Diagram'),
      'gsd-phase-researcher.md must contain "### System Architecture Diagram"'
    );
  });

  test('requires data flow through conceptual components', () => {
    assert.ok(
      content.includes('data flow through conceptual components'),
      'Directive must require "data flow through conceptual components"'
    );
  });

  test('explicitly prohibits file listings in diagrams', () => {
    assert.ok(
      content.includes('not file listings'),
      'Directive must explicitly state "not file listings"'
    );
  });

  test('includes key requirements for flow diagrams', () => {
    const requirements = [
      'entry points',
      'processing stages',
      'decision points',
      'external dependencies',
      'arrows',
    ];

    for (const req of requirements) {
      assert.ok(
        content.toLowerCase().includes(req),
        `Directive must mention "${req}"`
      );
    }
  });

  test('directs file-to-implementation mapping to Component Responsibilities table', () => {
    assert.ok(
      content.includes('Component Responsibilities table'),
      'Directive must redirect file mapping to Component Responsibilities table'
    );
  });

  test('diagram section comes before Recommended Project Structure', () => {
    const diagramPos = content.indexOf('### System Architecture Diagram');
    const structurePos = content.indexOf('### Recommended Project Structure');

    assert.ok(diagramPos !== -1, 'System Architecture Diagram section must exist');
    assert.ok(structurePos !== -1, 'Recommended Project Structure section must exist');
    assert.ok(
      diagramPos < structurePos,
      'System Architecture Diagram must come before Recommended Project Structure'
    );
  });
});

// ─── Research Template: System Architecture Diagram Section ───────────────────

describe('research template: System Architecture Diagram section', () => {
  const templatePath = path.join(TEMPLATES_DIR, 'research.md');
  const content = fs.readFileSync(templatePath, 'utf-8');

  test('contains System Architecture Diagram section', () => {
    assert.ok(
      content.includes('### System Architecture Diagram'),
      'Research template must contain "### System Architecture Diagram"'
    );
  });

  test('includes flow diagram requirements', () => {
    assert.ok(
      content.includes('data flow through conceptual components'),
      'Research template must include flow diagram directive'
    );
    assert.ok(
      content.includes('not file listings'),
      'Research template must prohibit file listings in diagrams'
    );
  });
});
