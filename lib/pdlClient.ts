export class PdlError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function searchPdl(esQuery: object): Promise<any[]> {
  const apiKey = process.env.PDL_API_KEY;
  if (!apiKey) throw new PdlError('PDL_API_KEY is not set in the server environment', 500);

  const res = await fetch('https://api.peopledatalabs.com/v5/person/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(esQuery),
  });

  if (res.status === 404) return [];
  if (res.status === 401) throw new PdlError('PDL rejected the API key (401)', 401);
  if (res.status === 429) throw new PdlError('PDL rate limited (429) — retry in a few seconds', 429);
  if (res.status >= 500) throw new PdlError(`PDL server error (${res.status})`, 502);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new PdlError(`PDL returned ${res.status}: ${body.slice(0, 300)}`, res.status);
  }

  const body = await res.json();
  return Array.isArray(body?.data) ? body.data : [];
}
