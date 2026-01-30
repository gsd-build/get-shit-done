/**
 * Text processing utilities - pure functions
 */

/**
 * Generate URL-safe slug from text
 * "Add Authentication System" → "add-authentication-system"
 */
export function generateSlug(text: string, maxLength: number = 40): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
    .replace(/--+/g, '-')        // Collapse multiple dashes
    .replace(/^-|-$/g, '')       // Trim leading/trailing dashes
    .slice(0, maxLength);
}

/**
 * Truncate slug at word boundaries
 */
export function truncateSlug(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) return slug;

  // Find last dash before maxLength
  const truncated = slug.slice(0, maxLength);
  const lastDash = truncated.lastIndexOf('-');

  if (lastDash > 0) {
    return truncated.slice(0, lastDash);
  }

  return truncated;
}

/**
 * Get ISO 8601 timestamp
 * → "2025-01-29T14:30:00Z"
 */
export function getIsoTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get date string in YYYY-MM-DD format
 * → "2025-01-29"
 */
export function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get Unix epoch seconds
 * → 1706538600
 */
export function getEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get Unix epoch milliseconds
 */
export function getEpochMillis(): number {
  return Date.now();
}

/**
 * Format duration in human-readable form
 * formatDuration(125) → "2m 5s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  if (remainingMins > 0) {
    return `${hours}h ${remainingMins}m`;
  }
  return `${hours}h`;
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert slug back to title case
 * "add-authentication-system" → "Add Authentication System"
 */
export function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(capitalize)
    .join(' ');
}

/**
 * Pad number with leading zeros
 */
export function padNumber(num: number, length: number): string {
  return String(num).padStart(length, '0');
}

/**
 * Extract number from start of string
 * "08-add-auth" → 8
 * "123-task" → 123
 */
export function extractLeadingNumber(str: string): number | null {
  const match = str.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
