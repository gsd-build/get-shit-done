#!/usr/bin/env node
/**
 * Extract Learnings from Phase Summaries and Verification Reports
 *
 * Parses completed phase documentation to extract structured knowledge:
 * - Decisions made and their rationale
 * - Patterns that worked well
 * - Mistakes and how to prevent them
 * - Pitfalls and their complexity
 *
 * Combines structured parsing (frontmatter) with optional LLM extraction
 * (Claude API) for narrative content analysis.
 *
 * Usage:
 *   node scripts/extract-learnings.js --milestone v1.12.0 [options]
 *
 * Options:
 *   --milestone <version>   Milestone version to extract learnings for (required)
 *   --phase <number>        Extract only a specific phase (optional)
 *   --structured-only       Skip LLM extraction, use only frontmatter parsing
 *   --dry-run              Show what would be extracted without saving
 *   --help                 Show this help message
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fg = require('fast-glob');
const matter = require('gray-matter');
const { PhaseLearningsSchema } = require('./lib/learning-schema');

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

const args = process.argv.slice(2);
const flags = {
  milestone: null,
  phase: null,
  structuredOnly: false,
  dryRun: false,
  help: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help' || args[i] === '-h') {
    flags.help = true;
  } else if (args[i] === '--milestone' && args[i + 1]) {
    flags.milestone = args[i + 1];
    i++;
  } else if (args[i] === '--phase' && args[i + 1]) {
    flags.phase = args[i + 1];
    i++;
  } else if (args[i] === '--structured-only') {
    flags.structuredOnly = true;
  } else if (args[i] === '--dry-run') {
    flags.dryRun = true;
  }
}

if (flags.help) {
  console.log(`
Extract Learnings from Phase Summaries and Verification Reports

Usage:
  node scripts/extract-learnings.js --milestone <version> [options]

Options:
  --milestone <version>   Milestone version to extract learnings for (required)
  --phase <number>        Extract only a specific phase (optional)
  --structured-only       Skip LLM extraction, use only frontmatter parsing
  --dry-run              Show what would be extracted without saving
  --help                 Show this help message

Examples:
  # Extract learnings from all phases for v1.12.0
  node scripts/extract-learnings.js --milestone v1.12.0

  # Extract learnings from phase 01 only
  node scripts/extract-learnings.js --milestone v1.12.0 --phase 01

  # Preview extraction without saving
  node scripts/extract-learnings.js --milestone v1.12.0 --dry-run

  # Use structured-only mode (no API key needed)
  node scripts/extract-learnings.js --milestone v1.12.0 --structured-only
  `);
  process.exit(0);
}

if (!flags.milestone) {
  console.error('Error: --milestone flag is required\n');
  console.log('Usage: node scripts/extract-learnings.js --milestone <version>');
  console.log('       Run with --help for more options');
  process.exit(1);
}

// =============================================================================
// CONFIGURATION LOADING
// =============================================================================

function loadLearningConfig() {
  const configPath = path.join(process.cwd(), '.planning', 'config.json');

  const defaults = {
    auto_extract_on_milestone: true,
    auto_extract_on_phase: false,
    anthropic_api_key_env: 'ANTHROPIC_API_KEY'
  };

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...defaults, ...(parsed.learning || {}) };
  } catch (err) {
    // Config file doesn't exist or is invalid, use defaults
    return defaults;
  }
}

const config = loadLearningConfig();

// =============================================================================
// FILE DISCOVERY
// =============================================================================

/**
 * Find all SUMMARY.md and VERIFICATION.md files in .planning/phases/
 */
async function findPhaseDocuments() {
  const planningDir = path.join(process.cwd(), '.planning', 'phases');

  if (!fs.existsSync(planningDir)) {
    console.error(`Error: Planning directory not found: ${planningDir}`);
    process.exit(1);
  }

  // Find all summary and verification files
  const summaryPattern = flags.phase
    ? `.planning/phases/${flags.phase}-*/*-SUMMARY.md`
    : '.planning/phases/**/*-SUMMARY.md';

  const verificationPattern = flags.phase
    ? `.planning/phases/${flags.phase}-*/*-VERIFICATION.md`
    : '.planning/phases/**/*-VERIFICATION.md';

  const summaries = await fg(summaryPattern, {
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  const verifications = await fg(verificationPattern, {
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  return { summaries, verifications };
}

// =============================================================================
// STRUCTURED EXTRACTION (Frontmatter Parsing)
// =============================================================================

/**
 * Extract structured learnings from SUMMARY.md frontmatter
 */
function extractFromSummary(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { data: frontmatter, content: body } = matter(content);

  const learnings = {
    decisions: [],
    patterns: [],
    mistakes: [],
    pitfalls: []
  };

  // Extract from frontmatter
  if (frontmatter['key-decisions']) {
    const decisions = Array.isArray(frontmatter['key-decisions'])
      ? frontmatter['key-decisions']
      : [frontmatter['key-decisions']];

    for (const dec of decisions) {
      if (typeof dec === 'string') {
        learnings.decisions.push({
          decision: dec,
          rationale: 'Extracted from summary frontmatter'
        });
      } else if (typeof dec === 'object') {
        learnings.decisions.push(dec);
      }
    }
  }

  if (frontmatter['patterns-established']) {
    const patterns = Array.isArray(frontmatter['patterns-established'])
      ? frontmatter['patterns-established']
      : [frontmatter['patterns-established']];

    for (const pat of patterns) {
      if (typeof pat === 'string') {
        learnings.patterns.push({
          pattern: pat,
          context: 'Extracted from summary frontmatter'
        });
      } else if (typeof pat === 'object') {
        learnings.patterns.push(pat);
      }
    }
  }

  // Parse body for "Decisions Made" section
  const decisionsSection = body.match(/##\s*Decisions Made\s*\n([\s\S]*?)(?=\n##|\n---|\n\*\*|$)/i);
  if (decisionsSection) {
    const lines = decisionsSection[1].split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.startsWith('-') || line.startsWith('*')) {
        const text = line.replace(/^[-*]\s*/, '').trim();
        if (text && !learnings.decisions.some(d => d.decision === text)) {
          learnings.decisions.push({
            decision: text,
            rationale: 'From summary narrative'
          });
        }
      }
    }
  }

  // Parse body for "Deviations from Plan" section
  const deviationsSection = body.match(/##\s*Deviations from Plan\s*\n([\s\S]*?)(?=\n##|\n---|\n\*\*|$)/i);
  if (deviationsSection) {
    const lines = deviationsSection[1].split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.includes('Rule 1') || line.includes('Bug') || line.includes('Fixed')) {
        learnings.mistakes.push({
          what: line.replace(/^[-*#]\s*/, '').trim(),
          why: 'Deviation during plan execution',
          prevention: 'Caught and fixed inline during execution'
        });
      }
    }
  }

  return learnings;
}

/**
 * Extract structured learnings from VERIFICATION.md
 */
function extractFromVerification(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const learnings = {
    decisions: [],
    patterns: [],
    mistakes: [],
    pitfalls: []
  };

  // Parse "Anti-Patterns Found" table
  const antiPatternsMatch = content.match(/##\s*Anti-Patterns Found[\s\S]*?\n\|\s*Anti-Pattern([\s\S]*?)(?=\n##|\n---|\n\*\*|$)/i);
  if (antiPatternsMatch) {
    const tableContent = antiPatternsMatch[1];
    const rows = tableContent.split('\n').filter(l => l.includes('|') && !l.includes('---'));

    for (const row of rows) {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 3) {
        learnings.mistakes.push({
          what: cells[0],
          why: cells[1],
          prevention: cells[2]
        });
      }
    }
  }

  // Parse "Issues Encountered" section
  const issuesSection = content.match(/##\s*Issues Encountered\s*\n([\s\S]*?)(?=\n##|\n---|\n\*\*|$)/i);
  if (issuesSection) {
    const lines = issuesSection[1].split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.startsWith('-') || line.startsWith('*')) {
        const text = line.replace(/^[-*]\s*/, '').trim();
        if (text) {
          learnings.pitfalls.push({
            description: text,
            complexity: 'Encountered during verification',
            solution: 'Documented in verification report'
          });
        }
      }
    }
  }

  return learnings;
}

// =============================================================================
// LLM EXTRACTION (Claude API)
// =============================================================================

/**
 * Extract learnings using Claude API for narrative analysis
 */
async function extractWithLLM(content, documentType, filePath) {
  // Check for API key
  const apiKey = process.env[config.anthropic_api_key_env];

  if (!apiKey) {
    console.warn(`⚠️  ${config.anthropic_api_key_env} not set — using structured-only extraction`);
    console.warn(`   Set API key for enhanced extraction from narrative content:`);
    console.warn(`   export ${config.anthropic_api_key_env}=sk-ant-...`);
    return { decisions: [], patterns: [], mistakes: [], pitfalls: [] };
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    const prompt = `You are a knowledge extraction specialist. Extract structured learnings from this ${documentType} document.

<document>
${content}
</document>

<instructions>
Extract the following types of learnings:

1. **Decisions**: Important choices made during this phase
   - What was decided
   - Why (rationale)
   - What alternatives were considered (if mentioned)
   - Outcome (if mentioned)

2. **Patterns**: Reusable approaches that worked well
   - Pattern name or description
   - Context where it applies
   - Example from this phase (if mentioned)
   - Anti-pattern to avoid (if mentioned)

3. **Mistakes**: Things that went wrong
   - What happened
   - Why it happened
   - How to prevent it
   - Warning signs to detect early (if mentioned)

4. **Pitfalls**: Things that seemed simple but had hidden complexity
   - Description
   - Why it was more complex than expected
   - Solution used
</instructions>

<examples>
<example>
<input_section>
**Decision:** Use Zod for schema validation instead of manual checks
- **Rationale:** Type safety and runtime validation in one library
- **Alternatives:** JSON Schema (more verbose), manual checks (error-prone)
- **Outcome:** Caught 3 schema bugs before production
</input_section>

<output>
{
  "decision": "Use Zod for schema validation instead of manual checks",
  "rationale": "Type safety and runtime validation in one library",
  "alternatives": ["JSON Schema (more verbose)", "manual checks (error-prone)"],
  "outcome": "Caught 3 schema bugs before production"
}
</output>
</example>

<example>
<input_section>
**Mistake:** Assumed config.json parsing with regex would handle all edge cases
- **Why:** Didn't test with nested objects or escaped quotes
- **Prevention:** Use JSON.parse with try/catch, validate with schema
- **Warning signs:** Runtime errors when reading config with special characters
</input_section>

<output>
{
  "what": "Assumed config.json parsing with regex would handle all edge cases",
  "why": "Didn't test with nested objects or escaped quotes",
  "prevention": "Use JSON.parse with try/catch, validate with schema",
  "warningSigns": ["Runtime errors when reading config with special characters"]
}
</output>
</example>
</examples>

Return ONLY valid JSON with this structure:
{
  "decisions": [ /* array of decision objects */ ],
  "patterns": [ /* array of pattern objects */ ],
  "mistakes": [ /* array of mistake objects */ ],
  "pitfalls": [ /* array of pitfall objects */ ]
}

Be thorough but concise. Focus on learnings that would help future phases avoid mistakes or make better decisions.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn(`⚠️  No JSON found in LLM response for ${path.basename(filePath)}`);
      return { decisions: [], patterns: [], mistakes: [], pitfalls: [] };
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return extracted;

  } catch (err) {
    console.warn(`⚠️  LLM extraction failed for ${path.basename(filePath)}: ${err.message}`);
    return { decisions: [], patterns: [], mistakes: [], pitfalls: [] };
  }
}

// =============================================================================
// MERGE AND DEDUPLICATE
// =============================================================================

/**
 * Merge structured and LLM-extracted learnings, removing duplicates
 */
function mergeLearnings(structured, llm) {
  const merged = {
    decisions: [...structured.decisions],
    patterns: [...structured.patterns],
    mistakes: [...structured.mistakes],
    pitfalls: [...structured.pitfalls]
  };

  // Helper to check for duplicates
  const isDuplicate = (arr, item, key) => {
    return arr.some(existing =>
      existing[key].toLowerCase().includes(item[key].toLowerCase()) ||
      item[key].toLowerCase().includes(existing[key].toLowerCase())
    );
  };

  // Merge decisions (prefer LLM version for richer content)
  for (const decision of llm.decisions || []) {
    if (!isDuplicate(merged.decisions, decision, 'decision')) {
      merged.decisions.push(decision);
    }
  }

  // Merge patterns
  for (const pattern of llm.patterns || []) {
    if (!isDuplicate(merged.patterns, pattern, 'pattern')) {
      merged.patterns.push(pattern);
    }
  }

  // Merge mistakes
  for (const mistake of llm.mistakes || []) {
    if (!isDuplicate(merged.mistakes, mistake, 'what')) {
      merged.mistakes.push(mistake);
    }
  }

  // Merge pitfalls
  for (const pitfall of llm.pitfalls || []) {
    if (!isDuplicate(merged.pitfalls, pitfall, 'description')) {
      merged.pitfalls.push(pitfall);
    }
  }

  return merged;
}

// =============================================================================
// SAVE JSON
// =============================================================================

/**
 * Save learnings to JSON files
 */
function saveLearnings(learnings, milestone, phase) {
  const learningsDir = path.join(process.cwd(), '.planning', 'learnings', milestone);

  if (!flags.dryRun) {
    fs.mkdirSync(learningsDir, { recursive: true });
  }

  const filename = `phase-${phase}-learnings.json`;
  const filepath = path.join(learningsDir, filename);

  const output = {
    milestone,
    phase,
    extractedAt: learnings.extractedAt,
    source: learnings.source,
    learnings: {
      decisions: learnings.decisions,
      patterns: learnings.patterns,
      mistakes: learnings.mistakes,
      pitfalls: learnings.pitfalls
    }
  };

  if (flags.dryRun) {
    console.log(`[DRY RUN] Would save to: ${filepath}`);
  } else {
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`✓ Saved: ${filename}`);
  }

  return filepath;
}

/**
 * Save extraction metadata
 */
function saveMetadata(phasesProcessed, totalLearnings, milestone) {
  const learningsDir = path.join(process.cwd(), '.planning', 'learnings', milestone);
  const metaPath = path.join(learningsDir, 'meta.json');

  const meta = {
    milestone,
    extractedAt: new Date().toISOString(),
    phasesProcessed,
    totalLearnings,
    mode: flags.structuredOnly ? 'structured-only' : 'structured+llm',
    apiKeyUsed: !flags.structuredOnly && !!process.env[config.anthropic_api_key_env]
  };

  if (flags.dryRun) {
    console.log(`[DRY RUN] Would save metadata to: ${metaPath}`);
  } else {
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  }

  return metaPath;
}

// =============================================================================
// VECTOR EMBEDDING
// =============================================================================

/**
 * Embed learnings into vector database
 */
async function embedLearnings(learnings, milestone, phase, projectId) {
  // Check if gsd-memory is built
  const gsdMemoryDist = path.join(process.cwd(), 'gsd-memory', 'dist');

  if (!fs.existsSync(gsdMemoryDist)) {
    console.warn(`⚠️  gsd-memory not built — skipping vector embeddings`);
    console.warn(`   JSON files saved successfully (primary artifact)`);
    console.warn(`   To enable embeddings: cd gsd-memory && npm run build`);
    return 0;
  }

  try {
    // Import vector tools from gsd-memory
    const { generateEmbedding } = require('../gsd-memory/dist/embeddings/transformer.js');

    // Try to load vectra from gsd-memory's node_modules
    let LocalIndex;
    try {
      const vectraPath = path.join(process.cwd(), 'gsd-memory', 'node_modules', 'vectra');
      LocalIndex = require(vectraPath).LocalIndex;
    } catch (e) {
      console.warn(`⚠️  vectra not found in gsd-memory/node_modules — skipping vector embeddings`);
      console.warn(`   JSON files saved successfully (primary artifact)`);
      console.warn(`   To enable embeddings: cd gsd-memory && npm install`);
      return 0;
    }

    // Initialize vector store for this project
    const vectorStoreDir = path.join(require('os').homedir(), '.gsd', 'knowledge', projectId);
    fs.mkdirSync(vectorStoreDir, { recursive: true });

    const index = new LocalIndex(vectorStoreDir);

    if (!await index.isIndexCreated()) {
      await index.createIndex();
    }

    let embeddedCount = 0;

    // Embed decisions
    for (const [idx, decision] of learnings.decisions.entries()) {
      const text = `Decision: ${decision.decision}. Rationale: ${decision.rationale}`;
      const vector = await generateEmbedding(text);

      if (!flags.dryRun) {
        await index.insertItem({
          id: `${milestone}-${phase}-decision-${idx}`,
          vector,
          metadata: {
            type: 'decision',
            learningType: 'decision',
            milestone,
            phase,
            text,
            ...decision
          }
        });
      }
      embeddedCount++;
    }

    // Embed patterns
    for (const [idx, pattern] of learnings.patterns.entries()) {
      const text = `Pattern: ${pattern.pattern}. Context: ${pattern.context}`;
      const vector = await generateEmbedding(text);

      if (!flags.dryRun) {
        await index.insertItem({
          id: `${milestone}-${phase}-pattern-${idx}`,
          vector,
          metadata: {
            type: 'pattern',
            learningType: 'pattern',
            milestone,
            phase,
            text,
            ...pattern
          }
        });
      }
      embeddedCount++;
    }

    // Embed mistakes
    for (const [idx, mistake] of learnings.mistakes.entries()) {
      const text = `Mistake: ${mistake.what}. Why: ${mistake.why}. Prevention: ${mistake.prevention}`;
      const vector = await generateEmbedding(text);

      if (!flags.dryRun) {
        await index.insertItem({
          id: `${milestone}-${phase}-mistake-${idx}`,
          vector,
          metadata: {
            type: 'anti-pattern',
            learningType: 'mistake',
            milestone,
            phase,
            text,
            ...mistake
          }
        });
      }
      embeddedCount++;
    }

    // Embed pitfalls
    for (const [idx, pitfall] of learnings.pitfalls.entries()) {
      const text = `Pitfall: ${pitfall.description}. Complexity: ${pitfall.complexity}. Solution: ${pitfall.solution}`;
      const vector = await generateEmbedding(text);

      if (!flags.dryRun) {
        await index.insertItem({
          id: `${milestone}-${phase}-pitfall-${idx}`,
          vector,
          metadata: {
            type: 'anti-pattern',
            learningType: 'pitfall',
            milestone,
            phase,
            text,
            ...pitfall
          }
        });
      }
      embeddedCount++;
    }

    if (flags.dryRun) {
      console.log(`[DRY RUN] Would embed ${embeddedCount} learnings to vector DB`);
    }

    return embeddedCount;

  } catch (err) {
    console.warn(`⚠️  Vector embedding failed: ${err.message}`);
    console.warn(`   JSON files saved successfully (primary artifact)`);
    return 0;
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('Knowledge Extraction');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Milestone: ${flags.milestone}`);
  console.log(`Mode: ${flags.structuredOnly ? 'structured-only' : 'structured + LLM'}`);
  if (flags.phase) {
    console.log(`Phase: ${flags.phase}`);
  }
  if (flags.dryRun) {
    console.log(`[DRY RUN MODE - no files will be saved]`);
  }
  console.log('');

  // Discover files
  const { summaries, verifications } = await findPhaseDocuments();

  console.log(`Found ${summaries.length} summary files, ${verifications.length} verification files`);
  console.log('');

  if (summaries.length === 0 && verifications.length === 0) {
    console.log('No phase documents found. Nothing to extract.');
    process.exit(0);
  }

  // Extract from each phase
  const phasesProcessed = [];
  const totalLearnings = {
    decisions: 0,
    patterns: 0,
    mistakes: 0,
    pitfalls: 0
  };

  // Derive project ID from directory path
  const projectId = crypto.createHash('sha256')
    .update(process.cwd())
    .digest('hex')
    .substring(0, 16);

  // Group files by phase
  const phaseGroups = {};

  for (const summaryPath of summaries) {
    const phaseMatch = path.basename(path.dirname(summaryPath)).match(/^(\d+)-/);
    if (phaseMatch) {
      const phaseNum = phaseMatch[1];
      if (!phaseGroups[phaseNum]) {
        phaseGroups[phaseNum] = { summaries: [], verifications: [] };
      }
      phaseGroups[phaseNum].summaries.push(summaryPath);
    }
  }

  for (const verificationPath of verifications) {
    const phaseMatch = path.basename(path.dirname(verificationPath)).match(/^(\d+)-/);
    if (phaseMatch) {
      const phaseNum = phaseMatch[1];
      if (!phaseGroups[phaseNum]) {
        phaseGroups[phaseNum] = { summaries: [], verifications: [] };
      }
      phaseGroups[phaseNum].verifications.push(verificationPath);
    }
  }

  // Process each phase
  for (const [phaseNum, files] of Object.entries(phaseGroups).sort()) {
    console.log(`Processing Phase ${phaseNum}...`);

    let phaseLearnings = {
      decisions: [],
      patterns: [],
      mistakes: [],
      pitfalls: [],
      source: []
    };

    // Extract from summaries
    for (const summaryPath of files.summaries) {
      console.log(`  - ${path.basename(summaryPath)}`);
      phaseLearnings.source.push(path.basename(summaryPath));

      // Structured extraction
      const structured = extractFromSummary(summaryPath);

      // LLM extraction (if not structured-only mode)
      let llm = { decisions: [], patterns: [], mistakes: [], pitfalls: [] };
      if (!flags.structuredOnly) {
        const content = fs.readFileSync(summaryPath, 'utf8');
        llm = await extractWithLLM(content, 'summary', summaryPath);
      }

      // Merge
      const merged = mergeLearnings(structured, llm);
      phaseLearnings.decisions.push(...merged.decisions);
      phaseLearnings.patterns.push(...merged.patterns);
      phaseLearnings.mistakes.push(...merged.mistakes);
      phaseLearnings.pitfalls.push(...merged.pitfalls);
    }

    // Extract from verifications
    for (const verificationPath of files.verifications) {
      console.log(`  - ${path.basename(verificationPath)}`);
      phaseLearnings.source.push(path.basename(verificationPath));

      // Structured extraction
      const structured = extractFromVerification(verificationPath);

      // LLM extraction (if not structured-only mode)
      let llm = { decisions: [], patterns: [], mistakes: [], pitfalls: [] };
      if (!flags.structuredOnly) {
        const content = fs.readFileSync(verificationPath, 'utf8');
        llm = await extractWithLLM(content, 'verification', verificationPath);
      }

      // Merge
      const merged = mergeLearnings(structured, llm);
      phaseLearnings.decisions.push(...merged.decisions);
      phaseLearnings.patterns.push(...merged.patterns);
      phaseLearnings.mistakes.push(...merged.mistakes);
      phaseLearnings.pitfalls.push(...merged.pitfalls);
    }

    // Validate with Zod schema
    try {
      const validated = PhaseLearningsSchema.parse({
        decisions: phaseLearnings.decisions,
        patterns: phaseLearnings.patterns,
        mistakes: phaseLearnings.mistakes,
        pitfalls: phaseLearnings.pitfalls,
        source: phaseLearnings.source.join(', '),
        extractedAt: new Date().toISOString(),
        milestone: flags.milestone,
        phase: phaseNum
      });

      // Save JSON
      saveLearnings(validated, flags.milestone, phaseNum);

      // Embed to vector DB
      const embeddedCount = await embedLearnings(validated, flags.milestone, phaseNum, projectId);

      // Track statistics
      phasesProcessed.push(phaseNum);
      totalLearnings.decisions += validated.decisions.length;
      totalLearnings.patterns += validated.patterns.length;
      totalLearnings.mistakes += validated.mistakes.length;
      totalLearnings.pitfalls += validated.pitfalls.length;

      console.log(`  ✓ Extracted: ${validated.decisions.length} decisions, ${validated.patterns.length} patterns, ${validated.mistakes.length} mistakes, ${validated.pitfalls.length} pitfalls`);
      if (embeddedCount > 0) {
        console.log(`  ✓ Embedded: ${embeddedCount} learnings to vector DB`);
      }
      console.log('');

    } catch (err) {
      console.error(`  ✗ Validation failed for phase ${phaseNum}: ${err.message}`);
      console.log('');
    }
  }

  // Save metadata
  saveMetadata(phasesProcessed, totalLearnings, flags.milestone);

  // Output summary
  console.log('='.repeat(60));
  console.log('Extraction Complete');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Phases processed: ${phasesProcessed.join(', ')}`);
  console.log('');
  console.log('Learnings extracted:');
  console.log(`  - Decisions: ${totalLearnings.decisions}`);
  console.log(`  - Patterns: ${totalLearnings.patterns}`);
  console.log(`  - Mistakes: ${totalLearnings.mistakes}`);
  console.log(`  - Pitfalls: ${totalLearnings.pitfalls}`);
  console.log('');

  if (!flags.dryRun) {
    const learningsDir = path.join(process.cwd(), '.planning', 'learnings', flags.milestone);
    console.log(`Files saved to: ${learningsDir}/`);
  }

  console.log('');
}

// Run main function
main().catch(err => {
  console.error('Error during extraction:', err);
  process.exit(1);
});
