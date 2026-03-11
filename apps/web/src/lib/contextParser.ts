/**
 * Context Parser - Parses CONTEXT.md into structured state
 */

/**
 * Generate a stable hash from content string
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Represents a single decision item
 */
export interface Decision {
  id: string;
  content: string;
  locked: boolean;
  section: 'decisions' | 'specifics' | 'deferred';
  isNew?: boolean;
}

/**
 * Represents the full CONTEXT.md state
 */
export interface ContextMdState {
  domain: string;
  decisions: Decision[];
  specifics: Decision[];
  deferred: Decision[];
  raw: string;
}

/**
 * Extract content from XML-like section
 */
function extractSection(markdown: string, sectionName: string): string {
  const openTag = `<${sectionName}>`;
  const closeTag = `</${sectionName}>`;

  const startIndex = markdown.indexOf(openTag);
  const endIndex = markdown.indexOf(closeTag);

  if (startIndex === -1 || endIndex === -1) {
    return '';
  }

  return markdown.slice(startIndex + openTag.length, endIndex).trim();
}

/**
 * Extract bullet points from a section as decisions
 */
function extractDecisions(
  content: string,
  section: 'decisions' | 'specifics' | 'deferred'
): Decision[] {
  const decisions: Decision[] = [];

  // Match bullet points (- or *) with content
  const bulletRegex = /^[\s]*[-*]\s+(.+)$/gm;
  let match;

  while ((match = bulletRegex.exec(content)) !== null) {
    const matchedContent = match[1];
    if (!matchedContent) continue;
    const bulletContent = matchedContent.trim();

    // Skip empty bullets or "None" placeholders
    if (!bulletContent || bulletContent.toLowerCase() === 'none') {
      continue;
    }

    // Check for locked metadata comment
    const isLocked = bulletContent.includes('<!-- locked -->');
    const cleanContent = bulletContent.replace(/<!--\s*locked\s*-->/g, '').trim();

    decisions.push({
      id: `${section}-${hashContent(cleanContent)}`,
      content: cleanContent,
      locked: isLocked,
      section,
      isNew: false,
    });
  }

  return decisions;
}

/**
 * Parse CONTEXT.md markdown into structured state
 */
export function parseContextMd(markdown: string): ContextMdState {
  // Extract each section
  const domainContent = extractSection(markdown, 'domain');
  const decisionsContent = extractSection(markdown, 'decisions');
  const specificsContent = extractSection(markdown, 'specifics');
  const deferredContent = extractSection(markdown, 'deferred');

  return {
    domain: domainContent,
    decisions: extractDecisions(decisionsContent, 'decisions'),
    specifics: extractDecisions(specificsContent, 'specifics'),
    deferred: extractDecisions(deferredContent, 'deferred'),
    raw: markdown,
  };
}

/**
 * Compare two states and mark new decisions
 */
export function markNewDecisions(
  newState: ContextMdState,
  previousState: ContextMdState | null
): ContextMdState {
  if (!previousState) {
    return newState;
  }

  const previousIds = new Set([
    ...previousState.decisions.map(d => d.id),
    ...previousState.specifics.map(d => d.id),
    ...previousState.deferred.map(d => d.id),
  ]);

  const markNew = (decisions: Decision[]): Decision[] =>
    decisions.map(d => ({
      ...d,
      isNew: !previousIds.has(d.id),
    }));

  return {
    ...newState,
    decisions: markNew(newState.decisions),
    specifics: markNew(newState.specifics),
    deferred: markNew(newState.deferred),
  };
}
