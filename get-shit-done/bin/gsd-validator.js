#!/usr/bin/env node

/**
 * gsd-validator.js
 *
 * LLM-as-a-judge validation module for Haiku task outputs.
 * Sonnet validates both correctness and reasoning quality with tiered validation depth.
 */

const fs = require('fs');
const path = require('path');

/**
 * Validation depth tiers based on task risk level
 */
const VALIDATION_DEPTH = {
  THOROUGH: 'thorough',
  STANDARD: 'standard',
  LIGHT: 'light'
};

/**
 * High-risk keywords requiring thorough validation
 */
const THOROUGH_KEYWORDS = [
  'database', 'migration', 'schema', 'security', 'auth', 'authentication',
  'authorization', 'payment', 'transaction', 'sql', 'query', 'encryption',
  'credential', 'token', 'session', 'permission', 'access control'
];

/**
 * Medium-risk keywords requiring standard validation
 */
const STANDARD_KEYWORDS = [
  'api', 'endpoint', 'integration', 'config', 'configuration', 'deploy',
  'deployment', 'route', 'routing', 'middleware', 'service', 'external'
];

/**
 * Select validation depth based on task content and risk level
 * @param {string} task - Task description or name
 * @returns {{depth: string, reason: string}}
 */
function selectValidationDepth(task) {
  const taskLower = task.toLowerCase();

  // Check for thorough keywords
  for (const keyword of THOROUGH_KEYWORDS) {
    if (taskLower.includes(keyword)) {
      return {
        depth: VALIDATION_DEPTH.THOROUGH,
        reason: `security-related task (matched: ${keyword})`
      };
    }
  }

  // Check for standard keywords
  for (const keyword of STANDARD_KEYWORDS) {
    if (taskLower.includes(keyword)) {
      return {
        depth: VALIDATION_DEPTH.STANDARD,
        reason: `integration/config task (matched: ${keyword})`
      };
    }
  }

  // Default to light
  return {
    depth: VALIDATION_DEPTH.LIGHT,
    reason: 'documentation or low-risk task'
  };
}

/**
 * Generate validation prompt for Sonnet
 * @param {string} task - Task description
 * @param {string} output - Haiku's output
 * @param {string} reasoning - Haiku's reasoning
 * @param {string} depth - Validation depth level
 * @returns {string} - Formatted validation prompt
 */
function validationPrompt(task, output, reasoning, depth = VALIDATION_DEPTH.STANDARD) {
  const depthInstructions = {
    thorough: `
THOROUGH VALIDATION (High-Risk Task):
- Deep analysis of security implications
- Detailed correctness verification
- Comprehensive edge case review
- Architecture and design pattern validation`,
    standard: `
STANDARD VALIDATION (Medium-Risk Task):
- Verify core functionality works correctly
- Check for obvious bugs or issues
- Review integration points`,
    light: `
LIGHT VALIDATION (Low-Risk Task):
- Quick sanity check
- Verify basic requirements met
- Check for obvious errors`
  };

  return `You are validating a task output from Claude Haiku. Perform a two-stage validation:

**TASK:**
${task}

**HAIKU OUTPUT:**
${output}

**HAIKU REASONING:**
${reasoning}

${depthInstructions[depth] || depthInstructions.standard}

**STAGE 1: Correctness Analysis**
Does the output meet task requirements?
- Are there bugs, missing features, or incorrect logic?
- Does it handle edge cases appropriately?
- Are there security or data integrity issues?

**STAGE 2: Reasoning Quality Analysis**
Was the approach sound?
- Were there shortcuts that compromise quality?
- Were assumptions made that should be validated?
- Are there misunderstandings of the requirements?

**RESPONSE FORMAT (JSON only):**
{
  "valid": true|false,
  "correctness_score": 0-100,
  "reasoning_score": 0-100,
  "issues": ["issue1", "issue2", ...],
  "recommendation": "PASS"|"FIX"|"REDO",
  "explanation": "Brief explanation of the decision"
}

Recommendation guidelines:
- PASS: Both scores >= 80, no critical issues
- FIX: Scores 60-79, minor issues can be patched
- REDO: Scores < 60, fundamental problems require restart`;
}

/**
 * Log validation entry to JSONL file
 * @param {Object} entry - Validation log entry
 */
function logValidation(entry) {
  const logDir = path.join(process.cwd(), '.planning', 'validation');
  const logFile = path.join(logDir, 'validation-log.jsonl');

  // Ensure directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Append to JSONL
  const logLine = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry
  }) + '\n';

  fs.appendFileSync(logFile, logLine, 'utf8');
}

/**
 * Display validation summary on failure
 * @param {Object} validationResult - Validation result object
 * @returns {string} - Formatted summary for console
 */
function displayValidationSummary(validationResult) {
  const { valid, correctness_score, reasoning_score, issues, recommendation, explanation, depth } = validationResult;

  let summary = '\n=== VALIDATION FAILED ===\n';
  summary += `Depth: ${depth}\n`;
  summary += `Correctness: ${correctness_score}/100\n`;
  summary += `Reasoning: ${reasoning_score}/100\n`;
  summary += `Recommendation: ${recommendation}\n\n`;

  if (issues && issues.length > 0) {
    summary += 'Issues found:\n';
    issues.forEach((issue, idx) => {
      summary += `  ${idx + 1}. ${issue}\n`;
    });
    summary += '\n';
  }

  summary += `Explanation: ${explanation}\n`;
  summary += '========================\n';

  return summary;
}

/**
 * Main validation function
 * @param {string} task - Task description
 * @param {string} haikuOutput - Output from Haiku
 * @param {string} haikuReasoning - Reasoning from Haiku
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} - ValidationResult
 */
async function validateTask(task, haikuOutput, haikuReasoning, options = {}) {
  // Select validation depth
  const depthResult = selectValidationDepth(task);
  const depth = options.depth || depthResult.depth;

  // Generate validation prompt
  const prompt = validationPrompt(task, haikuOutput, haikuReasoning, depth);

  // Log validation attempt
  if (options.verbose) {
    console.log('Validation prompt generated:', prompt.substring(0, 200) + '...');
  }

  // STUB: In real implementation, this would call Sonnet API
  // For now, return mock validation based on simple heuristics
  const mockValidation = generateMockValidation(haikuOutput, depth);

  const result = {
    valid: mockValidation.valid,
    correctness_score: mockValidation.correctness_score,
    reasoning_score: mockValidation.reasoning_score,
    issues: mockValidation.issues,
    recommendation: mockValidation.recommendation,
    explanation: mockValidation.explanation,
    depth: depth,
    timestamp: new Date().toISOString()
  };

  // Log to JSONL
  logValidation({
    task_id: options.task_id || 'unknown',
    haiku_model: options.haiku_model || 'haiku',
    validator_model: options.validator_model || 'sonnet',
    depth: depth,
    result: result
  });

  return result;
}

/**
 * Generate mock validation for infrastructure testing
 * @param {string} output - Task output to validate
 * @param {string} depth - Validation depth
 * @returns {Object} - Mock validation result
 */
function generateMockValidation(output, depth) {
  // Simple heuristics for mock validation
  const hasCode = output.includes('function') || output.includes('const ') || output.includes('class ');
  const hasExports = output.includes('module.exports') || output.includes('export ');
  const hasTests = output.includes('test(') || output.includes('describe(');
  const isLongEnough = output.length > 100;

  let correctness = 85;
  let reasoning = 80;
  const issues = [];

  if (!isLongEnough) {
    correctness -= 20;
    reasoning -= 15;
    issues.push('Output appears incomplete or too brief');
  }

  if (hasCode && !hasExports) {
    correctness -= 10;
    issues.push('Code lacks proper exports');
  }

  // Depth affects scoring threshold
  if (depth === VALIDATION_DEPTH.THOROUGH) {
    correctness -= 5; // Higher bar for thorough validation
  }

  const valid = correctness >= 80 && reasoning >= 80;
  let recommendation = 'PASS';

  if (correctness < 60 || reasoning < 60) {
    recommendation = 'REDO';
  } else if (correctness < 80 || reasoning < 80) {
    recommendation = 'FIX';
  }

  return {
    valid,
    correctness_score: Math.max(0, correctness),
    reasoning_score: Math.max(0, reasoning),
    issues: issues.length > 0 ? issues : ['None'],
    recommendation,
    explanation: valid
      ? 'Output meets requirements with sound approach'
      : `Output needs ${recommendation.toLowerCase()}: ${issues.join(', ')}`
  };
}

/**
 * Determine if retry with Sonnet is needed
 * @param {string} task - Task description
 * @param {Object} validationResult - Validation result from validateTask
 * @returns {Object} - Retry decision
 */
function retryWithSonnet(task, validationResult) {
  const { recommendation, correctness_score, reasoning_score } = validationResult;

  // Retry needed if recommendation is REDO or FIX with low scores
  const needsRetry =
    recommendation === 'REDO' ||
    (recommendation === 'FIX' && (correctness_score < 70 || reasoning_score < 70));

  if (!needsRetry) {
    return {
      retry_needed: false,
      new_model: null,
      reason: 'Validation passed or issues are minor'
    };
  }

  return {
    retry_needed: true,
    new_model: 'sonnet',
    reason: `Validation failed: ${recommendation} - Correctness: ${correctness_score}, Reasoning: ${reasoning_score}`
  };
}

// Exports
module.exports = {
  VALIDATION_DEPTH,
  selectValidationDepth,
  validationPrompt,
  validateTask,
  logValidation,
  displayValidationSummary,
  retryWithSonnet
};

// CLI support if run directly
if (require.main === module) {
  console.log('gsd-validator.js: Use via gsd-tools.js validation commands');
  console.log('Example: node gsd-tools.js validation depth "create user login endpoint"');
}
