const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { wireOverlay } = require('../../bin/lib/gsd-ic/wire-overlay.cjs');

function tmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-overlay-${label}-`));
}

function writeOverlay(packSource, customer, agentSkills) {
  const dir = path.join(packSource, 'config-overlays', customer);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'overlay.json'), JSON.stringify({ customer, agent_skills: agentSkills }, null, 2));
}

describe('wireOverlay', () => {
  it('creates .planning/config.json if missing', () => {
    const target = tmp('new');
    const packSource = tmp('src');
    writeOverlay(packSource, 'nga', {
      'gsd-geoint-researcher': ['.claude/skills/intel-coding-conventions'],
    });
    wireOverlay({ packSource, target, customer: 'nga' });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.deepEqual(cfg.agent_skills['gsd-geoint-researcher'], ['.claude/skills/intel-coding-conventions']);
    assert.notEqual(cfg.__gsd_ic, undefined);
    assert.equal(cfg.__gsd_ic.customer, 'nga');
  });

  it('merges into existing .planning/config.json without disturbing other keys', () => {
    const target = tmp('existing');
    const packSource = tmp('src');
    fs.mkdirSync(path.join(target, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(target, '.planning/config.json'), JSON.stringify({
      workflow: { auto_advance: true },
      agent_skills: { 'gsd-planner': ['.claude/skills/some-stock-skill'] },
    }));
    writeOverlay(packSource, 'nga', { 'gsd-geoint-researcher': ['.claude/skills/intel-coding-conventions'] });
    wireOverlay({ packSource, target, customer: 'nga' });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.equal(cfg.workflow.auto_advance, true);
    assert.deepEqual(cfg.agent_skills['gsd-planner'], ['.claude/skills/some-stock-skill']);
    assert.deepEqual(cfg.agent_skills['gsd-geoint-researcher'], ['.claude/skills/intel-coding-conventions']);
  });

  it('replaces previously-IC-managed entries on re-install (idempotent)', () => {
    const target = tmp('reinstall');
    const packSource = tmp('src');
    // First install with one mapping.
    writeOverlay(packSource, 'nga', { 'gsd-geoint-researcher': ['.claude/skills/intel-coding-conventions'] });
    wireOverlay({ packSource, target, customer: 'nga' });
    // Second install with a different mapping (same customer, but pack content drifted).
    writeOverlay(packSource, 'nga', { 'gsd-geoint-researcher': ['.claude/skills/new-skill'] });
    wireOverlay({ packSource, target, customer: 'nga' });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.deepEqual(cfg.agent_skills['gsd-geoint-researcher'], ['.claude/skills/new-skill']);
  });

  it('records the customer + pack version in __gsd_ic metadata', () => {
    const target = tmp('meta');
    const packSource = tmp('src');
    fs.writeFileSync(path.join(packSource, 'VERSION'), 'pack: 0.1.0\ngsd_pinned: 1.39.0\n');
    writeOverlay(packSource, 'cia', {});
    wireOverlay({ packSource, target, customer: 'cia' });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.equal(cfg.__gsd_ic.customer, 'cia');
    assert.equal(cfg.__gsd_ic.pack_version, '0.1.0');
    assert.equal(typeof cfg.__gsd_ic.installed_at, 'string');
  });

  it('warns and prompts on customer switch (different customer than last install)', () => {
    const target = tmp('switch');
    const packSource = tmp('src');
    writeOverlay(packSource, 'nga', { 'gsd-x': ['.claude/skills/y'] });
    wireOverlay({ packSource, target, customer: 'nga' });
    writeOverlay(packSource, 'nsa', { 'gsd-x': ['.claude/skills/z'] });
    assert.throws(() =>
      wireOverlay({ packSource, target, customer: 'nsa', confirmCustomerSwitch: false }),
      /customer switch/i);
    // With explicit confirmation, switch goes through.
    wireOverlay({ packSource, target, customer: 'nsa', confirmCustomerSwitch: true });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.equal(cfg.__gsd_ic.customer, 'nsa');
    assert.deepEqual(cfg.agent_skills['gsd-x'], ['.claude/skills/z']);
  });
});
