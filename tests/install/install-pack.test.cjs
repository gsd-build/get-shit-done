const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { installPack, MANAGED_PATHS } = require('../../bin/lib/gsd-ic/install-pack.cjs');

function tmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-pack-${label}-`));
}

function makeFakePackSource() {
  const src = tmp('src');
  fs.mkdirSync(path.join(src, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(src, 'agents', 'gsd-x.md'), '---\nic_pack: true\nclassification: UNCLASSIFIED\n---\n## X COMPLETE\n');
  fs.writeFileSync(path.join(src, 'agents', 'gsd-stock-keeper.md'), 'stock content (should NOT be copied; lacks ic_pack)');
  fs.mkdirSync(path.join(src, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(src, 'hooks', 'gsd-x.js'), '// IC hook');
  fs.mkdirSync(path.join(src, 'intel-refs'), { recursive: true });
  fs.writeFileSync(path.join(src, 'intel-refs', 'MANIFEST.json'), '{"version":"2026.05","topics":{}}');
  fs.mkdirSync(path.join(src, 'config-overlays', 'nga'), { recursive: true });
  fs.writeFileSync(path.join(src, 'config-overlays', 'nga', 'overlay.json'), '{"customer":"nga","agent_skills":{}}');
  fs.mkdirSync(path.join(src, 'skills', 'intel-coding-conventions'), { recursive: true });
  fs.writeFileSync(path.join(src, 'skills', 'intel-coding-conventions', 'SKILL.md'), '---\nic_pack: true\nclassification: UNCLASSIFIED\n---');
  fs.mkdirSync(path.join(src, 'references'), { recursive: true });
  fs.writeFileSync(path.join(src, 'references', 'agent-contracts.ic-pack.md'), '# IC Pack Agent Contracts');
  return src;
}

describe('installPack', () => {
  it('copies IC pack agents (those with ic_pack frontmatter) into target/.claude/agents/', () => {
    const src = makeFakePackSource();
    const target = tmp('tgt');
    installPack({ packSource: src, target, customer: 'nga' });
    assert.equal(fs.existsSync(path.join(target, '.claude/agents/gsd-x.md')), true);
    assert.equal(fs.existsSync(path.join(target, '.claude/agents/gsd-stock-keeper.md')), false);
  });

  it('copies hooks, intel-refs, the selected overlay, and skills', () => {
    const src = makeFakePackSource();
    const target = tmp('tgt');
    installPack({ packSource: src, target, customer: 'nga' });
    assert.equal(fs.existsSync(path.join(target, '.claude/hooks/gsd-x.js')), true);
    assert.equal(fs.existsSync(path.join(target, '.claude/intel-refs/MANIFEST.json')), true);
    assert.equal(fs.existsSync(path.join(target, '.claude/config-overlays/nga/overlay.json')), true);
    assert.equal(fs.existsSync(path.join(target, '.claude/skills/intel-coding-conventions/SKILL.md')), true);
  });

  it('does NOT copy other customer overlays', () => {
    const src = makeFakePackSource();
    fs.mkdirSync(path.join(src, 'config-overlays', 'nsa'), { recursive: true });
    fs.writeFileSync(path.join(src, 'config-overlays', 'nsa', 'overlay.json'), '{}');
    const target = tmp('tgt');
    installPack({ packSource: src, target, customer: 'nga' });
    assert.equal(fs.existsSync(path.join(target, '.claude/config-overlays/nsa')), false);
  });

  it('does not touch program-owned files in .planning/', () => {
    const src = makeFakePackSource();
    const target = tmp('tgt');
    fs.mkdirSync(path.join(target, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(target, '.planning/intel-context.md'), 'program-specific content');
    installPack({ packSource: src, target, customer: 'nga' });
    assert.equal(fs.readFileSync(path.join(target, '.planning/intel-context.md'), 'utf8'),
      'program-specific content');
  });

  it('exports MANAGED_PATHS for documentation', () => {
    assert.equal(Array.isArray(MANAGED_PATHS), true);
    assert.ok(MANAGED_PATHS.includes('.claude/agents'));
  });
});
