import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { validateConfig } from './schema';
import { Config } from './types';
import { formatConfigError } from '../errors/formatter';

// Module-level cache for singleton pattern
let cachedConfig: Config | null | undefined;

/**
 * Loads the company configuration file from ~/.gsd/company.json
 * Returns valid config or null, never throws.
 *
 * @returns Promise<Config | null> - Parsed config or null if invalid/missing
 */
export async function loadCompanyConfig(): Promise<Config | null> {
  const configPath = join(homedir(), '.gsd', 'company.json');

  try {
    // Attempt to read the config file
    const configContent = await fs.readFile(configPath, 'utf-8');

    // Parse JSON content
    let rawConfig: unknown;
    try {
      rawConfig = JSON.parse(configContent);
    } catch (parseError: any) {
      parseError.path = configPath;
      console.warn(formatConfigError(parseError));
      return null;
    }

    // Validate config structure
    const validatedConfig = validateConfig(rawConfig);

    if (!validatedConfig) {
      // Log validation failure
      const error: any = new Error('Invalid configuration structure');
      error.path = configPath;
      console.warn(formatConfigError(error));
      return null;
    }

    return validatedConfig;
  } catch (error: any) {
    // Add path to error for better formatting
    error.path = configPath;

    if (error.code !== 'ENOENT') {
      // Only log errors other than "file not found"
      console.warn(formatConfigError(error));
    }
    return null;
  }
}

/**
 * Gets the company configuration with caching.
 * Loads once and reuses the result for subsequent calls.
 *
 * @returns Promise<Config | null> - Cached config or null if invalid/missing
 */
export async function getConfig(): Promise<Config | null> {
  // If we haven't attempted to load yet
  if (cachedConfig === undefined) {
    cachedConfig = await loadCompanyConfig();
  }

  return cachedConfig;
}

/**
 * Clears the cached configuration, forcing a reload on next getConfig() call.
 * Useful for testing or when config file is modified.
 */
export function clearConfigCache(): void {
  cachedConfig = undefined;
}