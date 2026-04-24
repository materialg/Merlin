import type { CseResult } from './types.js';

const CSE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

export class CseError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function searchCSE(query: string, num: number = 10): Promise<CseResult[]> {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key) throw new CseError('GOOGLE_CSE_API_KEY is not set in the server environment', 500);
  if (!cx) throw new CseError('GOOGLE_CSE_ID is not set in the server environment', 500);

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: String(Math.max(1, Math.min(num, 10))),
  });
  const url = `${CSE_ENDPOINT}?${params.toString()}`;

  const res = await fetch(url);
  if (res.status === 429) throw new CseError('CSE rate limited (429) — retry in a moment', 429);
  if (res.status === 403) {
    const body = await res.text().catch(() => '');
    throw new CseError(`CSE quota exceeded or key invalid (403): ${body.slice(0, 300)}`, 403);
  }
  if (res.status === 400) {
    const body = await res.text().catch(() => '');
    throw new CseError(`CSE bad request (400): ${body.slice(0, 300)}`, 400);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new CseError(`CSE returned ${res.status}: ${body.slice(0, 300)}`, res.status);
  }

  const body = await res.json();
  const items = Array.isArray(body?.items) ? body.items : [];
  return items.map((it: any) => ({
    url: it.link || '',
    title: it.title || '',
    snippet: it.snippet || '',
    pagemap: it.pagemap,
  }));
}
