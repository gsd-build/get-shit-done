/**
 * Enhancement #2500: gsd-codebase-mapper (arch focus) rich architecture output
 *
 * The codebase/ARCHITECTURE.md produced by gsd-codebase-mapper was a sparse
 * structural inventory — file listings and module relationships. After a major
 * refactor, research/ARCHITECTURE.md (created at /gsd-new-project) goes stale
 * with no refresh command. This enhancement enriches the codebase mapper's
 * arch-focus template to match the richness of the research version:
 *   - ASCII system overview diagram
 *   - Data flow traces with numbered steps and code references
 *   - Component responsibility table (component → responsibility → file)
 *   - Critical architectural constraints
 *   - Anti-patterns specific to the codebase
 *   - <!-- refreshed: {date} --> marker at top (maintainer request)
 *
 * The agent's template text IS what the runtime executes, so testing
 * the template content directly tests the deployed contract.
 */

'use strict';

// allow-test-rule: source-text-is-the-product
// The gsd-codebase-mapper ARCHITECTURE.md template is the instruction set
// executed by the LLM at runtime. Testing its text content tests whether the
// deployed agent will produce rich architecture docs as required by #2500.

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AGENT_PATH = path.join(__dirname, '..', 'agents', 'gsd-codebase-mapper.md');

describe('enh-2500: gsd-codebase-mapper arch focus — rich architecture output', () => {
  let agentContent;
  let archTemplate;

  before(() => {
    assert.ok(fs.existsSync(AGENT_PATH), 'agents/gsd-codebase-mapper.md must exist');
    agentContent = fs.readFileSync(AGENT_PATH, 'utf-8');

    // Isolate the ARCHITECTURE.md template section from the agent file.
    // End boundary is the STRUCTURE.md Template heading that immediately follows it.
    const archStart = agentContent.indexOf('## ARCHITECTURE.md Template (arch focus)');
    assert.ok(archStart !== -1, 'agent must contain an ARCHITECTURE.md Template (arch focus) section');

    const archEnd = agentContent.indexOf('## STRUCTURE.md Template (arch focus)', archStart + 1);
    archTemplate = archEnd !== -1
      ? agentContent.slice(archStart, archEnd)
      : agentContent.slice(archStart);
  });

  test('template includes a refreshed date marker', () => {
    assert.ok(
      archTemplate.includes('<!-- refreshed:') || archTemplate.includes('refreshed:'),
      'ARCHITECTURE.md template must include a <!-- refreshed: {date} --> marker so users can see when the doc was last generated (#2500 maintainer requirement)'
    );
  });

  test('template includes an ASCII system overview diagram', () => {
    // ASCII diagrams use box-drawing characters or at minimum ┌/└/│/─ or +/|/-
    const hasAsciiDiagram =
      archTemplate.includes('┌') ||
      archTemplate.includes('└') ||
      archTemplate.includes('│') ||
      archTemplate.includes('+--') ||
      archTemplate.includes('+-') ||
      archTemplate.includes('→') ||
      archTemplate.includes('↓') ||
      archTemplate.includes('↑');

    assert.ok(
      hasAsciiDiagram,
      'ARCHITECTURE.md template must include an ASCII system overview diagram (box-drawing characters or flow arrows) as required by #2500'
    );
  });

  test('template includes System Overview section header', () => {
    assert.ok(
      archTemplate.includes('System Overview') || archTemplate.includes('system overview'),
      'ARCHITECTURE.md template must include a "System Overview" section for the ASCII diagram (#2500)'
    );
  });

  test('template includes a component responsibility table with required columns', () => {
    // Must have a markdown table with component, responsibility, and file columns
    const hasComponentCol =
      archTemplate.includes('Component') || archTemplate.includes('component');
    const hasResponsibilityCol =
      archTemplate.includes('Responsibility') || archTemplate.includes('responsibility');
    const hasFileCol =
      archTemplate.includes('File') || archTemplate.includes('file');

    assert.ok(
      hasComponentCol && hasResponsibilityCol && hasFileCol,
      'ARCHITECTURE.md template must include a component responsibility table with Component, Responsibility, and File columns (#2500)'
    );
  });

  test('template includes data flow traces with numbered steps', () => {
    const hasPrimaryRequestPath = /###\s+Primary Request Path/i.test(archTemplate);
    const hasThreeNumberedSteps = /^\s*1\..+\n\s*2\..+\n\s*3\./m.test(archTemplate);
    const hasFileLineRefs = /\(`\[.*:(?:line|\d+)\]`\)/.test(archTemplate);

    assert.ok(
      hasPrimaryRequestPath && hasThreeNumberedSteps && hasFileLineRefs,
      'ARCHITECTURE.md template must include a "Primary Request Path" section with numbered steps and file:line references (#2500)'
    );
  });

  test('template includes architectural constraints section', () => {
    const hasConstraints =
      /##\s+Architectural Constraints/i.test(archTemplate) &&
      /\bThreading\b/.test(archTemplate) &&
      /\bGlobal state\b/i.test(archTemplate) &&
      /\bCircular imports\b/i.test(archTemplate);

    assert.ok(
      hasConstraints,
      'ARCHITECTURE.md template must include an "Architectural Constraints" section with Threading, Global state, and Circular imports categories (#2500)'
    );
  });

  test('template includes anti-patterns section', () => {
    assert.ok(
      archTemplate.includes('Anti-pattern') ||
      archTemplate.includes('Anti-Pattern') ||
      archTemplate.includes('anti-pattern'),
      'ARCHITECTURE.md template must include an anti-patterns section specific to the codebase (#2500)'
    );
  });
});
