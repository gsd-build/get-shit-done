/**
 * GSD TypeScript Helpers
 *
 * Pure TypeScript implementations for common GSD operations.
 * All functions are read-only and use async fs operations.
 */

// Types
export type {
  GsdConfig,
  PhaseInfo,
  PlanInfo,
  CommandFrontmatter,
  AgentFrontmatter,
  ParsedPhaseNumber,
} from './types.js';

// Config operations
export {
  readConfig,
  getModelProfile,
  getWorkflowSettings,
  shouldCommitDocs,
  getMode,
  getDepth,
} from './config.js';

// Environment validation
export {
  planningExists,
  projectExists,
  roadmapExists,
  stateExists,
  configExists,
  gitRepoExists,
  phasesDirectoryExists,
  quickDirectoryExists,
  phaseDirectoryExists,
} from './environment.js';

// Phase number operations
export {
  normalizePhaseNumber,
  parsePhaseNumber,
  formatPhasePrefix,
  incrementPhase,
  getPhaseDirectoryPattern,
  buildPhaseSlug,
  extractPhaseFromDirName,
  extractNameFromDirName,
  buildPhaseDirectoryName,
  comparePhaseNumbers,
} from './phase.js';

// File discovery
export {
  listPhaseDirectories,
  findPhaseDirectory,
  listPlanFiles,
  listSummaryFiles,
  findIncompletePlans,
  countPlans,
  countSummaries,
  findResearchFile,
  findContextFile,
  calculateNextQuickNumber,
  getHighestPhaseNumber,
  listQuickDirectories,
  readFileContent,
  readStateFile,
  readRoadmapFile,
  readProjectFile,
} from './files.js';

// Text processing
export {
  generateSlug,
  truncateSlug,
  getIsoTimestamp,
  getDateString,
  getEpochSeconds,
  getEpochMillis,
  formatDuration,
  capitalize,
  slugToTitle,
  padNumber,
  extractLeadingNumber,
} from './text.js';

// Frontmatter parsing
export {
  parseFrontmatter,
  parseCommandFrontmatter,
  parseAgentFrontmatter,
  parsePlanFrontmatter,
  serializeFrontmatter,
  extractBody,
  hasFrontmatter,
} from './frontmatter.js';
