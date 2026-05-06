const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { verifyGsd } = require('../../bin/lib/gsd-ic/verify-gsd.cjs');

function tmp(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-verify-${label}-`));
  return dir;
}

describe('verifyGsd', () => {
  it('returns ok=true when target has .claude/skills/gsd-* skills (modern GSD)', () => {
    const target = tmp('modern');
    fs.mkdirSync(path.join(target, '.claude/skills/gsd-help'), { recursive: true });
    fs.writeFileSync(path.join(target, '.claude/skills/gsd-help/SKILL.md'), '');
    const r = verifyGsd({ target, gsdPinned: '1.39.0' });
    assert.equal(r.ok, true);
    assert.equal(r.detected, 'modern-skills');
  });

  it('returns ok=true when target has commands/gsd/ (legacy GSD)', () => {
    const target = tmp('legacy');
    fs.mkdirSync(path.join(target, 'commands/gsd'), { recursive: true });
    fs.writeFileSync(path.join(target, 'commands/gsd/help.md'), '');
    const r = verifyGsd({ target, gsdPinned: '1.39.0' });
    assert.equal(r.ok, true);
    assert.equal(r.detected, 'legacy-commands');
  });

  it('returns ok=false when no GSD signals found', () => {
    const target = tmp('empty');
    const r = verifyGsd({ target, gsdPinned: '1.39.0' });
    assert.equal(r.ok, false);
    assert.match(r.reason, /not detected/i);
  });

  it('returns ok=false when target dir does not exist', () => {
    const r = verifyGsd({ target: '/path/that/does/not/exist/anywhere', gsdPinned: '1.39.0' });
    assert.equal(r.ok, false);
  });
});
