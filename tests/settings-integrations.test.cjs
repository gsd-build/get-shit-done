'use strict';

// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * #2529 — /gsd-settings-integrations: configure third-party search and review integrations.
 *
 * Covers:
 *   - Artifacts exist (command, workflow, skill stub) with correct frontmatter
 *   - Workflow references the four search API key fields
 *   - Workflow exposes review.models.{claude,codex,gemini,opencode} routing
 *   - Workflow exposes agent_skills.<agent-type> injection input
 *   - Masking convention (****last4) is documented in the workflow and the displayed
 *     confirmation pattern does not echo plaintext
 *   - config-set round-trips all integration keys through VALID_CONFIG_KEYS + dynamic patterns
 *   - Config merge preserves unrelated keys
 *   - /gsd:settings confirmation output mentions /gsd:settings-integrations
 *   - Negative: invalid agent-type name (path traversal / special char) is rejected
 *   - Negative: malformed review.models key is rejected
 *   - Logging: plaintext API keys do not appear in any file written under .planning/
 *     by the config-set flow other than config.json itself
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');
const {
  VALID_CONFIG_KEYS,
  isValidConfigKey,
} = require('../get-shit-done/bin/lib/config-schema.cjs');

const REPO_ROOT = path.join(__dirname, '..');
// #2790: settings-integrations.md was consolidated into config.md as the --integrations flag.
const COMMAND_PATH = path.join(REPO_ROOT, 'commands', 'gsd', 'config.md');
const WORKFLOW_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'settings-integrations.md');
const SKILL_PATH = path.join(REPO_ROOT, '.claude', 'skills', 'gsd-settings-integrations.md');
const SETTINGS_WORKFLOW_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'settings.md');

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}

// ─── Artifacts ───────────────────────────────────────────────────────────────

describe('#2529 artifacts', () => {
  test('consolidated config.md command exists (#2790: settings-integrations absorbed)', () => {
    // #2790: settings-integrations.md was absorbed into config.md as the --integrations flag.
    assert.ok(fs.existsSync(COMMAND_PATH), `missing ${COMMAND_PATH}`);
  });

  test('config.md frontmatter declares name gsd:config and routes to --integrations', () => {
    const src = fs.readFileSync(COMMAND_PATH, 'utf-8');
    // #2790: consolidated command uses gsd:config name
    assert.match(src, /name:\s*gsd:config/);
    assert.match(src, /description:\s*.+/);
    assert.match(src, /allowed-tools:/);
    assert.match(src, /AskUserQuestion/);
  });

  test('workflow exists at get-shit-done/workflows/settings-integrations.md', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), `missing ${WORKFLOW_PATH}`);
  });

  test('skill stub or canonical command surface ships (#2790: via config.md --integrations)', () => {
    // #2790: The command surface is now config.md + settings-integrations.md workflow.
    const hasStub = fs.existsSync(SKILL_PATH);
    const hasCanonical =
      fs.existsSync(COMMAND_PATH) && fs.existsSync(WORKFLOW_PATH);
    assert.ok(
      hasStub || hasCanonical,
      `neither ${SKILL_PATH} nor the canonical command/workflow pair exists`
    );
  });

  test('config.md routes --integrations to the settings-integrations workflow', () => {
    const src = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(
      src.includes('workflows/settings-integrations.md') || src.includes('--integrations'),
      'config.md must reference settings-integrations workflow or --integrations flag'
    );
  });
});

// ─── Content: search API keys ────────────────────────────────────────────────

describe('#2529 workflow — search integrations', () => {
  test('workflow references all four search fields', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    for (const key of ['brave_search', 'firecrawl', 'exa_search', 'search_gitignored']) {
      assert.ok(src.includes(key), `workflow must reference ${key}`);
    }
  });
});

// ─── Content: review.models routing ──────────────────────────────────────────

describe('#2529 workflow — review.models routing', () => {
  test('workflow references all four reviewer CLIs', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    for (const cli of ['claude', 'codex', 'gemini', 'opencode']) {
      assert.ok(
        src.includes(`review.models.${cli}`),
        `workflow must reference review.models.${cli}`
      );
    }
  });

  test('review.models.<cli> matches the dynamic pattern validator', () => {
    for (const cli of ['claude', 'codex', 'gemini', 'opencode']) {
      assert.ok(
        isValidConfigKey(`review.models.${cli}`),
        `review.models.${cli} must pass isValidConfigKey`
      );
    }
  });
});

// ─── Content: agent_skills.<agent-type> injection ────────────────────────────

describe('#2529 workflow — agent_skills injection', () => {
  test('workflow references agent_skills.<agent-type> injection concept', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(src.includes('agent_skills'), 'workflow must reference agent_skills');
    assert.ok(
      /agent_skills\.<[^>]+>|agent_skills\.\w+/.test(src),
      'workflow must reference agent_skills.<agent-type> or concrete agent_skills.<slug>'
    );
  });

  test('agent_skills.<valid-slug> passes validator', () => {
    assert.ok(isValidConfigKey('agent_skills.gsd-executor'));
    assert.ok(isValidConfigKey('agent_skills.gsd-planner'));
    assert.ok(isValidConfigKey('agent_skills.my_custom_agent'));
  });
});

// ─── Content: masking ────────────────────────────────────────────────────────

describe('#2529 workflow — API key masking', () => {
  test('workflow documents the **** masking convention', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    // Must reference the **** mask pattern
    assert.ok(src.includes('****'), 'workflow must document the **** mask pattern');
    // Must explicitly state that plaintext is not displayed
    assert.ok(
      /never\s+(echo|display|log|show)[^.]*plaintext|plaintext[^.]*never\s+(echo|display|log|shown)|plaintext[^.]*not\s+(echoed|displayed|logged|shown)|not\s+(echoed|displayed|logged|shown)[^.]*plaintext/i.test(src),
      'workflow must explicitly forbid displaying plaintext API keys'
    );
  });

  test('workflow shows masked-value confirmation pattern, not raw secrets', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    // The confirmation table in the workflow must describe the masked display
    assert.ok(
      /\*\*\*\*\w{0,4}|\*\*\*\* *already set|\*\*\*\*<last.?4>/i.test(src),
      'workflow must describe a masked confirmation pattern (e.g. ****last4 or **** already set)'
    );
  });

  test('workflow includes a Leave / Replace / Clear flow for already-set keys', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(/Leave/i.test(src) && /Replace/i.test(src) && /Clear/i.test(src),
      'workflow must offer Leave / Replace / Clear when a key is already set');
  });
});

// ─── config-set round-trip ───────────────────────────────────────────────────

describe('#2529 config-set round-trip', () => {
  test('brave_search, firecrawl, exa_search, search_gitignored are valid keys', () => {
    for (const k of ['brave_search', 'firecrawl', 'exa_search', 'search_gitignored']) {
      assert.ok(VALID_CONFIG_KEYS.has(k), `${k} must be in VALID_CONFIG_KEYS`);
    }
  });

  test('config-set writes brave_search, firecrawl, exa_search values to config.json', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);

    const r1 = runGsdTools(['config-set', 'brave_search', 'BSKY-111111112222'], tmp);
    assert.ok(r1.success, `brave_search set failed: ${r1.error}`);
    const r2 = runGsdTools(['config-set', 'firecrawl', 'fc-aaaaaaaabbbbcccc'], tmp);
    assert.ok(r2.success, `firecrawl set failed: ${r2.error}`);
    const r3 = runGsdTools(['config-set', 'exa_search', 'ex-000011112222dddd'], tmp);
    assert.ok(r3.success, `exa_search set failed: ${r3.error}`);
    const r4 = runGsdTools(['config-set', 'search_gitignored', 'true'], tmp);
    assert.ok(r4.success, `search_gitignored set failed: ${r4.error}`);

    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(cfg.brave_search, 'BSKY-111111112222');
    assert.strictEqual(cfg.firecrawl, 'fc-aaaaaaaabbbbcccc');
    assert.strictEqual(cfg.exa_search, 'ex-000011112222dddd');
    assert.ok(
      cfg.search_gitignored === true || cfg.search_gitignored === 'true',
      `search_gitignored round-trip mismatch: got ${JSON.stringify(cfg.search_gitignored)}`
    );
  });

  test('config-set round-trips review.models.<cli>', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);

    const r = runGsdTools(
      ['config-set', 'review.models.codex', 'codex exec --model gpt-5'],
      tmp
    );
    assert.ok(r.success, `review.models.codex set failed: ${r.error}`);
    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(cfg.review?.models?.codex, 'codex exec --model gpt-5');
  });

  test('config-set round-trips agent_skills.<agent-type>', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);

    const r = runGsdTools(
      ['config-set', 'agent_skills.gsd-executor', 'skill-a,skill-b'],
      tmp
    );
    assert.ok(r.success, `agent_skills.gsd-executor set failed: ${r.error}`);
    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf-8'));
    // Accept either array or string — validator accepts both shapes today.
    const v = cfg.agent_skills?.['gsd-executor'];
    assert.ok(v === 'skill-a,skill-b' || (Array.isArray(v) && v.join(',') === 'skill-a,skill-b'),
      `expected agent_skills.gsd-executor to contain both skills, got ${JSON.stringify(v)}`);
  });
});

// ─── Config merge preserves unrelated keys ───────────────────────────────────

describe('#2529 config merge safety', () => {
  test('setting brave_search preserves unrelated workflow.research key', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);
    runGsdTools(['config-set', 'workflow.research', 'false'], tmp);

    const r = runGsdTools(['config-set', 'brave_search', 'BSKY-preserve-me-9999'], tmp);
    assert.ok(r.success, `set failed: ${r.error}`);

    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(cfg.workflow?.research, false, 'unrelated workflow.research must be preserved');
    assert.strictEqual(cfg.brave_search, 'BSKY-preserve-me-9999');
  });

  test('setting agent_skills.gsd-executor preserves unrelated review.models.codex', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);
    runGsdTools(['config-set', 'review.models.codex', 'codex exec'], tmp);

    const r = runGsdTools(['config-set', 'agent_skills.gsd-planner', 'a,b'], tmp);
    assert.ok(r.success, `set failed: ${r.error}`);

    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(cfg.review?.models?.codex, 'codex exec', 'unrelated review.models.codex must be preserved');
    assert.ok(cfg.agent_skills?.['gsd-planner'], 'agent_skills.gsd-planner must be set');
  });
});

// ─── /gsd-settings mentions /gsd-settings-integrations ──────────────────────

describe('#2529 /gsd-settings mentions new command', () => {
  test('settings workflow mentions canonical /gsd-config --integrations', () => {
    const src = fs.readFileSync(SETTINGS_WORKFLOW_PATH, 'utf-8');
    assert.ok(
      src.includes('gsd-config --integrations'),
      'settings.md must mention /gsd-config --integrations'
    );
    assert.ok(
      !src.includes('/gsd-settings-integrations'),
      'settings.md must not mention the legacy /gsd-settings-integrations variant'
    );
  });
});

// ─── Negative scenarios ──────────────────────────────────────────────────────

describe('#2529 negative — invalid inputs rejected', () => {
  test('invalid agent-type with path separators is rejected by validator', () => {
    assert.ok(!isValidConfigKey('agent_skills.../etc/passwd'),
      'agent_skills.../etc/passwd must be rejected');
    assert.ok(!isValidConfigKey('agent_skills./evil'),
      'agent_skills./evil must be rejected');
    assert.ok(!isValidConfigKey('agent_skills.a b c'),
      'agent_skills with spaces must be rejected');
    assert.ok(!isValidConfigKey('agent_skills.$(whoami)'),
      'agent_skills with shell metacharacters must be rejected');
  });

  test('config-set rejects agent_skills with path traversal', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);

    const r = runGsdTools(['config-set', 'agent_skills.../etc/passwd', 'x'], tmp);
    assert.ok(!r.success, 'config-set must reject path-traversal agent-type slug');
  });

  test('malformed review.models entry (empty cli) is rejected', () => {
    assert.ok(!isValidConfigKey('review.models.'),
      'review.models. (empty) must be rejected');
    assert.ok(!isValidConfigKey('review.models'),
      'review.models (no cli) must be rejected');
    assert.ok(!isValidConfigKey('review.models.claude/../../x'),
      'review.models with path separators must be rejected');
  });
});

// ─── Security: plaintext never leaks to disk outside config.json ─────────────

describe('#2529 security — plaintext containment', () => {
  test('after setting brave_search, plaintext appears only in config.json', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);

    // Build sentinel via concat so secret-scanners do not flag the literal.
    const marker = ['MASKCHECK', '9f3a7b2c'].join('-');
    const r = runGsdTools(['config-set', 'brave_search', marker], tmp);
    assert.ok(r.success, `set failed: ${r.error}`);

    const planning = path.join(tmp, '.planning');
    const hits = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.isFile()) continue;
        let buf;
        try { buf = fs.readFileSync(full, 'utf-8'); } catch { continue; }
        if (buf.includes(marker)) hits.push(full);
      }
    }
    walk(planning);

    assert.deepStrictEqual(
      hits.map(h => path.basename(h)).sort(),
      ['config.json'],
      `plaintext marker leaked outside config.json: found in ${hits.join(', ')}`
    );
  });

  test('config-set does not echo plaintext secret on stdout/stderr', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);

    const marker = ['ECHOCHECK', '77aa33bb'].join('-');
    const r = runGsdTools(['config-set', 'brave_search', marker], tmp);
    assert.ok(r.success, `set failed: ${r.error}`);
    const combined = `${r.output || ''}\n${r.error || ''}`;
    assert.ok(
      !combined.includes(marker),
      `config-set output must not echo the plaintext marker. Got:\n${combined}`
    );
  });

  test('config-get masks secrets and never echoes plaintext for brave_search/firecrawl/exa_search', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);

    const cases = [
      { key: 'brave_search', marker: ['GETMASK', 'brave', 'aaaa1111'].join('-') },
      { key: 'firecrawl',    marker: ['GETMASK', 'fc',    'bbbb2222'].join('-') },
      { key: 'exa_search',   marker: ['GETMASK', 'ex',    'cccc3333'].join('-') },
    ];

    for (const { key, marker } of cases) {
      const set = runGsdTools(['config-set', key, marker], tmp);
      assert.ok(set.success, `${key} set failed: ${set.error}`);

      const get = runGsdTools(['config-get', key], tmp);
      assert.ok(get.success, `${key} get failed: ${get.error}`);
      const combined = `${get.output || ''}\n${get.error || ''}`;
      assert.ok(
        !combined.includes(marker),
        `config-get must not echo plaintext for ${key}. Got:\n${combined}`
      );
      // Must contain the masked tail (last 4 of marker)
      const expectedMask = '****' + marker.slice(-4);
      assert.ok(
        combined.includes(expectedMask),
        `config-get must show masked form (${expectedMask}) for ${key}. Got:\n${combined}`
      );
    }
  });
});
