/**
 * Context truncation — reduces large .planning/ files to cache-friendly sizes.
 *
 * Two strategies:
 * 1. Markdown-aware truncation: keeps headings + first paragraph per section,
 *    replaces the rest with a pointer to the full file.
 * 2. Milestone extraction: pulls only the current milestone from ROADMAP.md.
 *
 * All functions are pure — no I/O, no side effects.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TruncationOptions {
  /** Max content length in characters before truncation kicks in. Default: 8192 */
  maxContentLength: number;
}

export const DEFAULT_TRUNCATION_OPTIONS: TruncationOptions = {
  maxContentLength: 8192,
};

// ─── Markdown-aware truncation ──────────────────────────────────────────────

/**
 * Truncate markdown content while preserving structure.
 *
 * Strategy: keep YAML frontmatter, all headings, and the first paragraph under
 * each heading. Collapse everything else with a line count summary.
 *
 * Returns the original content unchanged if below maxContentLength.
 */
export function truncateMarkdown(
  content: string,
  filename: string,
  options: TruncationOptions = DEFAULT_TRUNCATION_OPTIONS,
): string {
  if (content.length <= options.maxContentLength) return content;

  const lines = content.split('\n');
  const kept: string[] = [];
  let inFrontmatter = false;
  let frontmatterDone = false;
  let currentSectionLines = 0;
  let paragraphKept = false;
  let omittedLines = 0;
  let inParagraph = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle YAML frontmatter (preserve entirely)
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      kept.push(line);
      continue;
    }
    if (inFrontmatter) {
      kept.push(line);
      if (line.trim() === '---') {
        inFrontmatter = false;
        frontmatterDone = true;
      }
      continue;
    }

    // Heading — always keep, reset paragraph tracking
    if (/^#{1,6}\s/.test(line)) {
      if (omittedLines > 0) {
        kept.push(`[... ${omittedLines} lines omitted]`);
        omittedLines = 0;
      }
      kept.push(line);
      currentSectionLines = 0;
      paragraphKept = false;
      inParagraph = false;
      continue;
    }

    // Empty line — paragraph boundary
    if (line.trim() === '') {
      if (inParagraph && !paragraphKept) {
        // End of first paragraph — mark it kept
        paragraphKept = true;
      }
      if (!paragraphKept || currentSectionLines === 0) {
        kept.push(line);
      } else {
        omittedLines++;
      }
      inParagraph = false;
      continue;
    }

    // Content line
    currentSectionLines++;
    if (!paragraphKept) {
      // Still in the first paragraph — keep it
      kept.push(line);
      inParagraph = true;
    } else {
      omittedLines++;
    }
  }

  if (omittedLines > 0) {
    kept.push(`[... ${omittedLines} lines omitted]`);
  }

  const totalOmitted = lines.length - kept.length;
  if (totalOmitted > 0) {
    kept.push('');
    kept.push(`[Truncated: read .planning/${filename} for full content]`);
  }

  return kept.join('\n');
}

// ─── Milestone extraction ───────────────────────────────────────────────────

/**
 * Extract the current milestone section from a ROADMAP.md.
 *
 * Parses STATE.md to find the current milestone name, then extracts only
 * that milestone's section from the roadmap. Falls back to full content
 * if the milestone can't be identified or found.
 */
export function extractCurrentMilestone(
  roadmapContent: string,
  stateContent?: string,
): string {
  if (!stateContent) return roadmapContent;

  // Find current milestone from STATE.md
  // Patterns: "Current Milestone: X", "milestone: X", "## Current Position" block
  const milestonePatterns = [
    /current\s*milestone\s*:\s*(.+)/i,
    /^milestone\s*:\s*(.+)/im,
    /##\s*current\s*position[\s\S]*?milestone\s*:\s*(.+)/i,
  ];

  let milestoneName: string | undefined;
  for (const pattern of milestonePatterns) {
    const match = stateContent.match(pattern);
    if (match) {
      milestoneName = match[1].trim();
      break;
    }
  }

  if (!milestoneName) return roadmapContent;

  // Find the milestone section in roadmap
  // Look for heading containing the milestone name
  const lines = roadmapContent.split('\n');
  let sectionStart = -1;
  let sectionEnd = lines.length;
  let sectionHeadingLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (!headingMatch) continue;

    const level = headingMatch[1].length;
    const title = headingMatch[2];

    if (sectionStart === -1) {
      // Looking for the milestone heading
      if (title.toLowerCase().includes(milestoneName.toLowerCase())) {
        sectionStart = i;
        sectionHeadingLevel = level;
      }
    } else {
      // Found start — look for next heading at same or higher level
      if (level <= sectionHeadingLevel) {
        sectionEnd = i;
        break;
      }
    }
  }

  if (sectionStart === -1) return roadmapContent;

  // Extract preamble (everything before first milestone heading at the same level)
  const preamble: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{1,6})\s/);
    if (headingMatch && headingMatch[1].length === sectionHeadingLevel && i !== sectionStart) {
      // Hit another milestone-level heading before our section
      if (i < sectionStart) {
        break; // preamble ends at first milestone heading
      }
    }
    if (i < sectionStart) {
      // Keep top-level title and intro
      if (i === 0 || lines[i].match(/^#\s/) || !lines[i].match(/^#{1,6}\s/)) {
        preamble.push(lines[i]);
      }
    }
  }

  const milestoneSection = lines.slice(sectionStart, sectionEnd).join('\n');
  const otherMilestones = countOtherMilestones(lines, sectionHeadingLevel, sectionStart);

  const result = [
    ...preamble,
    '',
    milestoneSection,
  ];

  if (otherMilestones > 0) {
    result.push('');
    result.push(`[${otherMilestones} other milestone(s) omitted — read .planning/ROADMAP.md for full roadmap]`);
  }

  return result.join('\n').trim();
}

function countOtherMilestones(
  lines: string[],
  headingLevel: number,
  excludeIndex: number,
): number {
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i === excludeIndex) continue;
    const match = lines[i].match(/^(#{1,6})\s/);
    if (match && match[1].length === headingLevel) {
      count++;
    }
  }
  return count;
}
