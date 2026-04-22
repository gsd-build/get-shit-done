/**
 * Config — Planning config CRUD operations
 */

const fs = require('fs');
const path = require('path');
const { output, error, planningDir, withPlanningLock, CONFIG_DEFAULTS, atomicWriteFileSync } = require('./core.cjs');
const {
  VALID_PROFILES,
  getAgentToModelMapForProfile,
  formatAgentToModelMapAsTable,
} = require('./model-profiles.cjs');
const { VALID_CONFIG_KEYS, isValidConfigKey } = require('./config-schema.cjs');

const CONFIG_KEY_SUGGESTIONS = {
  'workflow.nyquist_validation_enabled': 'workflow.nyquist_validation',
  'agents.nyquist_validation_enabled': 'workflow.nyquist_validation',
  'nyquist.validation_enabled': 'workflow.nyquist_validation',
  'hooks.research_questions': 'workflow.research_before_questions',
  'workflow.research_questions': 'workflow.research_before_questions',
  'workflow.codereview': 'workflow.code_review',
  'workflow.review_command': 'workflow.code_review_command',
  'workflow.review': 'workflow.code_review',
  'workflow.code_review_level': 'workflow.code_review_depth',
  'workflow.review_depth': 'workflow.code_review_depth',
  'review.model': 'review.models.<cli-name>',
  'sub_repos': 'planning.sub_repos',
  'plan_checker': 'workflow.plan_check',
};

function validateKnownConfigKeyPath(keyPath) {
  const suggested = CONFIG_KEY_SUGGESTIONS[keyPath];
  if (suggested) {
    error(`Unknown config key: ${keyPath}. Did you mean ${suggested}?`);
  }
}

/**
 * Build a fully-materialized config object for a new project.
 *
 * Merges (increasing priority):
 *   1. Hardcoded defaults — every key that loadConfig() resolves, plus mode/granularity
 *   2. User-level defaults from ~/.gsd/defaults.json (if present)
 *   3. userChoices — the settings the user explicitly selected during /gsd:new-project
 *
 * Uses the canonical `git` namespace for branching keys (consistent with VALID_CONFIG_KEYS
 * and the settings workflow). loadConfig() handles both flat and nested formats, so this
 * is backward-compatible with existing projects that have flat keys.
 *
 * Returns a plain object — does NOT write any files.
 */
function buildNewProjectConfig(userChoices) {
  const choices = userChoices || {};
  const homedir = require('os').homedir();

  // Detect API key availability
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));
  const firecrawlKeyFile = path.join(homedir, '.gsd', 'firecrawl_api_key');
  const hasFirecrawl = !!(process.env.FIRECRAWL_API_KEY || fs.existsSync(firecrawlKeyFile));
  const exaKeyFile = path.join(homedir, '.gsd', 'exa_api_key');
  const hasExaSearch = !!(process.env.EXA_API_KEY || fs.existsSync(exaKeyFile));

  // Load user-level defaults from ~/.gsd/defaults.json if available
  const globalDefaultsPath = path.join(homedir, '.gsd', 'defaults.json');
  let userDefaults = {};
  try {
    if (fs.existsSync(globalDefaultsPath)) {
      userDefaults = JSON.parse(fs.readFileSync(globalDefaultsPath, 'utf-8'));
      // Migrate deprecated "depth" key to "granularity"
      if ('depth' in userDefaults && !('granularity' in userDefaults)) {
        const depthToGranularity = { quick: 'coarse', standard: 'standard', comprehensive: 'fine' };
        userDefaults.granularity = depthToGranularity[userDefaults.depth] || userDefaults.depth;
        delete userDefaults.depth;
        try {
          fs.writeFileSync(globalDefaultsPath, JSON.stringify(userDefaults, null, 2), 'utf-8');
        } catch { /* intentionally empty */ }
      }
    }
  } catch {
    // Ignore malformed global defaults
  }

  const hardcoded = {
    model_profile: CONFIG_DEFAULTS.model_profile,
    commit_docs: CONFIG_DEFAULTS.commit_docs,
    parallelization: CONFIG_DEFAULTS.parallelization,
    search_gitignored: CONFIG_DEFAULTS.search_gitignored,
    brave_search: hasBraveSearch,
    firecrawl: hasFirecrawl,
    exa_search: hasExaSearch,
    git: {
      branching_strategy: CONFIG_DEFAULTS.branching_strategy,
      phase_branch_template: CONFIG_DEFAULTS.phase_branch_template,
      milestone_branch_template: CONFIG_DEFAULTS.milestone_branch_template,
      quick_branch_template: CONFIG_DEFAULTS.quick_branch_template,
    },
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: true,
      auto_advance: false,
      node_repair: true,
      node_repair_budget: 2,
      ui_phase: true,
      ui_safety_gate: true,
      ai_integration_phase: true,
      tdd_mode: false,
      text_mode: false,
      research_before_questions: false,
      discuss_mode: 'discuss',
      skip_discuss: false,
      code_review: true,
      code_review_depth: 'standard',
      code_review_command: null,
      pattern_mapper: true,
      plan_bounce: false,
      plan_bounce_script: null,
      plan_bounce_passes: 2,
      auto_prune_state: false,
      security_enforcement: CONFIG_DEFAULTS.security_enforcement,
      security_asvs_level: CONFIG_DEFAULTS.security_asvs_level,
      security_block_on: CONFIG_DEFAULTS.security_block_on,
    },
    hooks: {
      context_warnings: true,
    },
    project_code: null,
    phase_naming: 'sequential',
    agent_skills: {},
    claude_md_path: './CLAUDE.md',
  };

  // Three-level deep merge: hardcoded <- userDefaults <- choices
  return {
    ...hardcoded,
    ...userDefaults,
    ...choices,
    git: {
      ...hardcoded.git,
      ...(userDefaults.git || {}),
      ...(choices.git || {}),
    },
    workflow: {
      ...hardcoded.workflow,
      ...(userDefaults.workflow || {}),
      ...(choices.workflow || {}),
    },
    hooks: {
      ...hardcoded.hooks,
      ...(userDefaults.hooks || {}),
      ...(choices.hooks || {}),
    },
    agent_skills: {
      ...hardcoded.agent_skills,
      ...(userDefaults.agent_skills || {}),
      ...(choices.agent_skills || {}),
    },
  };
}

/**
 * Command: create a fully-materialized .planning/config.json for a new project.
 *
 * Accepts user-chosen settings as a JSON string (the keys the user explicitly
 * configured during /gsd:new-project). All remaining keys are filled from
 * hardcoded defaults and optional ~/.gsd/defaults.json.
 *
 * Idempotent: if config.json already exists, returns { created: false }.
 */
function cmdConfigNewProject(cwd, choicesJson, raw) {
  const planningBase = planningDir(cwd);
  const configPath = path.join(planningBase, 'config.json');

  // Idempotent: don't overwrite existing config
  if (fs.existsSync(configPath)) {
    output({ created: false, reason: 'already_exists' }, raw, 'exists');
    return;
  }

  // Parse user choices
  let userChoices = {};
  if (choicesJson && choicesJson.trim() !== '') {
    try {
      userChoices = JSON.parse(choicesJson);
    } catch (err) {
      error('Invalid JSON for config-new-project: ' + err.message);
    }
  }

  // Ensure .planning directory exists
  try {
    if (!fs.existsSync(planningBase)) {
      fs.mkdirSync(planningBase, { recursive: true });
    }
  } catch (err) {
    error('Failed to create .planning directory: ' + err.message);
  }

  const config = buildNewProjectConfig(userChoices);

  try {
    atomicWriteFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    output({ created: true, path: '.planning/config.json' }, raw, 'created');
  } catch (err) {
    error('Failed to write config.json: ' + err.message);
  }
}

/**
 * Ensures the config file exists (creates it if needed).
 *
 * Does not call `output()`, so can be used as one step in a command without triggering `exit(0)` in
 * the happy path. But note that `error()` will still `exit(1)` out of the process.
 */
function ensureConfigFile(cwd) {
  const planningBase = planningDir(cwd);
  const configPath = path.join(planningBase, 'config.json');

  // Ensure .planning directory exists
  try {
    if (!fs.existsSync(planningBase)) {
      fs.mkdirSync(planningBase, { recursive: true });
    }
  } catch (err) {
    error('Failed to create .planning directory: ' + err.message);
  }

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    return { created: false, reason: 'already_exists' };
  }

  const config = buildNewProjectConfig({});

  try {
    atomicWriteFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return { created: true, path: '.planning/config.json' };
  } catch (err) {
    error('Failed to create config.json: ' + err.message);
  }
}

/**
 * Command to ensure the config file exists (creates it if needed).
 *
 * Note that this exits the process (via `output()`) even in the happy path; use
 * `ensureConfigFile()` directly if you need to avoid this.
 */
function cmdConfigEnsureSection(cwd, raw) {
  const ensureConfigFileResult = ensureConfigFile(cwd);
  if (ensureConfigFileResult.created) {
    output(ensureConfigFileResult, raw, 'created');
  } else {
    output(ensureConfigFileResult, raw, 'exists');
  }
}

/**
 * Sets a value in the config file, allowing nested values via dot notation (e.g.,
 * "workflow.research").
 *
 * Does not call `output()`, so can be used as one step in a command without triggering `exit(0)` in
 * the happy path. But note that `error()` will still `exit(1)` out of the process.
 */
function setConfigValue(cwd, keyPath, parsedValue) {
  const configPath = path.join(planningDir(cwd), 'config.json');

  return withPlanningLock(cwd, () => {
    // Load existing config or start with empty object
    let config = {};
    try {
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    } catch (err) {
      error('Failed to read config.json: ' + err.message);
    }

    // Set nested value using dot notation (e.g., "workflow.research")
    const keys = keyPath.split('.');
    let current = config;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    const previousValue = current[keys[keys.length - 1]]; // Capture previous value before overwriting
    current[keys[keys.length - 1]] = parsedValue;

    // Write back
    try {
      atomicWriteFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      return { updated: true, key: keyPath, value: parsedValue, previousValue };
    } catch (err) {
      error('Failed to write config.json: ' + err.message);
    }
  });
}

/**
 * Command to set a value in the config file, allowing nested values via dot notation (e.g.,
 * "workflow.research").
 *
 * Note that this exits the process (via `output()`) even in the happy path; use `setConfigValue()`
 * directly if you need to avoid this.
 */
function cmdConfigSet(cwd, keyPath, value, raw) {
  if (!keyPath) {
    error('Usage: config-set <key.path> <value>');
  }

  validateKnownConfigKeyPath(keyPath);

  if (!isValidConfigKey(keyPath)) {
    error(`Unknown config key: "${keyPath}". Valid keys: ${[...VALID_CONFIG_KEYS].sort().join(', ')}, agent_skills.<agent-type>, features.<feature_name>`);
  }

  // Parse value (handle booleans, numbers, and JSON arrays/objects)
  let parsedValue = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(value) && value !== '') parsedValue = Number(value);
  else if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
    try { parsedValue = JSON.parse(value); } catch { /* keep as string */ }
  }

  const VALID_CONTEXT_VALUES = ['dev', 'research', 'review'];
  if (keyPath === 'context' && !VALID_CONTEXT_VALUES.includes(String(parsedValue))) {
    error(`Invalid context value '${value}'. Valid values: ${VALID_CONTEXT_VALUES.join(', ')}`);
  }

  const setConfigValueResult = setConfigValue(cwd, keyPath, parsedValue);
  output(setConfigValueResult, raw, `${keyPath}=${parsedValue}`);
}

function cmdConfigGet(cwd, keyPath, raw, defaultValue) {
  const configPath = path.join(planningDir(cwd), 'config.json');
  const hasDefault = defaultValue !== undefined;

  if (!keyPath) {
    error('Usage: config-get <key.path> [--default <value>]');
  }

  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } else if (hasDefault) {
      output(defaultValue, raw, String(defaultValue));
      return;
    } else {
      error('No config.json found at ' + configPath);
    }
  } catch (err) {
    if (err.message.startsWith('No config.json')) throw err;
    error('Failed to read config.json: ' + err.message);
  }

  // Traverse dot-notation path (e.g., "workflow.auto_advance")
  const keys = keyPath.split('.');
  let current = config;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      if (hasDefault) { output(defaultValue, raw, String(defaultValue)); return; }
      error(`Key not found: ${keyPath}`);
    }
    current = current[key];
  }

  if (current === undefined) {
    if (hasDefault) { output(defaultValue, raw, String(defaultValue)); return; }
    error(`Key not found: ${keyPath}`);
  }

  output(current, raw, String(current));
}

/**
 * Command to set the model profile in the config file.
 *
 * Note that this exits the process (via `output()`) even in the happy path.
 */
function cmdConfigSetModelProfile(cwd, profile, raw) {
  if (!profile) {
    error(`Usage: config-set-model-profile <${VALID_PROFILES.join('|')}>`);
  }

  const normalizedProfile = profile.toLowerCase().trim();
  if (!VALID_PROFILES.includes(normalizedProfile)) {
    error(`Invalid profile '${profile}'. Valid profiles: ${VALID_PROFILES.join(', ')}`);
  }

  // Ensure config exists (create if needed)
  ensureConfigFile(cwd);

  // Set the model profile in the config
  const { previousValue } = setConfigValue(cwd, 'model_profile', normalizedProfile, raw);
  const previousProfile = previousValue || 'balanced';

  // Build result value / message and return
  const agentToModelMap = getAgentToModelMapForProfile(normalizedProfile);
  const result = {
    updated: true,
    profile: normalizedProfile,
    previousProfile,
    agentToModelMap,
  };
  const rawValue = getCmdConfigSetModelProfileResultMessage(
    normalizedProfile,
    previousProfile,
    agentToModelMap
  );
  output(result, raw, rawValue);
}

/**
 * Returns the message to display for the result of the `config-set-model-profile` command when
 * displaying raw output.
 */
function getCmdConfigSetModelProfileResultMessage(
  normalizedProfile,
  previousProfile,
  agentToModelMap
) {
  const agentToModelTable = formatAgentToModelMapAsTable(agentToModelMap);
  const didChange = previousProfile !== normalizedProfile;
  const paragraphs = didChange
    ? [
        `✓ Model profile set to: ${normalizedProfile} (was: ${previousProfile})`,
        'Agents will now use:',
        agentToModelTable,
        'Next spawned agents will use the new profile.',
      ]
    : [
        `✓ Model profile is already set to: ${normalizedProfile}`,
        'Agents are using:',
        agentToModelTable,
      ];
  return paragraphs.join('\n\n');
}

/**
 * Print the resolved config.json path (workstream-aware). Used by settings.md
 * so the workflow writes/reads the correct file when a workstream is active (#2282).
 */
function cmdConfigPath(cwd) {
  // Always emit as plain text — a file path is used via shell substitution,
  // never consumed as JSON. Passing raw=true forces plain-text output.
  const configPath = path.join(planningDir(cwd), 'config.json');
  output(configPath, true, configPath);
}

module.exports = {
  VALID_CONFIG_KEYS,
  cmdConfigEnsureSection,
  cmdConfigSet,
  cmdConfigGet,
  cmdConfigSetModelProfile,
  cmdConfigNewProject,
  cmdConfigPath,
};
