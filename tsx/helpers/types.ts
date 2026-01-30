/**
 * Shared TypeScript types for GSD helpers
 */

export interface GsdConfig {
  mode: 'yolo' | 'interactive';
  depth: 'quick' | 'standard' | 'comprehensive';
  parallelization: boolean;
  commit_docs: boolean;
  model_profile: 'quality' | 'balanced' | 'budget';
  workflow: {
    research: boolean;
    plan_check: boolean;
    verifier: boolean;
  };
}

export interface PhaseInfo {
  /** Normalized phase number: "08" or "02.1" */
  number: string;
  /** Phase name from directory */
  name: string;
  /** URL-safe slug */
  slug: string;
  /** Full directory path */
  directory: string;
}

export interface PlanInfo {
  /** Full path to plan file */
  path: string;
  /** Phase number */
  phase: string;
  /** Plan number within phase */
  plan: string;
  /** Whether summary exists */
  hasSummary: boolean;
}

export interface CommandFrontmatter {
  name: string;
  description: string;
  'argument-hint'?: string;
  'allowed-tools'?: string[];
  agent?: string;
}

export interface AgentFrontmatter {
  name: string;
  description: string;
  tools?: string;
  color?: string;
}

export interface ParsedPhaseNumber {
  /** Integer part of phase number */
  integer: number;
  /** Decimal part for inserted phases (e.g., 2.1 has decimal=1) */
  decimal?: number;
}
