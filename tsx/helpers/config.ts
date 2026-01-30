/**
 * Config reading and parsing for .planning/config.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { GsdConfig } from './types.js';

const CONFIG_PATH = '.planning/config.json';

const DEFAULT_CONFIG: GsdConfig = {
  mode: 'interactive',
  depth: 'standard',
  parallelization: true,
  commit_docs: true,
  model_profile: 'balanced',
  workflow: {
    research: true,
    plan_check: true,
    verifier: true,
  },
};

/**
 * Read and parse .planning/config.json
 * Returns null if file doesn't exist or is invalid
 */
export async function readConfig(basePath: string = process.cwd()): Promise<GsdConfig | null> {
  try {
    const configPath = path.join(basePath, CONFIG_PATH);
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed as GsdConfig;
  } catch {
    return null;
  }
}

/**
 * Get model profile from config, defaults to 'balanced'
 */
export function getModelProfile(config: GsdConfig | null): 'quality' | 'balanced' | 'budget' {
  return config?.model_profile ?? DEFAULT_CONFIG.model_profile;
}

/**
 * Get workflow settings from config
 */
export function getWorkflowSettings(config: GsdConfig | null): {
  research: boolean;
  plan_check: boolean;
  verifier: boolean;
} {
  return config?.workflow ?? DEFAULT_CONFIG.workflow;
}

/**
 * Check if planning docs should be committed
 */
export function shouldCommitDocs(config: GsdConfig | null): boolean {
  return config?.commit_docs ?? DEFAULT_CONFIG.commit_docs;
}

/**
 * Get mode setting (yolo or interactive)
 */
export function getMode(config: GsdConfig | null): 'yolo' | 'interactive' {
  return config?.mode ?? DEFAULT_CONFIG.mode;
}

/**
 * Get depth setting
 */
export function getDepth(config: GsdConfig | null): 'quick' | 'standard' | 'comprehensive' {
  return config?.depth ?? DEFAULT_CONFIG.depth;
}
