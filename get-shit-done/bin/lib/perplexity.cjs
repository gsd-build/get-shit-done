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
const PACKAGE_NAME = 'get-shit-done-cc';
const REDACTED = '[redacted]';

function warn(message) {
  fs.writeSync(2, `[perplexity] ${message}\n`);
}

function formatError(err) {
  return err && err.message ? err.message : String(err);
}

function sanitizeMessage(message, apiKey) {
  let sanitized = String(message);
  if (apiKey) {
    sanitized = sanitized.split(apiKey).join(REDACTED);
  }
  return sanitized
    .replace(/Bearer\s+[^ \t\r\n]+/g, `Bearer ${REDACTED}`)
    .replace(/\bpplx-[A-Za-z0-9._-]+/g, REDACTED);
}

function sanitizeValue(value, apiKey) {
  if (typeof value === 'string') return sanitizeMessage(value, apiKey);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, apiKey));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitizeValue(item, apiKey)]),
  );
}

function failure(kind, message, status) {
  return { kind, status: status == null ? null : status, message };
}

function unavailable(kind, message, status) {
  const result = { available: false, failure: failure(kind, message, status) };
  if (kind === 'NO_KEY') result.reason = message;
  else result.error = message;
  return result;
}

function classifyFailure(err, apiKey) {
  const message = sanitizeMessage(formatError(err), apiKey);
  if (err && err.code === 'NO_KEY') return failure('NO_KEY', message, null);
  if (err && err.code === 'API_ERROR') return failure('API_ERROR', message, err.status);
  if (err && err.code === 'INVALID_JSON') return failure('PARSE', message, null);
  return failure('NETWORK', message, null);
}

function unavailableFromError(err, apiKey) {
  const f = classifyFailure(err, apiKey);
  const result = { available: false, failure: f };
  if (f.kind === 'NO_KEY') result.reason = f.message;
  else result.error = f.message;
  return result;
}

function readPackageVersion(startDir) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  let fallbackVersion = null;
  while (true) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      const text = fs.readFileSync(candidate, 'utf-8');
      let pkg;
      try {
        pkg = JSON.parse(text);
      } catch (err) {
        throw new Error(`Failed to parse ${candidate}: ${formatError(err)}`);
      }
      if (pkg && typeof pkg.version === 'string' && pkg.version) {
        if (pkg.name === PACKAGE_NAME) return pkg.version;
        fallbackVersion = fallbackVersion || pkg.version;
      }
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return fallbackVersion;
}

/**
 * Build the attribution header value. The slug is documented for our
 * integration; the version is read from the repo's package.json so support
 * traffic from older installs is distinguishable.
 */
function integrationHeader() {
  let version = 'unknown';
  try {
    const found = readPackageVersion(__dirname);
    if (found) version = found;
    else warn('falling back to unknown integration version: package.json version not found');
  } catch (err) {
    warn(`falling back to unknown integration version: ${formatError(err)}`);
  }
  return `get-shit-done/${version}`;
}

function readKeyFile(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    // UTF-16 LE BOM tolerance (parity with Brave key-file handling).
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.toString('utf16le').replace(/^\uFEFF/, '').trim();
    }
    return buf.toString('utf-8').replace(/^\uFEFF/, '').trim();
  } catch (err) {
    if (!err || err.code !== 'ENOENT') {
      warn(`could not read key file ${filePath}: ${formatError(err)}`);
    }
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
    const cfgPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(cfgPath)) {
      const text = fs.readFileSync(cfgPath, 'utf-8');
      let cfg;
      try {
        cfg = JSON.parse(text);
      } catch (err) {
        warn(`could not parse ${cfgPath}: ${formatError(err)}`);
        return null;
      }
      const v = cfg && cfg.perplexity;
      if (typeof v === 'string' && v.length > 0) return v;
    }
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
  try {
    return await response.json();
  } catch {
    const err = new Error('Invalid JSON response');
    err.code = 'INVALID_JSON';
    throw err;
  }
}

/**
 * Search API — POST https://api.perplexity.ai/search.
 * Returns `{ available: true, query, count, results: [{title,url,snippet,date,last_updated}] }`
 * or `{ available: false, failure: { kind, status, message }, reason | error }`.
 */
async function search(query, options, ctx) {
  const apiKey = resolveApiKey(ctx && ctx.cwd);
  if (!apiKey) {
    return unavailable('NO_KEY', 'PERPLEXITY_API_KEY not set', null);
  }
  if (typeof query !== 'string' || query.trim() === '') {
    return unavailable('BAD_ARGS', 'Query required', null);
  }
  const body = { query };
  if (options && options.maxResults != null) {
    if (!Number.isInteger(options.maxResults) || options.maxResults < 1) {
      return unavailable('BAD_ARGS', 'maxResults requires a positive integer', null);
    }
    body.max_results = options.maxResults;
  }
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
      title: sanitizeValue(r.title || '', apiKey),
      url: sanitizeValue(r.url || '', apiKey),
      snippet: sanitizeValue(r.snippet || '', apiKey),
      date: sanitizeValue(r.date || null, apiKey),
      last_updated: sanitizeValue(r.last_updated || null, apiKey),
    })) : [];
    return {
      available: true,
      query,
      count: results.length,
      results,
    };
  } catch (err) {
    return unavailableFromError(err, apiKey);
  }
}

/**
 * Agent API — POST https://api.perplexity.ai/v1/agent.
 * Returns `{ available: true, id, output, raw }` on success, or
 * `{ available: false, failure: { kind, status, message }, reason | error }`.
 *
 * `model` and `preset` are mutually exclusive on the wire. `model` wins when
 * both are provided; otherwise `preset` defaults to `pro-search`.
 */
async function agent(input, options, ctx) {
  const apiKey = resolveApiKey(ctx && ctx.cwd);
  if (!apiKey) {
    return unavailable('NO_KEY', 'PERPLEXITY_API_KEY not set', null);
  }
  if (typeof input !== 'string' || input.trim() === '') {
    return unavailable('BAD_ARGS', 'Input required', null);
  }
  const body = { input };
  if (options && options.model) body.model = options.model;
  else body.preset = (options && options.preset) || 'pro-search';
  if (options && options.tools) body.tools = options.tools;

  try {
    const data = await perplexityFetch(AGENT_URL, body, {
      apiKey,
      fetchImpl: ctx && ctx.fetchImpl,
    });
    const output = data && data.output !== undefined
      ? data.output
      : data && data.output_text !== undefined
        ? data.output_text
        : data && data.response !== undefined
          ? data.response
          : null;
    return {
      available: true,
      id: (data && data.id) || null,
      output: sanitizeValue(output, apiKey),
      raw: sanitizeValue(data, apiKey),
    };
  } catch (err) {
    return unavailableFromError(err, apiKey);
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
