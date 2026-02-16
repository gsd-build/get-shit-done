/**
 * phase-archive.js
 *
 * Phase context archiving and compression for multi-phase execution.
 * Prevents context rot by archiving completed phases and selectively injecting relevant history (EXEC-07).
 *
 * Functions:
 * - archivePhase(phaseNumber) - Create ARCHIVE.json for completed phase
 * - compressContext(phaseDir) - Compress SUMMARYs to key points only
 * - injectRelevantContext(targetPhase, archives) - Select relevant archives for injection
 * - cleanupEphemeralCheckpoints(phaseNumber) - Remove phase checkpoints after archive
 * - updateStateWithArchive(phaseNumber, summary) - Update STATE.md
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Archive Phase ─────────────────────────────────────────────────────────

/**
 * Create ARCHIVE.json for completed phase
 * @param {number} phaseNumber - Phase number to archive
 * @returns {Promise<{archived: boolean, path: string, summary: object}>}
 */
async function archivePhase(phaseNumber) {
  const projectRoot = process.cwd();
  const phaseDir = path.join(projectRoot, '.planning', 'phases');

  // Find phase directory
  const phaseDirs = fs.readdirSync(phaseDir).filter(d => {
    const match = d.match(/^(\d+)-/);
    return match && parseInt(match[1]) === phaseNumber;
  });

  if (phaseDirs.length === 0) {
    return { archived: false, error: `Phase ${phaseNumber} directory not found` };
  }

  const targetPhaseDir = path.join(phaseDir, phaseDirs[0]);
  const phaseName = phaseDirs[0].replace(/^\d+-/, '');

  // Compress context from all SUMMARYs
  const compressedContext = await compressContext(targetPhaseDir);

  // Get verification status
  const verificationPath = path.join(targetPhaseDir, `${String(phaseNumber).padStart(2, '0')}-VERIFICATION.md`);
  let verificationStatus = 'not_verified';

  if (fs.existsSync(verificationPath)) {
    const content = fs.readFileSync(verificationPath, 'utf8');
    const statusMatch = content.match(/status:\s*(.+)/i);
    if (statusMatch) {
      verificationStatus = statusMatch[1].trim();
    }
  }

  // Extract all modified files across all plans
  const allFiles = new Set();
  const allDecisions = [];

  compressedContext.forEach(summary => {
    if (summary.files_created) summary.files_created.forEach(f => allFiles.add(f));
    if (summary.files_modified) summary.files_modified.forEach(f => allFiles.add(f));
    if (summary.key_decisions) allDecisions.push(...summary.key_decisions);
  });

  // Create archive structure
  const archive = {
    phase: phaseNumber,
    name: phaseName,
    completed_at: new Date().toISOString(),
    summary: {
      plans_executed: compressedContext.length,
      files_modified: Array.from(allFiles),
      key_decisions: allDecisions,
      verification_status: verificationStatus
    },
    compressed_context: compressedContext
  };

  // Write ARCHIVE.json
  const archivePath = path.join(targetPhaseDir, 'ARCHIVE.json');
  fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2), 'utf8');

  return {
    archived: true,
    path: archivePath,
    summary: archive.summary
  };
}

// ─── Compress Context ──────────────────────────────────────────────────────

/**
 * Compress SUMMARYs to key points only
 * @param {string} phaseDir - Path to phase directory
 * @returns {Promise<Array>} Array of compressed summaries
 */
async function compressContext(phaseDir) {
  const summaries = [];

  // Find all SUMMARY.md files
  const files = fs.readdirSync(phaseDir).filter(f => f.endsWith('-SUMMARY.md'));

  for (const file of files) {
    const filePath = path.join(phaseDir, file);
    const compressed = await extractSummaryMetadata(filePath);
    if (compressed) {
      summaries.push(compressed);
    }
  }

  return summaries;
}

/**
 * Extract key metadata from SUMMARY.md frontmatter
 * @param {string} summaryPath - Path to SUMMARY.md file
 * @returns {Promise<object|null>} Compressed summary object
 */
async function extractSummaryMetadata(summaryPath) {
  if (!fs.existsSync(summaryPath)) return null;

  const fileStream = fs.createReadStream(summaryPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let inFrontmatter = false;
  let frontmatterLines = [];
  let title = null;

  for await (const line of rl) {
    // Detect frontmatter boundaries
    if (line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
        continue;
      } else {
        // End of frontmatter
        break;
      }
    }

    if (inFrontmatter) {
      frontmatterLines.push(line);
    } else if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      break;
    }
  }

  // Parse frontmatter
  const metadata = parseFrontmatter(frontmatterLines);

  // Extract title if not from frontmatter
  if (!title && metadata.phase && metadata.plan) {
    title = `Phase ${metadata.phase} Plan ${metadata.plan}`;
  }

  return {
    plan_id: `${String(metadata.phase).padStart(2, '0')}-${String(metadata.plan).padStart(2, '0')}`,
    title: title || 'Unknown',
    objective: metadata.objective || null,
    key_decisions: metadata.key_decisions || [],
    tech_added: metadata.tech_stack?.added || [],
    files_created: metadata.key_files?.created || [],
    files_modified: metadata.key_files?.modified || [],
    provides: metadata.provides || []
  };
}

/**
 * Parse frontmatter YAML-like content into object
 * @param {Array<string>} lines - Frontmatter lines
 * @returns {object} Parsed metadata
 */
function parseFrontmatter(lines) {
  const metadata = {};
  let currentKey = null;
  let currentArray = null;
  let currentObject = null;

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Top-level key-value: "key: value"
    const kvMatch = line.match(/^([a-z_-]+):\s*(.*)$/i);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();

      // Array notation: key: [...]
      if (value.startsWith('[')) {
        const arrayContent = value.slice(1, -1);
        metadata[currentKey] = arrayContent.split(',').map(v => v.trim().replace(/['"]/g, ''));
        currentArray = null;
        currentObject = null;
      } else if (value) {
        metadata[currentKey] = value;
        currentArray = null;
        currentObject = null;
      } else {
        // Multiline structure
        currentArray = [];
        currentObject = {};
        metadata[currentKey] = null;
      }
      continue;
    }

    // Array item: "  - item"
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      if (!metadata[currentKey]) metadata[currentKey] = [];
      if (!Array.isArray(metadata[currentKey])) continue; // Skip if not array

      const item = arrayMatch[1].trim();
      // Remove quotes if present
      metadata[currentKey].push(item.replace(/^["'](.+)["']$/, '$1'));
      continue;
    }

    // Nested object key: "  key: value"
    const nestedMatch = line.match(/^\s+([a-z_-]+):\s*(.*)$/i);
    if (nestedMatch && currentKey) {
      const nestedKey = nestedMatch[1];
      const nestedValue = nestedMatch[2].trim();

      if (!metadata[currentKey]) metadata[currentKey] = {};

      if (nestedValue.startsWith('[')) {
        const arrayContent = nestedValue.slice(1, -1);
        metadata[currentKey][nestedKey] = arrayContent.split(',').map(v => v.trim().replace(/['"]/g, ''));
      } else {
        metadata[currentKey][nestedKey] = nestedValue || [];
      }
      continue;
    }
  }

  return metadata;
}

// ─── Inject Relevant Context ───────────────────────────────────────────────

/**
 * Select relevant archives for injection into target phase
 * @param {number} targetPhase - Target phase number
 * @param {Array} archives - Optional array of archive objects (if not provided, loads from disk)
 * @returns {Promise<object>} Compressed context for injection
 */
async function injectRelevantContext(targetPhase, archives = null) {
  const projectRoot = process.cwd();

  // Load roadmap to get dependencies
  const roadmapPath = path.join(projectRoot, '.planning', 'ROADMAP.md');
  const dependencies = await extractPhaseDependencies(roadmapPath, targetPhase);

  // Load archives if not provided
  if (!archives) {
    archives = await loadAllArchives();
  }

  // Filter to dependency phases only
  const relevantArchives = archives.filter(arc => dependencies.includes(arc.phase));

  // Extract only essential context
  const compressedContext = {
    target_phase: targetPhase,
    dependency_count: relevantArchives.length,
    context: relevantArchives.map(arc => ({
      phase: arc.phase,
      name: arc.name,
      key_decisions: arc.summary.key_decisions.slice(0, 3), // Top 3 decisions only
      files_created: arc.summary.files_modified.slice(0, 5), // Top 5 files only
      plans_executed: arc.summary.plans_executed
    }))
  };

  return compressedContext;
}

/**
 * Extract phase dependencies from ROADMAP.md
 * @param {string} roadmapPath - Path to ROADMAP.md
 * @param {number} targetPhase - Target phase number
 * @returns {Promise<Array<number>>} Array of dependency phase numbers
 */
async function extractPhaseDependencies(roadmapPath, targetPhase) {
  if (!fs.existsSync(roadmapPath)) return [];

  const fileStream = fs.createReadStream(roadmapPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let currentPhase = null;
  let dependencies = [];

  for await (const line of rl) {
    // Phase header: ### Phase N: Name
    const phaseMatch = line.match(/^###\s+Phase\s+(\d+):/);
    if (phaseMatch) {
      currentPhase = parseInt(phaseMatch[1]);
      if (currentPhase === targetPhase) {
        dependencies = [];
      }
    }

    // Depends on: Phase N
    if (currentPhase === targetPhase) {
      const depMatch = line.match(/\*\*Depends on\*\*:\s*(.+)/);
      if (depMatch) {
        const depText = depMatch[1];

        // Extract phase numbers
        const phaseNums = depText.match(/Phase\s+(\d+)/g);
        if (phaseNums) {
          dependencies = phaseNums.map(p => parseInt(p.match(/\d+/)[0]));
        }

        // Check for "Nothing"
        if (depText.includes('Nothing')) {
          dependencies = [];
        }

        break;
      }
    }
  }

  return dependencies;
}

/**
 * Load all ARCHIVE.json files from phases
 * @returns {Promise<Array>} Array of archive objects
 */
async function loadAllArchives() {
  const projectRoot = process.cwd();
  const phaseDir = path.join(projectRoot, '.planning', 'phases');
  const archives = [];

  if (!fs.existsSync(phaseDir)) return archives;

  const phaseDirs = fs.readdirSync(phaseDir).filter(d => {
    return fs.statSync(path.join(phaseDir, d)).isDirectory();
  });

  for (const dir of phaseDirs) {
    const archivePath = path.join(phaseDir, dir, 'ARCHIVE.json');
    if (fs.existsSync(archivePath)) {
      const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
      archives.push(archive);
    }
  }

  return archives;
}

// ─── Cleanup Ephemeral Checkpoints ─────────────────────────────────────────

/**
 * Remove phase checkpoints after archive
 * @param {number} phaseNumber - Phase number
 * @returns {Promise<{cleaned: number}>} Number of checkpoints removed
 */
async function cleanupEphemeralCheckpoints(phaseNumber) {
  const projectRoot = process.cwd();
  const knowledgeDbPath = path.join(projectRoot, '.planning', 'knowledge', 'ollorin.db');

  // Check if knowledge DB exists
  if (!fs.existsSync(knowledgeDbPath)) {
    return { cleaned: 0, note: 'Knowledge DB not found' };
  }

  // Use knowledge DB to remove checkpoints
  try {
    const Database = require('better-sqlite3');
    const db = new Database(knowledgeDbPath);

    // Count checkpoints for phase
    const countStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM knowledge
      WHERE type = 'checkpoint'
      AND json_extract(metadata, '$.phase') = ?
    `);
    const { count } = countStmt.get(phaseNumber);

    // Delete checkpoints for phase
    const deleteStmt = db.prepare(`
      DELETE FROM knowledge
      WHERE type = 'checkpoint'
      AND json_extract(metadata, '$.phase') = ?
    `);
    deleteStmt.run(phaseNumber);

    db.close();

    return { cleaned: count };
  } catch (error) {
    return { cleaned: 0, error: error.message };
  }
}

// ─── Update State with Archive ─────────────────────────────────────────────

/**
 * Update STATE.md with archive summary
 * @param {number} phaseNumber - Phase number
 * @param {object} summary - Archive summary object
 * @returns {Promise<{updated: boolean}>}
 */
async function updateStateWithArchive(phaseNumber, summary) {
  const projectRoot = process.cwd();
  const statePath = path.join(projectRoot, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    return { updated: false, error: 'STATE.md not found' };
  }

  // Read STATE.md
  let content = fs.readFileSync(statePath, 'utf8');

  // Add archive reference to appropriate section
  const archiveNote = `\n### Phase ${phaseNumber} Archive\n\n` +
    `Archived: ${summary.plans_executed} plans, ` +
    `${summary.files_modified.length} files modified, ` +
    `status: ${summary.verification_status}\n`;

  // Insert before "## Accumulated Context" if it exists
  if (content.includes('## Accumulated Context')) {
    content = content.replace(
      '## Accumulated Context',
      archiveNote + '\n## Accumulated Context'
    );
  } else {
    content += '\n' + archiveNote;
  }

  fs.writeFileSync(statePath, content, 'utf8');

  return { updated: true };
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  archivePhase,
  compressContext,
  injectRelevantContext,
  cleanupEphemeralCheckpoints,
  updateStateWithArchive
};
