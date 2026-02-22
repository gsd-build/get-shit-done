#!/usr/bin/env node
// state-merge.cjs - STATE.md parsing, section extraction, and merge strategies
// Provides infrastructure for section-based state merging
//
// Note: Uses dynamic imports because remark ecosystem is ESM-only

let processor = null;
let stringifier = null;
let headingRange = null;
let toStringFn = null;
let initialized = false;

// Section strategy configuration per CONTEXT.md
const SECTION_STRATEGIES = {
  'Current Position': 'additive',
  'Performance Metrics': 'additive',
  'Key Decisions': 'union',
  'Implementation Notes': 'union',
  'TODOs': 'union-main-wins-removals',
  'Blockers': 'union-main-wins-removals',
  'Session Continuity': 'worktree-wins',
  'Open Questions': 'union',
  'Accumulated Context': 'additive'  // Parent of subsections
};

/**
 * Initialize the markdown processing libraries (ESM modules)
 * Must be called before using other functions
 */
async function init() {
  if (initialized) return;

  const { unified } = await import('unified');
  const remarkParse = (await import('remark-parse')).default;
  const remarkStringify = (await import('remark-stringify')).default;
  const remarkGfm = (await import('remark-gfm')).default;
  const headingRangeModule = await import('mdast-util-heading-range');
  headingRange = headingRangeModule.headingRange;
  const toStringModule = await import('mdast-util-to-string');
  toStringFn = toStringModule.toString;

  // Create processor with GFM support for tables and task lists
  processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  // Create stringifier for markdown output
  stringifier = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: '-',
      listItemIndent: 'one',
      fences: true,
      rule: '-'
    });

  initialized = true;
}

/**
 * Parse STATE.md content into mdast tree
 * @param {string} content - Raw markdown content
 * @returns {object} mdast tree with type 'root'
 */
function parseStateFile(content) {
  if (!initialized) {
    throw new Error('Call init() before using parseStateFile');
  }
  return processor.parse(content);
}

/**
 * Extract section content by heading text
 * Returns nodes between the heading and the next same-level (or higher) heading
 *
 * @param {object} tree - mdast tree from parseStateFile
 * @param {string} headingText - Exact text of the heading to find (e.g., "Key Decisions")
 * @returns {object|null} Section object with heading, content, end properties, or null if not found
 */
function extractSection(tree, headingText) {
  if (!initialized) {
    throw new Error('Call init() before using extractSection');
  }

  let sectionNodes = null;

  // headingRange finds the heading and calls the handler with:
  // - start: the heading node
  // - nodes: array of nodes between this heading and the next same-level heading
  // - end: the next heading node (or undefined if at end)
  headingRange(tree, headingText, (start, nodes, end) => {
    sectionNodes = {
      heading: start,
      content: nodes,
      end: end
    };
  });

  return sectionNodes;
}

/**
 * Serialize section nodes back to markdown
 * Preserves GFM features like tables and task list checkboxes
 *
 * @param {object} section - Section object from extractSection
 * @returns {string} Markdown string (empty string if section is null/invalid)
 */
function serializeSection(section) {
  if (!initialized) {
    throw new Error('Call init() before using serializeSection');
  }

  if (!section || !section.content) return '';

  // Create temporary root with just the section content
  const tempTree = {
    type: 'root',
    children: section.content
  };

  return stringifier.stringify(tempTree);
}

/**
 * Get text content of a node for comparison
 */
function getNodeText(node) {
  if (!initialized) {
    throw new Error('Call init() before using getNodeText');
  }
  return toStringFn(node);
}

/**
 * Merge two sections using additive strategy
 * Combines entries from both sides, deduping by text content
 */
function mergeAdditive(mainSection, worktreeSection) {
  if (!mainSection) return worktreeSection;
  if (!worktreeSection) return mainSection;

  // Combine content nodes, deduping by text content
  const mainTexts = new Set(mainSection.content.map(n => getNodeText(n)));
  const combined = [...mainSection.content];

  for (const node of worktreeSection.content) {
    const text = getNodeText(node);
    if (!mainTexts.has(text)) {
      combined.push(node);
    }
  }

  return { ...mainSection, content: combined };
}

/**
 * Merge two sections using union strategy
 * All entries combined, no conflicts
 */
function mergeUnion(mainSection, worktreeSection) {
  // For tables (Key Decisions), merge rows by first column
  // For lists, union all items
  return mergeAdditive(mainSection, worktreeSection);
}

/**
 * Merge with union + main wins removals
 * Additions merge, completions from main stick (no resurrection)
 */
function mergeUnionMainWinsRemovals(mainSection, worktreeSection, baseSection) {
  if (!baseSection) {
    // No base = first time, just union
    return mergeUnion(mainSection, worktreeSection);
  }

  // Find items removed from main (were in base, not in main)
  const baseTexts = new Set((baseSection?.content || []).map(n => getNodeText(n)));
  const mainTexts = new Set((mainSection?.content || []).map(n => getNodeText(n)));

  // Items main removed (were in base but not in main)
  const mainRemoved = [...baseTexts].filter(t => !mainTexts.has(t));

  // Start with main's content
  const result = mainSection ? [...mainSection.content] : [];

  // Add worktree additions that main didn't remove
  if (worktreeSection) {
    for (const node of worktreeSection.content) {
      const text = getNodeText(node);
      // Skip if main removed it OR if main already has it
      if (!mainRemoved.includes(text) && !mainTexts.has(text)) {
        result.push(node);
      }
    }
  }

  return { ...(mainSection || worktreeSection), content: result };
}

/**
 * Worktree wins for phase-specific sections
 */
function mergeWorktreeWins(mainSection, worktreeSection) {
  return worktreeSection || mainSection;
}

/**
 * Get merge strategy for section
 */
function getStrategy(sectionName) {
  return SECTION_STRATEGIES[sectionName] || 'union';
}

/**
 * Merge a single section using appropriate strategy
 */
function mergeSection(sectionName, mainSection, worktreeSection, baseSection) {
  const strategy = getStrategy(sectionName);

  switch (strategy) {
    case 'additive':
      return mergeAdditive(mainSection, worktreeSection);
    case 'union':
      return mergeUnion(mainSection, worktreeSection);
    case 'union-main-wins-removals':
      return mergeUnionMainWinsRemovals(mainSection, worktreeSection, baseSection);
    case 'worktree-wins':
      return mergeWorktreeWins(mainSection, worktreeSection);
    default:
      return mergeUnion(mainSection, worktreeSection);
  }
}

// Conflict detection and resolution
const Diff3 = require('node-diff3');
const { edit } = require('external-editor');

/**
 * Detect conflicts using three-way merge
 * Returns { hasConflicts, conflicts[], autoMerged }
 */
function detectConflicts(baseContent, mainContent, worktreeContent) {
  const baseLines = baseContent.split('\n');
  const mainLines = mainContent.split('\n');
  const worktreeLines = worktreeContent.split('\n');

  const result = Diff3.diff3Merge(mainLines, baseLines, worktreeLines);

  const conflicts = [];
  const autoMerged = [];

  for (const hunk of result) {
    if (hunk.ok) {
      autoMerged.push(...hunk.ok);
    } else if (hunk.conflict) {
      conflicts.push({
        main: hunk.conflict.a.join('\n'),
        base: hunk.conflict.o.join('\n'),
        worktree: hunk.conflict.b.join('\n')
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    autoMerged: autoMerged.join('\n')
  };
}

/**
 * Present conflict to user and get resolution choice
 * Per CONTEXT.md: side-by-side diff with suggestion
 */
function presentConflict(conflict, suggestion) {
  console.log('\n=== CONFLICT DETECTED ===\n');
  console.log('MAIN has:');
  console.log(conflict.main);
  console.log('\n---');
  console.log('WORKTREE has:');
  console.log(conflict.worktree);
  console.log('\n---');
  console.log('SUGGESTION:', suggestion || 'Accept both (combine entries)');
  console.log('\nOptions:');
  console.log('  1. Accept suggestion');
  console.log('  2. Keep main');
  console.log('  3. Keep worktree');
  console.log('  4. Edit manually');

  // Return for CLI handling - actual prompt done by caller
  return {
    main: conflict.main,
    worktree: conflict.worktree,
    suggestion
  };
}

/**
 * Open content in user's editor for manual resolution
 * Uses $VISUAL -> $EDITOR -> vim -> nano fallback chain
 */
function openInEditor(content) {
  try {
    const edited = edit(content, { postfix: '.md' });
    return { success: true, content: edited };
  } catch (err) {
    // Editor not available or user cancelled
    return {
      success: false,
      error: `Editor failed: ${err.message}. Set $EDITOR environment variable.`
    };
  }
}

/**
 * Apply resolution choice
 * Per CONTEXT.md: rollback pattern - never leave half-merged state
 */
function applyResolution(choice, conflict, suggestion) {
  switch (choice) {
    case 'suggestion':
    case '1':
      return suggestion || `${conflict.main}\n${conflict.worktree}`;
    case 'main':
    case '2':
      return conflict.main;
    case 'worktree':
    case '3':
      return conflict.worktree;
    case 'edit':
    case '4':
      return openInEditor(`${conflict.main}\n\n--- SEPARATOR (delete this line) ---\n\n${conflict.worktree}`);
    default:
      throw new Error(`Unknown resolution choice: ${choice}`);
  }
}

/**
 * Full STATE.md merge with conflict handling
 * Main entry point for finalize-phase integration
 */
async function mergeStateFiles(basePath, mainPath, worktreePath, options = {}) {
  const fs = require('fs');

  // Read all three versions BEFORE any modifications (rollback pattern)
  const baseContent = fs.existsSync(basePath) ? fs.readFileSync(basePath, 'utf-8') : '';
  const mainContent = fs.readFileSync(mainPath, 'utf-8');
  const worktreeContent = fs.readFileSync(worktreePath, 'utf-8');

  // Ensure init is called before parsing
  await init();

  // Parse all versions
  const baseTree = baseContent ? parseStateFile(baseContent) : null;
  const mainTree = parseStateFile(mainContent);
  const worktreeTree = parseStateFile(worktreeContent);

  // Get all section names from both trees
  const sectionNames = Object.keys(SECTION_STRATEGIES);
  const mergedSections = {};
  const conflicts = [];

  for (const sectionName of sectionNames) {
    const baseSection = baseTree ? extractSection(baseTree, sectionName) : null;
    const mainSection = extractSection(mainTree, sectionName);
    const worktreeSection = extractSection(worktreeTree, sectionName);

    // Check for conflicts that can't be auto-merged
    if (mainSection && worktreeSection) {
      const mainText = serializeSection(mainSection);
      const worktreeText = serializeSection(worktreeSection);
      const baseText = baseSection ? serializeSection(baseSection) : '';

      const conflictResult = detectConflicts(baseText, mainText, worktreeText);

      if (conflictResult.hasConflicts) {
        conflicts.push({ sectionName, ...conflictResult.conflicts[0] });
      }
    }

    // Apply merge strategy
    mergedSections[sectionName] = mergeSection(
      sectionName,
      mainSection,
      worktreeSection,
      baseSection
    );
  }

  return {
    success: conflicts.length === 0,
    conflicts,
    mergedSections,
    // Don't write yet - let caller handle
    requiresResolution: conflicts.length > 0
  };
}

module.exports = {
  init,
  parseStateFile,
  extractSection,
  serializeSection,
  mergeSection,
  getStrategy,
  SECTION_STRATEGIES,
  detectConflicts,
  presentConflict,
  openInEditor,
  applyResolution,
  mergeStateFiles
};
