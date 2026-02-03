import { Service } from '../config/types';

/**
 * Result from Fuse.js search with confidence score
 */
export interface MatchResult {
  item: Service;
  score: number;
  confidence: number;
}

/**
 * Service with match confidence added
 */
export interface ServiceMatch extends Service {
  matchConfidence: number;
}