#!/usr/bin/env node
'use strict';

/**
 * Scaffolds a new changeset fragment (#2975).
 *
 *   npm run changeset -- --type Fixed --pr 1234 --body "fix the thing"
 *
 * Writes `.changeset/<adjective>-<noun>-<noun>.md` with frontmatter
 * + body. The random three-word filename minimizes filename collision
 * across concurrent PRs.
 */

const fs = require('node:fs');
const path = require('node:path');

// Small word lists — keep the function simple and dependency-free.
// Together this gives ~40 * 40 * 40 = 64,000 distinct names. The lint
// rejects any duplicate filename, so collisions are caught even when
// the random draw repeats.
const ADJECTIVES = [
  'silly', 'brave', 'calm', 'eager', 'gentle', 'happy', 'jolly', 'kind',
  'lively', 'merry', 'nimble', 'plucky', 'quick', 'sturdy', 'witty', 'zesty',
  'bold', 'clever', 'daring', 'fierce', 'graceful', 'humble', 'lucky', 'noble',
  'proud', 'rapid', 'sharp', 'tidy', 'vivid', 'wise', 'agile', 'curious',
  'eager', 'gallant', 'mellow', 'patient', 'serene', 'steady', 'sturdy', 'sunny',
];
const NOUNS_A = [
  'bears', 'birds', 'cats', 'dogs', 'elks', 'foxes', 'goats', 'hawks',
  'ibex', 'jays', 'koalas', 'lynx', 'moles', 'newts', 'otters', 'pumas',
  'quails', 'rams', 'seals', 'tigers', 'voles', 'wolves', 'yaks', 'zebras',
  'badgers', 'cranes', 'deer', 'eagles', 'finches', 'geese', 'herons', 'jaguars',
  'lemurs', 'mice', 'orcas', 'pandas', 'ravens', 'sloths', 'tunas', 'wasps',
];
const NOUNS_B = [
  'dance', 'sing', 'leap', 'run', 'jump', 'climb', 'fly', 'swim',
  'rest', 'wake', 'roam', 'greet', 'wander', 'gather', 'forage', 'travel',
  'glide', 'sprint', 'tumble', 'wave', 'cheer', 'rally', 'parade', 'march',
  'hop', 'frolic', 'caper', 'romp', 'zip', 'dart', 'snooze', 'munch',
  'chatter', 'squeak', 'howl', 'bark', 'purr', 'roar', 'hum', 'click',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateFragmentName() {
  return `${pick(ADJECTIVES)}-${pick(NOUNS_A)}-${pick(NOUNS_B)}`;
}

function scaffoldFragment({ repo, type, pr, body }) {
  const dir = path.join(repo, '.changeset');
  fs.mkdirSync(dir, { recursive: true });
  let name;
  let target;
  // Re-roll on collision (rare with 40^3 space; the loop terminates).
  for (let i = 0; i < 16; i++) {
    name = generateFragmentName();
    target = path.join(dir, `${name}.md`);
    if (!fs.existsSync(target)) break;
  }
  const content = `---\ntype: ${type}\npr: ${pr}\n---\n${body}\n`;
  fs.writeFileSync(target, content);
  return target;
}

function parseArgs(argv) {
  const opts = { type: null, pr: null, body: null, repo: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--type') opts.type = argv[++i];
    else if (a === '--pr') opts.pr = Number(argv[++i]);
    else if (a === '--body') opts.body = argv[++i];
    else if (a === '--repo') opts.repo = argv[++i];
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.type || !opts.pr || !opts.body) {
    process.stderr.write('usage: changeset/new.cjs --type <Fixed|Added|...> --pr NNNN --body "..."\n');
    process.exit(2);
  }
  const file = scaffoldFragment(opts);
  process.stdout.write(`${path.relative(process.cwd(), file)}\n`);
}

if (require.main === module) main();

module.exports = { generateFragmentName, scaffoldFragment };
