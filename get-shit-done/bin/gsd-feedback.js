#!/usr/bin/env node

/**
 * GSD Feedback Collection Module
 *
 * Implements feedback collection system with configurable modes (ask human or ask Opus),
 * feature flag control, and structured logging of incorrect routing decisions.
 *
 * Supports AUTO-13 continuous improvement of model routing.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Default configuration structure
const DEFAULT_CONFIG = {
  feedback_enabled: false,       // Feature flag (disabled by default)
  feedback_mode: 'human',        // 'human' or 'opus'
  feedback_frequency: 'escalations', // 'all', 'escalations', 'sample'
  sample_rate: 0.1               // 10% sampling if frequency is 'sample'
};

/**
 * Load configuration from .planning/config.json
 * @returns {Object} Configuration object with feedback settings
 */
function loadConfig() {
  const configPath = path.join(process.cwd(), '.planning/config.json');

  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // Merge with defaults to ensure all fields exist
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    console.error(`Warning: Failed to parse config.json: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration to .planning/config.json
 * @param {Object} config - Configuration object to save
 */
function saveConfig(config) {
  const configPath = path.join(process.cwd(), '.planning/config.json');
  const planningDir = path.dirname(configPath);

  // Ensure .planning directory exists
  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true });
  }

  // Merge with existing config if present
  let existingConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
      console.error(`Warning: Failed to read existing config: ${error.message}`);
    }
  }

  const mergedConfig = { ...existingConfig, ...config };
  fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2) + '\n', 'utf-8');
}

/**
 * Check if feedback should be collected based on configuration and context
 * @param {Object} config - Configuration object
 * @param {Object} context - Context object with isEscalation flag
 * @returns {Object} { enabled: boolean, reason: string }
 */
function isFeedbackEnabled(config, context = {}) {
  // Check feature flag
  if (!config.feedback_enabled) {
    return { enabled: false, reason: 'feedback_enabled is false' };
  }

  // Check frequency rules
  const frequency = config.feedback_frequency || 'escalations';

  if (frequency === 'all') {
    return { enabled: true, reason: 'frequency is all' };
  }

  if (frequency === 'escalations') {
    if (context.isEscalation) {
      return { enabled: true, reason: 'escalation detected' };
    }
    return { enabled: false, reason: 'not an escalation' };
  }

  if (frequency === 'sample') {
    const sampleRate = config.sample_rate || 0.1;
    const shouldSample = Math.random() < sampleRate;
    return {
      enabled: shouldSample,
      reason: shouldSample ? 'random sample selected' : 'random sample not selected'
    };
  }

  return { enabled: false, reason: 'unknown frequency setting' };
}

/**
 * Extract task fingerprint for pattern learning
 * @param {string} taskDescription - Task description text
 * @returns {Object} Fingerprint with keywords and complexity signals
 */
function extractTaskFingerprint(taskDescription) {
  const text = taskDescription.toLowerCase();

  // Stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
  ]);

  // Extract keywords (words not in stop list)
  const words = text.match(/\b\w+\b/g) || [];
  const keywords = words.filter(word =>
    word.length > 2 && !stopWords.has(word)
  );

  // Technical term categories
  const technicalTerms = {
    auth: ['auth', 'oauth', 'jwt', 'token', 'login', 'session', 'permission'],
    database: ['database', 'db', 'sql', 'query', 'schema', 'migration', 'index'],
    api: ['api', 'endpoint', 'rest', 'graphql', 'route', 'handler'],
    security: ['security', 'csrf', 'xss', 'cors', 'encryption', 'hash', 'vulnerability'],
    testing: ['test', 'spec', 'unit', 'integration', 'e2e', 'mock', 'fixture'],
    infrastructure: ['deploy', 'docker', 'kubernetes', 'ci', 'cd', 'pipeline'],
    performance: ['performance', 'optimize', 'cache', 'lazy', 'async', 'parallel']
  };

  // Count technical terms by category
  const technicalSignals = {};
  for (const [category, terms] of Object.entries(technicalTerms)) {
    const count = terms.filter(term => text.includes(term)).length;
    if (count > 0) {
      technicalSignals[category] = count;
    }
  }

  // Complexity signals
  const complexitySignals = {
    word_count: words.length,
    unique_keywords: new Set(keywords).size,
    technical_categories: Object.keys(technicalSignals).length,
    has_security_terms: text.includes('security') || text.includes('auth') || text.includes('permission'),
    has_architecture_terms: text.includes('architecture') || text.includes('design') || text.includes('system'),
    has_multiple_verbs: (text.match(/\b(create|implement|add|update|fix|refactor|optimize)\b/g) || []).length > 1
  };

  return {
    keywords: [...new Set(keywords)].slice(0, 20), // Top 20 unique keywords
    complexity_signals: complexitySignals,
    technical_signals: technicalSignals
  };
}

/**
 * Collect feedback from human via CLI prompts
 * @param {string} taskDescription - Description of the task
 * @param {string} usedModel - Model that was used (haiku/sonnet/opus)
 * @returns {Promise<Object>} Feedback result
 */
async function collectFeedbackFromHuman(taskDescription, usedModel) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

  try {
    console.log(`\nTask: ${taskDescription}`);
    console.log(`Model used: ${usedModel}`);

    const correctAnswer = await question(`Was ${usedModel} the right choice for this task? (y/n): `);
    const correct = correctAnswer.toLowerCase().trim() === 'y';

    let shouldUse = null;
    if (!correct) {
      const modelAnswer = await question('Which model should have been used? (haiku/sonnet/opus): ');
      shouldUse = modelAnswer.toLowerCase().trim();

      // Validate model choice
      if (!['haiku', 'sonnet', 'opus'].includes(shouldUse)) {
        console.log('Invalid model choice. Defaulting to sonnet.');
        shouldUse = 'sonnet';
      }
    }

    rl.close();

    return {
      correct,
      should_use: shouldUse,
      source: 'human'
    };
  } catch (error) {
    rl.close();
    throw error;
  }
}

/**
 * Collect feedback from Opus API (stub for now)
 * @param {string} taskDescription - Description of the task
 * @param {string} usedModel - Model that was used
 * @param {Object} outcome - Task outcome data (duration, errors, etc.)
 * @returns {Promise<Object>} Feedback result
 */
async function collectFeedbackFromOpus(taskDescription, usedModel, outcome) {
  // Stub implementation - to be integrated with actual Opus API
  // For now, return a mock response

  const evaluationPrompt = `
Evaluate this model selection decision:

Task: ${taskDescription}
Model used: ${usedModel}
Duration: ${outcome.duration_ms}ms
Errors: ${outcome.errors || 0}
Success: ${outcome.success ? 'yes' : 'no'}

Was this the optimal model choice? If not, which model should have been used?
Respond in JSON: { "correct_choice": boolean, "should_use": "haiku"|"sonnet"|"opus"|null, "reasoning": "..." }
`;

  console.log('Note: Opus API integration not yet implemented. Would evaluate with prompt:');
  console.log(evaluationPrompt);

  // Mock response for now
  return {
    correct: true,
    should_use: null,
    reasoning: 'Opus API integration pending',
    source: 'opus',
    _stub: true
  };
}

/**
 * Main feedback collection function
 * @param {string} taskDescription - Description of the task
 * @param {string} usedModel - Model that was used
 * @param {Object} outcome - Task outcome data
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} FeedbackResult
 */
async function collectFeedback(taskDescription, usedModel, outcome, config) {
  const mode = config.feedback_mode || 'human';

  let feedbackResult;

  if (mode === 'human') {
    feedbackResult = await collectFeedbackFromHuman(taskDescription, usedModel);
  } else if (mode === 'opus') {
    feedbackResult = await collectFeedbackFromOpus(taskDescription, usedModel, outcome);
  } else {
    throw new Error(`Unknown feedback mode: ${mode}`);
  }

  // Add task fingerprint for pattern learning
  const fingerprint = extractTaskFingerprint(taskDescription);
  feedbackResult.task_fingerprint = fingerprint;

  return feedbackResult;
}

/**
 * Log feedback entry to JSONL file
 * @param {Object} entry - Feedback entry to log
 */
function logFeedback(entry) {
  const feedbackDir = path.join(process.cwd(), '.planning/feedback');
  const logPath = path.join(feedbackDir, 'human-feedback.jsonl');

  // Ensure feedback directory exists
  if (!fs.existsSync(feedbackDir)) {
    fs.mkdirSync(feedbackDir, { recursive: true });
  }

  // Add timestamp if not present
  if (!entry.timestamp) {
    entry.timestamp = new Date().toISOString();
  }

  // Append to JSONL file
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(logPath, line, 'utf-8');
}

/**
 * Read feedback log entries
 * @param {Object} options - Filter options
 * @returns {Array} Array of feedback entries
 */
function readFeedbackLog(options = {}) {
  const logPath = path.join(process.cwd(), '.planning/feedback/human-feedback.jsonl');

  if (!fs.existsSync(logPath)) {
    return [];
  }

  const content = fs.readFileSync(logPath, 'utf-8');
  let entries = content
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(entry => entry && !entry._comment);

  // Apply filters
  if (options.correct !== undefined) {
    entries = entries.filter(e => e.correct === options.correct);
  }

  if (options.model) {
    entries = entries.filter(e => e.should_use === options.model);
  }

  // Apply limit
  const limit = options.limit || entries.length;
  return entries.slice(-limit);
}

/**
 * Calculate feedback statistics
 * @returns {Object} Statistics object
 */
function calculateFeedbackStats() {
  const entries = readFeedbackLog();

  if (entries.length === 0) {
    return {
      total_feedback: 0,
      correct_rate: 0,
      incorrect_by_model: {},
      common_patterns: []
    };
  }

  const total = entries.length;
  const correct = entries.filter(e => e.correct).length;
  const correctRate = (correct / total * 100).toFixed(1);

  // Count incorrect by model that should have been used
  const incorrectByModel = {};
  entries
    .filter(e => !e.correct && e.should_use)
    .forEach(e => {
      incorrectByModel[e.should_use] = (incorrectByModel[e.should_use] || 0) + 1;
    });

  // Extract common patterns from incorrect selections
  const incorrectEntries = entries.filter(e => !e.correct);
  const keywordCounts = {};

  incorrectEntries.forEach(e => {
    if (e.task_fingerprint && e.task_fingerprint.keywords) {
      e.task_fingerprint.keywords.forEach(keyword => {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });
    }
  });

  const commonPatterns = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));

  return {
    total_feedback: total,
    correct_selections: correct,
    incorrect_selections: total - correct,
    correct_rate: parseFloat(correctRate),
    incorrect_by_model: incorrectByModel,
    common_patterns: commonPatterns
  };
}

// Exports
module.exports = {
  loadConfig,
  saveConfig,
  isFeedbackEnabled,
  extractTaskFingerprint,
  collectFeedback,
  logFeedback,
  readFeedbackLog,
  calculateFeedbackStats,
  DEFAULT_CONFIG
};
