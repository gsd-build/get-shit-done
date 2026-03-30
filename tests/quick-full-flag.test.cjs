/**
 * GSD Tools Tests - quick --full flag implies --discuss and --research
 *
 * Validates that the quick workflow's --full flag automatically enables
 * --discuss and --research for the complete quality pipeline.
 *
 * Closes: #1498
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('quick --full implies --discuss and --research (#1498)', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

  test('workflow documents --full implies --discuss and --research', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('--full') && content.includes('implies') &&
      content.includes('--discuss') && content.includes('--research'),
      'workflow should document that --full implies --discuss and --research'
    );
  });

  test('purpose section describes --full as the complete pipeline', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const purposeMatch = content.match(/<purpose>([\s\S]*?)<\/purpose>/);
    const purpose = purposeMatch ? purposeMatch[1] : '';
    assert.ok(
      purpose.includes('--full') && purpose.includes('implies'),
      'purpose should describe --full as implying discuss+research'
    );
  });

  test('flag parsing step sets DISCUSS_MODE and RESEARCH_MODE when FULL_MODE is true', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // The workflow should have logic that sets discuss/research when full is set
    assert.ok(
      content.includes('FULL_MODE') && content.includes('DISCUSS_MODE') && content.includes('RESEARCH_MODE'),
      'workflow should reference all three mode variables'
    );
    // Should describe the implication
    assert.ok(
      content.includes('$FULL_MODE') && content.includes('$DISCUSS_MODE') && content.includes('$RESEARCH_MODE'),
      'workflow should set DISCUSS_MODE and RESEARCH_MODE when FULL_MODE is true'
    );
  });

  test('success criteria include --full auto-enable requirement', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const criteriaMatch = content.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/);
    const criteria = criteriaMatch ? criteriaMatch[1] : '';
    assert.ok(
      criteria.includes('--full') && criteria.includes('--discuss') && criteria.includes('--research'),
      'success criteria should include --full auto-enable requirement'
    );
  });
});
