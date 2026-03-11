/**
 * MCP Tools Module
 *
 * Tool registrations for exposing GSD operations via MCP protocol.
 * Core tier tools are always available; extended tier via capability negotiation.
 */

'use strict';

const { z } = require('zod');
const {
  envelope,
  errorEnvelope,
  projectNotFoundError,
  phaseNotFoundError,
  invalidInputError,
  GsdError,
} = require('./errors.cjs');
const state = require('../state.cjs');
const health = require('../health.cjs');
const phase = require('../phase.cjs');
const roadmap = require('../roadmap.cjs');
const commands = require('../commands.cjs');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Constants
// ============================================================================

/**
 * Core tier tools - always available
 */
const CORE_TOOLS = ['progress', 'health', 'state_get', 'phase_info', 'roadmap_get'];

/**
 * Extended tier tools - available via capability negotiation
 */
const EXTENDED_TOOLS = ['plan_phase', 'execute_phase', 'state_update', 'phase_complete'];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Ensure a GSD project exists in the current directory.
 * @param {string} cwd - Working directory to check
 * @throws {GsdError} If .planning/ directory does not exist
 */
function ensureProject(cwd) {
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) {
    throw projectNotFoundError();
  }
}

/**
 * Suggest next actions based on context.
 * @param {string} context - What just happened (e.g., 'progress', 'health')
 * @returns {string[]} Array of suggested tool names
 */
function suggestNextActions(context) {
  const suggestions = {
    progress: ['health', 'phase_info'],
    health: ['progress'],
    state_get: ['roadmap_get', 'progress'],
    phase_info: ['roadmap_get', 'state_get'],
    roadmap_get: ['phase_info', 'progress'],
    plan_phase: ['execute_phase', 'progress'],
    execute_phase: ['progress', 'health'],
    state_update: ['state_get'],
    phase_complete: ['progress', 'roadmap_get'],
  };
  return suggestions[context] || [];
}

/**
 * Format a successful response for MCP tool output.
 * @param {object} responseEnvelope - The envelope response
 * @returns {object} MCP-formatted response with content array
 */
function formatResponse(responseEnvelope) {
  return {
    content: [{ type: 'text', text: JSON.stringify(responseEnvelope, null, 2) }],
  };
}

/**
 * Capture output from GSD commands that use the output() pattern.
 * @param {function} cmdFn - The command function to call
 * @param  {...any} args - Arguments to pass to the command (cwd first, raw=true last)
 * @returns {object} The captured output
 */
function captureOutput(cmdFn, ...args) {
  let captured = null;
  const outputFn = (result, raw, _humanText) => {
    captured = result;
  };
  // Insert outputFn before the raw boolean
  const argsWithOutput = [...args.slice(0, -1), outputFn, args[args.length - 1]];
  cmdFn(...argsWithOutput);
  return captured;
}

// ============================================================================
// Core Tools Registration
// ============================================================================

/**
 * Register core tier tools with the MCP server.
 * Core tools are always available: progress, health, state_get, phase_info, roadmap_get
 *
 * @param {McpServer} server - The MCP server instance
 */
function registerCoreTools(server) {
  const cwd = process.cwd();

  // ─── progress ────────────────────────────────────────────────────────────────
  server.tool(
    'progress',
    'Show project progress across phases and milestones',
    {
      format: z.enum(['json', 'table', 'bar']).optional().describe('Output format'),
      milestone: z.string().optional().describe('Filter to specific milestone'),
    },
    async ({ format, milestone }) => {
      try {
        ensureProject(cwd);
        let result;
        const outputFn = (data, _raw, _text) => {
          result = data;
        };
        commands.cmdProgressMultiMilestone(cwd, format || 'json', outputFn, milestone);
        return formatResponse(envelope(result, suggestNextActions('progress')));
      } catch (err) {
        if (err instanceof GsdError) {
          return formatResponse(err.toEnvelope());
        }
        return formatResponse(
          errorEnvelope('PROGRESS_ERROR', err.message, 'Run /gsd:progress to check project status', ['health'])
        );
      }
    }
  );

  // ─── health ──────────────────────────────────────────────────────────────────
  server.tool(
    'health',
    'Check .planning/ integrity and worktree status',
    {
      repair: z.boolean().optional().default(false).describe('Attempt to repair issues'),
    },
    async ({ repair }) => {
      try {
        ensureProject(cwd);
        let result;
        const outputFn = (data, _raw) => {
          result = data;
        };
        health.cmdHealthCheck(cwd, { repair }, outputFn, true);
        return formatResponse(envelope(result, suggestNextActions('health')));
      } catch (err) {
        if (err instanceof GsdError) {
          return formatResponse(err.toEnvelope());
        }
        return formatResponse(
          errorEnvelope('HEALTH_ERROR', err.message, 'Check .planning/ directory exists and is readable', ['progress'])
        );
      }
    }
  );

  // ─── state_get ───────────────────────────────────────────────────────────────
  server.tool(
    'state_get',
    'Get STATE.md content or specific section',
    {
      section: z.string().optional().describe('Section name to extract (e.g., "Position", "Decisions")'),
    },
    async ({ section }) => {
      try {
        ensureProject(cwd);
        let result;
        const outputFn = (data, _raw) => {
          result = data;
        };

        if (section) {
          state.cmdStateGet(cwd, section, outputFn, true);
        } else {
          state.cmdStateSnapshot(cwd, outputFn, true);
        }
        return formatResponse(envelope(result, suggestNextActions('state_get')));
      } catch (err) {
        if (err instanceof GsdError) {
          return formatResponse(err.toEnvelope());
        }
        return formatResponse(
          errorEnvelope('STATE_ERROR', err.message, 'Ensure STATE.md exists in .planning/', ['progress'])
        );
      }
    }
  );

  // ─── phase_info ──────────────────────────────────────────────────────────────
  server.tool(
    'phase_info',
    'Get information about a specific phase',
    {
      phase: z.string().describe('Phase number or M<milestone>/<phase> reference'),
    },
    async ({ phase: phaseArg }) => {
      try {
        ensureProject(cwd);
        let result;
        const outputFn = (data, _raw, _text) => {
          result = data;
        };
        phase.cmdFindPhase(cwd, phaseArg, outputFn, {});

        if (!result || !result.found) {
          throw phaseNotFoundError(phaseArg);
        }
        return formatResponse(envelope(result, suggestNextActions('phase_info')));
      } catch (err) {
        if (err instanceof GsdError) {
          return formatResponse(err.toEnvelope());
        }
        return formatResponse(
          errorEnvelope('PHASE_ERROR', err.message, `Check phase exists with /gsd:progress`, ['progress', 'roadmap_get'])
        );
      }
    }
  );

  // ─── roadmap_get ─────────────────────────────────────────────────────────────
  server.tool(
    'roadmap_get',
    'Get ROADMAP.md parsed as structured data',
    {
      phase: z.string().optional().describe('Get specific phase section from roadmap'),
    },
    async ({ phase: phaseArg }) => {
      try {
        ensureProject(cwd);
        let result;
        const outputFn = (data, _raw, _text) => {
          result = data;
        };

        if (phaseArg) {
          roadmap.cmdRoadmapGetPhase(cwd, phaseArg, outputFn, null);
        } else {
          roadmap.cmdRoadmapAnalyze(cwd, outputFn, null);
        }
        return formatResponse(envelope(result, suggestNextActions('roadmap_get')));
      } catch (err) {
        if (err instanceof GsdError) {
          return formatResponse(err.toEnvelope());
        }
        return formatResponse(
          errorEnvelope('ROADMAP_ERROR', err.message, 'Ensure ROADMAP.md exists in .planning/', ['progress'])
        );
      }
    }
  );
}

// ============================================================================
// Extended Tools Registration
// ============================================================================

/**
 * Register extended tier tools with the MCP server.
 * Extended tools for planning/execution: plan_phase, execute_phase, state_update, phase_complete
 *
 * @param {McpServer} server - The MCP server instance
 */
function registerExtendedTools(server) {
  const cwd = process.cwd();

  // ─── plan_phase ──────────────────────────────────────────────────────────────
  server.tool(
    'plan_phase',
    'Create execution plans for a phase',
    {
      phase: z.string().describe('Phase number to plan'),
      gaps: z.boolean().optional().describe('Only plan gaps/incomplete tasks'),
    },
    async ({ phase: phaseArg, gaps }) => {
      try {
        ensureProject(cwd);
        // Long-running operation - return guidance for CLI usage
        return formatResponse(
          envelope(
            {
              status: 'long_running_operation',
              message: 'This operation requires streaming. Use CLI: /gsd:plan-phase',
              cli_command: `/gsd:plan-phase ${phaseArg}${gaps ? ' --gaps' : ''}`,
              phase: phaseArg,
              gaps: gaps || false,
            },
            suggestNextActions('plan_phase')
          )
        );
      } catch (err) {
        if (err instanceof GsdError) {
          return formatResponse(err.toEnvelope());
        }
        return formatResponse(
          errorEnvelope('PLAN_ERROR', err.message, 'Run /gsd:plan-phase via CLI', ['progress'])
        );
      }
    }
  );

  // ─── execute_phase ───────────────────────────────────────────────────────────
  server.tool(
    'execute_phase',
    'Execute a phase plan',
    {
      phase: z.string().describe('Phase number to execute'),
      plan: z.number().optional().describe('Specific plan number to execute'),
      dry_run: z.boolean().optional().describe('Preview without executing'),
    },
    async ({ phase: phaseArg, plan, dry_run }) => {
      try {
        ensureProject(cwd);
        // Long-running operation - return guidance for CLI usage
        const planArg = plan ? ` --plan ${plan}` : '';
        const dryRunArg = dry_run ? ' --dry-run' : '';
        return formatResponse(
          envelope(
            {
              status: 'long_running_operation',
              message: 'This operation requires streaming. Use CLI: /gsd:execute-phase',
              cli_command: `/gsd:execute-phase ${phaseArg}${planArg}${dryRunArg}`,
              phase: phaseArg,
              plan: plan || null,
              dry_run: dry_run || false,
            },
            suggestNextActions('execute_phase')
          )
        );
      } catch (err) {
        if (err instanceof GsdError) {
          return formatResponse(err.toEnvelope());
        }
        return formatResponse(
          errorEnvelope('EXECUTE_ERROR', err.message, 'Run /gsd:execute-phase via CLI', ['progress', 'health'])
        );
      }
    }
  );

  // ─── state_update ────────────────────────────────────────────────────────────
  server.tool(
    'state_update',
    'Update a STATE.md field',
    {
      field: z.string().describe('Field name to update (e.g., "status", "current_plan")'),
      value: z.string().describe('New value for the field'),
    },
    async ({ field, value }) => {
      try {
        ensureProject(cwd);

        // Validate field name
        const validFields = ['status', 'current_plan', 'current_phase', 'last_activity'];
        if (!validFields.includes(field)) {
          throw invalidInputError('field', `Must be one of: ${validFields.join(', ')}`);
        }

        let result;
        const outputFn = (data, _raw) => {
          result = data;
        };
        state.cmdStateUpdate(cwd, field, value, outputFn, true);
        return formatResponse(envelope(result, suggestNextActions('state_update')));
      } catch (err) {
        if (err instanceof GsdError) {
          return formatResponse(err.toEnvelope());
        }
        return formatResponse(
          errorEnvelope('STATE_UPDATE_ERROR', err.message, 'Check field name and value are valid', ['state_get'])
        );
      }
    }
  );

  // ─── phase_complete ──────────────────────────────────────────────────────────
  server.tool(
    'phase_complete',
    'Mark a phase as complete',
    {
      phase: z.string().describe('Phase number to mark complete'),
    },
    async ({ phase: phaseArg }) => {
      try {
        ensureProject(cwd);
        let result;
        const outputFn = (data, _raw, _text) => {
          result = data;
        };
        phase.cmdPhaseComplete(cwd, phaseArg, outputFn, null);
        return formatResponse(envelope(result, suggestNextActions('phase_complete')));
      } catch (err) {
        if (err instanceof GsdError) {
          return formatResponse(err.toEnvelope());
        }
        return formatResponse(
          errorEnvelope('PHASE_COMPLETE_ERROR', err.message, 'Ensure all plans in phase have summaries', ['progress', 'phase_info'])
        );
      }
    }
  );
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Constants
  CORE_TOOLS,
  EXTENDED_TOOLS,

  // Registration functions
  registerCoreTools,
  registerExtendedTools,

  // Helpers (exported for testing)
  ensureProject,
  suggestNextActions,
  formatResponse,
};
