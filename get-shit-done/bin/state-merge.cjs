#!/usr/bin/env node
// state-merge.cjs - stub for TDD (RED phase)

/**
 * Parse STATE.md content into mdast tree
 * @param {string} content - Raw markdown content
 * @returns {object} mdast tree
 */
function parseStateFile(content) {
  throw new Error('Not implemented');
}

/**
 * Extract section content by heading text
 * @param {object} tree - mdast tree
 * @param {string} headingText - Heading text to find
 * @returns {object|null} Section object with heading, content, end or null
 */
function extractSection(tree, headingText) {
  throw new Error('Not implemented');
}

/**
 * Serialize section nodes back to markdown
 * @param {object} section - Section object from extractSection
 * @returns {string} Markdown string
 */
function serializeSection(section) {
  throw new Error('Not implemented');
}

module.exports = { parseStateFile, extractSection, serializeSection };
