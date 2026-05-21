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
const { tmpdir } = require('node:os');
const { pathToFileURL } = require('node:url');

const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');
const perplexity = require('../get-shit-done/bin/lib/perplexity.cjs');
const { SECRET_CONFIG_KEYS, isSecretKey, maskSecret } = require('../get-shit-done/bin/lib/secrets.cjs');
const { VALID_CONFIG_KEYS, isValidConfigKey } = require('../get-shit-done/bin/lib/config-schema.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const SDK_CATALOG_DIST = path.join(REPO_ROOT, 'sdk', 'dist', 'query', 'command-static-catalog-domain.js');
const SDK_PERPLEXITY_DIST = path.join(REPO_ROOT, 'sdk', 'dist', 'query', 'perplexity.js');

async function importDist(filePath) {
  return import(pathToFileURL(filePath).href);
}

function assertNoMarker(value, marker) {
  assert.ok(!JSON.stringify(value).includes(marker), `value must not surface secret marker ${marker}`);
}

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
    assert.deepEqual(r.failure, {
      kind: 'NO_KEY',
      status: null,
      message: 'PERPLEXITY_API_KEY not set',
    });
    assert.equal(r.reason, 'PERPLEXITY_API_KEY not set');
  });

  test('agent() returns available:false with reason when no key is set', async () => {
    const r = await perplexity.agent('hello', {}, { cwd: '/tmp/nope' });
    assert.equal(r.available, false);
    assert.equal(r.failure.kind, 'NO_KEY');
    assert.equal(r.failure.status, null);
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
  let prevHome;
  let prevUserProfile;
  let sandboxedHome;

  beforeEach(() => {
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;
    // Sandbox HOME / USERPROFILE so a real `~/.gsd/perplexity_api_key`
    // on the developer or CI machine cannot satisfy the no-key branches
    // exercised here.
    sandboxedHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'pplx-test-home-'));
    process.env.HOME = sandboxedHome;
    process.env.USERPROFILE = sandboxedHome;
  });
  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
    if (prevUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = prevUserProfile;
    try { fs.rmSync(sandboxedHome, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  test('search() with no key returns fallback without calling fetch', async () => {
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
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
    try {
      const r = await perplexity.search('typescript generics', {
        maxResults: 5,
        searchRecencyFilter: 'week',
        searchDomainFilter: ['docs.example.com'],
      }, { fetchImpl: fakeFetch, cwd: undefined });
      assert.equal(r.available, false);
      assert.equal(r.failure.kind, 'NO_KEY');
      assert.equal(captured, null);
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  test('search() POSTs to /search with X-Pplx-Integration + body mapping', async () => {
    const prevEnv = process.env.PERPLEXITY_API_KEY;
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
    process.env.PERPLEXITY_API_KEY = 'pplx-test-key-abcd';
    try {
      const r = await perplexity.search('typescript generics', {
        maxResults: 5,
        searchRecencyFilter: 'week',
        searchDomainFilter: ['docs.example.com'],
      }, { fetchImpl: fakeFetch });
      assert.equal(r.available, true);
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
      assert.equal(r.results.length, 2);
      assert.equal(r.results[0].title, 'A');
      assert.equal(r.results[0].date, '2026-05-10');
      assert.equal(r.results[1].date, null);
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  test('agent() POSTs to /v1/agent with pro-search preset by default', async () => {
    const prevEnv = process.env.PERPLEXITY_API_KEY;
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
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  for (const { name, options, expectedModel } of [
    { name: 'with --model only', options: { model: 'sonar-pro' }, expectedModel: 'sonar-pro' },
    { name: 'with --model X --preset Y', options: { model: 'sonar-pro', preset: 'sonar-deep-research' }, expectedModel: 'sonar-pro' },
  ]) {
    test(`agent() sends model instead of preset ${name}`, async () => {
      const prevEnv = process.env.PERPLEXITY_API_KEY;
      process.env.PERPLEXITY_API_KEY = 'pplx-key-with-model';
      try {
        let captured = null;
        const fakeFetch = async (url, init) => {
          captured = { url, init };
          return { ok: true, async json() { return { id: 'ag_2', output_text: 'ok' }; } };
        };
        await perplexity.agent('hi', options, { fetchImpl: fakeFetch });
        const body = JSON.parse(captured.init.body);
        assert.deepEqual(body, { input: 'hi', model: expectedModel });
      } finally {
        if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
        else process.env.PERPLEXITY_API_KEY = prevEnv;
      }
    });
  }

  test('CJS agent() body stays in parity with the TS handler for model+preset precedence', async () => {
    const { perplexityAgent } = await importDist(SDK_PERPLEXITY_DIST);
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    const originalFetch = globalThis.fetch;
    process.env.PERPLEXITY_API_KEY = 'pplx-parity-key';
    const tmp = fs.mkdtempSync(path.join(tmpdir(), 'pplx-parity-project-'));
    try {
      let cjsBody = null;
      let tsBody = null;
      const fakeCjsFetch = async (_url, init) => {
        cjsBody = JSON.parse(init.body);
        return { ok: true, async json() { return { id: 'ag_cjs', output_text: 'ok' }; } };
      };
      globalThis.fetch = async (_url, init) => {
        tsBody = JSON.parse(init.body);
        return { ok: true, json: async () => ({ id: 'ag_ts', output_text: 'ok' }) };
      };

      await perplexity.agent('hi', { model: 'sonar-pro', preset: 'sonar-deep-research' }, { fetchImpl: fakeCjsFetch });
      await perplexityAgent(['hi', '--model', 'sonar-pro', '--preset', 'sonar-deep-research'], tmp);

      assert.deepEqual(cjsBody, { input: 'hi', model: 'sonar-pro' });
      assert.deepEqual(tsBody, cjsBody);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('non-2xx response surfaces as available:false with status error', async () => {
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    process.env.PERPLEXITY_API_KEY = 'pplx-error-key-xxx';
    try {
      const fakeFetch = async () => ({ ok: false, status: 429, async json() { return {}; } });
      const r = await perplexity.search('q', {}, { fetchImpl: fakeFetch });
      assert.equal(r.available, false);
      assert.deepEqual(r.failure, {
        kind: 'API_ERROR',
        status: 429,
        message: 'API error: 429',
      });
      assert.equal(r.error, 'API error: 429');
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  test('invalid JSON response surfaces as a stable provider error', async () => {
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    process.env.PERPLEXITY_API_KEY = 'pplx-invalid-json';
    try {
      const fakeFetch = async () => ({ ok: true, async json() { throw new SyntaxError('Unexpected token <'); } });
      const r = await perplexity.search('q', {}, { fetchImpl: fakeFetch });
      assert.equal(r.available, false);
      assert.equal(r.failure.kind, 'PARSE');
      assert.equal(r.error, 'Invalid JSON response');
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  test('network failure surfaces as available:false with NETWORK failure kind', async () => {
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    process.env.PERPLEXITY_API_KEY = 'pplx-network-key';
    try {
      const fakeFetch = async () => {
        throw new Error('ECONNRESET');
      };
      const r = await perplexity.search('q', {}, { fetchImpl: fakeFetch });
      assert.equal(r.available, false);
      assert.equal(r.failure.kind, 'NETWORK');
      assert.equal(r.failure.status, null);
      assert.equal(r.failure.message, 'ECONNRESET');
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  test('invalid maxResults is rejected before request construction', async () => {
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    process.env.PERPLEXITY_API_KEY = 'pplx-invalid-limit';
    try {
      let called = false;
      const fakeFetch = async () => {
        called = true;
        return { ok: true, async json() { return { results: [] }; } };
      };
      const r = await perplexity.search('q', { maxResults: NaN }, { fetchImpl: fakeFetch });
      assert.equal(r.available, false);
      assert.equal(r.failure.kind, 'BAD_ARGS');
      assert.equal(r.error, 'maxResults requires a positive integer');
      assert.equal(called, false);
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  test('empty query / input surfaces as available:false with "Query required" / "Input required"', async () => {
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    process.env.PERPLEXITY_API_KEY = 'pplx-validation-key';
    try {
      const r1 = await perplexity.search('', {}, {});
      assert.equal(r1.available, false);
      assert.equal(r1.failure.kind, 'BAD_ARGS');
      assert.equal(r1.error, 'Query required');
      const r2 = await perplexity.agent('', {}, {});
      assert.equal(r2.available, false);
      assert.equal(r2.failure.kind, 'BAD_ARGS');
      assert.equal(r2.error, 'Input required');
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  test('thrown provider errors redact Perplexity key markers', async () => {
    const marker = 'pplx-test-marker-xxxx';
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    process.env.PERPLEXITY_API_KEY = marker;
    try {
      const fakeFetch = async () => {
        throw new Error(`boom https://api.perplexity.ai/search Bearer ${marker}`);
      };
      const r = await perplexity.search('q', {}, { fetchImpl: fakeFetch });
      assert.equal(r.available, false);
      assert.equal(r.failure.kind, 'NETWORK');
      assertNoMarker(r.error, marker);
      assertNoMarker(r.failure.message, marker);
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  test('successful provider bodies redact Perplexity key markers from raw output', async () => {
    const marker = 'pplx-test-marker-yyyy';
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    process.env.PERPLEXITY_API_KEY = marker;
    try {
      const fakeFetch = async () => ({
        ok: true,
        async json() {
          return { id: 'ag_secret', output_text: 'ok', debug: `echo ${marker}` };
        },
      });
      const r = await perplexity.agent('hi', {}, { fetchImpl: fakeFetch });
      assert.equal(r.available, true);
      assertNoMarker(r, marker);
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
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
  test('empty PERPLEXITY_API_KEY treated as unset', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    const sharedEnv = { HOME: tmp, PERPLEXITY_API_KEY: '' };
    const search = runGsdTools(['perplexity-search', 'hello'], tmp, sharedEnv);
    assert.ok(search.success, `perplexity-search failed: ${search.error}`);
    const parsedSearch = JSON.parse(search.output);
    assert.equal(parsedSearch.available, false);
    assert.equal(parsedSearch.failure.kind, 'NO_KEY');
    assert.equal(parsedSearch.reason, 'PERPLEXITY_API_KEY not set');

    const agentRun = runGsdTools(['perplexity-agent', 'hello'], tmp, sharedEnv);
    assert.ok(agentRun.success, `perplexity-agent failed: ${agentRun.error}`);
    const parsedAgent = JSON.parse(agentRun.output);
    assert.equal(parsedAgent.available, false);
    assert.equal(parsedAgent.failure.kind, 'NO_KEY');
    assert.equal(parsedAgent.reason, 'PERPLEXITY_API_KEY not set');
  });

  test('absent PERPLEXITY_API_KEY treated as unset', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    const prevEnv = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    try {
      const search = runGsdTools(['perplexity-search', 'hello'], tmp, { HOME: tmp });
      assert.ok(search.success, `perplexity-search failed: ${search.error}`);
      const parsedSearch = JSON.parse(search.output);
      assert.equal(parsedSearch.available, false);
      assert.equal(parsedSearch.failure.kind, 'NO_KEY');

      const agentRun = runGsdTools(['perplexity-agent', 'hello'], tmp, { HOME: tmp });
      assert.ok(agentRun.success, `perplexity-agent failed: ${agentRun.error}`);
      const parsedAgent = JSON.parse(agentRun.output);
      assert.equal(parsedAgent.available, false);
      assert.equal(parsedAgent.failure.kind, 'NO_KEY');
    } finally {
      if (prevEnv === undefined) delete process.env.PERPLEXITY_API_KEY;
      else process.env.PERPLEXITY_API_KEY = prevEnv;
    }
  });

  test('perplexity-search rejects --limit without a following value', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    const r = runGsdTools(['perplexity-search', 'myquery', '--limit'], tmp, { HOME: tmp, PERPLEXITY_API_KEY: '' });
    assert.equal(r.success, false);
    assert.match(r.error, /--limit requires a positive integer/);
  });

  test('perplexity-agent returns available:false when no key set', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    const r = runGsdTools(['perplexity-agent', 'hello'], tmp, { HOME: tmp, PERPLEXITY_API_KEY: '' });
    assert.ok(r.success, `perplexity-agent failed: ${r.error}`);
    const parsed = JSON.parse(r.output);
    assert.equal(parsed.available, false);
    assert.equal(parsed.failure.kind, 'NO_KEY');
    assert.equal(parsed.reason, 'PERPLEXITY_API_KEY not set');
  });
});

// ─── Runtime CLI / catalog surface ───────────────────────────────────────────

describe('perplexity surfaced in CLI usage + config schema', () => {
  test('static SDK command catalog includes Perplexity query handlers', async () => {
    const { DOMAIN_STATIC_CATALOG } = await importDist(SDK_CATALOG_DIST);
    const names = new Set(DOMAIN_STATIC_CATALOG.map(([name]) => name));
    assert.equal(names.has('perplexity-search'), true, 'catalog must include perplexity-search');
    assert.equal(names.has('perplexity-agent'), true, 'catalog must include perplexity-agent');
  });

  test('config-set/get perplexity round-trips through the schema and masks output', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    runGsdTools(['config-ensure-section'], tmp);

    const marker = ['PPLX', 'SURFACE', 'mnop5678'].join('-');
    const set = runGsdTools(['config-set', 'perplexity', marker], tmp);
    assert.ok(set.success, `config-set perplexity must succeed: ${set.error}`);

    const get = runGsdTools(['config-get', 'perplexity'], tmp);
    assert.ok(get.success, `config-get perplexity must succeed: ${get.error}`);
    const combined = `${get.output || ''}\n${get.error || ''}`;
    assert.ok(combined.includes('****' + marker.slice(-4)), 'config-get must mask the secret');
    assert.ok(!combined.includes(marker), 'config-get must not echo plaintext');
  });

  test('perplexity-search and perplexity-agent both produce structured JSON output', (t) => {
    const tmp = createTempProject();
    t.after(() => cleanup(tmp));
    const sharedEnv = { HOME: tmp, PERPLEXITY_API_KEY: '' };
    const search = runGsdTools(['perplexity-search', 'hi'], tmp, sharedEnv);
    assert.ok(search.success, `perplexity-search must run: ${search.error}`);
    const parsedSearch = JSON.parse(search.output);
    assert.equal(parsedSearch.available, false);
    assert.equal(parsedSearch.failure.kind, 'NO_KEY');
    assert.equal(parsedSearch.reason, 'PERPLEXITY_API_KEY not set');

    const agentRun = runGsdTools(['perplexity-agent', 'hi'], tmp, sharedEnv);
    assert.ok(agentRun.success, `perplexity-agent must run: ${agentRun.error}`);
    const parsedAgent = JSON.parse(agentRun.output);
    assert.equal(parsedAgent.available, false);
    assert.equal(parsedAgent.failure.kind, 'NO_KEY');
    assert.equal(parsedAgent.reason, 'PERPLEXITY_API_KEY not set');
  });
});
