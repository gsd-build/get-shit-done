#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * declare-tools.js - CLI entry point for Declare.
 *
 * Subcommand dispatch pattern forked from GSD's gsd-tools.cjs.
 * Bundled via esbuild into dist/declare-tools.cjs for distribution.
 *
 * Usage: node declare-tools.js <command> [args...]
 *
 * Commands:
 *   commit <message> --files <file1> [file2...]  - Atomic git commit for planning docs
 *   init                                          - (stub) Initialize project
 *   status                                        - (stub) Show graph status
 *   help                                          - (stub) Show help
 */

const { commitPlanningDocs } = require('./git/commit');
const { runInit } = require('./commands/init');
const { runStatus } = require('./commands/status');
const { runHelp } = require('./commands/help');

/**
 * Parse --cwd flag from argv.
 * @param {string[]} argv
 * @returns {string | null}
 */
function parseCwdFlag(argv) {
  const idx = argv.indexOf('--cwd');
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

/**
 * Extract positional arguments from argv, stripping known flags and their values.
 * Strips: --cwd <value>, --files <values...>
 * @param {string[]} argv - Arguments after the subcommand (e.g., args.slice(1))
 * @returns {string[]}
 */
function parsePositionalArgs(argv) {
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === '--cwd') {
      i += 2; // skip flag and value
    } else if (argv[i] === '--files') {
      i++; // skip flag
      while (i < argv.length && !argv[i].startsWith('--')) i++; // skip file values
    } else if (argv[i].startsWith('--')) {
      i++; // skip unknown flag
    } else {
      positional.push(argv[i]);
      i++;
    }
  }
  return positional;
}

/**
 * Parse --files flag from argv.
 * Collects everything after --files until next flag (starts with --) or end.
 * @param {string[]} argv
 * @returns {string[]}
 */
function parseFilesFlag(argv) {
  const idx = argv.indexOf('--files');
  if (idx === -1) return [];

  const files = [];
  for (let i = idx + 1; i < argv.length; i++) {
    if (argv[i].startsWith('--')) break;
    files.push(argv[i]);
  }
  return files;
}

/**
 * Main entry point. Dispatches to subcommands.
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(JSON.stringify({ error: 'No command specified. Use: commit, init, status, help' }));
    process.exit(1);
  }

  try {
    switch (command) {
      case 'commit': {
        const message = args[1];
        if (!message) {
          console.log(JSON.stringify({ error: 'commit requires a message argument' }));
          process.exit(1);
        }
        const files = parseFilesFlag(args);
        const cwd = process.cwd();
        const result = commitPlanningDocs(cwd, message, files);
        console.log(JSON.stringify(result));
        process.exit(result.committed || result.reason === 'nothing_to_commit' ? 0 : 1);
        break;
      }

      case 'init': {
        const cwdInit = parseCwdFlag(args) || process.cwd();
        const initArgs = parsePositionalArgs(args.slice(1));
        const result = runInit(cwdInit, initArgs);
        console.log(JSON.stringify(result));
        break;
      }

      case 'status': {
        const cwdStatus = parseCwdFlag(args) || process.cwd();
        const result = runStatus(cwdStatus);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'help': {
        const result = runHelp();
        console.log(JSON.stringify(result));
        break;
      }

      default:
        console.log(JSON.stringify({ error: `Unknown command: ${command}. Use: commit, init, status, help` }));
        process.exit(1);
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }));
    process.exit(1);
  }
}

main();
