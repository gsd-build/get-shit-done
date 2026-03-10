/**
 * MCP Resource Providers
 *
 * Exposes GSD project state as MCP resources with stable URIs.
 * Resources return parsed JSON (not raw markdown) wrapped in envelope format.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { envelope, projectNotFoundError } = require('./errors.cjs');
const state = require('../state.cjs');
const roadmap = require('../roadmap.cjs');
const health = require('../health.cjs');
const init = require('../init.cjs');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure a GSD project exists in the current working directory.
 * @param {string} cwd - Current working directory
 * @throws {GsdError} If .planning/ directory does not exist
 */
function ensureProject(cwd) {
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) {
    throw projectNotFoundError();
  }
}

/**
 * Get current working directory, defaulting to process.cwd().
 * @returns {string} Current working directory
 */
function getCwd() {
  return process.cwd();
}

/**
 * Capture output from a GSD command that uses the output() function.
 * Many GSD lib functions call output() instead of returning data directly.
 * This wrapper captures that output.
 *
 * @param {Function} fn - Function to execute
 * @param {...any} args - Arguments to pass to the function
 * @returns {object|null} Captured output data or null if none
 */
function captureOutput(fn, ...args) {
  let capturedData = null;

  // Create a mock output function that captures data
  const mockOutput = (data /*, raw, humanText */) => {
    capturedData = data;
  };

  // Call the function with raw=true to get JSON output
  // For functions that use the output helper from core.cjs
  try {
    fn(...args);
  } catch (err) {
    // Re-throw GsdErrors, otherwise wrap
    if (err.name === 'GsdError') {
      throw err;
    }
    throw new Error(`Command failed: ${err.message}`);
  }

  return capturedData;
}

// ============================================================================
// Resource Handlers
// ============================================================================

/**
 * Handler for gsd://state resource.
 * Returns parsed STATE.md with progress, decisions, blockers.
 */
async function handleStateResource() {
  const cwd = getCwd();
  ensureProject(cwd);

  // cmdStateSnapshot returns data via output function, but we need raw JSON
  // Call with raw=true to get structured data
  let stateData = null;

  // Create custom output capture
  const originalOutput = state.cmdStateSnapshot;

  try {
    // cmdStateSnapshot(cwd, raw) - raw=true returns JSON via output
    // We need to capture the output
    let captured = null;
    const mockOutput = (data) => { captured = data; };

    // Temporarily override output in the module
    // Since cmdStateSnapshot uses the output helper from core.cjs,
    // we need to call it and capture stdout or use raw mode
    state.cmdStateSnapshot(cwd, true);

    // For commands that print to stdout in raw mode, we read STATE.md directly
    // and parse it ourselves for more reliable resource data
    const statePath = path.join(cwd, '.planning', 'STATE.md');
    if (!fs.existsSync(statePath)) {
      return envelope({
        error: 'STATE.md not found',
        exists: false,
      }, ['init']);
    }

    const content = fs.readFileSync(statePath, 'utf-8');

    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = {};
    if (frontmatterMatch) {
      const lines = frontmatterMatch[1].split('\n');
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          frontmatter[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
        }
      }
    }

    // Parse current position
    const phaseMatch = content.match(/\*\*Phase:\*\*\s*(\d+[A-Za-z]?(?:\.\d+)?)/);
    const planMatch = content.match(/\*\*Plan:\*\*\s*(\d+-\d+|\d+)/);
    const statusMatch = content.match(/\*\*Status:\*\*\s*([^\n]+)/);

    // Parse progress bar
    const progressMatch = content.match(/\[([#\-]+)\]\s*(\d+)%/);

    stateData = {
      exists: true,
      frontmatter,
      milestone: frontmatter.milestone || null,
      milestone_name: frontmatter.milestone_name || null,
      status: frontmatter.status || statusMatch?.[1]?.trim() || 'unknown',
      current_phase: phaseMatch?.[1] || null,
      current_plan: planMatch?.[1] || null,
      progress_percent: progressMatch ? parseInt(progressMatch[2], 10) : null,
      last_updated: frontmatter.last_updated || null,
      last_activity: frontmatter.last_activity || null,
    };

  } catch (err) {
    if (err.name === 'GsdError') {
      throw err;
    }
    stateData = {
      exists: false,
      error: err.message,
    };
  }

  return envelope(stateData, ['roadmap_get', 'phase_info', 'progress']);
}

/**
 * Handler for gsd://roadmap resource.
 * Returns parsed ROADMAP.md with phases, progress, and dependencies.
 */
async function handleRoadmapResource() {
  const cwd = getCwd();
  ensureProject(cwd);

  let roadmapData = null;

  try {
    // cmdRoadmapAnalyze(cwd, raw, milestoneId)
    // This outputs to stdout in raw mode, so we read and parse directly
    const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');

    if (!fs.existsSync(roadmapPath)) {
      return envelope({
        exists: false,
        error: 'ROADMAP.md not found',
        phases: [],
      }, ['init']);
    }

    // Call the analyze function and capture via modified approach
    // Since roadmap.cmdRoadmapAnalyze uses output() from core.cjs,
    // we invoke it and rely on the raw data structure
    let captured = null;
    const originalConsoleLog = console.log;

    // Temporarily capture console.log output (raw mode prints JSON to stdout)
    let outputBuffer = '';
    console.log = (data) => { outputBuffer += data; };

    try {
      roadmap.cmdRoadmapAnalyze(cwd, true, null);
      console.log = originalConsoleLog;

      if (outputBuffer) {
        captured = JSON.parse(outputBuffer);
      }
    } catch (parseErr) {
      console.log = originalConsoleLog;
      // Fall back to basic parsing
    }

    if (captured) {
      roadmapData = {
        exists: true,
        ...captured,
      };
    } else {
      // Basic fallback parsing
      const content = fs.readFileSync(roadmapPath, 'utf-8');
      const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
      const phases = [];
      let match;

      while ((match = phasePattern.exec(content)) !== null) {
        phases.push({
          number: match[1],
          name: match[2].replace(/\(INSERTED\)/i, '').trim(),
        });
      }

      roadmapData = {
        exists: true,
        phases,
        phase_count: phases.length,
      };
    }

  } catch (err) {
    if (err.name === 'GsdError') {
      throw err;
    }
    roadmapData = {
      exists: false,
      error: err.message,
      phases: [],
    };
  }

  return envelope(roadmapData, ['state_get', 'phase_info']);
}

/**
 * Handler for gsd://phase/current resource.
 * Returns context for the current active phase.
 */
async function handleCurrentPhaseResource() {
  const cwd = getCwd();
  ensureProject(cwd);

  let phaseData = null;

  try {
    // First, read STATE.md to get current phase
    const statePath = path.join(cwd, '.planning', 'STATE.md');
    if (!fs.existsSync(statePath)) {
      return envelope({
        exists: false,
        error: 'STATE.md not found - cannot determine current phase',
      }, ['init']);
    }

    const stateContent = fs.readFileSync(statePath, 'utf-8');
    const phaseMatch = stateContent.match(/\*\*Phase:\*\*\s*(\d+[A-Za-z]?(?:\.\d+)?)/);

    if (!phaseMatch) {
      return envelope({
        exists: false,
        error: 'Current phase not found in STATE.md',
      }, ['progress']);
    }

    const currentPhase = phaseMatch[1];

    // Call cmdInitPhaseOp to get phase context
    let captured = null;
    const originalConsoleLog = console.log;
    let outputBuffer = '';
    console.log = (data) => { outputBuffer += data; };

    try {
      init.cmdInitPhaseOp(cwd, currentPhase, true);
      console.log = originalConsoleLog;

      if (outputBuffer) {
        captured = JSON.parse(outputBuffer);
      }
    } catch (parseErr) {
      console.log = originalConsoleLog;
    }

    if (captured) {
      phaseData = {
        exists: true,
        phase_number: currentPhase,
        ...captured,
      };
    } else {
      // Fallback: basic phase info
      phaseData = {
        exists: true,
        phase_number: currentPhase,
        phase_found: false,
        error: 'Could not load detailed phase info',
      };
    }

  } catch (err) {
    if (err.name === 'GsdError') {
      throw err;
    }
    phaseData = {
      exists: false,
      error: err.message,
    };
  }

  return envelope(phaseData, ['execute_plan', 'roadmap_get']);
}

/**
 * Handler for gsd://health resource.
 * Returns worktree health, sync status, and integrity checks.
 */
async function handleHealthResource() {
  const cwd = getCwd();
  ensureProject(cwd);

  let healthData = null;

  try {
    // runQuickHealthCheck(cwd) returns { issues, hasOrphans } directly
    const quickHealth = health.runQuickHealthCheck(cwd);

    // Also check sync health if available
    let syncIssues = [];
    try {
      syncIssues = health.checkSyncHealth(cwd);
    } catch {
      // Sync health check is optional
    }

    healthData = {
      status: quickHealth.hasOrphans || syncIssues.length > 0 ? 'degraded' : 'healthy',
      issues: quickHealth.issues,
      has_issues: quickHealth.hasOrphans,
      issue_count: quickHealth.issues.length,
      sync_issues: syncIssues,
      sync_issue_count: syncIssues.length,
    };

  } catch (err) {
    if (err.name === 'GsdError') {
      throw err;
    }
    healthData = {
      status: 'unknown',
      error: err.message,
      issues: [],
    };
  }

  return envelope(healthData, ['health_repair']);
}

// ============================================================================
// Resource Registration
// ============================================================================

/**
 * Register MCP resource providers on the server.
 *
 * Resources follow the MCP SDK resource API:
 * - handler returns { contents: [{ uri, mimeType, text }] }
 *
 * @param {McpServer} server - The MCP server instance
 */
function registerResources(server) {
  // gsd://state - Project state from STATE.md
  server.resource(
    'gsd://state',
    'GSD Project State',
    async (uri) => {
      try {
        const data = await handleStateResource();
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          }],
        };
      } catch (err) {
        const errorData = err.toEnvelope ? err.toEnvelope() : {
          success: false,
          error: { code: 'RESOURCE_ERROR', message: err.message },
        };
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(errorData, null, 2),
          }],
        };
      }
    }
  );

  // gsd://roadmap - Roadmap from ROADMAP.md
  server.resource(
    'gsd://roadmap',
    'GSD Roadmap',
    async (uri) => {
      try {
        const data = await handleRoadmapResource();
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          }],
        };
      } catch (err) {
        const errorData = err.toEnvelope ? err.toEnvelope() : {
          success: false,
          error: { code: 'RESOURCE_ERROR', message: err.message },
        };
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(errorData, null, 2),
          }],
        };
      }
    }
  );

  // gsd://phase/current - Current phase context
  server.resource(
    'gsd://phase/current',
    'Current Phase Context',
    async (uri) => {
      try {
        const data = await handleCurrentPhaseResource();
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          }],
        };
      } catch (err) {
        const errorData = err.toEnvelope ? err.toEnvelope() : {
          success: false,
          error: { code: 'RESOURCE_ERROR', message: err.message },
        };
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(errorData, null, 2),
          }],
        };
      }
    }
  );

  // gsd://health - Health status
  server.resource(
    'gsd://health',
    'GSD Health Status',
    async (uri) => {
      try {
        const data = await handleHealthResource();
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          }],
        };
      } catch (err) {
        const errorData = err.toEnvelope ? err.toEnvelope() : {
          success: false,
          error: { code: 'RESOURCE_ERROR', message: err.message },
        };
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(errorData, null, 2),
          }],
        };
      }
    }
  );
}

module.exports = {
  registerResources,
  // Export handlers for testing
  handleStateResource,
  handleRoadmapResource,
  handleCurrentPhaseResource,
  handleHealthResource,
};
