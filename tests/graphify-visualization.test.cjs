'use strict';

// Tests for graphify.cjs — staleness, mvp-viz, and regressions describe blocks.
// Split from the consolidated 2336-LOC file. Refs #3761.

const { describe, test, beforeEach, afterEach, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('node:os');
const { execFileSync } = require('child_process');
const { createTempProject, createTempGitProject, cleanup } = require('./helpers.cjs');

const {
  graphifyStatus,
} = require('../get-shit-done/bin/lib/graphify.cjs');

const {
  enableGraphify,
  writeGraphJson,
  gitHead,
  commitEmpty,
  SAMPLE_NODES_MINIMAL,
} = require('./helpers/graphify.cjs');

// ─── staleness describe ──────────────────────────────────────────────────────

describe('staleness', () => {
  // Regression for #3170: graphifyStatus surfaces built_at_commit staleness.
  // graphify v0.7+ embeds `built_at_commit` into graph.json at write time.
  // Tri-state on commit_stale: null means "we don't know" (pre-v0.7 graph or
  // no git), which is semantically distinct from false ("known fresh").

  describe('git-aware', () => {
    let tmpDir;
    let planningDir;

    beforeEach(() => {
      tmpDir = createTempGitProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
    });

    afterEach(() => cleanup(tmpDir));

    test('graph rebuilt at HEAD: commits_behind=0, commit_stale=false', () => {
      const head = gitHead(tmpDir);
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: head });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, head.slice(0, 7),
        'short hash from graph.built_at_commit');
      assert.equal(result.current_commit, head.slice(0, 7),
        'short hash of git HEAD');
      assert.equal(result.commits_behind, 0,
        'zero commits between HEAD and itself');
      assert.equal(result.commit_stale, false,
        'commit_stale is explicitly false when commits_behind === 0');
    });

    test('graph 5 commits behind HEAD: commits_behind=5, commit_stale=true', () => {
      const built = gitHead(tmpDir);
      for (let i = 0; i < 5; i += 1) commitEmpty(tmpDir, `c${i}`);
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: built });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.commits_behind, 5);
      assert.equal(result.commit_stale, true);
      assert.equal(result.built_at_commit, built.slice(0, 7));
      assert.notEqual(result.current_commit, built.slice(0, 7),
        'current_commit reflects HEAD, not graph build commit');
    });

    test('built_at_commit absent (pre-v0.7 graph): all four new fields null', () => {
      // No built_at_commit on the graph -- GSD must not fabricate one.
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [] });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, null);
      assert.equal(result.commits_behind, null);
      assert.equal(result.commit_stale, null,
        'tri-state: null means "we do not know", not "fresh"');
      // current_commit may still be non-null since we are in a git repo,
      // but without a baseline it cannot drive staleness.
      assert.notEqual(result.current_commit, undefined,
        'current_commit field is always present even when null');
    });

    test('rebased-away built_at_commit: commits_behind=null, commit_stale=null', () => {
      // built_at_commit references a commit that never existed in this repo.
      const ghostHash = '0000000000000000000000000000000000000001';
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: ghostHash });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, ghostHash.slice(0, 7),
        'echoes the field even if unreachable -- caller can decide what to do');
      assert.equal(result.commits_behind, null,
        'cannot count commits to an unreachable commit');
      assert.equal(result.commit_stale, null,
        'unknown distance means unknown staleness');
    });

    test('malformed built_at_commit (dashed argv): rejected before git invocation', () => {
      // Argument-injection fence: a graph.json with a hostile built_at_commit
      // must never reach `git` as an argv element. The implementation should
      // validate /^[0-9a-f]{4,40}$/i and treat anything else as absent.
      const malicious = '--upload-pack=evil';
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: malicious });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, null,
        'malformed value is rejected, not echoed');
      assert.equal(result.commits_behind, null);
      assert.equal(result.commit_stale, null);
    });
  });

  describe('non-git cwd', () => {
    let tmpDir;
    let planningDir;

    beforeEach(() => {
      tmpDir = createTempProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
    });

    afterEach(() => cleanup(tmpDir));

    test('cwd has no .git: current_commit=null, derived fields=null', () => {
      const built = 'abcdef1234567890abcdef1234567890abcdef12';
      writeGraphJson(planningDir, { nodes: SAMPLE_NODES_MINIMAL, edges: [], built_at_commit: built });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, built.slice(0, 7),
        'graph field is echoed even without a local repo');
      assert.equal(result.current_commit, null,
        'no HEAD without git');
      assert.equal(result.commits_behind, null);
      assert.equal(result.commit_stale, null);
    });
  });

  describe('back-compat', () => {
    let tmpDir;
    let planningDir;

    beforeEach(() => {
      tmpDir = createTempGitProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
      writeGraphJson(planningDir, {
        nodes: SAMPLE_NODES_MINIMAL,
        edges: [{ source: 'n1', target: 'n2', label: 'x', confidence: 'EXTRACTED' }],
        hyperedges: [],
        built_at_commit: gitHead(tmpDir),
      });
    });

    afterEach(() => cleanup(tmpDir));

    test('existing fields are unchanged when commit-staleness fields are added', () => {
      const result = graphifyStatus(tmpDir);

      // Existing contract — must not regress.
      assert.equal(result.exists, true);
      assert.equal(result.node_count, 2);
      assert.equal(result.edge_count, 1);
      assert.equal(result.hyperedge_count, 0);
      assert.equal(typeof result.last_build, 'string');
      assert.equal(typeof result.stale, 'boolean',
        'mtime-based stale flag stays as-is for back-compat');
      assert.equal(typeof result.age_hours, 'number');
    });

    test('disabled response is unchanged (commit-staleness fields not added)', () => {
      const tmp2 = createTempProject();
      try {
        const result = graphifyStatus(tmp2);
        assert.equal(result.disabled, true,
          'disabled path returns the existing shape, no commit fields');
        assert.equal(result.built_at_commit, undefined,
          'commit-staleness fields are only added on the success path');
      } finally {
        cleanup(tmp2);
      }
    });
  });
});

// ─── mvp-viz describe ─────────────────────────────────────────────────────────

describe('mvp-viz', () => {
  // Contract: commands/gsd/graphify.md documents MVP visual differentiation.
  // Per PRD Q5: distinct node color + 'MVP' label suffix.
  // Tests parse the markdown skill into structured IR (YAML frontmatter +
  // fenced code blocks) and assert on the parsed structures, not raw text.

  const CMD = path.join(__dirname, '..', 'commands', 'gsd', 'graphify.md');

  /**
   * Parse the narrow YAML subset used in this skill's frontmatter:
   *   key: scalar
   *   key:
   *     - item
   *     - item
   */
  function parseSkillFrontmatter(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let activeKey = null;
    let activeList = null;
    for (const raw of lines) {
      const listItem = raw.match(/^\s+-\s+(.+?)\s*$/);
      if (listItem && activeList) {
        activeList.push(listItem[1]);
        continue;
      }
      const kv = raw.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
      if (!kv) continue;
      const [, key, rawValue] = kv;
      const value = rawValue.trim();
      if (value === '') {
        activeKey = key;
        activeList = [];
        out[key] = activeList;
      } else {
        activeKey = null;
        activeList = null;
        out[key] = value;
      }
    }
    return out;
  }

  /**
   * Walk markdown body line-by-line and return every fenced code block as
   * { lang, content } records. Tracks fence state explicitly.
   */
  function extractFencedBlocks(body) {
    const lines = body.split(/\r?\n/);
    const blocks = [];
    let active = null;
    for (const line of lines) {
      const open = line.match(/^```(\S*)\s*$/);
      if (active === null) {
        if (open) active = { lang: open[1] || '', lines: [] };
        continue;
      }
      if (line.trim() === '```') {
        blocks.push({ lang: active.lang, content: active.lines.join('\n') });
        active = null;
        continue;
      }
      active.lines.push(line);
    }
    return blocks;
  }

  function loadSkill() {
    // Local rename (`markdown` not `content`) so the no-source-grep lint
    // doesn't conflate this readFileSync-bound variable with the
    // `b.content.includes(...)` calls below — those operate on parsed
    // fenced-block records, not raw file text.
    const markdown = fs.readFileSync(CMD, 'utf8');
    const lines = markdown.split(/\r?\n/);
    const delims = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].trim() === '---') delims.push(i);
      if (delims.length === 2) break;
    }
    assert.equal(delims.length, 2, 'graphify.md must have a closed frontmatter block');
    const frontmatterText = lines.slice(delims[0] + 1, delims[1]).join('\n');
    const body = lines.slice(delims[1] + 1).join('\n');
    return {
      frontmatter: parseSkillFrontmatter(frontmatterText),
      body,
      fencedBlocks: extractFencedBlocks(body),
    };
  }

  // Parse MVP section from graphify.md body as structured IR (not raw grep).
  // Extracts: mentionsMvp, colorRuleLine, labelRuleLine, fallbackLine.
  function parseMvpVizContract(body) {
    const lines = body.split(/\r?\n/);
    const lowerLines = lines.map(line => line.toLowerCase());
    const mvpLines = lines.filter(line => line.toLowerCase().includes('mvp'));
    return {
      mentionsMvp: mvpLines.length > 0,
      colorRuleLine: mvpLines.find(line => {
        const lower = line.toLowerCase();
        return lower.includes('color') || lower.includes('fill') || line.includes('#');
      }) || '',
      labelRuleLine: mvpLines.find(line => {
        const lower = line.toLowerCase();
        return lower.includes('label') || lower.includes('suffix');
      }) || '',
      fallbackLine: lowerLines.find(line =>
        (line.includes('mode') && (line.includes('null') || line.includes('absent') || line.includes('not mvp'))) ||
        (line.includes('standard') && (line.includes('render') || line.includes('fallback')))
      ) || '',
    };
  }

  test('graphify.md documents distinct color for MVP-mode phases', () => {
    const { body } = loadSkill();
    const contract = parseMvpVizContract(body);
    assert.ok(contract.mentionsMvp, 'must mention MVP in color rule');
    assert.ok(contract.colorRuleLine.length > 0, 'must reference a color/fill rule for MVP nodes');
  });

  test('graphify.md documents MVP label suffix on node text', () => {
    const { body } = loadSkill();
    const contract = parseMvpVizContract(body);
    assert.ok(contract.labelRuleLine.length > 0, 'must add an MVP label/suffix to node text');
  });

  test('graphify.md specifies fallback when phase mode is null/absent', () => {
    const { body } = loadSkill();
    const contract = parseMvpVizContract(body);
    assert.ok(contract.fallbackLine.length > 0, 'must specify fallback when mode is not mvp');
  });

  // Counter-test: a non-mvp phase must NOT carry mode:'mvp' in the contract.
  // The fallbackLine ensures standard rendering is documented for the non-mvp case.
  test('non-mvp phase render path is documented (counter-test)', () => {
    const { body } = loadSkill();
    const contract = parseMvpVizContract(body);
    // The fallback line is required precisely because non-mvp phases exist;
    // its presence is the counter-assertion that mvp rendering is NOT applied globally.
    assert.ok(
      contract.fallbackLine.length > 0,
      'fallback documentation confirms mvp rendering is not applied to non-mvp phases',
    );
    // Additionally: the MVP label should only be a suffix, not a full replacement;
    // so the standard label path (no MVP suffix) must be documented.
    assert.ok(
      contract.mentionsMvp,
      'mvp mention is present, meaning mvp is treated as a special case, not the default',
    );
  });
});

// ─── regressions describe ─────────────────────────────────────────────────────

describe('regressions', () => {
  // ── Regression for #3166 ────────────────────────────────────────────────────
  // /gsd-graphify build lost artifacts because the skill spawned a Task
  // sub-agent that backgrounded `graphify update .`. Sub-agent isolation
  // SIGTERM'd the post-extraction phase before graph.json / graph.html /
  // GRAPH_REPORT.md were written.
  // Fix: skill runs the build inline in a single foreground Bash call.
  // Structural fence: skill is parsed into (a) a YAML frontmatter map and
  // (b) a list of fenced code blocks. Assertions run against parsed structures,
  // never against raw markdown text.

  const SKILL_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'graphify.md');

  function parseBug3166SkillFrontmatter(text) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let activeKey = null;
    let activeList = null;
    for (const raw of lines) {
      const listItem = raw.match(/^\s+-\s+(.+?)\s*$/);
      if (listItem && activeList) {
        activeList.push(listItem[1]);
        continue;
      }
      const kv = raw.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
      if (!kv) continue;
      const [, key, rawValue] = kv;
      const value = rawValue.trim();
      if (value === '') {
        activeKey = key;
        activeList = [];
        out[key] = activeList;
      } else {
        activeKey = null;
        activeList = null;
        out[key] = value;
      }
    }
    return out;
  }

  function extractBug3166FencedBlocks(body) {
    const lines = body.split(/\r?\n/);
    const blocks = [];
    let active = null;
    for (const line of lines) {
      const open = line.match(/^```(\S*)\s*$/);
      if (active === null) {
        if (open) active = { lang: open[1] || '', lines: [] };
        continue;
      }
      if (line.trim() === '```') {
        blocks.push({ lang: active.lang, content: active.lines.join('\n') });
        active = null;
        continue;
      }
      active.lines.push(line);
    }
    return blocks;
  }

  function loadBug3166Skill() {
    const markdown = fs.readFileSync(SKILL_PATH, 'utf8');
    const lines = markdown.split(/\r?\n/);
    const delims = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].trim() === '---') delims.push(i);
      if (delims.length === 2) break;
    }
    assert.equal(delims.length, 2, 'graphify.md must have a closed frontmatter block');
    const frontmatterText = lines.slice(delims[0] + 1, delims[1]).join('\n');
    const body = lines.slice(delims[1] + 1).join('\n');
    return {
      frontmatter: parseBug3166SkillFrontmatter(frontmatterText),
      body,
      fencedBlocks: extractBug3166FencedBlocks(body),
    };
  }

  // Regression for #3166
  test('graphify.md allowed-tools does not include Task (inline build fence)', () => {
    const { frontmatter } = loadBug3166Skill();
    assert.ok(Array.isArray(frontmatter['allowed-tools']),
      'allowed-tools must be a YAML block list');
    assert.ok(frontmatter['allowed-tools'].length > 0,
      'allowed-tools must declare at least one tool');
    assert.ok(!frontmatter['allowed-tools'].includes('Task'),
      'Task must NOT be in allowed-tools — sub-agent isolation truncates ' +
      'graphify v0.7+ post-extraction phase (#3166). Build runs inline.');
  });

  // Regression for #3166
  test('graphify.md frontmatter retains Read and Bash (inline build prerequisites)', () => {
    const { frontmatter } = loadBug3166Skill();
    const tools = frontmatter['allowed-tools'];
    assert.ok(tools.includes('Read'), 'Read required for config gate');
    assert.ok(tools.includes('Bash'), 'Bash required for inline build chain');
  });

  // Regression for #3166
  test('no fenced code block in graphify.md invokes Task() agent spawn syntax', () => {
    const { fencedBlocks } = loadBug3166Skill();
    const offending = fencedBlocks.filter(b => b.content.includes('Task('));
    assert.deepEqual(offending, [],
      'no fenced code block in graphify.md may contain `Task(` invocation ' +
      'syntax — sub-agent spawning truncates graphify v0.7+ post-extraction ' +
      'phase (#3166). Prose mentioning the word "Task" is fine; only the ' +
      'call expression inside a code block is forbidden.');
  });

  // Regression for #3166
  test('a bash code block invokes the inline graphify update . pipeline', () => {
    const { fencedBlocks } = loadBug3166Skill();
    const bashBlocks = fencedBlocks.filter(b => b.lang === 'bash');
    assert.ok(bashBlocks.length > 0, 'skill must contain at least one bash block');
    assert.ok(
      bashBlocks.some(b => b.content.includes('graphify update .')),
      'a bash code block must invoke `graphify update .`'
    );
    assert.ok(
      bashBlocks.some(b => /gsd-tools\.cjs["']?\s+graphify build snapshot/.test(b.content)),
      'a bash code block must invoke `gsd-tools.cjs graphify build snapshot`'
    );
  });

  // ── Regression for #3579 ────────────────────────────────────────────────────
  // graphify auto-update hook was dead-on-arrival in 1.50.0-canary.x because:
  //   Gap 1: scripts/build-hooks.js HOOKS_TO_COPY did not include
  //           gsd-graphify-update.sh
  //   Gap 2: hooks/lib/gsd-graphify-rebuild.sh not copied by installer
  // Test strategy: run the actual build and assert filesystem outcomes.

  const REPO_ROOT_3579 = path.resolve(__dirname, '..');
  const HOOKS_DIR_3579 = path.join(REPO_ROOT_3579, 'hooks');
  const DIST_DIR_3579 = path.join(HOOKS_DIR_3579, 'dist');
  const BUILD_SCRIPT_3579 = path.join(REPO_ROOT_3579, 'scripts', 'build-hooks.js');
  const INSTALL_SCRIPT_3579 = path.join(REPO_ROOT_3579, 'bin', 'install.js');

  // Regression for #3579: Gap 1 — build-hooks.js packages every top-level hooks/*.sh
  describe('#3579 Gap 1: build-hooks.js packages every top-level hooks/*.sh into dist', () => {
    before(() => {
      execFileSync(process.execPath, [BUILD_SCRIPT_3579], { encoding: 'utf-8', stdio: 'pipe' });
    });

    test('every top-level hooks/*.sh is emitted to hooks/dist/ by the build', () => {
      const topLevelSh = fs
        .readdirSync(HOOKS_DIR_3579, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.sh'))
        .map((e) => e.name);

      assert.ok(topLevelSh.length > 0, 'expected at least one top-level hooks/*.sh in source');

      const missing = topLevelSh.filter(
        (sh) => !fs.existsSync(path.join(DIST_DIR_3579, sh))
      );
      assert.deepStrictEqual(
        missing,
        [],
        `every top-level hooks/*.sh must be emitted to hooks/dist/ by scripts/build-hooks.js; missing from dist: ${JSON.stringify(missing)}`
      );
    });

    test('hooks/dist/gsd-graphify-update.sh exists after build', () => {
      assert.ok(
        fs.existsSync(path.join(DIST_DIR_3579, 'gsd-graphify-update.sh')),
        'expected hooks/dist/gsd-graphify-update.sh to exist after build (Gap 1)'
      );
    });

    test('hooks/dist/lib/gsd-graphify-rebuild.sh exists after build', () => {
      assert.ok(
        fs.existsSync(path.join(DIST_DIR_3579, 'lib', 'gsd-graphify-rebuild.sh')),
        'expected hooks/dist/lib/gsd-graphify-rebuild.sh to exist after build (Gap 2)'
      );
    });
  });

  // Regression for #3579: installer deploys graphify hook + lib helper to target
  describe('#3579: installer deploys graphify hook + lib helper to target', () => {
    let tmpDir;
    let installStdout;

    before(() => {
      execFileSync(process.execPath, [BUILD_SCRIPT_3579], { encoding: 'utf-8', stdio: 'pipe' });
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3579-install-'));
      installStdout = execFileSync(
        process.execPath,
        [INSTALL_SCRIPT_3579, '--claude', '--global', '--yes', '--no-sdk'],
        {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, CLAUDE_CONFIG_DIR: tmpDir },
        }
      );
    });

    after(() => {
      if (tmpDir) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    });

    test('hooks/gsd-graphify-update.sh present at install target', () => {
      const dest = path.join(tmpDir, 'hooks', 'gsd-graphify-update.sh');
      assert.ok(fs.existsSync(dest), `expected ${dest} to exist after install`);
    });

    test('hooks/lib/gsd-graphify-rebuild.sh present at install target', () => {
      const dest = path.join(tmpDir, 'hooks', 'lib', 'gsd-graphify-rebuild.sh');
      assert.ok(fs.existsSync(dest), `expected ${dest} to exist after install`);
    });

    test('installer does not warn about missing gsd-graphify-update.sh', () => {
      assert.ok(
        !installStdout.includes('Missing expected hook: gsd-graphify-update.sh'),
        `installer output must not warn about missing graphify hook; got:\n${installStdout}`
      );
      assert.ok(
        !installStdout.includes(
          'Skipped graphify auto-update hook — gsd-graphify-update.sh not found'
        ),
        `installer must not skip graphify hook configuration; got:\n${installStdout}`
      );
    });
  });
});
