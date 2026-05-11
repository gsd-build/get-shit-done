'use strict';

/**
 * Perplexity integration tests — Search API + Agent API.
 *
 * Covers:
 *   - Graceful fallback when PERPLEXITY_API_KEY is absent
 *   - Search API request body / response mapping
 *   - Agent API request body / response mapping (pro-search preset default)
 *   - X-Pplx-Integration attribution header is sent on every outgoing call
 *   - Config key (`perplexity`) round-trips and masks secrets
 *   - Plaintext containment (no leak outside config.json on disk)
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');
const perplexity = require('../get-shit-done/bin/lib/perplexity.cjs');
const { SECRET_CONFIG_KEYS, isSecretKey, maskSecret } = require('../get-shit-done/bin/lib/secrets.cjs');
const { VALID_CONFIG_KEYS, isValidConfigKey } = require('../get-shit-done/bin/lib/config-schema.cjs');

// ─── Module-level guards ─────────────────────────────────────────────────────

describe('perplexity module shape', () => {
  test('exports search, agent, perplexityFetch, resolveApiKey, integrationHeader', () => {
    assert.equal(typeof perplexity.search, 'function');
    assert.equal(typeof perplexity.agent, 'function');
    assert.equal(typeof perplexity.perplexityFetch, 'function');
    assert.equal(typeof perplexity.resolveApiKey, 'function');
    assert.equal(typeof perplexity.integrationHeader, 'function');
  });

  test('integrationHeader uses the get-shit-done/<version> shape from package.json', () => {
    const value = perplexity.integrationHeader();
    assert.match(value, /^get-shit-done\/[^\s]+$/);
    // Sanity: the version segment is the package.json version, not "unknown",
    // when the repo is present (the test environment is the repo itself).
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    assert.equal(value, `get-shit-done/${pkg.version}`);
  });
});

// ─── Config schema / secrets registration ────────────────────────────────────

describe('perplexity registered as config key + secret', () => {
  test('`perplexity` is in VALID_CONFIG_KEYS', () => {
    assert.ok(VALID_CONFIG_KEYS.has('perplexity'), 'perplexity must be a valid config key');
    assert.ok(isValidConfigKey('perplexity'));
  });

  test('`perplexity` is in SECRET_CONFIG_KEYS', () => {
    assert.ok(SECRET_CONFIG_KEYS.has('perplexity'), 'perplexity must be a secret key');
    assert.equal(isSecretKey('perplexity'), true);
  });

  test('maskSecret applies the documented convention', () => {
    assert.equal(maskSecret('pplx-abcd1234efgh'), '****efgh');
    assert.equal(maskSecret(null), '(unset)');
  });
});

// ─── Key resolution + graceful fallback ──────────────────────────────────────

describe('perplexity.resolveApiKey + fallback', () => {
  let prevEnv;
  let prevHome;
  let prevUserProfile;
  let sandboxedHome;

  beforeEach(() => {
    prevEnv = process.env.PERPLEXITY_API_KEY;
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;
    delete process.env.PERPLEXITY_API_KEY;
    // Sandbox HOME / USERPROFILE so a real `~/.gsd/perplexity_api_key`
    // on the developer or CI machine cannot satisfy these no-key tests.
    sandboxedHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'pplx-test-home-'));
    process.env.HOME = sandboxedHome;
    process.env.USERPROFILE = sandboxedHome;
  });
  afterEach(() => {
    if (prevEnv !== undefined) process.env.PERPLEXITY_API_KEY = prevEnv; else delete process.env.PERPLEXITY_API_KEY;
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
    if (prevUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = prevUserProfile;
    try { fs.rmSync(sandboxedHome, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  test('search() returns available:false with reason when no key is set', async () => {
    const r = await perplexity.search('hello', {}, { cwd: '/tmp/nope' });
    assert.equal(r.available, false);
    assert.equal(r.reason, 'PERPLEXITY_API_KEY not set');
  });

  test('agent() returns available:false with reason when no key is set', async () => {
    const r = await perplexity.agent('hello', {}, { cwd: '/tmp/nope' });
    assert.equal(r.available, false);
    assert.equal(r.reason, 'PERPLEXITY_API_KEY not set');
  });

  test('search() resolves the key from config.json when env unset', async (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);
    runGsdTools(['config-set', 'perplexity', 'pplx-from-config-99'], tmp);

    let captured = null;
    const fakeFetch = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        async json() { return { id: 'req_1', results: [{ title: 't', url: 'u', snippet: 's' }] }; },
      };
    };
    const r = await perplexity.search('q', {}, { cwd: tmp, fetchImpl: fakeFetch });
    assert.equal(r.available, true);
    assert.equal(r.count, 1);
    assert.equal(captured.init.headers.Authorization, 'Bearer pplx-from-config-99');
  });
});

// ─── Request mapping + attribution header ────────────────────────────────────

describe('perplexity HTTP request shape', () => {
  test('search() POSTs to /search with X-Pplx-Integration + body mapping', async () => {
    let captured = null;
    const fakeFetch = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        async json() {
          return {
            id: 'req_2',
            results: [
              { title: 'A', url: 'https://a', snippet: 'sa', date: '2026-05-10' },
              { title: 'B', url: 'https://b', snippet: 'sb' },
            ],
          };
        },
      };
    };
    const r = await perplexity.search('typescript generics', {
      maxResults: 5,
      searchRecencyFilter: 'week',
      searchDomainFilter: ['docs.example.com'],
    }, { fetchImpl: fakeFetch, cwd: undefined });
    // Override resolveApiKey via env for this case
    process.env.PERPLEXITY_API_KEY = 'pplx-test-key-abcd';
    try {
      const r2 = await perplexity.search('typescript generics', {
        maxResults: 5,
        searchRecencyFilter: 'week',
        searchDomainFilter: ['docs.example.com'],
      }, { fetchImpl: fakeFetch });
      assert.equal(r2.available, true);
      assert.equal(captured.url, 'https://api.perplexity.ai/search');
      assert.equal(captured.init.method, 'POST');
      assert.equal(captured.init.headers['Content-Type'], 'application/json');
      assert.equal(captured.init.headers.Authorization, 'Bearer pplx-test-key-abcd');
      assert.match(captured.init.headers['X-Pplx-Integration'], /^get-shit-done\/[^\s]+$/);
      const body = JSON.parse(captured.init.body);
      assert.equal(body.query, 'typescript generics');
      assert.equal(body.max_results, 5);
      assert.equal(body.search_recency_filter, 'week');
      assert.deepEqual(body.search_domain_filter, ['docs.example.com']);
      assert.equal(r2.results.length, 2);
      assert.equal(r2.results[0].title, 'A');
      assert.equal(r2.results[0].date, '2026-05-10');
      assert.equal(r2.results[1].date, null);
    } finally {
      delete process.env.PERPLEXITY_API_KEY;
    }
    // First call (no env, no cwd) returns fallback — fakeFetch was never called for that branch:
    assert.equal(r.available, false);
  });

  test('agent() POSTs to /v1/agent with pro-search preset by default', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-agent-key-xxxx';
    try {
      let captured = null;
      const fakeFetch = async (url, init) => {
        captured = { url, init };
        return {
          ok: true,
          async json() { return { id: 'ag_1', output: 'synthesized answer' }; },
        };
      };
      const r = await perplexity.agent('Find recent context on …', {}, { fetchImpl: fakeFetch });
      assert.equal(r.available, true);
      assert.equal(r.output, 'synthesized answer');
      assert.equal(captured.url, 'https://api.perplexity.ai/v1/agent');
      assert.match(captured.init.headers['X-Pplx-Integration'], /^get-shit-done\//);
      const body = JSON.parse(captured.init.body);
      assert.equal(body.input, 'Find recent context on …');
      assert.equal(body.preset, 'pro-search');
    } finally {
      delete process.env.PERPLEXITY_API_KEY;
    }
  });

  test('agent() sends model instead of preset when --model provided', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-key-with-model';
    try {
      let captured = null;
      const fakeFetch = async (url, init) => {
        captured = { url, init };
        return { ok: true, async json() { return { id: 'ag_2', output_text: 'ok' }; } };
      };
      await perplexity.agent('hi', { model: 'sonar-pro' }, { fetchImpl: fakeFetch });
      const body = JSON.parse(captured.init.body);
      assert.equal(body.model, 'sonar-pro');
      assert.equal(body.preset, undefined);
    } finally {
      delete process.env.PERPLEXITY_API_KEY;
    }
  });

  test('non-2xx response surfaces as available:false with status error', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-error-key-xxx';
    try {
      const fakeFetch = async () => ({ ok: false, status: 429, async json() { return {}; } });
      const r = await perplexity.search('q', {}, { fetchImpl: fakeFetch });
      assert.equal(r.available, false);
      assert.equal(r.error, 'API error: 429');
    } finally {
      delete process.env.PERPLEXITY_API_KEY;
    }
  });

  test('empty query / input surfaces as available:false with "Query required" / "Input required"', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-validation-key';
    try {
      const r1 = await perplexity.search('', {}, {});
      assert.equal(r1.available, false);
      assert.equal(r1.error, 'Query required');
      const r2 = await perplexity.agent('', {}, {});
      assert.equal(r2.available, false);
      assert.equal(r2.error, 'Input required');
    } finally {
      delete process.env.PERPLEXITY_API_KEY;
    }
  });
});

// ─── config-set round-trip + masking ─────────────────────────────────────────

describe('perplexity config integration', () => {
  test('config-set perplexity stores plaintext only in config.json and masks output', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);

    const marker = ['PPLX', 'TESTMARK', 'abcd1234'].join('-');
    const r = runGsdTools(['config-set', 'perplexity', marker], tmp);
    assert.ok(r.success, `config-set perplexity failed: ${r.error}`);

    const combined = `${r.output || ''}\n${r.error || ''}`;
    assert.ok(!combined.includes(marker), `config-set must mask plaintext, got: ${combined}`);
    assert.ok(combined.includes('****' + marker.slice(-4)), `expected mask **** + last-4, got: ${combined}`);

    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf-8'));
    assert.equal(cfg.perplexity, marker, 'plaintext should be written to config.json');
  });

  test('config-get perplexity masks the secret on read', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);
    const marker = ['PPLX', 'GET', 'wxyz9876'].join('-');
    runGsdTools(['config-set', 'perplexity', marker], tmp);

    const get = runGsdTools(['config-get', 'perplexity'], tmp);
    assert.ok(get.success, `config-get failed: ${get.error}`);
    const combined = `${get.output || ''}\n${get.error || ''}`;
    assert.ok(!combined.includes(marker), 'config-get must not echo plaintext');
    assert.ok(combined.includes('****' + marker.slice(-4)), 'config-get must show mask');
  });

  test('plaintext appears only in config.json after config-set perplexity', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);
    const marker = ['PPLX', 'LEAKCHECK', 'qqqq1111'].join('-');
    runGsdTools(['config-set', 'perplexity', marker], tmp);

    const planning = path.join(tmp, '.planning');
    const hits = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        let buf;
        try { buf = fs.readFileSync(full, 'utf-8'); } catch { return; }
        if (buf.includes(marker)) hits.push(full);
      }
    })(planning);
    assert.deepEqual(
      hits.map(h => path.basename(h)).sort(),
      ['config.json'],
      `plaintext leaked outside config.json: ${hits.join(', ')}`,
    );
  });
});

// ─── CLI surface ─────────────────────────────────────────────────────────────

describe('perplexity-search / perplexity-agent CLI surface', () => {
  test('perplexity-search returns available:false when no key set', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    // Sandbox HOME so ~/.gsd/perplexity_api_key cannot satisfy the lookup.
    const r = runGsdTools(['perplexity-search', 'hello'], tmp, { HOME: tmp, PERPLEXITY_API_KEY: '' });
    assert.ok(r.success, `perplexity-search failed: ${r.error}`);
    const parsed = JSON.parse(r.output);
    assert.equal(parsed.available, false);
    assert.equal(parsed.reason, 'PERPLEXITY_API_KEY not set');
  });

  test('perplexity-agent returns available:false when no key set', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    const r = runGsdTools(['perplexity-agent', 'hello'], tmp, { HOME: tmp, PERPLEXITY_API_KEY: '' });
    assert.ok(r.success, `perplexity-agent failed: ${r.error}`);
    const parsed = JSON.parse(r.output);
    assert.equal(parsed.available, false);
    assert.equal(parsed.reason, 'PERPLEXITY_API_KEY not set');
  });
});

// ─── Workflow + docs surface ─────────────────────────────────────────────────

describe('perplexity surfaced in docs / workflow', () => {
  test('settings-integrations workflow mentions perplexity key', () => {
    const wf = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'settings-integrations.md'),
      'utf-8',
    );
    assert.ok(wf.includes('perplexity'), 'workflow must reference perplexity key');
  });

  test('CONFIGURATION.md documents the perplexity key', () => {
    const docs = fs.readFileSync(
      path.join(__dirname, '..', 'docs', 'CONFIGURATION.md'),
      'utf-8',
    );
    assert.ok(docs.includes('`perplexity`'), 'CONFIGURATION.md must document perplexity key');
    assert.ok(docs.includes('PERPLEXITY_API_KEY'), 'CONFIGURATION.md must reference env var');
    assert.ok(docs.includes('docs.perplexity.ai'), 'CONFIGURATION.md must link official docs');
  });

  test('researcher agent references perplexity-search / perplexity-agent', () => {
    const agent = fs.readFileSync(
      path.join(__dirname, '..', 'agents', 'gsd-project-researcher.md'),
      'utf-8',
    );
    assert.ok(agent.includes('perplexity-search'));
    assert.ok(agent.includes('perplexity-agent'));
  });
});
