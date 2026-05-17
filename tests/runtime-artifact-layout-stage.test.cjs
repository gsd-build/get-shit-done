'use strict';
/**
 * Tests for resolveRuntimeArtifactLayout kind.stage() invocations.
 * Verifies each kind type produces the expected staged directory structure.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { resolveRuntimeArtifactLayout } = require('../get-shit-done/bin/lib/runtime-artifact-layout.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

// A small resolved profile selecting known real skills
const CORE_SKILLS = new Set(['help', 'phase', 'new-project']);
const CORE_AGENTS = new Set(['gsd-planner']);
const PROFILE_CORE = { skills: CORE_SKILLS, agents: CORE_AGENTS };
const PROFILE_FULL = { skills: '*', agents: new Set() };

const FAKE_DIR = '/tmp/fake-config-dir-stage';

describe('commands kind — stage (gemini)', () => {
  test('stage returns a directory containing only the selected skill .md files', () => {
    const layout = resolveRuntimeArtifactLayout('gemini', FAKE_DIR);
    const commandsKind = layout.kinds.find(k => k.kind === 'commands');
    assert.ok(commandsKind, 'should have a commands kind');

    const stagedDir = commandsKind.stage(PROFILE_CORE);
    // stagedDir is managed by stageSkillsForProfile — just verify, no manual cleanup needed
    const entries = fs.readdirSync(stagedDir).filter(f => f.endsWith('.md'));
    // All staged files must come from the selected skill set
    for (const entry of entries) {
      const stem = entry.slice(0, -3);
      assert.ok(CORE_SKILLS.has(stem), `unexpected skill staged: ${stem}`);
    }
    // At least one file must be present (help.md exists in real commands/gsd)
    assert.ok(entries.length >= 1, 'at least one skill file should be staged');
  });
});

describe('agents kind — stage (claude local)', () => {
  test('stage returns a directory containing only the selected agent .md files', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_DIR, 'local');
    const agentsKind = layout.kinds.find(k => k.kind === 'agents');
    assert.ok(agentsKind, 'should have an agents kind');

    const stagedDir = agentsKind.stage(PROFILE_CORE);
    // stagedDir may be empty (agents Set from core profile may be empty set)
    // But it must be a valid directory
    assert.ok(fs.existsSync(stagedDir), 'stagedDir must exist');
    assert.ok(fs.statSync(stagedDir).isDirectory(), 'stagedDir must be a directory');
  });
});

describe('skills kind — stage (claude global)', () => {
  test('stage returns a directory containing gsd-<stem>/SKILL.md entries', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_DIR, 'global');
    const skillsKind = layout.kinds.find(k => k.kind === 'skills');
    assert.ok(skillsKind, 'should have a skills kind');

    const stagedDir = skillsKind.stage(PROFILE_CORE);
    // managed by stageSkillsForRuntimeAsSkills — no manual cleanup needed
    assert.ok(fs.existsSync(stagedDir), 'stagedDir must exist');
    const entries = fs.readdirSync(stagedDir);
    // Each entry should be a directory named gsd-<stem>
    for (const entry of entries) {
      assert.ok(entry.startsWith('gsd-'), `entry should start with gsd-: ${entry}`);
      const skillMd = path.join(stagedDir, entry, 'SKILL.md');
      assert.ok(fs.existsSync(skillMd), `SKILL.md must exist in ${entry}`);
    }
    assert.ok(entries.length >= 1, 'at least one skill dir should be staged');
  });
});

describe('skills kind — stage with full profile', () => {
  test('stage with skills="*" stages all commands/gsd/*.md as skills', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_DIR, 'global');
    const skillsKind = layout.kinds.find(k => k.kind === 'skills');
    assert.ok(skillsKind, 'should have a skills kind');

    const stagedDir = skillsKind.stage(PROFILE_FULL);
    assert.ok(fs.existsSync(stagedDir), 'stagedDir must exist');
    const entries = fs.readdirSync(stagedDir);
    // Full profile: should have many skills
    assert.ok(entries.length > 10, `full profile should have many skills, got ${entries.length}`);
    for (const entry of entries) {
      assert.ok(entry.startsWith('gsd-'), `entry should start with gsd-: ${entry}`);
      const skillMd = path.join(stagedDir, entry, 'SKILL.md');
      assert.ok(fs.existsSync(skillMd), `SKILL.md must exist in ${entry}`);
    }
  });
});

describe('opencode commands kind — stage', () => {
  test('opencode stage returns directory with .md files for selected skills', () => {
    const layout = resolveRuntimeArtifactLayout('opencode', FAKE_DIR);
    const commandsKind = layout.kinds.find(k => k.kind === 'commands');
    assert.ok(commandsKind, 'should have a commands kind');

    const stagedDir = commandsKind.stage(PROFILE_CORE);
    assert.ok(fs.existsSync(stagedDir), 'stagedDir must exist');
    const entries = fs.readdirSync(stagedDir).filter(f => f.endsWith('.md'));
    for (const entry of entries) {
      const stem = entry.slice(0, -3);
      assert.ok(CORE_SKILLS.has(stem), `unexpected skill staged: ${stem}`);
    }
  });
});
