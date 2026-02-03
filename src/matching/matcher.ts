import { getConfig } from '../config';
import { Service } from '../config/types';
import { MatchResult, ServiceMatch } from './types';

// Config cache to avoid repeated loads
let cachedConfig: any = undefined;

/**
 * Normalize a service name by removing common suffixes and trimming
 * @param name - The service name to normalize
 * @returns Normalized service name
 */
function normalizeServiceName(name: string): string {
  return name
    .replace(/\s+(Service|API|App|System|Platform|Server|Client)$/i, '')
    .trim()
    .toLowerCase();
}

/**
 * Find a service by name using simple string matching
 * @param serviceName - The service name to match
 * @param minConfidence - Minimum confidence score (0-1), defaults to 0.85 (unused but kept for API compatibility)
 * @returns ServiceMatch if found, null otherwise
 */
export async function findServiceWithConfidence(
  serviceName: string,
  minConfidence: number = 0.85
): Promise<ServiceMatch | null> {
  // Get configuration (with caching)
  if (cachedConfig === undefined) {
    cachedConfig = await getConfig();
  }

  const config = cachedConfig;

  if (!config || !config.services || config.services.length === 0) {
    return null;
  }

  // Normalize the input service name
  const normalizedInput = normalizeServiceName(serviceName);

  // Require at least 2 characters to avoid false positives
  if (normalizedInput.length < 2) {
    return null;
  }

  // Find service by checking if normalized names contain each other
  for (const service of config.services) {
    const normalizedServiceName = normalizeServiceName(service.name);

    // Check if either contains the other
    if (normalizedInput.includes(normalizedServiceName) ||
        normalizedServiceName.includes(normalizedInput)) {
      // Return the matched service with perfect confidence
      return {
        ...service,
        matchConfidence: 1.0,
      };
    }
  }

  return null;
}

/**
 * Clear the cached config
 * Useful when configuration is reloaded
 */
export function clearMatcherCache(): void {
  cachedConfig = undefined;
}
