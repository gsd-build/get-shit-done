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

// Technical signal detection
const TECHNICAL_SIGNALS = [
  /`[^`]+`/,                    // Backticks (code references)
  /\/[a-zA-Z0-9_\-./]+/,        // Paths (slashes)
  /\berror\b/i,                 // Error mentions
  /\b(?:npm|git|node|bash|python|rust|javascript|typescript|react|vue|angular)\b/i,
  /\b(?:API|HTTP|JSON|SQL|CLI|URL|HTML|CSS)\b/,
  /\b(?:function|class|const|let|var|import|export|require|module)\b/,
  /\b(?:async|await|promise|callback)\b/i,
  /\b(?:database|schema|model|table|query)\b/i,
  /\b(?:file|directory|path|folder)\b/i,
  /\.[a-z]{2,4}\b/,             // File extensions (.js, .ts, .md)
  /[A-Z][a-z]+[A-Z]/,           // CamelCase identifiers
  /[a-z]+_[a-z]+/,              // snake_case identifiers
  /\b[A-Z]{2,}\b/               // All-caps technical terms (AUTOINCREMENT, WAL, FTS5, etc)
];

const GENERIC_PHRASES = [
  'sounds good', 'looks good', 'that works', 'makes sense',
  'got it', 'understood', 'okay', 'alright', 'sure',
  'yes', 'no', 'maybe', 'I think so', 'I agree',
  'thank you', 'thanks', 'great', 'perfect', 'awesome'
];

/**
 * Check if content passes quality gates
 * @param {string} content - Extracted content to check
 * @returns {Object} { passed: boolean, reason?: string, threshold?: number, actual?: number }
 */
function passesQualityGate(content) {
  // Minimum length check (HOOK-04: 20 chars)
  if (!content || content.length < 20) {
    return { passed: false, reason: 'too_short', threshold: 20, actual: content?.length || 0 };
  }

  // Avoid generic phrases
  const lowerContent = content.toLowerCase();
  const isGeneric = GENERIC_PHRASES.some(phrase =>
    lowerContent.includes(phrase) && content.length < 50
  );
  if (isGeneric) {
    return { passed: false, reason: 'generic_phrase' };
  }

  // Technical signal detection
  const hasTechnicalSignal = TECHNICAL_SIGNALS.some(regex => regex.test(content));
  if (!hasTechnicalSignal) {
    return { passed: false, reason: 'no_technical_signal' };
  }

  return { passed: true };
}

/**
 * Filter extractions with quality gates
 * @param {Array} extractions - Array of extraction objects
 * @param {Object} options - Options { debug: boolean }
 * @returns {Array} Filtered extractions
 */
function filterWithQualityGates(extractions, options = {}) {
  const { debug = false } = options;

  return extractions.filter(ext => {
    const check = passesQualityGate(ext.content);

    if (!check.passed) {
      if (debug || process.env.GSD_DEBUG) {
        console.log(`[extraction] Filtered: "${ext.content.slice(0, 40)}..." - ${check.reason}`);
      }
      return false;
    }

    return true;
  });
}

/**
 * Combined extraction with filtering
 * @param {string} responseText - Claude response text
 * @param {Object} options - Options { debug: boolean }
 * @returns {Array} Filtered extractions
 */
function extractAndFilter(responseText, options = {}) {
  const raw = extractFromResponse(responseText);
  return filterWithQualityGates(raw, options);
}

module.exports = {
  DECISION_PATTERNS,
  LESSON_PATTERNS,
  TECHNICAL_SIGNALS,
  GENERIC_PHRASES,
  extractFromResponse,
  passesQualityGate,
  filterWithQualityGates,
  extractAndFilter
};
