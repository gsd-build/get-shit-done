/**
 * Knowledge Layer — Facade module
 * Single entry point for the entire knowledge engine.
 * Re-exports all public APIs from sub-modules.
 */
'use strict';

const { initKnowledge } = require('./init.cjs');
const { buildIndex, updateIndexIncremental, getIndex, listModules } = require('./indexer.cjs');
const { assembleContext, assembleDiffAwareContext } = require('./context.cjs');
const { buildDependencyGraph, getImpactedFiles } = require('./dependencies.cjs');
const { getChangedFilesSince, getCurrentHead } = require('./git-diff.cjs');
const { createLoopGuard } = require('./loop-guard.cjs');
const {
  getProtectedFiles, isFileProtected, isSafeImprovement,
  createCircuitBreaker, scopeCheck, validateMergeReadiness,
} = require('./safety.cjs');
const { knowledgeDir, indexPath } = require('./utils.cjs');

module.exports = {
  // Init
  initKnowledge,

  // Indexer
  buildIndex, updateIndexIncremental, getIndex, listModules,

  // Context
  assembleContext, assembleDiffAwareContext,

  // Dependencies
  buildDependencyGraph, getImpactedFiles,

  // Git
  getChangedFilesSince, getCurrentHead,

  // Loop Guard
  createLoopGuard,

  // Safety
  getProtectedFiles, isFileProtected, isSafeImprovement,
  createCircuitBreaker, scopeCheck, validateMergeReadiness,

  // Paths
  knowledgeDir, indexPath,
};
