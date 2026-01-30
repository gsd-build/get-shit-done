/**
 * Phase number operations - pure logic, no file I/O
 */

import type { ParsedPhaseNumber } from './types.js';

/**
 * Normalize phase number to standard format
 * "8" → "08", "2.1" → "02.1", "12" → "12"
 */
export function normalizePhaseNumber(phase: string | number): string {
  const str = String(phase);

  // Handle decimal phases (e.g., "2.1" → "02.1")
  if (str.includes('.')) {
    const [intPart, decPart] = str.split('.');
    const normalizedInt = intPart.padStart(2, '0');
    return `${normalizedInt}.${decPart}`;
  }

  // Handle integer phases (e.g., "8" → "08")
  return str.padStart(2, '0');
}

/**
 * Parse phase number into components
 * "08" → { integer: 8 }
 * "02.1" → { integer: 2, decimal: 1 }
 */
export function parsePhaseNumber(phase: string): ParsedPhaseNumber {
  const normalized = normalizePhaseNumber(phase);

  if (normalized.includes('.')) {
    const [intPart, decPart] = normalized.split('.');
    return {
      integer: parseInt(intPart, 10),
      decimal: parseInt(decPart, 10),
    };
  }

  return {
    integer: parseInt(normalized, 10),
  };
}

/**
 * Format phase and plan number into prefix
 * ("08", "01") → "08-01"
 */
export function formatPhasePrefix(phase: string, plan: string): string {
  const normalizedPhase = normalizePhaseNumber(phase);
  const normalizedPlan = plan.padStart(2, '0');
  return `${normalizedPhase}-${normalizedPlan}`;
}

/**
 * Increment phase number
 * "08" → "09", "02.1" → "02.2"
 */
export function incrementPhase(currentPhase: string): string {
  const parsed = parsePhaseNumber(currentPhase);

  if (parsed.decimal !== undefined) {
    // Increment decimal part
    return `${String(parsed.integer).padStart(2, '0')}.${parsed.decimal + 1}`;
  }

  // Increment integer part
  return String(parsed.integer + 1).padStart(2, '0');
}

/**
 * Get glob pattern for finding phase directory
 * "08" → "08-*"
 */
export function getPhaseDirectoryPattern(phase: string): string {
  const normalized = normalizePhaseNumber(phase);
  return `${normalized}-*`;
}

/**
 * Build URL-safe slug from phase name
 * "Add Authentication System" → "add-authentication-system"
 */
export function buildPhaseSlug(name: string, maxLength: number = 40): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
    .replace(/--+/g, '-')        // Collapse multiple dashes
    .replace(/^-|-$/g, '')       // Trim leading/trailing dashes
    .slice(0, maxLength);
}

/**
 * Extract phase number from directory name
 * "08-add-authentication" → "08"
 * "02.1-hotfix" → "02.1"
 */
export function extractPhaseFromDirName(dirName: string): string | null {
  // Match patterns like "08-*" or "02.1-*"
  const match = dirName.match(/^(\d{2}(?:\.\d+)?)-/);
  return match ? match[1] : null;
}

/**
 * Extract phase name from directory name
 * "08-add-authentication" → "add-authentication"
 */
export function extractNameFromDirName(dirName: string): string | null {
  // Remove the phase prefix
  const match = dirName.match(/^\d{2}(?:\.\d+)?-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Build full directory name from phase number and name
 * ("08", "add-authentication") → "08-add-authentication"
 */
export function buildPhaseDirectoryName(phase: string | number, name: string): string {
  const normalized = normalizePhaseNumber(phase);
  const slug = buildPhaseSlug(name);
  return `${normalized}-${slug}`;
}

/**
 * Compare two phase numbers for sorting
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
export function comparePhaseNumbers(a: string, b: string): number {
  const parsedA = parsePhaseNumber(a);
  const parsedB = parsePhaseNumber(b);

  // First compare integer parts
  if (parsedA.integer !== parsedB.integer) {
    return parsedA.integer - parsedB.integer;
  }

  // If integers equal, compare decimals (undefined < any number)
  const decA = parsedA.decimal ?? -1;
  const decB = parsedB.decimal ?? -1;
  return decA - decB;
}
