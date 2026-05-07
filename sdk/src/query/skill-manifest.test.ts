import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

import { buildSkillManifest } from './skill-manifest.js';
import { resolveGlobalSkillsBase, renderGlobalSkillsBaseDisplayPath } from './helpers.js';
import { resolveLegacySkillsDir } from '../sdk-package-compatibility.js';

describe('skill-manifest', () => {
  it('resolves runtime-global skills roots through shared runtime policy', () => {
    const manifest = buildSkillManifest('/tmp/project-that-does-not-exist');
    const claudeRoot = manifest.roots.find(root => root.root === renderGlobalSkillsBaseDisplayPath('claude'));
    const codexRoot = manifest.roots.find(root => root.root === renderGlobalSkillsBaseDisplayPath('codex'));

    expect(claudeRoot?.path).toBe(resolveGlobalSkillsBase('claude'));
    expect(claudeRoot?.scope).toBe('global');
    expect(codexRoot?.path).toBe(resolveGlobalSkillsBase('codex'));
    expect(codexRoot?.scope).toBe('global');
  });

  it('resolves legacy import-only skills root through SDK Package Seam Module', () => {
    const manifest = buildSkillManifest('/tmp/project-that-does-not-exist');
    const legacyRoot = manifest.roots.find(root => root.root === '.claude/get-shit-done/skills');

    expect(legacyRoot).toBeDefined();
    expect(legacyRoot?.path).toBe(resolveLegacySkillsDir());
    expect(legacyRoot?.scope).toBe('import-only');
    expect(legacyRoot?.deprecated).toBe(true);
  });

  it('discovers skills from explicit --skills-dir without scanning global roots', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-skill-manifest-'));
    try {
      const skillsDir = join(tmpDir, 'custom-skills');
      const alphaDir = join(skillsDir, 'alpha-skill');
      await mkdir(alphaDir, { recursive: true });
      await writeFile(
        join(alphaDir, 'SKILL.md'),
        '---\nname: alpha-skill\ndescription: alpha desc\n---\n\nTRIGGER when: need alpha\n',
      );

      const manifest = buildSkillManifest(tmpDir, skillsDir);
      expect(manifest.counts.roots).toBe(1);
      expect(manifest.roots[0]?.path).toBe(skillsDir);
      expect(manifest.skills).toHaveLength(1);
      expect(manifest.skills[0]).toMatchObject({
        name: 'alpha-skill',
        description: 'alpha desc',
        triggers: ['need alpha'],
        root: skillsDir,
        scope: 'custom',
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('legacy skills dir helper points at ~/.claude/get-shit-done/skills', () => {
    expect(resolveLegacySkillsDir()).toBe(join(homedir(), '.claude', 'get-shit-done', 'skills'));
  });
});
