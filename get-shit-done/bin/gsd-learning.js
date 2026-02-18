#!/usr/bin/env node

/**
 * GSD Learning Module
 *
 * Extracts patterns from feedback data and merges learned rules with built-in routing rules.
 * Implements intelligent conflict resolution with evidence-based thresholds.
 */

const fs = require('fs');
const path = require('path');

// Evidence threshold for overriding built-in rules
const EVIDENCE_THRESHOLD = 3;

/**
 * Read feedback log from .planning/feedback/human-feedback.jsonl
 * @returns {Array} Array of feedback entries
 */
function readFeedbackLog() {
  const cwd = process.cwd();
  const feedbackPath = path.join(cwd, '.planning/feedback/human-feedback.jsonl');

  if (!fs.existsSync(feedbackPath)) {
    return [];
  }

  const lines = fs.readFileSync(feedbackPath, 'utf8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('{"_comment"'));

  const entries = lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }).filter(entry => entry !== null);

  // Filter to incorrect feedback only
  return entries.filter(entry => entry.correct === false);
}

/**
 * Extract keywords from task description
 * @param {string} description - Task description
 * @returns {Array<string>} Extracted keywords
 */
function extractKeywords(description) {
  // Stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
  ]);

  // Extract words, filter stop words, lowercase
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Count frequency
  const frequency = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // Return top keywords by frequency
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Calculate complexity signals from task description
 * @param {string} description - Task description
 * @returns {Object} Complexity signals
 */
function calculateComplexitySignals(description) {
  const technicalTerms = [
    'api', 'database', 'schema', 'query', 'endpoint', 'authentication',
    'authorization', 'validation', 'error', 'exception', 'async', 'promise',
    'callback', 'event', 'state', 'redux', 'react', 'component', 'hook',
    'service', 'controller', 'model', 'repository', 'middleware', 'router',
    'request', 'response', 'http', 'https', 'rest', 'graphql', 'websocket'
  ];

  const securityTerms = [
    'security', 'authentication', 'authorization', 'auth', 'token', 'jwt',
    'session', 'cookie', 'csrf', 'xss', 'injection', 'sanitize', 'validate',
    'encrypt', 'decrypt', 'hash', 'salt', 'password', 'credential', 'oauth',
    'permission', 'role', 'access', 'control'
  ];

  const descLower = description.toLowerCase();
  const wordCount = description.split(/\s+/).length;

  const hasTechnical = technicalTerms.some(term => descLower.includes(term));
  const hasSecurity = securityTerms.some(term => descLower.includes(term));

  const technicalCount = technicalTerms.filter(term => descLower.includes(term)).length;
  const securityCount = securityTerms.filter(term => descLower.includes(term)).length;

  return {
    word_count: wordCount,
    has_technical: hasTechnical,
    has_security: hasSecurity,
    technical_term_count: technicalCount,
    security_term_count: securityCount
  };
}

/**
 * Calculate keyword overlap between two keyword arrays
 * @param {Array<string>} keywords1
 * @param {Array<string>} keywords2
 * @returns {number} Overlap percentage (0-1)
 */
function calculateKeywordOverlap(keywords1, keywords2) {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Extract patterns from feedback log
 * @param {Array} feedbackLog - Array of feedback entries (incorrect only)
 * @returns {Array} Array of LearnedPattern objects
 */
function extractPatterns(feedbackLog) {
  if (!feedbackLog || feedbackLog.length === 0) {
    return [];
  }

  // Group feedback by should_use model
  const byModel = {};
  feedbackLog.forEach(entry => {
    const model = entry.should_use;
    if (!byModel[model]) {
      byModel[model] = [];
    }
    byModel[model].push(entry);
  });

  const patterns = [];

  // For each model, find patterns
  for (const [model, entries] of Object.entries(byModel)) {
    // Extract keywords and complexity for each entry
    const entryData = entries.map(entry => ({
      entry,
      keywords: extractKeywords(entry.task_fingerprint.description),
      complexity: calculateComplexitySignals(entry.task_fingerprint.description)
    }));

    // Group similar entries (keyword overlap > 50%)
    const clusters = [];
    entryData.forEach(data => {
      let foundCluster = false;
      for (const cluster of clusters) {
        const overlap = calculateKeywordOverlap(data.keywords, cluster.keywords);
        if (overlap > 0.5) {
          cluster.entries.push(data.entry);
          cluster.allKeywords.push(...data.keywords);
          foundCluster = true;
          break;
        }
      }
      if (!foundCluster) {
        clusters.push({
          keywords: data.keywords,
          allKeywords: [...data.keywords],
          entries: [data.entry]
        });
      }
    });

    // Create patterns from clusters
    clusters.forEach(cluster => {
      // Get most frequent keywords across cluster
      const keywordFreq = {};
      cluster.allKeywords.forEach(keyword => {
        keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
      });

      const topKeywords = Object.entries(keywordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword]) => keyword);

      // Get example descriptions
      const examples = cluster.entries
        .slice(0, 3)
        .map(entry => entry.task_fingerprint.description);

      // Calculate aggregate complexity signals
      const complexitySignals = cluster.entries.reduce((acc, entry) => {
        const signals = calculateComplexitySignals(entry.task_fingerprint.description);
        return {
          word_count: acc.word_count + signals.word_count,
          has_technical: acc.has_technical || signals.has_technical,
          has_security: acc.has_security || signals.has_security,
          technical_term_count: acc.technical_term_count + signals.technical_term_count,
          security_term_count: acc.security_term_count + signals.security_term_count
        };
      }, {
        word_count: 0,
        has_technical: false,
        has_security: false,
        technical_term_count: 0,
        security_term_count: 0
      });

      // Average word count
      complexitySignals.word_count = Math.round(complexitySignals.word_count / cluster.entries.length);

      patterns.push({
        pattern: topKeywords.join(', '),
        model,
        evidence_count: cluster.entries.length,
        keywords: topKeywords,
        complexity_signals: complexitySignals,
        examples,
        last_updated: new Date().toISOString()
      });
    });
  }

  // Sort by evidence count (highest first)
  patterns.sort((a, b) => b.evidence_count - a.evidence_count);

  return patterns;
}

/**
 * Load built-in routing rules from routing-rules.md
 * @returns {Array} Array of built-in rule objects
 */
function loadBuiltInRules() {
  const rulesPath = path.join(
    process.env.HOME,
    '.claude/skills/gsd-task-router/routing-rules.md'
  );

  if (!fs.existsSync(rulesPath)) {
    return [];
  }

  const content = fs.readFileSync(rulesPath, 'utf8');
  const rules = [];

  // Parse markdown table
  const lines = content.split('\n');
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith('| Pattern |')) {
      inTable = true;
      continue;
    }
    if (line.startsWith('|---')) {
      continue;
    }
    if (inTable && line.startsWith('|')) {
      const parts = line.split('|').map(s => s.trim()).filter(s => s);
      if (parts.length >= 3) {
        rules.push({
          pattern: parts[0],
          model: parts[1],
          description: parts[2]
        });
      }
    }
    if (inTable && !line.startsWith('|')) {
      break;
    }
  }

  return rules;
}

/**
 * Log rule merge decision
 * @param {Object} entry - Merge decision entry
 */
function logRuleMerge(entry) {
  const cwd = process.cwd();
  const logPath = path.join(cwd, '.planning/feedback/rule-merge-log.jsonl');

  // Ensure directory exists
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Add timestamp
  entry.timestamp = new Date().toISOString();

  // Append to log
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

/**
 * Merge learned rules with built-in rules
 * @param {Array} builtInRules - Built-in routing rules
 * @param {Array} learnedPatterns - Learned patterns from feedback
 * @returns {Array} Merged rule set
 */
function mergeRules(builtInRules, learnedPatterns) {
  const mergedRules = [...builtInRules];
  const stats = {
    overrides: 0,
    insufficient: 0,
    new: 0
  };

  for (const learned of learnedPatterns) {
    // Check for conflict with built-in rules
    const conflict = builtInRules.find(rule =>
      rule.pattern.toLowerCase() === learned.pattern.toLowerCase()
    );

    if (conflict) {
      if (conflict.model !== learned.model) {
        // Conflict exists - check evidence threshold
        if (learned.evidence_count >= EVIDENCE_THRESHOLD) {
          // Override built-in rule
          const index = mergedRules.findIndex(r =>
            r.pattern.toLowerCase() === learned.pattern.toLowerCase()
          );
          mergedRules[index] = {
            pattern: learned.pattern,
            model: learned.model,
            description: `Learned from ${learned.evidence_count} feedback entries`,
            learned: true
          };

          logRuleMerge({
            pattern: learned.pattern,
            conflict_type: 'override',
            old_model: conflict.model,
            new_model: learned.model,
            evidence_count: learned.evidence_count
          });

          stats.overrides++;
        } else {
          // Insufficient evidence - keep built-in
          logRuleMerge({
            pattern: learned.pattern,
            conflict_type: 'insufficient',
            old_model: conflict.model,
            new_model: learned.model,
            evidence_count: learned.evidence_count
          });

          stats.insufficient++;
        }
      }
    } else {
      // No conflict - add learned rule
      mergedRules.push({
        pattern: learned.pattern,
        model: learned.model,
        description: `Learned from ${learned.evidence_count} feedback entries`,
        learned: true
      });

      logRuleMerge({
        pattern: learned.pattern,
        conflict_type: 'new',
        old_model: null,
        new_model: learned.model,
        evidence_count: learned.evidence_count
      });

      stats.new++;
    }
  }

  return { rules: mergedRules, stats };
}

/**
 * Generate learned rules markdown document
 * @param {Array} patterns - Array of LearnedPattern objects
 * @returns {string} Markdown content
 */
function generateLearnedRulesDoc(patterns) {
  let markdown = `# Learned Routing Rules

**Generated:** ${new Date().toISOString()}
**Source:** User feedback and Opus evaluation

These rules were automatically generated from feedback on incorrect model selections.
You can edit this file to adjust rules or delete entries.

## Quick Reference

| Pattern | Model | Evidence | Last Updated |
|---------|-------|----------|--------------|
`;

  if (patterns.length === 0) {
    markdown += `| (no learned rules yet) | - | - | - |\n`;
  } else {
    for (const pattern of patterns) {
      const lastUpdated = pattern.last_updated.split('T')[0];
      markdown += `| ${pattern.pattern} | ${pattern.model} | ${pattern.evidence_count} | ${lastUpdated} |\n`;
    }
  }

  markdown += `\n## Pattern Details\n\n`;

  if (patterns.length === 0) {
    markdown += `No learned patterns yet.\n\n`;
  } else {
    for (const pattern of patterns) {
      markdown += `### ${pattern.pattern}\n\n`;
      markdown += `- **Recommended Model:** ${pattern.model}\n`;
      markdown += `- **Evidence Count:** ${pattern.evidence_count} feedback entries\n`;
      markdown += `- **Keywords:** ${pattern.keywords.join(', ')}\n`;

      if (pattern.complexity_signals) {
        markdown += `- **Complexity Signals:**\n`;
        markdown += `  - Word count: ${pattern.complexity_signals.word_count}\n`;
        markdown += `  - Technical terms: ${pattern.complexity_signals.technical_term_count}\n`;
        markdown += `  - Security terms: ${pattern.complexity_signals.security_term_count}\n`;
      }

      markdown += `- **Example Tasks:**\n`;
      for (const example of pattern.examples.slice(0, 3)) {
        markdown += `  - ${example}\n`;
      }
      markdown += `\n`;
    }
  }

  markdown += `## How Learning Works

1. After task completion, you may be asked "Was this the right model?"
2. If you answer "no", you specify which model should have been used
3. System extracts patterns from incorrect choices
4. After 3+ similar corrections, a learned rule is created
5. Learned rules merge with built-in rules (Phase 1)

To enable learning: \`gsd-tools feedback enable --mode human\`
`;

  return markdown;
}

/**
 * Write learned rules to learned-rules.md
 * @param {Array} patterns - Array of LearnedPattern objects
 */
function writeLearnedRules(patterns) {
  const rulesDir = path.join(process.env.HOME, '.claude/skills/gsd-task-router');
  const rulesPath = path.join(rulesDir, 'learned-rules.md');

  // Ensure directory exists
  if (!fs.existsSync(rulesDir)) {
    fs.mkdirSync(rulesDir, { recursive: true });
  }

  // Generate markdown
  const markdown = generateLearnedRulesDoc(patterns);

  // Write file
  fs.writeFileSync(rulesPath, markdown);

  return rulesPath;
}

module.exports = {
  EVIDENCE_THRESHOLD,
  readFeedbackLog,
  extractPatterns,
  loadBuiltInRules,
  mergeRules,
  logRuleMerge,
  extractKeywords,
  calculateComplexitySignals,
  generateLearnedRulesDoc,
  writeLearnedRules
};
