#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { HeaderExtractor } = require('../compression/header-extractor');
const { loadHookConfig, matchesPattern, checkCircuitBreaker, recordSuccess, recordFailure, getCircuitBreakerStatus } = require('./config');
const { CompressionCache } = require('./compression-cache');

/**
 * PreToolUse Hook: Documentation Compression
 *
 * Purpose: Intercept Read operations on GSD documentation files and return compressed summaries
 * Input: JSON via stdin { tool, parameters }
 * Output: JSON via stdout { additionalContext, metadata } or exit 0 (pass-through)
 */

// Quick pattern check for documentation files
const DOC_PATTERNS = [
  /.*-RESEARCH\.md$/,
  /.*-PLAN\.md$/,
  /.*-CONTEXT\.md$/,
  /STATE\.md$/,
  /ROADMAP\.md$/,
  /PROJECT\.md$/
];

/**
 * Main hook execution
 */
async function main() {
  try {
    // Read hook input from stdin
    const input = await readStdin();

    if (!input) {
      // No input, pass through
      process.exit(0);
    }

    const hookData = JSON.parse(input);
    const { tool, parameters } = hookData;

    // Only intercept Read operations
    if (tool !== 'Read') {
      process.exit(0);
    }

    // Check if file_path parameter exists
    if (!parameters || !parameters.file_path) {
      process.exit(0);
    }

    const filePath = parameters.file_path;

    // Expand ~ to home directory
    const absolutePath = filePath.startsWith('~')
      ? path.join(process.env.HOME, filePath.slice(1))
      : path.resolve(filePath);

    // Quick check: Does this match our doc patterns?
    const matchesDocPattern = DOC_PATTERNS.some(pattern => pattern.test(absolutePath));
    if (!matchesDocPattern) {
      process.exit(0);
    }

    // Load configuration
    const config = loadHookConfig();

    // Check if compression is enabled
    if (!config.enabled || !config.compression.enabled) {
      process.exit(0);
    }

    // Check circuit breaker BEFORE attempting compression
    if (!checkCircuitBreaker()) {
      // Circuit open - pass through
      process.exit(0);
    }

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      process.exit(0);
    }

    // Check if file matches patterns (using config patterns)
    const matches = matchesPattern(
      absolutePath,
      config.compression.patterns,
      config.compression.exclude
    );

    if (!matches) {
      process.exit(0);
    }

    // Get file content and stats
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const stat = fs.statSync(absolutePath);

    // Check file size threshold (min_file_lines)
    const lineCount = content.split('\n').length;
    if (lineCount < config.compression.min_file_lines) {
      // File too small, pass through
      process.exit(0);
    }

    // Initialize cache
    const cache = new CompressionCache(config.compression.cache_ttl);

    // Check cache first
    const cached = cache.get(absolutePath, content, stat.mtimeMs);
    if (cached) {
      // Cache hit!
      const output = {
        additionalContext: cached,
        metadata: {
          fromCache: true,
          path: absolutePath,
          lineCount,
          strategy: config.compression.strategy
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }

    // Cache miss - compress the file
    const extractor = new HeaderExtractor();
    const { summary, sections } = extractor.extractSummary(content, absolutePath);

    // Record success after successful compression
    recordSuccess();

    // Store in cache
    cache.set(absolutePath, content, stat.mtimeMs, summary);

    // Calculate reduction
    const originalChars = content.length;
    const compressedChars = summary.length;
    const reduction = Math.round((1 - compressedChars / originalChars) * 100);

    // Get circuit breaker status for metadata
    const cbStatus = getCircuitBreakerStatus();

    // Return compressed summary
    const output = {
      additionalContext: summary,
      metadata: {
        fromCache: false,
        path: absolutePath,
        lineCount,
        sections,
        strategy: config.compression.strategy,
        originalChars,
        compressedChars,
        reduction: `${reduction}%`,
        circuitBreaker: cbStatus.state
      }
    };

    console.log(JSON.stringify(output));
    process.exit(0);

  } catch (error) {
    // Log error to stderr (not stdout which is hook output)
    console.error(`[doc-compression-hook] Error: ${error.message}`);
    console.error(error.stack);

    // Record failure in circuit breaker
    recordFailure();

    // Return pass-through on error (fallback behavior)
    process.exit(0);
  }
}

/**
 * Read stdin asynchronously
 * @returns {Promise<string>} Input from stdin
 */
function readStdin() {
  return new Promise((resolve) => {
    let data = '';

    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    // Handle case where stdin is empty
    process.stdin.on('error', () => {
      resolve('');
    });
  });
}

// Run the hook
main();
