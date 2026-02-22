// state-merge.test.cjs - TDD tests for STATE.md parsing
const { parseStateFile, extractSection, serializeSection } = require('./state-merge.cjs');
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

console.log('\nAll tests passed!');
