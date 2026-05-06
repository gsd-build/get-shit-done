#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const { parseArgs, USAGE } = require(path.join(__dirname, 'lib', 'gsd-ic', 'parse-args.cjs'));
const { verifyGsd } = require(path.join(__dirname, 'lib', 'gsd-ic', 'verify-gsd.cjs'));
const { installPack } = require(path.join(__dirname, 'lib', 'gsd-ic', 'install-pack.cjs'));
const { wireOverlay } = require(path.join(__dirname, 'lib', 'gsd-ic', 'wire-overlay.cjs'));

function readGsdPinned() {
  const p = path.join(__dirname, '..', 'VERSION');
  if (!fs.existsSync(p)) return null;
  const m = fs.readFileSync(p, 'utf8').match(/^gsd_pinned:\s*(\S+)/m);
  return m ? m[1] : null;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }

  if (opts.subcommand === 'help') {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const packSource = path.join(__dirname, '..');
  const gsdPinned = readGsdPinned();

  // 1. Verify GSD installed in target.
  const v = verifyGsd({ target: opts.target, gsdPinned });
  if (!v.ok) {
    process.stderr.write(`error: ${v.reason}\n`);
    process.exit(3);
  }
  process.stderr.write(`[gsd-ic] GSD detected (${v.detected}); pack pinned to GSD ${gsdPinned || '<unknown>'}\n`);

  // 2. Copy pack content.
  installPack({ packSource, target: opts.target, customer: opts.customer });
  process.stderr.write(`[gsd-ic] pack content installed under ${opts.target}/.claude/\n`);

  // 3. Wire customer overlay into agent_skills.
  const confirmSwitch = process.argv.includes('--confirm-customer-switch');
  try {
    wireOverlay({
      packSource,
      target: opts.target,
      customer: opts.customer,
      confirmCustomerSwitch: confirmSwitch,
    });
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(4);
  }
  process.stderr.write(`[gsd-ic] customer overlay wired (${opts.customer})\n`);

  process.stdout.write(`install complete: @adelphi/gsd-ic for customer=${opts.customer} in ${opts.target}\n`);
}

main();
