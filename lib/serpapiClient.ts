import type { SearchResult } from './types.js';

const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';

export class SerpApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function serpapiSearch(query: string, num: number = 20): Promise<SearchResult[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new SerpApiError('SERPAPI_KEY is not set in the server environment', 500);

  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    num: String(num),
    gl: 'us',
    hl: 'en',
    api_key: key,
  });
  const url = `${SERPAPI_ENDPOINT}?${params.toString()}`;

  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    throw new SerpApiError(`SerpAPI auth failed (${res.status}): ${body.slice(0, 300)}`, res.status);
  }
  if (res.status === 429) {
    const body = await res.text().catch(() => '');
    throw new SerpApiError(`SerpAPI rate limited (429): ${body.slice(0, 300)}`, 429);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new SerpApiError(`SerpAPI returned ${res.status}: ${body.slice(0, 300)}`, res.status);
  }

  const body = await res.json();

  // SerpAPI returns 200 with an `error` field for some failure modes
  // (quota exceeded, bad query, etc.) — surface those as errors too.
  if (body?.error) {
    throw new SerpApiError(`SerpAPI error: ${String(body.error).slice(0, 300)}`, 500);
  }

  const items = Array.isArray(body?.organic_results) ? body.organic_results : [];
  return items.map((it: any) => ({
    url: it.link || '',
    title: it.title || '',
    snippet: it.snippet || '',
    position: typeof it.position === 'number' ? it.position : undefined,
  }));
}
