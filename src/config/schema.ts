/**
 * Simple validation for service configuration
 * Replaces Zod schema with basic type checking
 */

export interface Service {
  name: string;
  repository?: string;
  local_path?: string;
}

export interface Config {
  version: string;
  services: Service[];
  standards_repo?: string;
}

/**
 * Validate a service object
 */
function isValidService(obj: any): obj is Service {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.name === 'string' &&
    obj.name.length > 0 &&
    (obj.repository === undefined || typeof obj.repository === 'string') &&
    (obj.local_path === undefined || typeof obj.local_path === 'string')
  );
}

/**
 * Validate the config object
 */
export function validateConfig(obj: any): Config | null {
  // Basic structure check
  if (typeof obj !== 'object' || obj === null) {
    return null;
  }

  // Validate version
  const version = obj.version || '1.0.0';
  if (typeof version !== 'string') {
    return null;
  }

  // Validate services array
  const services = obj.services || [];
  if (!Array.isArray(services)) {
    return null;
  }

  // Validate each service
  for (const service of services) {
    if (!isValidService(service)) {
      return null;
    }
  }

  // Validate standards_repo if present
  const standards_repo = obj.standards_repo;
  if (standards_repo !== undefined && typeof standards_repo !== 'string') {
    return null;
  }

  return {
    version,
    services,
    standards_repo,
  };
}
