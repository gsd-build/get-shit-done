export interface OutOfScopeItem {
  item: string;
  reason: string;
}

export interface Constraint {
  type: string;
  value: string;
  why?: string;
}

export interface Decision {
  decision: string;
  rationale: string;
  outcome: string;
}

export interface Requirements {
  validated: string[];
  active: string[];
  outOfScope: OutOfScopeItem[];
}

export interface ProjectData {
  name: string;
  description: string;
  coreValue: string;
  requirements: Requirements;
  context: string;
  constraints: Constraint[];
  decisions: Decision[];
}

/**
 * Extract structured data from a PROJECT.md file
 */
export function extractProject(markdown: string): ProjectData {
  return {
    name: extractName(markdown),
    description: extractSection(markdown, 'What This Is'),
    coreValue: extractSection(markdown, 'Core Value'),
    requirements: extractRequirements(markdown),
    context: extractSection(markdown, 'Context'),
    constraints: extractConstraints(markdown),
    decisions: extractDecisions(markdown)
  };
}

function extractName(content: string): string {
  // First line should be # ProjectName
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : '';
}

function extractSection(content: string, sectionName: string): string {
  // Find the section and extract content until next ## heading
  const regex = new RegExp(`##\\s+${sectionName}\\n\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function extractRequirements(content: string): Requirements {
  const requirementsSection = content.match(/##\s+Requirements\n([\s\S]*?)(?=\n##[^#]|$)/i);
  if (!requirementsSection) {
    return { validated: [], active: [], outOfScope: [] };
  }

  const section = requirementsSection[1];

  return {
    validated: extractValidatedRequirements(section),
    active: extractActiveRequirements(section),
    outOfScope: extractOutOfScope(section)
  };
}

function extractValidatedRequirements(section: string): string[] {
  const requirements: string[] = [];

  // Look for ### Validated subsection
  const validatedSection = section.match(/###\s+Validated\n([\s\S]*?)(?=###|$)/i);
  if (!validatedSection) return requirements;

  // Extract checkmark items: - ✓ requirement — version
  const matches = validatedSection[1].match(/^-\s+✓\s+(.+)/gm);
  if (matches) {
    for (const match of matches) {
      const content = match.replace(/^-\s+✓\s+/, '').trim();
      requirements.push(content);
    }
  }

  return requirements;
}

function extractActiveRequirements(section: string): string[] {
  const requirements: string[] = [];

  // Look for ### Active subsection
  const activeSection = section.match(/###\s+Active\n([\s\S]*?)(?=###|$)/i);
  if (!activeSection) return requirements;

  // Extract checkbox items: - [ ] requirement
  const matches = activeSection[1].match(/^-\s+\[\s*\]\s+(.+)/gm);
  if (matches) {
    for (const match of matches) {
      const content = match.replace(/^-\s+\[\s*\]\s+/, '').trim();
      requirements.push(content);
    }
  }

  return requirements;
}

function extractOutOfScope(section: string): OutOfScopeItem[] {
  const items: OutOfScopeItem[] = [];

  // Look for ### Out of Scope subsection
  const outOfScopeSection = section.match(/###\s+Out of Scope\n([\s\S]*?)(?=###|$)/i);
  if (!outOfScopeSection) return items;

  // Extract items: - Item — reason
  const matches = outOfScopeSection[1].match(/^-\s+(.+)/gm);
  if (matches) {
    for (const match of matches) {
      const content = match.replace(/^-\s+/, '').trim();
      // Split by em-dash or double hyphen
      const parts = content.split(/\s+—\s+|\s+--\s+/);
      items.push({
        item: parts[0].trim(),
        reason: parts[1]?.trim() || ''
      });
    }
  }

  return items;
}

function extractConstraints(content: string): Constraint[] {
  const constraints: Constraint[] = [];

  const constraintsSection = content.match(/##\s+Constraints\n([\s\S]*?)(?=\n##|$)/i);
  if (!constraintsSection) return constraints;

  // Extract items: - **Type**: Value — Why
  const matches = constraintsSection[1].match(/^-\s+\*\*([^*]+)\*\*:\s*(.+)/gm);
  if (matches) {
    for (const match of matches) {
      const typeMatch = match.match(/\*\*([^*]+)\*\*/);
      const valueMatch = match.match(/\*\*[^*]+\*\*:\s*(.+)/);

      if (typeMatch && valueMatch) {
        const valueParts = valueMatch[1].split(/\s+—\s+|\s+--\s+/);
        constraints.push({
          type: typeMatch[1].trim(),
          value: valueParts[0].trim(),
          why: valueParts[1]?.trim()
        });
      }
    }
  }

  return constraints;
}

function extractDecisions(content: string): Decision[] {
  const decisions: Decision[] = [];

  const decisionsSection = content.match(/##\s+Key Decisions\n([\s\S]*?)(?=\n##[^#]|\n---|$)/i);
  if (!decisionsSection) return decisions;

  // Parse markdown table rows - match rows with 3+ cells
  const lines = decisionsSection[1].split('\n');

  for (const line of lines) {
    // Must be a table row (starts and ends with |)
    if (!line.trim().startsWith('|')) continue;

    // Skip header row (contains 'Decision') and separator row (contains ---)
    if (line.includes('Decision') || line.includes('---')) continue;

    const cells = line.split('|').filter(c => c.trim());
    if (cells.length >= 3) {
      decisions.push({
        decision: cells[0].trim(),
        rationale: cells[1].trim(),
        outcome: cells[2].trim()
      });
    }
  }

  return decisions;
}
