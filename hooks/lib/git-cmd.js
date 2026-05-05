'use strict';

/**
 * git-cmd.js — token-walk git command classifier.
 *
 * Determines whether a shell command string invokes a specific git
 * subcommand. Handles the four forms that a naive `^git\s+commit` regex
 * misses:
 *
 *   bare:         git commit -m "..."                 ✓
 *   -C path:      git -C /some/path commit -m "..."   ✓ (missed by regex)
 *   env-prefix:   GIT_AUTHOR_NAME=x git commit "..."  ✓ (missed by regex)
 *   full-path:    /usr/bin/git commit -m "..."         ✓ (missed by regex)
 *
 * This module is the single source of truth for git-commit detection so all
 * hooks that need to gate on git commits share one implementation.
 *
 * Exported by the hooks/lib/ directory — require via a path relative to the
 * hook's own __dirname:
 *
 *   const { isGitSubcommand } = require(path.join(__dirname, 'lib', 'git-cmd.js'));
 */

const path = require('path');

/**
 * Git global options that take a following argument.
 * These must be consumed as (option, argument) pairs when walking tokens.
 */
const ARGUMENT_TAKING_FLAGS = new Set([
  '-C',                // working directory
  '--git-dir',         // path to git repository
  '--work-tree',       // path to working tree
  '--namespace',       // git namespace
  '--super-prefix',    // superproject-relative prefix
  '--exec-path',       // path to core git programs (when given an arg)
  '--html-path',
  '--man-path',
  '--info-path',
  '--list-cmds',
]);

/**
 * Git global flags that consume no extra argument.
 */
const BOOLEAN_FLAGS = new Set([
  '-p', '--paginate', '--no-pager',
  '--no-replace-objects', '--bare',
  '--literal-pathspecs', '--glob-pathspecs', '--noglob-pathspecs',
  '--icase-pathspecs', '--no-optional-locks',
  '-P', '--no-lazy-fetch',
  '--version', '--help',
]);

/**
 * Tokenize a shell command string.
 * Handles single-quoted strings, double-quoted strings, and unquoted tokens.
 * Does NOT perform variable expansion or brace expansion.
 *
 * @param {string} cmd
 * @returns {string[]}
 */
function tokenize(cmd) {
  const tokens = [];
  let i = 0;
  const len = cmd.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(cmd[i])) i++;
    if (i >= len) break;

    let token = '';
    while (i < len && !/\s/.test(cmd[i])) {
      if (cmd[i] === "'") {
        // Single-quoted string: take everything until closing '
        i++;
        while (i < len && cmd[i] !== "'") token += cmd[i++];
        if (i < len) i++; // consume closing '
      } else if (cmd[i] === '"') {
        // Double-quoted string: take everything until closing " (no escape handling)
        i++;
        while (i < len && cmd[i] !== '"') token += cmd[i++];
        if (i < len) i++; // consume closing "
      } else {
        token += cmd[i++];
      }
    }
    if (token) tokens.push(token);
  }

  return tokens;
}

/**
 * Return true if `cmd` invokes the git subcommand `sub`.
 *
 * @param {string} cmd  - Full shell command string (may include env vars, full paths)
 * @param {string} sub  - Subcommand to test for, e.g. 'commit'
 * @returns {boolean}
 */
function isGitSubcommand(cmd, sub) {
  if (!cmd || !sub) return false;

  const tokens = tokenize(cmd);
  let i = 0;

  // Phase 1: skip leading VAR=VALUE environment assignments
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) {
    i++;
  }

  // Phase 2: the next token must be the git executable
  if (i >= tokens.length) return false;
  const gitToken = tokens[i++];
  if (path.basename(gitToken) !== 'git') return false;

  // Phase 3: consume git global options
  while (i < tokens.length) {
    const t = tokens[i];

    // --flag=value form for argument-taking flags
    const eqIdx = t.indexOf('=');
    const flagName = eqIdx !== -1 ? t.slice(0, eqIdx) : t;
    if (ARGUMENT_TAKING_FLAGS.has(flagName)) {
      if (eqIdx !== -1) {
        // consumed as one token: --git-dir=.git
        i++;
      } else {
        // consumed as two tokens: -C /path
        i += 2;
      }
      continue;
    }

    if (BOOLEAN_FLAGS.has(t)) {
      i++;
      continue;
    }

    // Not a global option — this is the subcommand
    break;
  }

  // Phase 4: check the subcommand
  if (i >= tokens.length) return false;
  return tokens[i] === sub;
}

module.exports = { isGitSubcommand, tokenize };
