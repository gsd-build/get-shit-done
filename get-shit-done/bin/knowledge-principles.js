const { knowledge } = require('./knowledge.js');
const { generateEmbedding } = require('./embeddings.js');

// Action classification for autonomy
const ACTION_TYPES = {
  reversible: [
    'create_file', 'edit_file', 'add_code', 'update_code',
    'install_package', 'run_test', 'format_code', 'lint'
  ],
  irreversible: [
    'delete_file', 'delete_directory', 'delete_database', 'delete_table',
    'drop_table', 'drop_database', 'remove_package', 'git_push_force',
    'production_deploy', 'truncate', 'purge'
  ],
  external: [
    'send_email', 'api_call', 'notification', 'webhook'
  ],
  costly: [
    'cloud_resource', 'paid_api', 'large_compute'
  ]
};

// Check relevant principles for a decision context
async function checkPrinciples(context, options = {}) {
  const { scope = 'global', limit = 5 } = options;

  try {
    // Search for relevant principles
    const embedding = await generateEmbedding(context);
    const results = await knowledge.search(context, {
      scope,
      types: ['principle'],
      limit,
      embedding  // Use embedding for better matching
    });

    // Filter by confidence
    const applicable = results.filter(r => {
      const meta = r.metadata || {};
      return meta.confidence >= 0.7;  // Only high-confidence principles
    });

    return {
      found: applicable.length > 0,
      principles: applicable.map(p => ({
        id: p.id,
        rule: p.content,
        confidence: p.metadata?.confidence || 0,
        topic: p.metadata?.topic
      }))
    };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

function classifyAction(action) {
  const lowerAction = action.toLowerCase();

  // Check for specific keywords first
  for (const [category, keywords] of Object.entries(ACTION_TYPES)) {
    for (const keyword of keywords) {
      if (lowerAction.includes(keyword.replace(/_/g, ' ')) ||
          lowerAction.includes(keyword)) {
        return { category, keyword };
      }
    }
  }

  // Additional safety check: any delete/remove with production/critical context
  if ((lowerAction.includes('delete') || lowerAction.includes('remove')) &&
      (lowerAction.includes('production') || lowerAction.includes('prod') ||
       lowerAction.includes('data') || lowerAction.includes('all'))) {
    return { category: 'irreversible', keyword: 'delete_production' };
  }

  return { category: 'reversible', keyword: 'default' };
}

async function canActAutonomously(action, context = '', options = {}) {
  // Step 1: Classify action type
  const classification = classifyAction(action);

  // Irreversible, external, or costly actions require human approval
  if (classification.category !== 'reversible') {
    return {
      autonomous: false,
      reason: `${classification.category}_action`,
      category: classification.category,
      requires_approval: true
    };
  }

  // Step 2: Check for relevant principles
  const principleCheck = await checkPrinciples(
    `${action}: ${context}`,
    options
  );

  if (principleCheck.found && principleCheck.principles.length > 0) {
    // Have guiding principles - can act autonomously
    const topPrinciple = principleCheck.principles[0];

    return {
      autonomous: true,
      reason: 'principle_guided',
      principle: topPrinciple.rule,
      confidence: topPrinciple.confidence,
      principle_id: topPrinciple.id
    };
  }

  // Step 3: No principles but reversible - cautious autonomy
  return {
    autonomous: true,
    reason: 'reversible_default',
    confidence: 0.5,  // Lower confidence without principle
    note: 'No matching principles, proceeding with caution'
  };
}

async function applyPrinciple(principleId, action, outcome, options = {}) {
  const { scope = 'global' } = options;

  try {
    // Get the principle
    const principle = await knowledge.get(principleId, scope);
    if (!principle) {
      return { applied: false, reason: 'principle_not_found' };
    }

    // Track principle usage
    const { updateKnowledge } = require('./knowledge-crud.js');
    const conn = await knowledge._getConnection(scope);

    const meta = principle.metadata || {};
    await updateKnowledge(conn.db, principleId, {
      metadata: {
        ...meta,
        usage_count: (meta.usage_count || 0) + 1,
        last_used: Date.now(),
        last_action: action,
        last_outcome: outcome
      }
    });

    return {
      applied: true,
      principle: principle.content,
      usage_count: (meta.usage_count || 0) + 1
    };
  } catch (err) {
    return { applied: false, reason: err.message };
  }
}

async function makeDecision(action, context, options = {}) {
  // Full decision flow
  const autonomyCheck = await canActAutonomously(action, context, options);

  const decision = {
    action,
    context,
    can_proceed: autonomyCheck.autonomous,
    ...autonomyCheck
  };

  if (!autonomyCheck.autonomous) {
    decision.message = `This ${autonomyCheck.category} action requires human approval.`;
    decision.prompt = `Should I proceed with: ${action}?`;
  } else if (autonomyCheck.principle) {
    decision.message = `Proceeding based on learned principle: ${autonomyCheck.principle}`;
  } else {
    decision.message = 'Proceeding with reversible action (no specific principle applies).';
  }

  return decision;
}

module.exports = {
  ACTION_TYPES,
  classifyAction,
  checkPrinciples,
  canActAutonomously,
  applyPrinciple,
  makeDecision
};
