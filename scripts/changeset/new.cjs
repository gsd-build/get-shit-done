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

// Allowed Keep-a-Changelog section types. Used by both scaffoldFragment
// (sanitization at write time) and parse.cjs (validation at consume time).
const ALLOWED_TYPES = new Set(['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']);

function scaffoldFragment({ repo, type, pr, body }) {
  // Sanitize: reject any type value not on the allowlist BEFORE embedding it
  // in frontmatter. A newline in `type` would corrupt the fragment; an
  // unrecognized value would be rejected later by parse.cjs but with a
  // confusing diagnostic. Catch both at the write boundary.
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(
      `scaffoldFragment: type=${JSON.stringify(type)} is not one of [${[...ALLOWED_TYPES].join(', ')}]`,
    );
  }
  const dir = path.join(repo, '.changeset');
  fs.mkdirSync(dir, { recursive: true });
  const content = `---\ntype: ${type}\npr: ${pr}\n---\n${body}\n`;
  // Atomic create: writeFileSync with `flag: 'wx'` fails (EEXIST) when the
  // file already exists, so concurrent invocations can't race past
  // `existsSync` and overwrite each other. Re-roll the random name on
  // collision; fail loudly after exhausting the retry budget.
  for (let i = 0; i < 16; i++) {
    const name = generateFragmentName();
    const target = path.join(dir, `${name}.md`);
    try {
      fs.writeFileSync(target, content, { flag: 'wx' });
      return target;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // collision — try another random draw
    }
  }
  throw new Error(
    'scaffoldFragment: 16 random filename draws all collided; ' +
    'expand the word lists or investigate corrupted .changeset/ state',
  );
}

function parseArgs(argv) {
  const opts = { type: null, pr: null, body: null, repo: process.cwd() };
  // Validate flag values: argv[++i] could be undefined (flag with no value)
  // or another flag (silently misparsed). Match the cli.cjs convention: return
  // { ok: true, opts } on success, { ok: false, error } on malformed input.
  const requireValue = (flag, i) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
      return { ok: false, error: `missing value for ${flag}` };
    }
    return { ok: true, value: v };
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--type' || a === '--pr' || a === '--body' || a === '--repo') {
      const r = requireValue(a, i);
      if (!r.ok) return { ok: false, error: r.error };
      if (a === '--type') opts.type = r.value;
      else if (a === '--pr') opts.pr = Number(r.value);
      else if (a === '--body') opts.body = r.value;
      else if (a === '--repo') opts.repo = r.value;
      i++;
      continue;
    }
    return { ok: false, error: `unknown argument: ${a}` };
  }
  return { ok: true, opts };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${parsed.error}\n`);
    process.stderr.write('usage: changeset/new.cjs --type <Fixed|Added|...> --pr NNNN --body "..."\n');
    process.exit(2);
  }
  const { opts } = parsed;
  if (!opts.type || !opts.pr || !opts.body) {
    process.stderr.write('usage: changeset/new.cjs --type <Fixed|Added|...> --pr NNNN --body "..."\n');
    process.exit(2);
  }
  const file = scaffoldFragment(opts);
  process.stdout.write(`${path.relative(process.cwd(), file)}\n`);
}

if (require.main === module) main();

module.exports = { generateFragmentName, scaffoldFragment, parseArgs, ALLOWED_TYPES };
