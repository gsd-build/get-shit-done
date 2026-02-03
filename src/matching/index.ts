/**
 * Fuzzy matching module for service ownership
 * Provides service name matching with confidence scoring
 */

export { findServiceWithConfidence, clearMatcherCache } from './matcher';
export type { MatchResult, ServiceMatch } from './types';