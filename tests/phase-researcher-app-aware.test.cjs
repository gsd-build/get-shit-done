/**
 * Phase Researcher Application-Aware Tests (#1988)
 *
 * Validates that gsd-phase-researcher maps capabilities to architectural
 * tiers before diving into framework-specific research. Also validates
 * that gsd-planner and gsd-plan-checker consume the Architectural
 * Responsibility Map downstream.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');
const TEMPLATES_DIR = path.join(__dirname, '..', 'get-shit-done', 'templates');

// ─── Phase Researcher: Architectural Responsibility Mapping ─────────────────

describe('phase-researcher: Architectural Responsibility Mapping', () => {
  const researcherPath = path.join(AGENTS_DIR, 'gsd-phase-researcher.md');
  const content = fs.readFileSync(researcherPath, 'utf-8');

  test('contains Architectural Responsibility Mapping step', () => {
    assert.ok(
      content.includes('Architectural Responsibility Map'),
      'gsd-phase-researcher.md must contain "Architectural Responsibility Map"'
    );
  });

  test('Architectural Responsibility Mapping step comes after Step 1 and before Step 2', () => {
    const step1Pos = content.indexOf('## Step 1:');
    // Look for the step heading specifically (not the output format section)
    const stepARMPos = content.indexOf('## Step 1.5:');
    const step2Pos = content.indexOf('## Step 2:');

    assert.ok(step1Pos !== -1, 'Step 1 must exist');
    assert.ok(stepARMPos !== -1, 'Step 1.5 Architectural Responsibility Mapping step must exist');
    assert.ok(step2Pos !== -1, 'Step 2 must exist');

    assert.ok(
      stepARMPos > step1Pos,
      'Step 1.5 (Architectural Responsibility Mapping) must come after Step 1'
    );
    assert.ok(
      stepARMPos < step2Pos,
      'Step 1.5 (Architectural Responsibility Mapping) must come before Step 2'
    );
  });

  test('step is a pure reasoning step with no tool calls', () => {
    // Extract the ARM section content (between the ARM heading and the next ## Step heading)
    const armHeadingMatch = content.match(/## Step 1\.5[^\n]*Architectural Responsibility Map/);
    assert.ok(armHeadingMatch, 'Must have a Step 1.5 heading for Architectural Responsibility Mapping');

    const armStart = content.indexOf(armHeadingMatch[0]);
    const nextStepMatch = content.indexOf('## Step 2:', armStart);
    const armSection = content.substring(armStart, nextStepMatch);

    // Should not contain tool invocation patterns
    const toolPatterns = [
      /```bash/,
      /node "\$HOME/,
      /gsd-tools\.cjs/,
      /WebSearch/,
      /Context7/,
      /mcp__/,
    ];

    for (const pattern of toolPatterns) {
      assert.ok(
        !pattern.test(armSection),
        `Architectural Responsibility Mapping step must be pure reasoning (no tool calls), but found: ${pattern}`
      );
    }
  });

  test('mentions standard architectural tiers', () => {
    const armStart = content.indexOf('Architectural Responsibility Map');
    const nextStep = content.indexOf('## Step 2:', armStart);
    const armSection = content.substring(armStart, nextStep);

    // Should reference standard tiers
    const tiers = ['browser', 'frontend', 'API', 'database'];
    const foundTiers = tiers.filter(tier =>
      armSection.toLowerCase().includes(tier.toLowerCase())
    );

    assert.ok(
      foundTiers.length >= 3,
      `Must mention at least 3 standard architectural tiers, found: ${foundTiers.join(', ')}`
    );
  });

  test('specifies output format as a table in RESEARCH.md', () => {
    const armStart = content.indexOf('Architectural Responsibility Map');
    const nextStep = content.indexOf('## Step 2:', armStart);
    const armSection = content.substring(armStart, nextStep);

    assert.ok(
      armSection.includes('|') && armSection.includes('Capability'),
      'ARM step must specify a table output format with Capability column'
    );
  });
});

// ─── Planner: Architectural Responsibility Map Sanity Check ─────────────────

describe('planner: Architectural Responsibility Map sanity check', () => {
  const plannerPath = path.join(AGENTS_DIR, 'gsd-planner.md');
  const content = fs.readFileSync(plannerPath, 'utf-8');

  test('references Architectural Responsibility Map', () => {
    assert.ok(
      content.includes('Architectural Responsibility Map'),
      'gsd-planner.md must reference the Architectural Responsibility Map'
    );
  });

  test('includes sanity check against the map', () => {
    // Must mention checking/verifying plan tasks against the responsibility map
    assert.ok(
      content.includes('sanity check') || content.includes('sanity-check'),
      'gsd-planner.md must include a sanity check against the Architectural Responsibility Map'
    );
  });
});

// ─── Plan Checker: Architectural Tier Verification Dimension ────────────────

describe('plan-checker: Architectural Tier verification dimension', () => {
  const checkerPath = path.join(AGENTS_DIR, 'gsd-plan-checker.md');
  const content = fs.readFileSync(checkerPath, 'utf-8');

  test('has verification dimension for architectural tier', () => {
    assert.ok(
      content.includes('Architectural Responsibility Map') ||
      content.includes('Architectural Tier'),
      'gsd-plan-checker.md must have a verification dimension for architectural tier mapping'
    );
  });

  test('verification dimension checks plans against the map', () => {
    // Should have a dimension that references tier/responsibility checking
    assert.ok(
      content.includes('tier owner') || content.includes('tier mismatch') || content.includes('responsibility map'),
      'plan-checker verification dimension must check for tier mismatches against the responsibility map'
    );
  });
});

// ─── Research Template: Architectural Responsibility Map Section ─────────────

describe('research template: Architectural Responsibility Map section', () => {
  const templatePath = path.join(TEMPLATES_DIR, 'research.md');
  const content = fs.readFileSync(templatePath, 'utf-8');

  test('mentions Architectural Responsibility Map section', () => {
    assert.ok(
      content.includes('Architectural Responsibility Map'),
      'Research template must include an Architectural Responsibility Map section'
    );
  });

  test('template includes tier table format', () => {
    const armStart = content.indexOf('Architectural Responsibility Map');
    assert.ok(armStart !== -1, 'ARM section must exist');

    const sectionEnd = content.indexOf('##', armStart + 10);
    const section = content.substring(armStart, sectionEnd !== -1 ? sectionEnd : armStart + 500);

    assert.ok(
      section.includes('|') && (section.includes('Tier') || section.includes('tier')),
      'Research template ARM section must include a table format with Tier column'
    );
  });
});
