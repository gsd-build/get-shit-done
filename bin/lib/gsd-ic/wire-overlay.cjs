'use strict';

const fs = require('fs');
const path = require('path');

function readPackVersion(packSource) {
  const p = path.join(packSource, 'VERSION');
  if (!fs.existsSync(p)) return null;
  const m = fs.readFileSync(p, 'utf8').match(/^pack:\s*(\S+)/m);
  return m ? m[1] : null;
}

function readOverlay(packSource, customer) {
  const p = path.join(packSource, 'config-overlays', customer, 'overlay.json');
  if (!fs.existsSync(p)) {
    throw new Error(`overlay.json missing for customer "${customer}" at ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readTargetConfig(target) {
  const p = path.join(target, '.planning/config.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`target config.json is malformed: ${p}: ${e.message}`);
  }
}

function writeTargetConfig(target, cfg) {
  const dir = path.join(target, '.planning');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2) + '\n');
}

function wireOverlay({ packSource, target, customer, confirmCustomerSwitch = false }) {
  const overlay = readOverlay(packSource, customer);
  const cfg = readTargetConfig(target);

  // Customer-switch guard.
  const previousCustomer = cfg.__gsd_ic && cfg.__gsd_ic.customer;
  if (previousCustomer && previousCustomer !== customer && !confirmCustomerSwitch) {
    throw new Error(
      `customer switch detected (was "${previousCustomer}", now "${customer}"). ` +
      `Re-run with --confirm-customer-switch to proceed. (Per spec §2.3, customer is ` +
      `usually a property of the program; switching usually means a new instance.)`
    );
  }

  // Clear previously-managed agent_skills entries (idempotent re-install).
  const previouslyManagedAgents = (cfg.__gsd_ic && cfg.__gsd_ic.managed_agents) || [];
  const existingSkills = cfg.agent_skills || {};
  for (const a of previouslyManagedAgents) delete existingSkills[a];

  // Apply new overlay's agent_skills (replace, not append).
  const newManagedAgents = Object.keys(overlay.agent_skills || {});
  for (const [agent, skills] of Object.entries(overlay.agent_skills || {})) {
    existingSkills[agent] = skills;
  }

  cfg.agent_skills = existingSkills;
  cfg.__gsd_ic = {
    customer,
    pack_version: readPackVersion(packSource),
    installed_at: new Date().toISOString(),
    managed_agents: newManagedAgents,
  };

  writeTargetConfig(target, cfg);
}

module.exports = { wireOverlay };
