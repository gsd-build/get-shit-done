#!/usr/bin/env node

/**
 * Surface Critical Learnings CLI
 *
 * Detects recurring learnings from vector DB and appends them to project CLAUDE.md.
 * Non-blocking design: always exits 0, never fails milestone workflows.
 */

const crypto = require('crypto');
const { detectCriticalLearnings } = require('./lib/criticality-detector');
const { appendToCLAUDEmd } = require('./lib/claude-md-appender');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    milestone: null,
    similarityThreshold: 0.75,
    minClusterSize: 3,
    maxLearnings: 15,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--milestone':
        parsed.milestone = args[++i];
        break;
      case '--similarity':
        parsed.similarityThreshold = parseFloat(args[++i]);
        break;
      case '--min-cluster':
        parsed.minClusterSize = parseInt(args[++i], 10);
        break;
      case '--max':
        parsed.maxLearnings = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      default:
        console.warn(`⚠ Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function showHelp() {
  console.log(`
Usage: node scripts/surface-critical-learnings.js [options]

Detects recurring learnings from the vector knowledge base and appends
them to project CLAUDE.md with marker-delimited sections.

Options:
  --milestone <version>     Milestone version for reporting (required)
  --similarity <n>          Similarity threshold for clustering (default: 0.75)
  --min-cluster <n>         Minimum cluster size for criticality (default: 3)
  --max <n>                 Maximum learnings to surface (default: 15)
  --dry-run                 Show what would be appended without writing
  --help, -h                Show this help message

Examples:
  # Surface critical learnings for milestone v1.12.0
  npm run learn:surface -- --milestone v1.12.0

  # Preview without writing
  npm run learn:surface -- --milestone v1.12.0 --dry-run

  # Adjust detection sensitivity
  npm run learn:surface -- --milestone v1.12.0 --similarity 0.7 --min-cluster 2

Notes:
  - This script is non-blocking and always exits 0
  - Requires gsd-memory to be built (cd gsd-memory && npm run build)
  - Appends to project root CLAUDE.md with auto-managed marker sections
  - Safe to re-run: replaces existing auto-generated section
`);
}

// ============================================================================
// Project ID Derivation
// ============================================================================

function getProjectId() {
  // Same pattern as query-learnings.js and extract-learnings.js
  return crypto.createHash('sha256')
    .update(process.cwd())
    .digest('hex')
    .substring(0, 16);
}

// ============================================================================
// Main Flow
// ============================================================================

async function main() {
  const args = parseArgs();

  // Show help
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Validate required args
  if (!args.milestone) {
    console.error('❌ Error: --milestone is required');
    console.log('Run with --help for usage information');
    process.exit(0); // Non-blocking: exit 0 even on validation error
  }

  console.log(`🔍 Detecting critical learnings for milestone ${args.milestone}...`);
  console.log(`   Similarity threshold: ${args.similarityThreshold}`);
  console.log(`   Min cluster size: ${args.minClusterSize}`);
  console.log(`   Max learnings: ${args.maxLearnings}`);
  console.log('');

  // Derive project ID
  const projectId = getProjectId();

  // Detect critical learnings
  const criticalLearnings = await detectCriticalLearnings(projectId, {
    similarityThreshold: args.similarityThreshold,
    minClusterSize: args.minClusterSize,
    maxLearnings: args.maxLearnings
  });

  // Handle no learnings found
  if (!criticalLearnings || criticalLearnings.length === 0) {
    console.log('ℹ️  No critical learnings detected');
    console.log('');
    console.log('This may happen if:');
    console.log('  - Knowledge base is too small (few phases completed)');
    console.log('  - Similarity threshold is too strict');
    console.log('  - Min cluster size is too large');
    console.log('  - Vector index not yet populated');
    console.log('');
    console.log('Try adjusting thresholds or completing more milestones.');
    process.exit(0);
  }

  console.log(`✓ Found ${criticalLearnings.length} critical learnings`);
  console.log('');

  // Append to CLAUDE.md
  const result = await appendToCLAUDEmd(process.cwd(), criticalLearnings, {
    dryRun: args.dryRun
  });

  // Print summary
  if (args.dryRun) {
    console.log('');
    console.log(`ℹ️  DRY RUN: Would update ${result.path}`);
  } else {
    console.log(`✓ ${result.created ? 'Created' : 'Updated'} ${result.path}`);
  }

  // Breakdown by type
  const byType = {
    decision: 0,
    pattern: 0,
    mistake: 0,
    pitfall: 0,
    unknown: 0
  };

  for (const learning of criticalLearnings) {
    const type = learning.type || 'unknown';
    if (byType[type] !== undefined) {
      byType[type]++;
    } else {
      byType.unknown++;
    }
  }

  console.log('');
  console.log('Breakdown:');
  if (byType.decision > 0) console.log(`  - Decisions: ${byType.decision}`);
  if (byType.pattern > 0) console.log(`  - Patterns: ${byType.pattern}`);
  if (byType.mistake > 0) console.log(`  - Mistakes: ${byType.mistake}`);
  if (byType.pitfall > 0) console.log(`  - Pitfalls: ${byType.pitfall}`);
  if (byType.unknown > 0) console.log(`  - Other: ${byType.unknown}`);

  console.log('');
  console.log('✓ Critical learnings surfaced successfully');

  process.exit(0);
}

// ============================================================================
// Entry Point
// ============================================================================

main().catch(error => {
  console.warn(`⚠ Error surfacing critical learnings: ${error.message}`);
  console.warn('Continuing without blocking workflow...');
  process.exit(0); // Non-blocking: always exit 0
});
