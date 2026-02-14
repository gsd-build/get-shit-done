import { parseFrontmatter } from './frontmatter.js';

export interface StackEntry {
  library: string;
  version?: string;
  purpose: string;
  whyStandard?: string;
}

export interface Pitfall {
  name: string;
  description: string;
  cause?: string;
  prevention: string;
  warningSigns?: string;
}

export interface DontHandRoll {
  problem: string;
  dontBuild: string;
  useInstead: string;
  why: string;
}

export interface UserConstraints {
  locked: string[];
  discretion: string[];
  deferred: string[];
}

export interface ResearchData {
  // Metadata
  domain: string;
  confidence: string;
  researched: string;

  // Extracted sections
  standardStack: StackEntry[];
  pitfalls: Pitfall[];
  dontHandRoll: DontHandRoll[];
  antiPatterns: string[];
  userConstraints: UserConstraints;
  primaryRecommendation: string;
}

/**
 * Extract structured data from a RESEARCH.md file
 */
export function extractResearch(markdown: string): ResearchData {
  const { frontmatter, content } = parseFrontmatter(markdown);

  return {
    // Metadata from frontmatter
    domain: (frontmatter.domain as string) || '',
    confidence: (frontmatter.confidence as string) || '',
    researched: formatDate(frontmatter.researched),

    // Extracted from content
    standardStack: extractStandardStack(content),
    pitfalls: extractPitfalls(content),
    dontHandRoll: extractDontHandRoll(content),
    antiPatterns: extractAntiPatterns(content),
    userConstraints: extractUserConstraints(content),
    primaryRecommendation: extractPrimaryRecommendation(content)
  };
}

function formatDate(date: unknown): string {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date);
}

function extractStandardStack(content: string): StackEntry[] {
  const entries: StackEntry[] = [];

  // Look for standard_stack section and parse markdown tables
  const stackSection = extractSection(content, 'standard_stack');
  if (!stackSection) return entries;

  // Parse Core and Supporting tables
  const tableRows = stackSection.match(/\|[^|]+\|[^|]+\|[^|]+\|[^|]*\|/g);
  if (!tableRows) return entries;

  for (const row of tableRows) {
    // Skip header and separator rows
    if (row.includes('Library') || row.includes('---')) continue;

    const cells = row.split('|').filter(c => c.trim());
    if (cells.length >= 3) {
      entries.push({
        library: cells[0].trim(),
        version: cells[1]?.trim(),
        purpose: cells[2]?.trim(),
        whyStandard: cells[3]?.trim()
      });
    }
  }

  return entries;
}

function extractPitfalls(content: string): Pitfall[] {
  const pitfalls: Pitfall[] = [];

  const pitfallSection = extractSection(content, 'common_pitfalls');
  if (!pitfallSection) return pitfalls;

  // Parse individual pitfall blocks (### Pitfall N: Name)
  const pitfallBlocks = pitfallSection.split(/###\s+Pitfall\s+\d+:\s+/);

  for (const block of pitfallBlocks) {
    if (!block.trim()) continue;

    const lines = block.split('\n');
    const name = lines[0]?.trim();
    if (!name) continue;

    const description = extractField(block, 'What goes wrong');
    const cause = extractField(block, 'Why it happens');
    const prevention = extractField(block, 'How to avoid');
    const warningSigns = extractField(block, 'Warning signs');

    if (description || prevention) {
      pitfalls.push({
        name,
        description: description || '',
        cause,
        prevention: prevention || '',
        warningSigns
      });
    }
  }

  return pitfalls;
}

function extractDontHandRoll(content: string): DontHandRoll[] {
  const items: DontHandRoll[] = [];

  const section = extractSection(content, 'dont_hand_roll');
  if (!section) return items;

  // Parse table rows
  const tableRows = section.match(/\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|/g);
  if (!tableRows) return items;

  for (const row of tableRows) {
    if (row.includes('Problem') || row.includes('---')) continue;

    const cells = row.split('|').filter(c => c.trim());
    if (cells.length >= 4) {
      items.push({
        problem: cells[0].trim(),
        dontBuild: cells[1].trim(),
        useInstead: cells[2].trim(),
        why: cells[3].trim()
      });
    }
  }

  return items;
}

function extractAntiPatterns(content: string): string[] {
  const patterns: string[] = [];

  const archSection = extractSection(content, 'architecture_patterns');
  if (!archSection) return patterns;

  // Look for "Anti-Patterns to Avoid" subsection
  const antiMatch = archSection.match(/###\s+Anti-Patterns to Avoid\n([\s\S]*?)(?=###|$)/);
  if (!antiMatch) return patterns;

  // Extract bullet points
  const bullets = antiMatch[1].match(/^-\s+\*\*([^*]+)\*\*/gm);
  if (bullets) {
    for (const bullet of bullets) {
      const match = bullet.match(/\*\*([^*]+)\*\*/);
      if (match) patterns.push(match[1].trim());
    }
  }

  return patterns;
}

function extractUserConstraints(content: string): UserConstraints {
  const constraints: UserConstraints = {
    locked: [],
    discretion: [],
    deferred: []
  };

  const section = extractSection(content, 'user_constraints');
  if (!section) return constraints;

  // Extract locked decisions
  const lockedMatch = section.match(/###\s+Locked Decisions\n([\s\S]*?)(?=###|$)/);
  if (lockedMatch) {
    constraints.locked = extractBulletPoints(lockedMatch[1]);
  }

  // Extract Claude's discretion
  const discretionMatch = section.match(/###\s+Claude's Discretion\n([\s\S]*?)(?=###|$)/);
  if (discretionMatch) {
    constraints.discretion = extractBulletPoints(discretionMatch[1]);
  }

  // Extract deferred items
  const deferredMatch = section.match(/###\s+Deferred Ideas[^#]*\n([\s\S]*?)(?=<\/|$)/);
  if (deferredMatch) {
    constraints.deferred = extractBulletPoints(deferredMatch[1]);
  }

  return constraints;
}

function extractPrimaryRecommendation(content: string): string {
  // Look for "Primary recommendation:" in summary section
  const match = content.match(/\*\*Primary recommendation:\*\*\s*([^\n]+)/);
  return match ? match[1].trim() : '';
}

// Helper functions

function extractSection(content: string, sectionTag: string): string | null {
  const regex = new RegExp(`<${sectionTag}>([\\s\\S]*?)<\\/${sectionTag}>`, 'i');
  const match = content.match(regex);
  return match ? match[1] : null;
}

function extractField(block: string, fieldName: string): string | undefined {
  const regex = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*([^\\n]+)`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : undefined;
}

function extractBulletPoints(text: string): string[] {
  const points: string[] = [];
  const matches = text.match(/^-\s+(.+)/gm);
  if (matches) {
    for (const match of matches) {
      const content = match.replace(/^-\s+/, '').trim();
      if (content) points.push(content);
    }
  }
  return points;
}
