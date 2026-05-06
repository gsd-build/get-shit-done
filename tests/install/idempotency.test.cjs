const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { installPack } = require('../../bin/lib/gsd-ic/install-pack.cjs');
const { wireOverlay } = require('../../bin/lib/gsd-ic/wire-overlay.cjs');

function tmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-idem-${label}-`));
}

function makePackSource() {
  const src = tmp('src');
  fs.writeFileSync(path.join(src, 'VERSION'), 'pack: 0.1.0\ngsd_pinned: 1.39.0\n');
  fs.mkdirSync(path.join(src, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(src, 'agents', 'gsd-x.md'),
    '---\nic_pack: true\nclassification: UNCLASSIFIED\n---\n## X COMPLETE\n');
  fs.mkdirSync(path.join(src, 'intel-refs'), { recursive: true });
  fs.writeFileSync(path.join(src, 'intel-refs', 'MANIFEST.json'), '{"version":"2026.05","topics":{}}');
  fs.mkdirSync(path.join(src, 'config-overlays/nga'), { recursive: true });
  fs.writeFileSync(path.join(src, 'config-overlays/nga/overlay.json'),
    JSON.stringify({ customer: 'nga', agent_skills: { 'gsd-x': ['.claude/skills/y'] } }));
  return src;
}

function listAllRel(root) {
  const out = [];
  function walk(d, prefix) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      const rel = path.join(prefix, e.name);
      if (e.isDirectory()) walk(full, rel);
      else out.push({ rel, size: fs.statSync(full).size });
    }
  }
  walk(root, '');
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

describe('install idempotency', () => {
  it('produces identical file set + content after re-running install', () => {
    const packSource = makePackSource();
    const target = tmp('tgt');
    fs.mkdirSync(path.join(target, '.claude/skills/gsd-help'), { recursive: true });
    fs.writeFileSync(path.join(target, '.claude/skills/gsd-help/SKILL.md'), 'stock');

    installPack({ packSource, target, customer: 'nga' });
    wireOverlay({ packSource, target, customer: 'nga' });
    const after1 = listAllRel(target);

    installPack({ packSource, target, customer: 'nga' });
    wireOverlay({ packSource, target, customer: 'nga' });
    const after2 = listAllRel(target);

    // Strip __gsd_ic.installed_at timestamps before comparing config.json sizes.
    const cfg1 = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    const cfg2 = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    cfg1.__gsd_ic.installed_at = '<TS>';
    cfg2.__gsd_ic.installed_at = '<TS>';
    assert.deepEqual(cfg1, cfg2);

    // File set should be identical between runs.
    assert.deepEqual(after1.map((f) => f.rel), after2.map((f) => f.rel));
  });

  it('preserves program-owned files across re-install', () => {
    const packSource = makePackSource();
    const target = tmp('preserve');
    fs.mkdirSync(path.join(target, '.planning/decisions'), { recursive: true });
    fs.writeFileSync(path.join(target, '.planning/intel-context.md'), 'PROGRAM CONTEXT');
    fs.writeFileSync(path.join(target, '.planning/audit.md'), 'AUDIT LOG');
    fs.writeFileSync(path.join(target, '.planning/decisions/2026-05-06-x.md'), 'DECISION');

    installPack({ packSource, target, customer: 'nga' });
    wireOverlay({ packSource, target, customer: 'nga' });

    assert.equal(fs.readFileSync(path.join(target, '.planning/intel-context.md'), 'utf8'), 'PROGRAM CONTEXT');
    assert.equal(fs.readFileSync(path.join(target, '.planning/audit.md'), 'utf8'), 'AUDIT LOG');
    assert.equal(fs.readFileSync(path.join(target, '.planning/decisions/2026-05-06-x.md'), 'utf8'), 'DECISION');

    installPack({ packSource, target, customer: 'nga' });
    wireOverlay({ packSource, target, customer: 'nga' });

    assert.equal(fs.readFileSync(path.join(target, '.planning/intel-context.md'), 'utf8'), 'PROGRAM CONTEXT');
    assert.equal(fs.readFileSync(path.join(target, '.planning/audit.md'), 'utf8'), 'AUDIT LOG');
    assert.equal(fs.readFileSync(path.join(target, '.planning/decisions/2026-05-06-x.md'), 'utf8'), 'DECISION');
  });
});
