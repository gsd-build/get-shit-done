/**
 * MCP Error Envelope Module
 *
 * Provides structured error handling with recovery suggestions for MCP tools.
 * All responses follow the envelope pattern per CONTEXT.md decisions.
 */

'use strict';

/**
 * Wrap successful response in envelope format.
 * @param {*} data - The response data
 * @param {string[]} nextActions - Suggested follow-up tools
 * @returns {object} Envelope with success=true
 */
function envelope(data, nextActions = []) {
  return {
    success: true,
    data,
    error: null,
    next_actions: nextActions,
  };
}

/**
 * Wrap error response in envelope format.
 * @param {string} code - Error code (e.g., 'PHASE_NOT_FOUND')
 * @param {string} message - Human-readable error message
 * @param {string} recovery - Recovery suggestion referencing /gsd: commands
 * @param {string[]} nextActions - Suggested follow-up tools
 * @returns {object} Envelope with success=false
 */
function errorEnvelope(code, message, recovery, nextActions = []) {
  return {
    success: false,
    data: null,
    error: { code, message, recovery },
    next_actions: nextActions,
  };
}

/**
 * Custom error class with recovery suggestion.
 * Can be thrown and caught, then converted to envelope format.
 */
class GsdError extends Error {
  /**
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {string} recovery - Recovery suggestion
   * @param {string[]} nextActions - Suggested follow-up tools
   */
  constructor(code, message, recovery, nextActions = []) {
    super(message);
    this.name = 'GsdError';
    this.code = code;
    this.recovery = recovery;
    this.nextActions = nextActions;
  }

  /**
   * Convert this error to an envelope response.
   * @returns {object} Error envelope
   */
  toEnvelope() {
    return errorEnvelope(this.code, this.message, this.recovery, this.nextActions);
  }
}

// ============================================================================
// Pre-defined error factories for common cases
// ============================================================================

/**
 * Create error for phase not found.
 * @param {string} phase - The phase that was not found
 * @returns {GsdError}
 */
function phaseNotFoundError(phase) {
  return new GsdError(
    'PHASE_NOT_FOUND',
    `Phase ${phase} does not exist in .planning/phases/`,
    'Run /gsd:progress to see available phases, or /gsd:plan-phase to create a new phase',
    ['progress', 'roadmap_get']
  );
}

/**
 * Create error for plan not found.
 * @param {string} phase - The phase number
 * @param {string|number} plan - The plan number
 * @returns {GsdError}
 */
function planNotFoundError(phase, plan) {
  return new GsdError(
    'PLAN_NOT_FOUND',
    `Plan ${plan} does not exist in phase ${phase}`,
    `Run /gsd:progress to see available plans in phase ${phase}`,
    ['progress', 'phase_info']
  );
}

/**
 * Create error for project not initialized.
 * @returns {GsdError}
 */
function projectNotFoundError() {
  return new GsdError(
    'PROJECT_NOT_FOUND',
    'No GSD project found. The .planning/ directory does not exist.',
    'Run /gsd:init to initialize a new project, or change to a directory with an existing GSD project',
    ['init']
  );
}

/**
 * Create error for invalid input.
 * @param {string} field - The field that has invalid input
 * @param {string} reason - Why the input is invalid
 * @returns {GsdError}
 */
function invalidInputError(field, reason) {
  return new GsdError(
    'INVALID_INPUT',
    `Invalid input for '${field}': ${reason}`,
    'Check the tool documentation for valid parameter values',
    []
  );
}

module.exports = {
  envelope,
  errorEnvelope,
  GsdError,
  phaseNotFoundError,
  planNotFoundError,
  projectNotFoundError,
  invalidInputError,
};
