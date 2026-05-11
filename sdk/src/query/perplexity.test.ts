/**
 * Tests for Perplexity Search + Agent handlers.
 *
 * Covers:
 *  - graceful fallback when PERPLEXITY_API_KEY is absent (no network)
 *  - Search API request body / response mapping
 *  - Agent API request body / response mapping (pro-search preset default)
 *  - X-Pplx-Integration attribution header on outgoing calls
 *  - argument parsing (--limit / --recency / --preset / --model)
 *  - non-2xx + network failure surfaces as available:false
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { perplexitySearch, perplexityAgent, integrationHeader } from './perplexity.js';

const tmpDir = '/tmp';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.PERPLEXITY_API_KEY;
});

describe('integrationHeader', () => {
  it('uses the get-shit-done/<version> slug + version shape', () => {
    expect(integrationHeader()).toMatch(/^get-shit-done\/[^\s]+$/);
  });
});

describe('perplexitySearch — no-key fallback', () => {
  it('returns available:false when PERPLEXITY_API_KEY is not set', async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const r = await perplexitySearch(['hello'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.reason).toBe('PERPLEXITY_API_KEY not set');
  });

  it('returns error when query is missing', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-x';
    const r = await perplexitySearch([], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.error).toBe('Query required');
  });
});

describe('perplexitySearch — successful API call', () => {
  it('returns mapped results and sends X-Pplx-Integration header', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-success-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'req_42',
        results: [
          { title: 'A', url: 'https://a', snippet: 'sa', date: '2026-05-10' },
          { title: 'B', url: 'https://b', snippet: 'sb' },
        ],
      }),
    } as Response);

    const r = await perplexitySearch(['typescript generics', '--limit', '5', '--recency', 'week'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.available).toBe(true);
    expect(data.count).toBe(2);
    const results = data.results as Array<Record<string, unknown>>;
    expect(results[0].title).toBe('A');
    expect(results[0].date).toBe('2026-05-10');
    expect(results[1].date).toBeNull();

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.perplexity.ai/search');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer pplx-success-key');
    expect(headers['X-Pplx-Integration']).toMatch(/^get-shit-done\//);
    const body = JSON.parse(init.body as string);
    expect(body.query).toBe('typescript generics');
    expect(body.max_results).toBe(5);
    expect(body.search_recency_filter).toBe('week');
  });
});

describe('perplexitySearch — error paths', () => {
  it('returns available:false on non-ok response', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-429';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 429 } as Response);
    const r = await perplexitySearch(['rate limited'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.error).toBe('API error: 429');
  });

  it('returns available:false on network failure', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-net';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await perplexitySearch(['network fail'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.error).toBe('ECONNREFUSED');
  });
});

describe('perplexityAgent — no-key fallback', () => {
  it('returns available:false when PERPLEXITY_API_KEY is not set', async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const r = await perplexityAgent(['hello'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.reason).toBe('PERPLEXITY_API_KEY not set');
  });

  it('returns error when input is missing', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-x';
    const r = await perplexityAgent([], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.error).toBe('Input required');
  });
});

describe('perplexityAgent — request shape', () => {
  it('defaults to pro-search preset and sends X-Pplx-Integration', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-agent-default';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ag_1', output: 'synthesized' }),
    } as Response);

    const r = await perplexityAgent(['Find recent context on …'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.available).toBe(true);
    expect(data.output).toBe('synthesized');

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.perplexity.ai/v1/agent');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Pplx-Integration']).toMatch(/^get-shit-done\//);
    expect(headers.Authorization).toBe('Bearer pplx-agent-default');
    const body = JSON.parse(init.body as string);
    expect(body.input).toBe('Find recent context on …');
    expect(body.preset).toBe('pro-search');
    expect(body.model).toBeUndefined();
  });

  it('sends explicit model when --model is provided (and no preset)', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-agent-model';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ag_2', output_text: 'ok' }),
    } as Response);

    await perplexityAgent(['hi', '--model', 'sonar-pro'], tmpDir);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('sonar-pro');
    expect(body.preset).toBeUndefined();
  });
});
