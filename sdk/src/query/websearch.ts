/**
 * Web search query handler — Brave Search API integration.
 *
 * Provides web search for researcher agents. Returns { available: false }
 * gracefully when BRAVE_API_KEY is missing so agents can fall back to
 * built-in WebSearch tools.
 *
 * @example
 * ```typescript
 * import { websearch } from './websearch.js';
 *
 * await websearch(['typescript generics'], '/project');
 * // { data: { available: true, query: 'typescript generics', count: 10, results: [...] } }
 * ```
 */

import type { QueryHandler } from './utils.js';

/**
 * Search the web via Brave Search API.
 * Requires BRAVE_API_KEY env var.
 *
 * Args: query [--limit N] [--freshness day|week|month]
 */
export const websearch: QueryHandler = async (args) => {
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    return { data: { available: false, reason: 'BRAVE_API_KEY not set' } };
  }

  const query = args[0];
  if (!query) {
    return { data: { available: false, error: 'Query required' } };
  }

  const limitIdx = args.indexOf('--limit');
  const freshnessIdx = args.indexOf('--freshness');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10;
  const freshness = freshnessIdx !== -1 ? args[freshnessIdx + 1] : null;

  const params = new URLSearchParams({
    q: query,
    count: String(limit),
    country: 'us',
    search_lang: 'en',
    text_decorations: 'false',
  });
  if (freshness) params.set('freshness', freshness);

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey,
        },
      },
    );

    if (!response.ok) {
      return { data: { available: false, error: `API error: ${response.status}` } };
    }

    const body = await response.json() as {
      web?: { results?: Array<{ title: string; url: string; description: string; age?: string }> };
    };

    const results = (body.web?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age || null,
    }));

    return { data: { available: true, query, count: results.length, results } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: { available: false, error: msg } };
  }
};
