'use strict';

// Customers shipped in the catalog (config-overlays/<name>/).
const KNOWN_CUSTOMERS = new Set(['nga', 'nsa', 'nro', 'cia', 'dia']);

const USAGE = `
Usage:
  npx @adelphi/gsd-ic install --customer=<name> [--target=<path>]

Subcommands:
  install     Install the IC pack into a program directory
  --help      Show this help

Required:
  --customer=<name>   One of: ${[...KNOWN_CUSTOMERS].join(', ')}

Optional:
  --target=<path>     Program directory (default: $PWD)

Examples:
  npx @adelphi/gsd-ic install --customer=nga
  npx @adelphi/gsd-ic@2026.05.0 install --customer=nsa --target=/path/to/program
`.trim();

function parseArgs(argv) {
  const opts = { subcommand: null, customer: null, target: process.cwd() };
  const tokens = Array.isArray(argv) ? argv.slice() : [];

  // Help flag.
  if (tokens.includes('--help') || tokens.includes('-h')) {
    return { ...opts, subcommand: 'help' };
  }

  // Pull subcommand (first non-flag token).
  for (const t of tokens) {
    if (!t.startsWith('--')) {
      if (!opts.subcommand) opts.subcommand = t;
    }
  }

  // Pull --foo=bar style flags.
  for (const t of tokens) {
    if (t.startsWith('--customer=')) opts.customer = t.slice('--customer='.length);
    else if (t.startsWith('--target=')) opts.target = t.slice('--target='.length);
  }

  if (!opts.subcommand) {
    throw new Error(`missing subcommand. ${USAGE}`);
  }
  if (!['install', 'help'].includes(opts.subcommand)) {
    throw new Error(`unknown subcommand "${opts.subcommand}". ${USAGE}`);
  }
  if (opts.subcommand === 'install') {
    if (!opts.customer) {
      throw new Error(`install requires --customer=<name>. ${USAGE}`);
    }
    if (!KNOWN_CUSTOMERS.has(opts.customer)) {
      throw new Error(`unknown customer "${opts.customer}". Known: ${[...KNOWN_CUSTOMERS].join(', ')}`);
    }
  }
  return opts;
}

module.exports = { parseArgs, USAGE, KNOWN_CUSTOMERS };
