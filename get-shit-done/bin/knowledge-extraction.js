#!/usr/bin/env node

/**
 * Knowledge Extraction Module
 *
 * Passive extraction of decisions and lessons from Claude responses.
 * Uses regex patterns with quality gates to prevent noise.
 */

// Decision patterns (HOOK-02)
const DECISION_PATTERNS = [
  // "let's use X", "let us go with Y"
  /(?:let's|let us)\s+(?:use|go with|implement|choose|try|pick)\s+([^.!?]+)/gi,

  // "decided to X", "decided on Y"
  /(?:decided|decided to|choosing to|going with|chose to)\s+([^.!?]+)/gi,

  // "will use X because/for/to"
  /(?:will use|using|opted for|opting for)\s+([^.!?]+?)\s+(?:because|for|to|since)/gi,

  // "approach: X", "solution: Y"
  /(?:approach|solution|implementation|strategy|plan):\s*([^.!?\n]+)/gi,

  // "I recommend X", "I suggest Y"
  /(?:I recommend|I suggest|I'd suggest|I'd recommend)\s+([^.!?]+)/gi,

  // "X is better because", "X makes more sense"
  /([A-Z][a-z]+(?:\s+[a-zA-Z]+)*)\s+(?:is better|makes more sense|is the way to go|is preferred)/gi
];

// Lesson patterns (HOOK-03)
const LESSON_PATTERNS = [
  // "learned that X", "discovered that Y"
  /(?:learned|discovered|found out|realized)\s+(?:that\s+)?([^.!?]+)/gi,

  // "turns out X", "it turns out Y"
  /(?:turns out|it turns out|apparently)\s+(?:that\s+)?([^.!?]+)/gi,

  // "the trick is X", "the key is Y"
  /(?:the trick is|the key is|the secret is|the solution is)\s+([^.!?]+)/gi,

  // "gotcha: X", "pitfall: Y", "watch out: Z"
  /(?:gotcha|pitfall|caveat|watch out|warning|caution):\s*([^.!?\n]+)/gi,

  // "note: X", "important: Y"
  /(?:note|important|remember|tip|hint):\s*([^.!?\n]+)/gi,

  // "X doesn't work because", "X fails when"
  /([^.!?]+?)\s+(?:doesn't work|won't work|fails|breaks)\s+(?:because|when|if)\s+([^.!?]+)/gi,

  // "instead of X, use Y"
  /instead of\s+([^,]+),\s+(?:use|try|do)\s+([^.!?]+)/gi
];

/**
 * Extract decisions and lessons from response text
 * @param {string} responseText - Claude response text
 * @returns {Array} Array of match objects with type, content, pattern, full_match, index
 */
function extractFromResponse(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    return [];
  }

  const matches = [];

  // Extract decisions
  for (const pattern of DECISION_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    const found = [...responseText.matchAll(pattern)];

    for (const match of found) {
      const content = (match[1] || match[0]).trim();
      if (content.length > 0) {
        matches.push({
          type: 'decision',
          content,
          pattern: pattern.source,
          full_match: match[0].trim(),
          index: match.index
        });
      }
    }
  }

  // Extract lessons
  for (const pattern of LESSON_PATTERNS) {
    pattern.lastIndex = 0;
    const found = [...responseText.matchAll(pattern)];

    for (const match of found) {
      // Handle patterns with multiple capture groups
      const content = (match[2] || match[1] || match[0]).trim();
      if (content.length > 0) {
        matches.push({
          type: 'lesson',
          content,
          pattern: pattern.source,
          full_match: match[0].trim(),
          index: match.index
        });
      }
    }
  }

  // Sort by position in text
  matches.sort((a, b) => a.index - b.index);

  return matches;
}

module.exports = {
  DECISION_PATTERNS,
  LESSON_PATTERNS,
  extractFromResponse
};
