/**
 * Active Workstream Pointer Store Module
 *
 * Owns workstream source precedence and selection:
 * CLI --ws > GSD_WORKSTREAM env > stored active workstream pointer.
 */

const { getActiveWorkstream } = require('./planning-workspace.cjs');
const { isValidActiveWorkstreamName } = require('./workstream-name-policy.cjs');

function validateWorkstreamName(name) {
  return isValidActiveWorkstreamName(name);
}

function parseCliWorkstream(args) {
  const wsEqArg = args.find(arg => arg.startsWith('--ws='));
  const wsIdx = args.indexOf('--ws');

  if (wsEqArg) {
    const value = wsEqArg.slice('--ws='.length).trim();
    if (!value) throw new Error('Missing value for --ws');
    return {
      value,
      source: 'cli',
      args: args.filter(arg => arg !== wsEqArg),
    };
  }

  if (wsIdx !== -1) {
    const value = args[wsIdx + 1];
    if (!value || value.startsWith('--')) throw new Error('Missing value for --ws');
    return {
      value,
      source: 'cli',
      args: args.filter((_, idx) => idx !== wsIdx && idx !== wsIdx + 1),
    };
  }

  return {
    value: null,
    source: null,
    args: args.slice(),
  };
}

function resolveActiveWorkstream(cwd, args, env = process.env, deps = {}) {
  const parsed = parseCliWorkstream(args);
  const getStored = deps.getStored || getActiveWorkstream;

  let ws = null;
  let source = 'none';

  if (parsed.value) {
    ws = parsed.value;
    source = parsed.source;
  } else if (env && typeof env.GSD_WORKSTREAM === 'string' && env.GSD_WORKSTREAM.trim()) {
    ws = env.GSD_WORKSTREAM.trim();
    source = 'env';
  } else {
    ws = getStored(cwd) || null;
    source = ws ? 'store' : 'none';
  }

  if (ws && !validateWorkstreamName(ws)) {
    throw new Error('Invalid workstream name: must be alphanumeric, hyphens, underscores, or dots');
  }

  return {
    ws,
    source,
    args: parsed.args,
  };
}

function applyResolvedWorkstreamEnv(resolution, env = process.env) {
  if (!resolution || !resolution.ws) return;
  env.GSD_WORKSTREAM = resolution.ws;
}

module.exports = {
  validateWorkstreamName,
  parseCliWorkstream,
  resolveActiveWorkstream,
  applyResolvedWorkstreamEnv,
};
