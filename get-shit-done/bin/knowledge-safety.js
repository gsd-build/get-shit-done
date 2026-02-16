const { classifyAction } = require('./knowledge-principles.js');

// Lazy-load permissions module to avoid circular dependencies
function getPermissionsModule() {
  try {
    return require('./knowledge-permissions.js');
  } catch (err) {
    // Module not ready yet
    return null;
  }
}

/**
 * Determine if action requires user approval
 * @param {string} action - The action to check
 * @param {object} context - Additional context
 * @returns {object} - { stop: boolean, reason: string, category: string, prompt?: string }
 */
function shouldStopAndAsk(action, context = {}) {
  const classification = classifyAction(action);
  const category = classification.category;

  // Irreversible actions require approval
  if (category === 'irreversible') {
    return {
      stop: true,
      reason: 'irreversible_action',
      category,
      prompt: formatApprovalPrompt(action, 'irreversible')
    };
  }

  // External communications require approval
  if (category === 'external') {
    return {
      stop: true,
      reason: 'external_communication',
      category,
      prompt: formatApprovalPrompt(action, 'external')
    };
  }

  // Costly actions require approval
  if (category === 'costly') {
    return {
      stop: true,
      reason: 'costly_action',
      category,
      prompt: formatApprovalPrompt(action, 'costly')
    };
  }

  // Safe/reversible actions don't require approval
  return {
    stop: false,
    reason: 'safe_action',
    category
  };
}

/**
 * Format human-readable approval prompt
 * @param {string} action - The action requiring approval
 * @param {string} category - Action category (irreversible/external/costly)
 * @returns {string} - Formatted prompt
 */
function formatApprovalPrompt(action, category) {
  switch (category) {
    case 'irreversible':
      return `This action will ${action}. This cannot be undone. Proceed? [y/N]`;
    case 'external':
      return `This will communicate externally: ${action}. Proceed? [y/N]`;
    case 'costly':
      return `This action may incur costs: ${action}. Proceed? [y/N]`;
    default:
      return `Proceed with ${action}? [y/N]`;
  }
}

/**
 * Estimate cost of action
 * @param {string} action - The action to estimate
 * @param {object} context - Additional context (estimated_tokens, etc.)
 * @returns {number} - Estimated cost in dollars
 */
function estimateActionCost(action, context = {}) {
  const lowerAction = action.toLowerCase();

  // AWS/cloud resources
  if (lowerAction.includes('aws:') || lowerAction.includes('cloud_resource')) {
    return 0.10; // Conservative estimate
  }

  // API calls with token estimates
  if (lowerAction.includes('api_call') && context.estimated_tokens) {
    return (context.estimated_tokens / 1000000) * 0.50;
  }

  // Paid APIs
  if (lowerAction.includes('paid_api')) {
    return 0.05;
  }

  // Large compute
  if (lowerAction.includes('large_compute')) {
    return 1.00;
  }

  // Default: no cost
  return 0.0;
}

/**
 * Execute action with full safety check flow
 * @param {string} action - The action to execute
 * @param {object} context - Additional context
 * @param {object} options - Execution options
 * @returns {object} - { proceed: boolean, autonomous?: boolean, requires_approval?: boolean, reason: string, ... }
 */
function executeWithSafetyCheck(action, context = {}, options = {}) {
  // Step 1: Check if we should stop and ask
  const stopCheck = shouldStopAndAsk(action, context);

  if (stopCheck.stop) {
    // Try to check permission (if module is available)
    let permitted = false;
    let grantId = null;

    try {
      const permissionsModule = getPermissionsModule();
      if (permissionsModule && permissionsModule.checkPermission) {
        const permCheck = permissionsModule.checkPermission(action, context);
        permitted = permCheck.permitted || false;
        grantId = permCheck.grant_id || null;
      }
    } catch (err) {
      // Permission check failed - treat as not permitted
      permitted = false;
    }

    // If permitted, proceed autonomously
    if (permitted) {
      const result = {
        proceed: true,
        autonomous: true,
        via: 'permission',
        grant_id: grantId,
        reason: stopCheck.reason,
        category: stopCheck.category
      };

      // Add cost estimate for costly actions
      if (stopCheck.category === 'costly') {
        result.estimated_cost = estimateActionCost(action, context);
      }

      return result;
    }

    // Not permitted - require approval
    const result = {
      proceed: false,
      requires_approval: true,
      reason: stopCheck.reason,
      prompt: stopCheck.prompt,
      category: stopCheck.category
    };

    // Add cost estimate for costly actions
    if (stopCheck.category === 'costly') {
      const cost = estimateActionCost(action, context);
      result.estimated_cost = cost;
      result.prompt = `This action may cost ~$${cost.toFixed(2)}: ${action}. Proceed? [y/N]`;
    }

    return result;
  }

  // No stop required - safe to proceed
  return {
    proceed: true,
    autonomous: true,
    reason: 'safe_action',
    category: stopCheck.category
  };
}

module.exports = {
  shouldStopAndAsk,
  formatApprovalPrompt,
  estimateActionCost,
  executeWithSafetyCheck
};
