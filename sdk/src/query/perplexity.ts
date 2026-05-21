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

import { readFileSync, existsSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, parse, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QueryHandler } from './utils.js';

export const SEARCH_URL = 'https://api.perplexity.ai/search';
export const AGENT_URL = 'https://api.perplexity.ai/v1/agent';
const PACKAGE_NAME = 'get-shit-done-cc';
const REDACTED = '[redacted]';

export type PerplexityFailureKind = 'NO_KEY' | 'API_ERROR' | 'NETWORK' | 'PARSE' | 'BAD_ARGS';

export interface PerplexityFailure {
  kind: PerplexityFailureKind;
  status: number | null;
  message: string;
}

interface PerplexityUnavailable {
  available: false;
  failure: PerplexityFailure;
  reason?: string;
  error?: string;
}

interface PerplexitySearchAvailable {
  available: true;
  query: string;
  count: number;
  results: SearchResultItem[];
}

interface PerplexityAgentAvailable {
  available: true;
  id: string | null;
  output: unknown;
  raw: unknown;
}

export type PerplexitySearchResult = PerplexitySearchAvailable | PerplexityUnavailable;
export type PerplexityAgentResult = PerplexityAgentAvailable | PerplexityUnavailable;

interface PerplexityError extends Error {
  code?: 'NO_KEY' | 'API_ERROR' | 'INVALID_JSON';
  status?: number;
}

function warn(message: string): void {
  writeSync(2, `[perplexity] ${message}\n`);
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sanitizeMessage(message: unknown, apiKey?: string | null): string {
  let sanitized = String(message);
  if (apiKey) {
    sanitized = sanitized.split(apiKey).join(REDACTED);
  }
  return sanitized
    .replace(/Bearer\s+[^ \t\r\n]+/g, `Bearer ${REDACTED}`)
    .replace(/\bpplx-[A-Za-z0-9._-]+/g, REDACTED);
}

function sanitizeValue(value: unknown, apiKey?: string | null): unknown {
  if (typeof value === 'string') return sanitizeMessage(value, apiKey);
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item, apiKey));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitizeValue(item, apiKey)]),
  );
}

function unavailable(kind: PerplexityFailureKind, message: string, status: number | null = null): PerplexityUnavailable {
  const failure = { kind, status, message };
  if (kind === 'NO_KEY') return { available: false, failure, reason: message };
  return { available: false, failure, error: message };
}

function classifyFailure(err: unknown, apiKey?: string | null): PerplexityFailure {
  const e = err as PerplexityError;
  const message = sanitizeMessage(formatError(err), apiKey);
  if (e.code === 'NO_KEY') return { kind: 'NO_KEY', status: null, message };
  if (e.code === 'API_ERROR') return { kind: 'API_ERROR', status: e.status ?? null, message };
  if (e.code === 'INVALID_JSON') return { kind: 'PARSE', status: null, message };
  return { kind: 'NETWORK', status: null, message };
}

function unavailableFromError(err: unknown, apiKey?: string | null): PerplexityUnavailable {
  const failure = classifyFailure(err, apiKey);
  if (failure.kind === 'NO_KEY') return { available: false, failure, reason: failure.message };
  return { available: false, failure, error: failure.message };
}

function readPackageVersion(startDir: string): string | null {
  let dir = pathResolve(startDir);
  const root = parse(dir).root;
  let fallbackVersion: string | null = null;
  while (true) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      const text = readFileSync(candidate, 'utf-8');
      let pkg: { name?: unknown; version?: unknown };
      try {
        pkg = JSON.parse(text) as { name?: unknown; version?: unknown };
      } catch (err: unknown) {
        throw new Error(`Failed to parse ${candidate}: ${formatError(err)}`);
      }
      if (typeof pkg.version === 'string' && pkg.version) {
        if (pkg.name === PACKAGE_NAME) return pkg.version;
        fallbackVersion = fallbackVersion || pkg.version;
      }
    }
    if (dir === root) break;
    dir = dirname(dir);
  }
  return fallbackVersion;
}

/**
 * `X-Pplx-Integration` header value. Slug is fixed for this integration; the
 * version is read from the repo's package.json so older installs are
 * distinguishable in provider-side telemetry.
 */
export function integrationHeader(): string {
  let version = 'unknown';
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const found = readPackageVersion(here);
    if (found) version = found;
    else warn('falling back to unknown integration version: package.json version not found');
  } catch (err: unknown) {
    warn(`falling back to unknown integration version: ${formatError(err)}`);
  }
  return `get-shit-done/${version}`;
}

function readKeyFile(filePath: string): string | null {
  try {
    const buf = readFileSync(filePath);
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.toString('utf16le').replace(/^\uFEFF/, '').trim();
    }
    return buf.toString('utf-8').replace(/^\uFEFF/, '').trim();
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: unknown }).code : null;
    if (code !== 'ENOENT') {
      warn(`could not read key file ${filePath}: ${formatError(err)}`);
    }
    return null;
  }
}

export function resolveApiKey(cwd?: string): string | null {
  if (process.env.PERPLEXITY_API_KEY) return process.env.PERPLEXITY_API_KEY;
  const homeKey = join(homedir(), '.gsd', 'perplexity_api_key');
  const fromHome = readKeyFile(homeKey);
  if (fromHome) return fromHome;
  if (cwd) {
    const cfgPath = join(cwd, '.planning', 'config.json');
    if (existsSync(cfgPath)) {
      const text = readFileSync(cfgPath, 'utf-8');
      let cfg: { perplexity?: unknown };
      try {
        cfg = JSON.parse(text) as { perplexity?: unknown };
      } catch (err: unknown) {
        warn(`could not parse ${cfgPath}: ${formatError(err)}`);
        return null;
      }
      if (typeof cfg.perplexity === 'string' && cfg.perplexity.length > 0) {
        return cfg.perplexity;
      }
    }
  }
  return null;
}

interface PerplexityFetchOpts {
  apiKey: string | null;
  fetchImpl?: typeof fetch;
}

/**
 * Central Perplexity transport. Adds Authorization and X-Pplx-Integration,
 * returns parsed JSON, and throws on missing key, transport/non-2xx, or
 * invalid JSON. Thrown errors carry `.code` for NO_KEY, API_ERROR, and
 * INVALID_JSON; API_ERROR also attaches `.status`.
 */
export async function perplexityFetch<T = unknown>(
  url: string,
  body: Record<string, unknown>,
  opts: PerplexityFetchOpts,
): Promise<T> {
  const { apiKey, fetchImpl } = opts;
  if (!apiKey) {
    const err = new Error('PERPLEXITY_API_KEY not set') as PerplexityError;
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
    const err = new Error(`API error: ${response.status}`) as PerplexityError;
    err.code = 'API_ERROR';
    err.status = response.status;
    throw err;
  }
  try {
    return await response.json() as T;
  } catch {
    const err = new Error('Invalid JSON response') as PerplexityError;
    err.code = 'INVALID_JSON';
    throw err;
  }
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
export const perplexitySearch: QueryHandler<PerplexitySearchResult> = async (args, cwd) => {
  const apiKey = resolveApiKey(cwd);
  if (!apiKey) {
    return { data: unavailable('NO_KEY', 'PERPLEXITY_API_KEY not set') };
  }
  const query = args[0];
  if (typeof query !== 'string' || query.trim() === '') {
    return { data: unavailable('BAD_ARGS', 'Query required') };
  }
  const limitIdx = args.indexOf('--limit');
  const recencyIdx = args.indexOf('--recency');
  const limitValue = limitIdx !== -1 ? args[limitIdx + 1] : null;
  const limit = limitIdx !== -1 ? Number(limitValue) : 10;
  if (limitIdx !== -1 && (!limitValue || limitValue.startsWith('--') || !Number.isInteger(limit) || limit < 1)) {
    return { data: unavailable('BAD_ARGS', '--limit requires a positive integer') };
  }
  const recency = recencyIdx !== -1 ? args[recencyIdx + 1] : null;

  const body: Record<string, unknown> = { query, max_results: limit };
  if (recency) body.search_recency_filter = recency;

  try {
    const data = await perplexityFetch<SearchResponse>(SEARCH_URL, body, { apiKey });
    const rawResults = Array.isArray(data.results) ? data.results : [];
    const results: SearchResultItem[] = rawResults.map(r => ({
      title: sanitizeValue(r.title || '', apiKey) as string,
      url: sanitizeValue(r.url || '', apiKey) as string,
      snippet: sanitizeValue(r.snippet || '', apiKey) as string,
      date: sanitizeValue(r.date || null, apiKey) as string | null,
      last_updated: sanitizeValue(r.last_updated || null, apiKey) as string | null,
    }));
    return { data: { available: true, query, count: results.length, results } };
  } catch (err: unknown) {
    return { data: unavailableFromError(err, apiKey) };
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
 * `model` and `preset` are mutually exclusive on the wire. `model` wins when
 * both are provided; otherwise `preset` defaults to `pro-search`.
 */
export const perplexityAgent: QueryHandler<PerplexityAgentResult> = async (args, cwd) => {
  const apiKey = resolveApiKey(cwd);
  if (!apiKey) {
    return { data: unavailable('NO_KEY', 'PERPLEXITY_API_KEY not set') };
  }
  const input = args[0];
  if (typeof input !== 'string' || input.trim() === '') {
    return { data: unavailable('BAD_ARGS', 'Input required') };
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
    const output = data.output !== undefined
      ? data.output
      : data.output_text !== undefined
        ? data.output_text
        : data.response !== undefined
          ? data.response
          : null;
    return {
      data: {
        available: true,
        id: data.id || null,
        output: sanitizeValue(output, apiKey),
        raw: sanitizeValue(data, apiKey),
      },
    };
  } catch (err: unknown) {
    return { data: unavailableFromError(err, apiKey) };
  }
};
