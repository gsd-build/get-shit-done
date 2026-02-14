/**
 * CLAUDE.md Appender
 *
 * Safely appends critical learnings to project CLAUDE.md using marker-delimited sections.
 * Preserves all user content before the marker.
 */

const fs = require('fs');
const path = require('path');

// Marker constants for auto-generated section
const MARKER_START = '<!-- AUTO-GENERATED: GSD Critical Learnings -->';
const MARKER_END = '<!-- END AUTO-GENERATED -->';

/**
 * Format critical learnings into markdown section
 *
 * @param {Array} learnings - Array of critical learning objects
 * @returns {string} - Formatted markdown content
 */
function formatCriticalLearnings(learnings) {
  if (!learnings || learnings.length === 0) {
    return `## Critical Learnings (Auto-Generated)

*No critical learnings detected yet. Run \`npm run learn:surface\` after completing milestones.*

*Last updated: ${new Date().toISOString().split('T')[0]}*`;
  }

  // Group by type
  const grouped = {
    decision: [],
    pattern: [],
    mistake: [],
    pitfall: [],
    unknown: []
  };

  for (const learning of learnings) {
    const type = learning.type || 'unknown';
    if (grouped[type]) {
      grouped[type].push(learning);
    } else {
      grouped.unknown.push(learning);
    }
  }

  // Count unique milestones
  const allMilestones = new Set();
  for (const learning of learnings) {
    for (const milestone of learning.milestones || []) {
      allMilestones.add(milestone);
    }
  }

  // Build markdown sections
  const sections = [];

  // Header
  sections.push(`## Critical Learnings (Auto-Generated)

*Recurring patterns detected across ${allMilestones.size} milestone(s) and ${learnings.reduce((sum, l) => sum + (l.phases?.length || 0), 0)} phases.*

*Last updated: ${new Date().toISOString().split('T')[0]}*

---
`);

  // Add sections for each type
  if (grouped.decision.length > 0) {
    sections.push('### Key Decisions\n');
    for (const learning of grouped.decision) {
      sections.push(`- **${learning.learning}**`);
      sections.push(`  - Appeared ${learning.frequency}x across phases: ${learning.phases.join(', ')}`);
      sections.push('');
    }
    sections.push('');
  }

  if (grouped.pattern.length > 0) {
    sections.push('### Proven Patterns\n');
    for (const learning of grouped.pattern) {
      sections.push(`- **${learning.learning}**`);
      sections.push(`  - Appeared ${learning.frequency}x across phases: ${learning.phases.join(', ')}`);
      sections.push('');
    }
    sections.push('');
  }

  if (grouped.mistake.length > 0) {
    sections.push('### Common Mistakes\n');
    for (const learning of grouped.mistake) {
      sections.push(`- **${learning.learning}**`);
      sections.push(`  - Appeared ${learning.frequency}x across phases: ${learning.phases.join(', ')}`);
      sections.push('');
    }
    sections.push('');
  }

  if (grouped.pitfall.length > 0) {
    sections.push('### Known Pitfalls\n');
    for (const learning of grouped.pitfall) {
      sections.push(`- **${learning.learning}**`);
      sections.push(`  - Appeared ${learning.frequency}x across phases: ${learning.phases.join(', ')}`);
      sections.push('');
    }
    sections.push('');
  }

  // Footer note
  sections.push('---');
  sections.push('');
  sections.push('*To update this section, run: `npm run learn:surface -- --milestone <version>`*');
  sections.push('*This section is auto-managed. Manual edits will be overwritten.*');

  return sections.join('\n');
}

/**
 * Append critical learnings to project CLAUDE.md
 *
 * @param {string} projectRoot - Absolute path to project root directory
 * @param {Array} criticalLearnings - Array of critical learning objects
 * @param {Object} options - Append options
 * @param {boolean} options.dryRun - If true, log to stdout instead of writing (default: false)
 * @returns {Promise<Object>} - Result object with path, added count, and created flag
 */
async function appendToCLAUDEmd(projectRoot, criticalLearnings, options = {}) {
  const { dryRun = false } = options;

  // Resolve CLAUDE.md path - ALWAYS project root, NEVER ~/.claude/
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');

  // Read existing content (if file exists)
  let existingContent = '';
  let fileExisted = false;

  try {
    existingContent = fs.readFileSync(claudeMdPath, 'utf8');
    fileExisted = true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // File doesn't exist yet - will create new
  }

  // Strip existing auto-generated section if present
  const markerStartIdx = existingContent.indexOf(MARKER_START);
  if (markerStartIdx !== -1) {
    const markerEndIdx = existingContent.indexOf(MARKER_END, markerStartIdx);
    if (markerEndIdx !== -1) {
      // Remove from MARKER_START through MARKER_END (inclusive)
      existingContent = existingContent.substring(0, markerStartIdx) +
                       existingContent.substring(markerEndIdx + MARKER_END.length);
    }
  }

  // Trim trailing whitespace
  existingContent = existingContent.trimEnd();

  // Format critical learnings section
  const formattedSection = formatCriticalLearnings(criticalLearnings);

  // Build final content
  const finalContent = existingContent
    ? `${existingContent}\n\n${MARKER_START}\n${formattedSection}\n${MARKER_END}\n`
    : `${MARKER_START}\n${formattedSection}\n${MARKER_END}\n`;

  // Dry run: log to stdout
  if (dryRun) {
    console.log('='.repeat(80));
    console.log('DRY RUN: Would append to CLAUDE.md');
    console.log('='.repeat(80));
    console.log(formattedSection);
    console.log('='.repeat(80));
    return {
      path: claudeMdPath,
      added: criticalLearnings.length,
      created: !fileExisted
    };
  }

  // Write via atomic pattern: temp file + rename
  const tmpPath = `${claudeMdPath}.tmp`;

  try {
    fs.writeFileSync(tmpPath, finalContent, 'utf8');
    fs.renameSync(tmpPath, claudeMdPath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      fs.unlinkSync(tmpPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }

  return {
    path: claudeMdPath,
    added: criticalLearnings.length,
    created: !fileExisted
  };
}

module.exports = {
  appendToCLAUDEmd,
  formatCriticalLearnings,
  MARKER_START,
  MARKER_END
};
