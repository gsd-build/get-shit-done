'use strict';

const {
  MODEL_PROFILES,
  VALID_PROFILES,
  AGENT_TO_PHASE_TYPE,
  VALID_PHASE_TYPES,
  AGENT_DEFAULT_TIERS,
  VALID_AGENT_TIERS,
  nextTier,
  formatAgentToModelMapAsTable,
  getAgentToModelMapForProfile,
} = require('./model-catalog.cjs');

module.exports = {
  MODEL_PROFILES,
  VALID_PROFILES,
  AGENT_TO_PHASE_TYPE,
  VALID_PHASE_TYPES,
  AGENT_DEFAULT_TIERS,
  VALID_AGENT_TIERS,
  nextTier,
  formatAgentToModelMapAsTable,
  getAgentToModelMapForProfile,
};
