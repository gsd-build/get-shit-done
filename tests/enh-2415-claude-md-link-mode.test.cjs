'use strict';

/**
 * Tests for claude_md_assembly "link" mode (#2415).
 * Verifies that generate-claude-md writes @-references instead of inlined
 * content when claude_md_assembly.mode is "link".
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { cmdGenerateClaudeMd } = require('../get-shit-done/bin/lib/profile-output.cjs');

function makeTempProject(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2415-'));
  fs.mkdirSync(path.join(dir, '.planning', 'codebase'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

test('link mode writes @-reference for architecture section', () => {
  const dir = makeTempProject({
    '.planning/codebase/ARCHITECTURE.md': '# Architecture\n\n- layered\n',
    '.planning/config.json': JSON.stringify({ claude_md_assembly: { mode: 'link' } }),
  });

  cmdGenerateClaudeMd(dir, { output: path.join(dir, 'CLAUDE.md') }, false);

  const content = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8');
  assert.ok(content.includes('@.planning/codebase/ARCHITECTURE.md'), 'should contain @-reference');
  assert.ok(!content.includes('- layered'), 'should not inline architecture content');
});

test('link mode writes @-reference for project section', () => {
  const dir = makeTempProject({
    '.planning/PROJECT.md': '# My Project\n\n## What This Is\n\nA great app.\n',
    '.planning/config.json': JSON.stringify({ claude_md_assembly: { mode: 'link' } }),
  });

  cmdGenerateClaudeMd(dir, { output: path.join(dir, 'CLAUDE.md') }, false);

  const content = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8');
  assert.ok(content.includes('@.planning/PROJECT.md'), 'should contain @-reference for project');
  assert.ok(!content.includes('A great app.'), 'should not inline project content');
});

test('embed mode (default) inlines content as before', () => {
  const dir = makeTempProject({
    '.planning/codebase/ARCHITECTURE.md': '# Architecture\n\n- monolith\n',
  });

  cmdGenerateClaudeMd(dir, { output: path.join(dir, 'CLAUDE.md') }, false);

  const content = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8');
  assert.ok(content.includes('- monolith'), 'embed mode should inline content');
  assert.ok(!content.includes('@.planning/codebase/ARCHITECTURE.md'), 'embed mode should not write @-reference');
});

test('per-block override: link only architecture, embed others', () => {
  const dir = makeTempProject({
    '.planning/PROJECT.md': '# Proj\n\n## What This Is\n\nApp.\n',
    '.planning/codebase/ARCHITECTURE.md': '# Arch\n\n- layers\n',
    '.planning/config.json': JSON.stringify({ claude_md_assembly: { mode: 'embed', blocks: { architecture: 'link' } } }),
  });

  cmdGenerateClaudeMd(dir, { output: path.join(dir, 'CLAUDE.md') }, false);

  const content = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8');
  assert.ok(content.includes('@.planning/codebase/ARCHITECTURE.md'), 'architecture should use link');
  assert.ok(!content.includes('@.planning/PROJECT.md'), 'project should use embed');
  assert.ok(content.includes('App.'), 'project content should be inlined');
});

test('link mode falls back to embed for workflow section (no linkable source)', () => {
  const dir = makeTempProject({
    '.planning/config.json': JSON.stringify({ claude_md_assembly: { mode: 'link' } }),
  });

  cmdGenerateClaudeMd(dir, { output: path.join(dir, 'CLAUDE.md') }, false);

  const content = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8');
  // workflow section should still be inlined (it has no linkPath)
  assert.ok(!content.includes('@GSD defaults'), 'workflow should not write @GSD defaults');
  assert.ok(content.includes('GSD Workflow Enforcement'), 'workflow content should be embedded inline');
});

test('link mode falls back to embed when source file is missing (hasFallback)', () => {
  const dir = makeTempProject({
    '.planning/config.json': JSON.stringify({ claude_md_assembly: { mode: 'link' } }),
  });
  // No .planning/codebase/ARCHITECTURE.md — generator will use fallback

  cmdGenerateClaudeMd(dir, { output: path.join(dir, 'CLAUDE.md') }, false);

  const content = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8');
  assert.ok(!content.includes('@.planning/codebase/ARCHITECTURE.md'), 'fallback section should not write @-reference');
});
