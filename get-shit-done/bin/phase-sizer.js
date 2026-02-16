#!/usr/bin/env node

/**
 * Phase Sizer
 *
 * Detects oversized phases before execution begins and recommends splits
 * to prevent context exhaustion mid-phase. Integrates with roadmap-parser
 * for pre-execution validation.
 *
 * Pattern: Phase Size Limits with Split Recommendations
 * Source: Phase 7 Research - Pattern 2
 */

const LIMITS = {
  MAX_REQUIREMENTS_PER_PHASE: 8,     // More than 8 requirements = likely too large
  MAX_SUCCESS_CRITERIA_PER_PHASE: 6, // More than 6 criteria = complex verification
  MAX_ESTIMATED_PLANS: 5,            // More than 5 plans = consider splitting
  SAFE_CONTEXT_USAGE: 0.7,           // 70% of context window is safe
  CONTEXT_WINDOW: 200000,            // Default context window size
  TOKENS_PER_REQUIREMENT: 10000,     // Estimated tokens per requirement
  TOKENS_PER_CRITERIA: 5000,         // Estimated tokens per success criteria
  TOKENS_OVERHEAD: 20000             // Base overhead tokens
};

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

/**
 * Estimate size metrics for a phase
 * @param {Object} phase - Phase object with requirements, success_criteria
 * @returns {Object} - Size estimate with risk level
 */
function estimatePhaseSize(phase) {
  const requirements = phase.requirements?.length || 0;
  const successCriteria = phase.success_criteria?.length || 0;

  // Estimate plans: ~2 requirements per plan on average
  const estimatedPlans = Math.ceil(requirements / 2);

  // Estimate tokens needed
  const estimatedTokens =
    (requirements * LIMITS.TOKENS_PER_REQUIREMENT) +
    (successCriteria * LIMITS.TOKENS_PER_CRITERIA) +
    LIMITS.TOKENS_OVERHEAD;

  // Determine risk level
  let riskLevel = RISK_LEVELS.LOW;
  if (requirements > 5 || successCriteria > 4 || estimatedPlans > 3) {
    riskLevel = RISK_LEVELS.MEDIUM;
  }
  if (requirements > LIMITS.MAX_REQUIREMENTS_PER_PHASE ||
      successCriteria > LIMITS.MAX_SUCCESS_CRITERIA_PER_PHASE ||
      estimatedPlans > LIMITS.MAX_ESTIMATED_PLANS) {
    riskLevel = RISK_LEVELS.HIGH;
  }

  return {
    requirements,
    successCriteria,
    estimatedPlans,
    estimatedTokens,
    riskLevel,
    meetsLimits: riskLevel !== RISK_LEVELS.HIGH
  };
}

/**
 * Detect phases that exceed size limits
 * @param {Array} phases - Array of phase objects
 * @returns {Array} - Array of oversized phase reports
 */
function detectOversizedPhases(phases) {
  const oversized = [];

  for (const phase of phases) {
    const estimate = estimatePhaseSize(phase);

    if (!estimate.meetsLimits) {
      const reasons = [];

      if (estimate.requirements > LIMITS.MAX_REQUIREMENTS_PER_PHASE) {
        reasons.push(`${estimate.requirements} requirements (max: ${LIMITS.MAX_REQUIREMENTS_PER_PHASE})`);
      }

      if (estimate.successCriteria > LIMITS.MAX_SUCCESS_CRITERIA_PER_PHASE) {
        reasons.push(`${estimate.successCriteria} success criteria (max: ${LIMITS.MAX_SUCCESS_CRITERIA_PER_PHASE})`);
      }

      if (estimate.estimatedPlans > LIMITS.MAX_ESTIMATED_PLANS) {
        reasons.push(`${estimate.estimatedPlans} estimated plans (max: ${LIMITS.MAX_ESTIMATED_PLANS})`);
      }

      const safeTokens = LIMITS.CONTEXT_WINDOW * LIMITS.SAFE_CONTEXT_USAGE;
      if (estimate.estimatedTokens > safeTokens) {
        reasons.push(`${estimate.estimatedTokens} estimated tokens (max: ${safeTokens})`);
      }

      oversized.push({
        phase: phase.number,
        name: phase.name,
        reasons,
        estimate
      });
    }
  }

  return oversized;
}

/**
 * Recommend how to split an oversized phase
 * @param {Object} phase - Phase object
 * @returns {Object} - Split recommendations
 */
function recommendSplit(phase) {
  const requirements = phase.requirements || [];

  if (requirements.length <= LIMITS.MAX_REQUIREMENTS_PER_PHASE) {
    return {
      canSplit: false,
      recommendations: [],
      reasoning: 'Phase is within size limits'
    };
  }

  // Group by requirement prefix (e.g., AUTO-01, EXEC-01, KNOW-01)
  const prefixGroups = {};
  const keywordGroups = {};

  for (const req of requirements) {
    // Extract prefix (e.g., AUTO from AUTO-01)
    const prefixMatch = req.match(/^([A-Z]+)-\d+/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      if (!prefixGroups[prefix]) prefixGroups[prefix] = [];
      prefixGroups[prefix].push(req);
    }

    // Group by keywords
    const keywords = ['auth', 'database', 'ui', 'api', 'test', 'deploy', 'config'];
    for (const keyword of keywords) {
      if (req.toLowerCase().includes(keyword)) {
        if (!keywordGroups[keyword]) keywordGroups[keyword] = [];
        keywordGroups[keyword].push(req);
      }
    }
  }

  // Generate split recommendations
  const recommendations = [];
  let usedReqs = new Set();

  // First, try prefix-based grouping
  const prefixEntries = Object.entries(prefixGroups).filter(([, reqs]) => reqs.length >= 2);
  for (const [prefix, reqs] of prefixEntries) {
    if (reqs.length >= 2 && reqs.length <= LIMITS.MAX_REQUIREMENTS_PER_PHASE) {
      recommendations.push({
        name: `Phase ${phase.number}a: ${prefix} Features`,
        requirements: reqs,
        groupingStrategy: 'prefix'
      });
      reqs.forEach(r => usedReqs.add(r));
    }
  }

  // For remaining, try keyword grouping
  if (usedReqs.size < requirements.length) {
    const remaining = requirements.filter(r => !usedReqs.has(r));

    // Split remaining into chunks of MAX_REQUIREMENTS_PER_PHASE
    const chunks = [];
    for (let i = 0; i < remaining.length; i += LIMITS.MAX_REQUIREMENTS_PER_PHASE) {
      chunks.push(remaining.slice(i, i + LIMITS.MAX_REQUIREMENTS_PER_PHASE));
    }

    chunks.forEach((chunk, idx) => {
      const suffix = String.fromCharCode(97 + recommendations.length); // a, b, c, ...
      recommendations.push({
        name: `Phase ${phase.number}${suffix}: Additional Requirements`,
        requirements: chunk,
        groupingStrategy: 'size-based'
      });
    });
  }

  return {
    canSplit: recommendations.length > 1,
    recommendations,
    reasoning: recommendations.length > 1
      ? `Split into ${recommendations.length} sub-phases based on requirement grouping`
      : 'Unable to create meaningful split - requirements too interrelated'
  };
}

/**
 * Validate that split recommendations preserve dependency ordering
 * @param {Object} originalPhase - Original phase
 * @param {Array} recommendedSplits - Split recommendations
 * @param {Array} allPhases - All phases for dependency checking
 * @returns {Object} - Validation result
 */
function validateSplitPreservesDependencies(originalPhase, recommendedSplits, allPhases) {
  const issues = [];

  // Check that original phase dependencies are still valid
  const dependsOn = originalPhase.depends_on || [];

  for (const depNum of dependsOn) {
    const depPhase = allPhases.find(p => p.number === depNum);
    if (!depPhase) {
      issues.push(`Dependency on Phase ${depNum} not found in phase list`);
    }
  }

  // Check that phases depending on original can still depend on splits
  const dependentPhases = allPhases.filter(p =>
    (p.depends_on || []).includes(originalPhase.number)
  );

  if (dependentPhases.length > 0 && recommendedSplits.length > 1) {
    // Dependents should depend on the LAST split phase
    issues.push(`Note: ${dependentPhases.length} phase(s) depend on Phase ${originalPhase.number}. ` +
      `After split, update dependencies to point to last sub-phase.`);
  }

  return {
    valid: issues.filter(i => !i.startsWith('Note:')).length === 0,
    issues
  };
}

/**
 * Format a human-readable phase size report
 * @param {Object} analysis - Analysis result
 * @returns {string} - Formatted report
 */
function formatReport(analysis) {
  const lines = [];

  lines.push(`Phase ${analysis.phase}: ${analysis.name}`);
  lines.push(`  Risk Level: ${analysis.estimate.riskLevel.toUpperCase()}`);
  lines.push(`  Requirements: ${analysis.estimate.requirements}`);
  lines.push(`  Success Criteria: ${analysis.estimate.successCriteria}`);
  lines.push(`  Estimated Plans: ${analysis.estimate.estimatedPlans}`);
  lines.push(`  Estimated Tokens: ${analysis.estimate.estimatedTokens.toLocaleString()}`);

  if (analysis.reasons.length > 0) {
    lines.push(`  Issues:`);
    for (const reason of analysis.reasons) {
      lines.push(`    - ${reason}`);
    }
  }

  return lines.join('\n');
}

// Exports
module.exports = {
  estimatePhaseSize,
  detectOversizedPhases,
  recommendSplit,
  validateSplitPreservesDependencies,
  formatReport,
  LIMITS,
  RISK_LEVELS
};

// CLI interface when run directly
if (require.main === module) {
  console.log('PhaseSizer module loaded successfully');
  console.log('Exports:', Object.keys(module.exports).join(', '));
  console.log('Limits:', LIMITS);

  // Quick test
  const testPhase = {
    number: 7,
    name: 'Test Phase',
    requirements: ['REQ-1', 'REQ-2', 'REQ-3'],
    success_criteria: ['C1', 'C2']
  };

  const estimate = estimatePhaseSize(testPhase);
  console.log('\nTest estimate:', JSON.stringify(estimate, null, 2));
}
