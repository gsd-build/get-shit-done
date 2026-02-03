/**
 * Main entry point for the config module.
 * Provides clean API for loading and accessing company configuration.
 */

// Export loader functions
export { loadCompanyConfig, getConfig, clearConfigCache } from './loader';

// Export types for consumers
export type { Config, Service } from './types';