#!/usr/bin/env node

/**
 * query-learnings.js - CLI wrapper for vector DB queries
 *
 * Orchestrator-friendly CLI tool for querying past learnings from the vector store.
 * Designed for bash-context orchestrator workflows (plan-phase.md, verify-phase.md).
 *
 * Usage:
 *   node scripts/query-learnings.js --query "..." [--type decision|pattern|anti-pattern] [--top-k 5] [--min-score 0.35] [--format context-block|checklist|json]
 *
 * Features:
 * - Graceful degradation: never fails, always exits 0
 * - Multiple output formats for different use cases
 * - Type filtering for targeted queries
 * - Configurable relevance thresholds
 *
 * @see Phase 05-query-integration
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    query: null,
    type: null,
    topK: 5,
    minScore: 0.35,
    format: 'context-block'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      case '--query':
        parsed.query = args[++i];
        break;
      case '--type':
        parsed.type = args[++i];
        break;
      case '--top-k':
        parsed.topK = parseInt(args[++i], 10);
        break;
      case '--min-score':
        parsed.minScore = parseFloat(args[++i]);
        break;
      case '--format':
        parsed.format = args[++i];
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        showHelp();
        process.exit(1);
    }
  }

  // Validate required args
  if (!parsed.query) {
    console.error('Error: --query is required');
    showHelp();
    process.exit(1);
  }

  // Validate type if provided
  if (parsed.type && !['decision', 'pattern', 'anti-pattern'].includes(parsed.type)) {
    console.error(`Error: --type must be one of: decision, pattern, anti-pattern`);
    process.exit(1);
  }

  // Validate format
  if (!['context-block', 'checklist', 'json'].includes(parsed.format)) {
    console.error(`Error: --format must be one of: context-block, checklist, json`);
    process.exit(1);
  }

  return parsed;
}

function showHelp() {
  console.log(`
query-learnings.js - Query past learnings from vector DB

Usage:
  node scripts/query-learnings.js --query "..." [options]

Required:
  --query <text>           Search query text

Options:
  --type <type>            Filter by type: decision, pattern, anti-pattern
  --top-k <n>              Number of results (default: 5)
  --min-score <n>          Minimum relevance threshold (default: 0.35)
  --format <fmt>           Output format (default: context-block)
                           - context-block: Structured markdown for prompt injection
                           - checklist: Numbered list for verification
                           - json: Raw JSON array

Examples:
  # Query decisions about vector databases
  node scripts/query-learnings.js --query "vector database patterns" --type decision

  # Get anti-patterns for verification
  node scripts/query-learnings.js --query "common mistakes" --type anti-pattern --format checklist

  # Get all relevant learnings as JSON
  node scripts/query-learnings.js --query "authentication" --format json
`);
}

// ============================================================================
// Project ID Derivation
// ============================================================================

function getProjectId() {
  // Same pattern as extract-learnings.js (line 737-740)
  return crypto.createHash('sha256')
    .update(process.cwd())
    .digest('hex')
    .substring(0, 16);
}

// ============================================================================
// Vector Store Access
// ============================================================================

async function queryVectorStore(queryText, projectId, topK, typeFilter) {
  // Check if gsd-memory is built
  const transformerPath = path.join(__dirname, '../gsd-memory/dist/embeddings/transformer.js');
  if (!fs.existsSync(transformerPath)) {
    console.warn('⚠ gsd-memory not built (run: cd gsd-memory && npm run build)');
    return null;
  }

  // Check if vectra is installed
  const vectraPath = path.join(__dirname, '../gsd-memory/node_modules/vectra');
  if (!fs.existsSync(vectraPath)) {
    console.warn('⚠ vectra not installed in gsd-memory (run: cd gsd-memory && npm install)');
    return null;
  }

  try {
    // Import dependencies
    const { generateEmbedding } = require(transformerPath);
    const { LocalIndex } = require(path.join(vectraPath, 'lib/index.js'));

    // Check if vector index exists
    const indexPath = path.join(os.homedir(), '.gsd', 'knowledge', projectId);
    if (!fs.existsSync(indexPath)) {
      // Cold start - index not created yet
      return null;
    }

    // Open index
    const index = new LocalIndex(indexPath);
    if (!(await index.isIndexCreated())) {
      return null;
    }

    // Generate query embedding
    const embedding = await generateEmbedding(queryText);

    // Search index (vectra 0.12.3 API: queryItems(vector, query_string, topK))
    const results = await index.queryItems(embedding, '', topK);

    // Filter by type if specified (per Phase 1 pattern: type filtering at query layer)
    if (typeFilter) {
      return results
        .filter(item => item.item?.metadata?.type === typeFilter)
        .map(item => ({
          text: item.item.metadata?.text || '',
          type: item.item.metadata?.type || 'unknown',
          source: item.item.metadata?.milestone || '',
          phase: item.item.metadata?.phase || '',
          score: item.score || 0
        }));
    }

    // Return all results
    return results.map(item => ({
      text: item.item.metadata?.text || '',
      type: item.item.metadata?.type || 'unknown',
      source: item.item.metadata?.milestone || '',
      phase: item.item.metadata?.phase || '',
      score: item.score || 0
    }));
  } catch (err) {
    console.warn(`⚠ Vector query failed: ${err.message}`);
    return null;
  }
}

// ============================================================================
// Output Formatters
// ============================================================================

function formatContextBlock(results, minScore) {
  const filtered = results.filter(r => r.score >= minScore);

  if (filtered.length === 0) {
    return '';
  }

  return filtered.map(item => {
    const typeLabel = item.type.toUpperCase();
    const score = item.score.toFixed(2);
    const sourceInfo = item.source ? `${item.source}` : 'Unknown source';
    const phaseInfo = item.phase ? ` | Phase: ${item.phase}` : '';

    return `- **${typeLabel}** (score: ${score}): ${item.text}\n  _Source: ${sourceInfo}${phaseInfo}_`;
  }).join('\n\n');
}

function formatChecklist(results, minScore) {
  const filtered = results.filter(r => r.score >= minScore);

  if (filtered.length === 0) {
    return '';
  }

  return filtered.map((item, idx) => {
    const typeLabel = item.type === 'anti-pattern' ? 'Pitfall' : item.type.toUpperCase();
    const score = item.score.toFixed(2);
    const sourceInfo = item.source ? `${item.source}` : 'Unknown source';
    const checkText = item.type === 'anti-pattern'
      ? `Check: Verify this anti-pattern is avoided`
      : `Source: ${sourceInfo}`;

    return `${idx + 1}. **${typeLabel}** (score: ${score}): ${item.text}\n   ${checkText}`;
  }).join('\n\n');
}

function formatJson(results, minScore) {
  const filtered = results.filter(r => r.score >= minScore);
  return JSON.stringify(filtered, null, 2);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs();

  // Derive project ID
  const projectId = getProjectId();

  // Query vector store
  const results = await queryVectorStore(args.query, projectId, args.topK, args.type);

  // Handle null/empty results
  if (!results || results.length === 0) {
    console.log('No past learnings found for this query (knowledge base may be empty or query too specific)');
    process.exit(0);
  }

  // Format output
  let output;
  switch (args.format) {
    case 'context-block':
      output = formatContextBlock(results, args.minScore);
      break;
    case 'checklist':
      output = formatChecklist(results, args.minScore);
      break;
    case 'json':
      output = formatJson(results, args.minScore);
      break;
  }

  // Handle empty filtered results
  if (!output || output.trim() === '' || output === '[]') {
    console.log('No past learnings found for this query (knowledge base may be empty or query too specific)');
  } else {
    console.log(output);
  }

  process.exit(0);
}

// Run
main().catch(err => {
  console.warn(`⚠ Query failed: ${err.message}`);
  console.log('No past learnings found for this query (knowledge base may be empty or query too specific)');
  process.exit(0);
});
