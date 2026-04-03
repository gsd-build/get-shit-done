const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('pause-work improvements', () => {
  let pauseContent;

  test('pause-work.md exists', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'pause-work.md');
    assert.ok(fs.existsSync(p));
    pauseContent = fs.readFileSync(p, 'utf-8');
  });

  test('#1489: pause-work detects non-phase contexts (spike, deliberation, research)', () => {
    pauseContent = pauseContent || fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'pause-work.md'), 'utf-8'
    );
    assert.ok(pauseContent.includes('spike') || pauseContent.includes('Spike'),
      'pause-work should handle spike context');
    assert.ok(pauseContent.includes('deliberation') || pauseContent.includes('research'),
      'pause-work should handle deliberation/research context');
  });

  test('#1489: pause-work writes to non-phase paths when appropriate', () => {
    pauseContent = pauseContent || fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'pause-work.md'), 'utf-8'
    );
    assert.ok(pauseContent.includes('.planning/.continue-here') ||
              pauseContent.includes('.planning/spikes') ||
              pauseContent.includes('non-phase'),
      'pause-work should write to root .planning/ when not in a phase');
  });

  test('#1490: continue-here template includes required-reading section', () => {
    pauseContent = pauseContent || fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'pause-work.md'), 'utf-8'
    );
    assert.ok(pauseContent.includes('Required Reading') || pauseContent.includes('required-reading'),
      'Template should include Required Reading section');
  });

  test('#1490: continue-here template includes anti-patterns section', () => {
    pauseContent = pauseContent || fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'pause-work.md'), 'utf-8'
    );
    assert.ok(pauseContent.includes('Anti-Pattern') || pauseContent.includes('anti-pattern') ||
              pauseContent.includes('do NOT repeat'),
      'Template should include Anti-Patterns section');
  });

  test('#1490: continue-here template includes infrastructure-state section', () => {
    pauseContent = pauseContent || fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'pause-work.md'), 'utf-8'
    );
    assert.ok(pauseContent.includes('Infrastructure') || pauseContent.includes('infrastructure'),
      'Template should include Infrastructure State section');
  });

  test('#1487: pause-work documents pre-execution critique gate', () => {
    pauseContent = pauseContent || fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'pause-work.md'), 'utf-8'
    );
    assert.ok(
      pauseContent.includes('critique') || pauseContent.includes('design gate') ||
      pauseContent.includes('Pre-Execution'),
      'pause-work should document design critique gate for design→execution transitions'
    );
  });
});
