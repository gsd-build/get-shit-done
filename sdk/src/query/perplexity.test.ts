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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { perplexitySearch, perplexityAgent, integrationHeader } from './perplexity.js';

// Sandbox HOME / USERPROFILE so a real `~/.gsd/perplexity_api_key` on the
// developer or CI machine cannot accidentally satisfy a no-key test.
// `os.homedir()` consults HOME on POSIX and USERPROFILE on Windows.
let sandboxedHome: string;
let projectDir: string;
let prevHome: string | undefined;
let prevUserProfile: string | undefined;

beforeEach(() => {
  sandboxedHome = mkdtempSync(join(tmpdir(), 'pplx-test-home-'));
  projectDir = mkdtempSync(join(tmpdir(), 'pplx-test-project-'));
  prevHome = process.env.HOME;
  prevUserProfile = process.env.USERPROFILE;
  process.env.HOME = sandboxedHome;
  process.env.USERPROFILE = sandboxedHome;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.PERPLEXITY_API_KEY;
  if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = prevUserProfile;
  try { rmSync(sandboxedHome, { recursive: true, force: true }); } catch { /* best-effort */ }
  try { rmSync(projectDir, { recursive: true, force: true }); } catch { /* best-effort */ }
});

describe('integrationHeader', () => {
  it('uses the get-shit-done/<version> slug + version shape', () => {
    expect(integrationHeader()).toMatch(/^get-shit-done\/[^\s]+$/);
  });
});

describe('perplexitySearch — no-key fallback', () => {
  it('returns available:false when PERPLEXITY_API_KEY is not set', async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const r = await perplexitySearch(['hello'], projectDir);
    const data = r.data;
    expect(data.available).toBe(false);
    if (data.available) throw new Error('expected unavailable result');
    expect(data.failure.kind).toBe('NO_KEY');
    expect(data.failure.status).toBeNull();
    expect(data.reason).toBe('PERPLEXITY_API_KEY not set');
  });

  it('returns error when query is missing', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-x';
    const r = await perplexitySearch([], projectDir);
    const data = r.data;
    expect(data.available).toBe(false);
    if (data.available) throw new Error('expected unavailable result');
    expect(data.failure.kind).toBe('BAD_ARGS');
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

    const r = await perplexitySearch(['typescript generics', '--limit', '5', '--recency', 'week'], projectDir);
    const data = r.data;
    expect(data.available).toBe(true);
    if (!data.available) throw new Error('expected available result');
    expect(data.count).toBe(2);
    expect(data.results[0].title).toBe('A');
    expect(data.results[0].date).toBe('2026-05-10');
    expect(data.results[1].date).toBeNull();

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
    const r = await perplexitySearch(['rate limited'], projectDir);
    const data = r.data;
    expect(data.available).toBe(false);
    if (data.available) throw new Error('expected unavailable result');
    expect(data.failure).toEqual({
      kind: 'API_ERROR',
      status: 429,
      message: 'API error: 429',
    });
    expect(data.error).toBe('API error: 429');
  });

  it('returns available:false on network failure', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-net';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await perplexitySearch(['network fail'], projectDir);
    const data = r.data;
    expect(data.available).toBe(false);
    if (data.available) throw new Error('expected unavailable result');
    expect(data.failure.kind).toBe('NETWORK');
    expect(data.failure.status).toBeNull();
    expect(data.error).toBe('ECONNREFUSED');
  });

  it('returns available:false on invalid JSON parse failure', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-json';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    } as unknown as Response);
    const r = await perplexitySearch(['parse fail'], projectDir);
    const data = r.data;
    expect(data.available).toBe(false);
    if (data.available) throw new Error('expected unavailable result');
    expect(data.failure.kind).toBe('PARSE');
    expect(data.error).toBe('Invalid JSON response');
  });

  it('redacts Perplexity key markers from thrown provider errors', async () => {
    const marker = 'pplx-test-marker-xxxx';
    process.env.PERPLEXITY_API_KEY = marker;
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error(`boom https://api.perplexity.ai/search Bearer ${marker}`),
    );
    const r = await perplexitySearch(['secret fail'], projectDir);
    const data = r.data;
    expect(data.available).toBe(false);
    if (data.available) throw new Error('expected unavailable result');
    expect(data.failure.kind).toBe('NETWORK');
    expect(data.failure.message).not.toContain(marker);
    expect(JSON.stringify(data)).not.toContain(marker);
  });
});

describe('perplexityAgent — no-key fallback', () => {
  it('returns available:false when PERPLEXITY_API_KEY is not set', async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const r = await perplexityAgent(['hello'], projectDir);
    const data = r.data;
    expect(data.available).toBe(false);
    if (data.available) throw new Error('expected unavailable result');
    expect(data.failure.kind).toBe('NO_KEY');
    expect(data.reason).toBe('PERPLEXITY_API_KEY not set');
  });

  it('returns error when input is missing', async () => {
    process.env.PERPLEXITY_API_KEY = 'pplx-x';
    const r = await perplexityAgent([], projectDir);
    const data = r.data;
    expect(data.available).toBe(false);
    if (data.available) throw new Error('expected unavailable result');
    expect(data.failure.kind).toBe('BAD_ARGS');
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

    const r = await perplexityAgent(['Find recent context on …'], projectDir);
    const data = r.data;
    expect(data.available).toBe(true);
    if (!data.available) throw new Error('expected available result');
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

  it.each([
    { name: '--model only', args: ['hi', '--model', 'sonar-pro'], expectedBody: { input: 'hi', model: 'sonar-pro' } },
    {
      name: '--model X --preset Y',
      args: ['hi', '--model', 'sonar-pro', '--preset', 'sonar-deep-research'],
      expectedBody: { input: 'hi', model: 'sonar-pro' },
    },
  ])('sends explicit model instead of preset for $name', async ({ args, expectedBody }) => {
    process.env.PERPLEXITY_API_KEY = 'pplx-agent-model';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ag_2', output_text: 'ok' }),
    } as Response);

    await perplexityAgent(args, projectDir);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual(expectedBody);
  });

  it('redacts Perplexity key markers from successful provider raw bodies', async () => {
    const marker = 'pplx-test-marker-yyyy';
    process.env.PERPLEXITY_API_KEY = marker;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ag_secret', output_text: 'ok', debug: `echo ${marker}` }),
    } as Response);

    const r = await perplexityAgent(['hi'], projectDir);
    const data = r.data;
    expect(data.available).toBe(true);
    expect(JSON.stringify(data)).not.toContain(marker);
  });
});
