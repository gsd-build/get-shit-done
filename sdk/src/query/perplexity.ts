/**
 * Perplexity query handlers — Search API and Agent API.
 *
 * Provides two query commands:
 *   - `perplexity-search` — POST https://api.perplexity.ai/search
 *   - `perplexity-agent`  — POST https://api.perplexity.ai/v1/agent
 *
 * Both degrade gracefully with `{ available: false }` when
 * `PERPLEXITY_API_KEY` is not configured. The attribution header
 * `X-Pplx-Integration: get-shit-done/<package-version>` is sent on every
 * outgoing call from `perplexityFetch`.
 *
 * Docs: https://docs.perplexity.ai
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QueryHandler } from './utils.js';

export const SEARCH_URL = 'https://api.perplexity.ai/search';
export const AGENT_URL = 'https://api.perplexity.ai/v1/agent';

/**
 * `X-Pplx-Integration` header value. Slug is fixed for this integration; the
 * version is read from the repo's package.json so older installs are
 * distinguishable in provider-side telemetry.
 */
export function integrationHeader(): string {
  let version = 'unknown';
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // Two layouts: src/ (dev) and dist/ (built). Walk up until package.json found.
    const candidates = [
      pathResolve(here, '..', '..', '..', 'package.json'),
      pathResolve(here, '..', '..', 'package.json'),
      pathResolve(here, '..', 'package.json'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf-8'));
        if (pkg && typeof pkg.version === 'string' && pkg.version) {
          version = pkg.version;
          break;
        }
      }
    }
  } catch { /* unknown is fine — header still goes out */ }
  return `get-shit-done/${version}`;
}

function readKeyFile(filePath: string): string | null {
  try {
    const buf = readFileSync(filePath);
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.toString('utf16le').replace(/^﻿/, '').trim();
    }
    return buf.toString('utf-8').replace(/^﻿/, '').trim();
  } catch {
    return null;
  }
}

export function resolveApiKey(cwd?: string): string | null {
  if (process.env.PERPLEXITY_API_KEY) return process.env.PERPLEXITY_API_KEY;
  const homeKey = join(homedir(), '.gsd', 'perplexity_api_key');
  const fromHome = readKeyFile(homeKey);
  if (fromHome) return fromHome;
  if (cwd) {
    try {
      const cfgPath = join(cwd, '.planning', 'config.json');
      if (existsSync(cfgPath)) {
        const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8')) as { perplexity?: unknown };
        if (typeof cfg.perplexity === 'string' && cfg.perplexity.length > 0) {
          return cfg.perplexity;
        }
      }
    } catch { /* malformed config treated as no-key */ }
  }
  return null;
}

interface PerplexityFetchOpts {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export async function perplexityFetch<T = unknown>(
  url: string,
  body: Record<string, unknown>,
  opts: PerplexityFetchOpts,
): Promise<T> {
  const { apiKey, fetchImpl } = opts;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not set');
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
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  date: string | null;
  last_updated: string | null;
}

interface SearchResponse {
  id?: string;
  results?: Array<{ title?: string; url?: string; snippet?: string; date?: string; last_updated?: string }>;
}

/**
 * Perplexity Search API handler.
 * Args: <query> [--limit N] [--recency hour|day|week|month|year]
 */
export const perplexitySearch: QueryHandler = async (args, cwd) => {
  const apiKey = resolveApiKey(cwd);
  if (!apiKey) {
    return { data: { available: false, reason: 'PERPLEXITY_API_KEY not set' } };
  }
  const query = args[0];
  if (!query) {
    return { data: { available: false, error: 'Query required' } };
  }
  const limitIdx = args.indexOf('--limit');
  const recencyIdx = args.indexOf('--recency');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10;
  const recency = recencyIdx !== -1 ? args[recencyIdx + 1] : null;

  const body: Record<string, unknown> = { query, max_results: limit };
  if (recency) body.search_recency_filter = recency;

  try {
    const data = await perplexityFetch<SearchResponse>(SEARCH_URL, body, { apiKey });
    const rawResults = Array.isArray(data.results) ? data.results : [];
    const results: SearchResultItem[] = rawResults.map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.snippet || '',
      date: r.date || null,
      last_updated: r.last_updated || null,
    }));
    return { data: { available: true, query, count: results.length, results } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: { available: false, error: msg } };
  }
};

interface AgentResponse {
  id?: string;
  output?: unknown;
  output_text?: string;
  response?: unknown;
}

/**
 * Perplexity Agent API handler.
 * Args: <input> [--preset pro-search] [--model <id>]
 *
 * Defaults `preset` to `pro-search` when neither `--preset` nor `--model`
 * is provided — that's the documented first-class research-agent surface.
 */
export const perplexityAgent: QueryHandler = async (args, cwd) => {
  const apiKey = resolveApiKey(cwd);
  if (!apiKey) {
    return { data: { available: false, reason: 'PERPLEXITY_API_KEY not set' } };
  }
  const input = args[0];
  if (!input) {
    return { data: { available: false, error: 'Input required' } };
  }
  const presetIdx = args.indexOf('--preset');
  const modelIdx = args.indexOf('--model');
  const preset = presetIdx !== -1 ? args[presetIdx + 1] : null;
  const model = modelIdx !== -1 ? args[modelIdx + 1] : null;

  const body: Record<string, unknown> = { input };
  if (model) body.model = model;
  else body.preset = preset || 'pro-search';

  try {
    const data = await perplexityFetch<AgentResponse>(AGENT_URL, body, { apiKey });
    return {
      data: {
        available: true,
        id: data.id || null,
        output: data.output || data.output_text || data.response || null,
        raw: data,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: { available: false, error: msg } };
  }
};
