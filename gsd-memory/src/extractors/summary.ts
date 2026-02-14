import { parseFrontmatter } from './frontmatter.js';

export interface TechStackEntry {
  library: string;
  version: string;
  purpose?: string;
}

export interface Dependency {
  phase: string;
  provides: string;
}

export interface KeyFiles {
  created: string[];
  modified: string[];
}

export interface Decision {
  decision: string;
  source?: string;
}

export interface SummaryData {
  // Identifiers
  phase: string;
  plan: number | string;
  subsystem: string;
  tags: string[];

  // Dependency graph
  requires: Dependency[];
  provides: string[];
  affects: string[];

  // Tech tracking
  techStack: TechStackEntry[];
  patterns: string[];

  // Files
  keyFiles: KeyFiles;

  // Decisions
  decisions: Decision[];

  // Metadata
  duration: string;
  completed: string;

  // Content
  oneLiner: string;
}

/**
 * Extract structured data from a SUMMARY.md file
 */
export function extractSummary(markdown: string): SummaryData {
  const { frontmatter, content } = parseFrontmatter(markdown);

  return {
    // Identifiers
    phase: (frontmatter.phase as string) || '',
    plan: (frontmatter.plan as number | string) || '',
    subsystem: (frontmatter.subsystem as string) || '',
    tags: (frontmatter.tags as string[]) || [],

    // Dependency graph
    requires: extractRequires(frontmatter.requires),
    provides: (frontmatter.provides as string[]) || [],
    affects: (frontmatter.affects as string[]) || [],

    // Tech tracking
    techStack: extractTechStack(frontmatter['tech-stack']),
    patterns: (frontmatter['patterns-established'] as string[]) || [],

    // Files
    keyFiles: extractKeyFiles(frontmatter['key-files']),

    // Decisions
    decisions: extractDecisions(frontmatter['key-decisions']),

    // Metadata
    duration: (frontmatter.duration as string) || '',
    completed: formatCompleted(frontmatter.completed),

    // Content
    oneLiner: extractOneLiner(content)
  };
}

function extractRequires(requires: unknown): Dependency[] {
  if (!Array.isArray(requires)) return [];

  return requires.map((req) => ({
    phase: (req as Record<string, unknown>).phase as string || '',
    provides: (req as Record<string, unknown>).provides as string || ''
  }));
}

function extractTechStack(techStack: unknown): TechStackEntry[] {
  if (!techStack || typeof techStack !== 'object') return [];

  const ts = techStack as Record<string, unknown>;
  const added = ts.added;

  if (!Array.isArray(added)) return [];

  return added.map((entry) => {
    // Handle both object format { library: version } and string format
    if (typeof entry === 'object' && entry !== null) {
      const [library, version] = Object.entries(entry)[0] || ['', ''];
      return { library, version: String(version) };
    }
    return { library: String(entry), version: '' };
  });
}

function extractKeyFiles(keyFiles: unknown): KeyFiles {
  if (!keyFiles || typeof keyFiles !== 'object') {
    return { created: [], modified: [] };
  }

  const kf = keyFiles as Record<string, unknown>;
  return {
    created: (kf.created as string[]) || [],
    modified: (kf.modified as string[]) || []
  };
}

function extractDecisions(decisions: unknown): Decision[] {
  if (!Array.isArray(decisions)) return [];

  return decisions.map((d) => ({
    decision: String(d),
    source: 'frontmatter'
  }));
}

function formatCompleted(completed: unknown): string {
  if (!completed) return '';

  // If it's a Date object (YAML parsed it), format as ISO date
  if (completed instanceof Date) {
    return completed.toISOString().split('T')[0];
  }

  return String(completed);
}

function extractOneLiner(content: string): string {
  // The one-liner is the bold text after the title
  // Pattern: # Title\n\n**one-liner**
  const match = content.match(/^#[^\n]+\n\n\*\*([^*]+)\*\*/m);
  return match ? match[1].trim() : '';
}
