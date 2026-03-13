// state-merge.test.cjs - TDD tests for STATE.md parsing, merge strategies, and conflict detection
const { init, parseStateFile, extractSection, serializeSection, mergeSection, getStrategy, SECTION_STRATEGIES, detectConflicts, applyResolution } = require('./state-merge.cjs');
const assert = require('assert');

// Test fixture - minimal STATE.md content
const basicState = `# Project State

## Current Position

**Phase:** 1
[####......] 40%

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Use JSON | Simple | 2026-02-20 |

## TODOs

- [x] Complete task 1
- [ ] Pending task 2
`;

// Test fixture for code block edge case
const stateWithCodeBlock = `# Project State

## Implementation Notes

Here is some code:

\`\`\`markdown
## This is NOT a real heading
It's inside a code block
\`\`\`

Real content continues here.

## Next Section

This should be a separate section.
`;

// Run tests (async to handle ESM initialization)
async function runTests() {
  // Initialize ESM modules
  console.log('Initializing markdown parser...');
  await init();
  console.log('  OK\n');

  // Test 1: Parse returns mdast tree
  console.log('Test 1: Parse returns mdast tree...');
  const tree = parseStateFile(basicState);
  assert(tree.type === 'root', 'Should return root node');
  assert(Array.isArray(tree.children), 'Should have children array');
  console.log('  PASSED');

  // Test 2: Extract existing section
  console.log('Test 2: Extract existing section...');
  const positionSection = extractSection(tree, 'Current Position');
  assert(positionSection !== null, 'Should find Current Position');
  assert(positionSection.heading !== undefined, 'Should have heading');
  assert(Array.isArray(positionSection.content), 'Should have content array');
  console.log('  PASSED');

  // Test 3: Extract missing section returns null
  console.log('Test 3: Extract missing section returns null...');
  const missing = extractSection(tree, 'NonExistent');
  assert(missing === null, 'Should return null for missing section');
  console.log('  PASSED');

  // Test 4: Serialize preserves task list structure
  console.log('Test 4: Serialize preserves task list structure...');
  const todoSection = extractSection(tree, 'TODOs');
  const serialized = serializeSection(todoSection);
  assert(serialized.includes('[x]'), 'Should preserve checked task list items');
  assert(serialized.includes('[ ]'), 'Should preserve unchecked task list items');
  console.log('  PASSED');

  // Test 5: Code blocks with ## don't cause false section splits
  console.log('Test 5: Code blocks with ## handled correctly...');
  const codeBlockTree = parseStateFile(stateWithCodeBlock);
  const implNotes = extractSection(codeBlockTree, 'Implementation Notes');
  assert(implNotes !== null, 'Should find Implementation Notes');
  const implContent = serializeSection(implNotes);
  assert(implContent.includes('```markdown'), 'Code block should be in section');
  assert(implContent.includes('## This is NOT a real heading'), 'Fenced heading preserved');
  console.log('  PASSED');

  // Test 6: Table preservation in Key Decisions
  console.log('Test 6: Table preservation in sections...');
  const decisionsSection = extractSection(tree, 'Key Decisions');
  const decisionsSerialized = serializeSection(decisionsSection);
  assert(decisionsSerialized.includes('| Decision |'), 'Should preserve table headers');
  assert(decisionsSerialized.includes('| Use JSON |'), 'Should preserve table data');
  console.log('  PASSED');

  // Test 7: Strategy lookup for TODOs
  console.log('Test 7: Strategy lookup for TODOs...');
  assert(getStrategy('TODOs') === 'union-main-wins-removals', 'TODOs should use union-main-wins-removals');
  console.log('  PASSED');

  // Test 8: Strategy lookup for Session Continuity
  console.log('Test 8: Strategy lookup for Session Continuity...');
  assert(getStrategy('Session Continuity') === 'worktree-wins', 'Session Continuity should use worktree-wins');
  console.log('  PASSED');

  // Test 9: Strategy defaults to union for unknown sections
  console.log('Test 9: Strategy defaults to union for unknown sections...');
  assert(getStrategy('Unknown Section') === 'union', 'Unknown sections should default to union');
  console.log('  PASSED');

  // Test 10: All CONTEXT.md sections have strategies
  console.log('Test 10: All CONTEXT.md sections have strategies...');
  const requiredSections = [
    'Current Position', 'Performance Metrics', 'Key Decisions',
    'Implementation Notes', 'TODOs', 'Blockers', 'Session Continuity', 'Open Questions'
  ];
  for (const section of requiredSections) {
    assert(SECTION_STRATEGIES[section], `Missing strategy for ${section}`);
  }
  console.log('  PASSED');

  // Test 11: detectConflicts no conflict on identical
  console.log('Test 11: detectConflicts no conflict on identical...');
  const identicalResult = detectConflicts('same', 'same', 'same');
  assert(!identicalResult.hasConflicts, 'No conflicts when all identical');
  console.log('  PASSED');

  // Test 12: detectConflicts conflict on divergent changes
  console.log('Test 12: detectConflicts conflict on divergent changes...');
  const conflictResult = detectConflicts('base', 'changed-main', 'changed-worktree');
  assert(conflictResult.hasConflicts, 'Should detect conflict on divergent changes');
  assert(conflictResult.conflicts.length > 0, 'Should have conflict entries');
  console.log('  PASSED');

  // Test 13: applyResolution with main choice
  console.log('Test 13: applyResolution with main choice...');
  const testConflict = { main: 'main-content', worktree: 'worktree-content' };
  const mainResolution = applyResolution('main', testConflict, null);
  assert(mainResolution === 'main-content', 'Should return main content');
  console.log('  PASSED');

  // Test 14: applyResolution with worktree choice
  console.log('Test 14: applyResolution with worktree choice...');
  const worktreeResolution = applyResolution('worktree', testConflict, null);
  assert(worktreeResolution === 'worktree-content', 'Should return worktree content');
  console.log('  PASSED');

  // Test 15: applyResolution with suggestion choice
  console.log('Test 15: applyResolution with suggestion choice...');
  const suggestionResolution = applyResolution('suggestion', testConflict, 'custom-suggestion');
  assert(suggestionResolution === 'custom-suggestion', 'Should return suggestion');
  console.log('  PASSED');

  // Test 16: applyResolution with numeric choices
  console.log('Test 16: applyResolution with numeric choices...');
  assert(applyResolution('1', testConflict, 'sugg') === 'sugg', 'Choice 1 = suggestion');
  assert(applyResolution('2', testConflict, null) === 'main-content', 'Choice 2 = main');
  assert(applyResolution('3', testConflict, null) === 'worktree-content', 'Choice 3 = worktree');
  console.log('  PASSED');

  console.log('\nAll tests passed!');
}

runTests().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
