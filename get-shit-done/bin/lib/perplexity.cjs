'use strict';

/**
 * Perplexity client — single HTTP entry point for the Search API and Agent
 * API integrations. Centralizing the request shape here means the attribution
 * header (`X-Pplx-Integration`) and key resolution policy live in one file:
 * any future provider call routes through `perplexityFetch` rather than
 * inlining its own `fetch()` call.
 *
 * Docs: https://docs.perplexity.ai
 *   Search API: POST https://api.perplexity.ai/search
 *   Agent API:  POST https://api.perplexity.ai/v1/agent
 *
 * Key resolution mirrors the existing search-provider pattern:
 *   1. `PERPLEXITY_API_KEY` env var
 *   2. `~/.gsd/perplexity_api_key` file (UTF-8 / UTF-16 LE tolerated)
 *   3. `perplexity` field in .planning/config.json (string form)
 * Returns `null` when no key is configured so callers can fall back gracefully.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const SEARCH_URL = 'https://api.perplexity.ai/search';
const AGENT_URL = 'https://api.perplexity.ai/v1/agent';

/**
 * Build the attribution header value. The slug is documented for our
 * integration; the version is read from the repo's package.json so support
 * traffic from older installs is distinguishable.
 */
function integrationHeader() {
  let version = 'unknown';
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'),
    );
    if (pkg && typeof pkg.version === 'string' && pkg.version) {
      version = pkg.version;
    }
  } catch { /* unknown is fine — header still goes out */ }
  return `get-shit-done/${version}`;
}

function readKeyFile(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    // UTF-16 LE BOM tolerance (parity with Brave key-file handling).
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.toString('utf16le').replace(/^﻿/, '').trim();
    }
    return buf.toString('utf-8').replace(/^﻿/, '').trim();
  } catch {
    return null;
  }
}

/**
 * Resolve the Perplexity API key with the same precedence as other providers.
 * Returns null when nothing is configured — callers translate that into a
 * graceful `{ available: false }` response.
 */
function resolveApiKey(cwd) {
  if (process.env.PERPLEXITY_API_KEY) return process.env.PERPLEXITY_API_KEY;
  const homeKey = path.join(os.homedir(), '.gsd', 'perplexity_api_key');
  const fromHome = readKeyFile(homeKey);
  if (fromHome) return fromHome;
  if (cwd) {
    try {
      const cfgPath = path.join(cwd, '.planning', 'config.json');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        const v = cfg && cfg.perplexity;
        if (typeof v === 'string' && v.length > 0) return v;
      }
    } catch { /* malformed config is treated as no-key */ }
  }
  return null;
}

/**
 * Central HTTP entry point. Adds `Authorization` and `X-Pplx-Integration` on
 * every call. Returns the parsed JSON body or throws on transport / non-2xx.
 *
 * @param {string} url
 * @param {object} body  Request body (JSON-serialized).
 * @param {object} opts  { apiKey, fetchImpl? } — `fetchImpl` is for tests.
 */
async function perplexityFetch(url, body, opts) {
  const { apiKey, fetchImpl } = opts || {};
  if (!apiKey) {
    const err = new Error('PERPLEXITY_API_KEY not set');
    err.code = 'NO_KEY';
    throw err;
  }
  const doFetch = fetchImpl || globalThis.fetch;
  const response = await doFetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Pplx-Integration': integrationHeader(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = new Error(`API error: ${response.status}`);
    err.code = 'API_ERROR';
    err.status = response.status;
    throw err;
  }
  return response.json();
}

/**
 * Search API — POST https://api.perplexity.ai/search.
 * Returns `{ available: true, query, count, results: [{title,url,snippet,date,last_updated}] }`
 * or `{ available: false, reason | error }` for graceful fallback.
 */
async function search(query, options, ctx) {
  const apiKey = resolveApiKey(ctx && ctx.cwd);
  if (!apiKey) {
    return { available: false, reason: 'PERPLEXITY_API_KEY not set' };
  }
  if (!query || (typeof query === 'string' && query.trim() === '')) {
    return { available: false, error: 'Query required' };
  }
  const body = { query };
  if (options && options.maxResults != null) body.max_results = options.maxResults;
  if (options && options.maxTokens != null) body.max_tokens = options.maxTokens;
  if (options && options.maxTokensPerPage != null) body.max_tokens_per_page = options.maxTokensPerPage;
  if (options && options.searchDomainFilter) body.search_domain_filter = options.searchDomainFilter;
  if (options && options.searchRecencyFilter) body.search_recency_filter = options.searchRecencyFilter;
  if (options && options.searchLanguageFilter) body.search_language_filter = options.searchLanguageFilter;

  try {
    const data = await perplexityFetch(SEARCH_URL, body, {
      apiKey,
      fetchImpl: ctx && ctx.fetchImpl,
    });
    const results = Array.isArray(data && data.results) ? data.results.map((r) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.snippet || '',
      date: r.date || null,
      last_updated: r.last_updated || null,
    })) : [];
    return {
      available: true,
      query: typeof query === 'string' ? query : query[0],
      count: results.length,
      results,
    };
  } catch (err) {
    return { available: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * Agent API — POST https://api.perplexity.ai/v1/agent.
 * Returns `{ available: true, id, output, raw }` on success, or
 * `{ available: false, reason | error }` for graceful fallback.
 *
 * `preset` defaults to `pro-search` per the provider docs; callers can pass
 * an explicit model via `options.model`.
 */
async function agent(input, options, ctx) {
  const apiKey = resolveApiKey(ctx && ctx.cwd);
  if (!apiKey) {
    return { available: false, reason: 'PERPLEXITY_API_KEY not set' };
  }
  if (!input || (typeof input === 'string' && input.trim() === '')) {
    return { available: false, error: 'Input required' };
  }
  const body = { input };
  if (options && options.preset) body.preset = options.preset;
  else if (!options || !options.model) body.preset = 'pro-search';
  if (options && options.model) body.model = options.model;
  if (options && options.tools) body.tools = options.tools;

  try {
    const data = await perplexityFetch(AGENT_URL, body, {
      apiKey,
      fetchImpl: ctx && ctx.fetchImpl,
    });
    return {
      available: true,
      id: (data && data.id) || null,
      output: (data && (data.output || data.output_text || data.response)) || null,
      raw: data,
    };
  } catch (err) {
    return { available: false, error: err && err.message ? err.message : String(err) };
  }
}

module.exports = {
  SEARCH_URL,
  AGENT_URL,
  integrationHeader,
  resolveApiKey,
  perplexityFetch,
  search,
  agent,
};
