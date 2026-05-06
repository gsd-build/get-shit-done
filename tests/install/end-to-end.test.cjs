const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function tmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-e2e-${label}-`));
}

const PACK_ROOT = path.resolve(__dirname, '..', '..');

function setupFakeGsdInstall(target) {
  fs.mkdirSync(path.join(target, '.claude/skills/gsd-help'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude/skills/gsd-help/SKILL.md'), 'stock');
}

function runInstall(args, opts = {}) {
  return execFileSync('node', [path.join(PACK_ROOT, 'bin/gsd-ic-install.js'), ...args], {
    encoding: 'utf8',
    cwd: opts.cwd || process.cwd(),
    env: { ...process.env, ...(opts.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('end-to-end install', () => {
  it('--help prints usage and exits 0', () => {
    const out = runInstall(['--help']);
    assert.match(out, /npx @adelphi\/gsd-ic install/);
  });

  it('errors clearly when GSD is not installed in target', () => {
    const target = tmp('no-gsd');
    assert.throws(() => runInstall(['install', '--customer=nga', `--target=${target}`]), /GSD not detected/);
  });

  it('happy path: install --customer=nga produces the expected file tree', () => {
    const target = tmp('happy');
    setupFakeGsdInstall(target);
    const out = runInstall(['install', '--customer=nga', `--target=${target}`]);
    assert.match(out, /install complete/i);
    // managed paths exist (manifest copied)
    assert.equal(fs.existsSync(path.join(target, '.claude/intel-refs/MANIFEST.json')), true);
    // config.json was created/wired
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.equal(cfg.__gsd_ic.customer, 'nga');
  });

  it('errors on customer switch without --confirm-customer-switch', () => {
    const target = tmp('switch');
    setupFakeGsdInstall(target);
    runInstall(['install', '--customer=nga', `--target=${target}`]);
    assert.throws(() => runInstall(['install', '--customer=nsa', `--target=${target}`]), /customer switch/i);
  });
});
