import { geminiJdToQuerySpec } from '../lib/geminiQuerySpec';
import { buildPdlQuery } from '../lib/pdlQueryBuilder';
import { searchPdl, PdlError } from '../lib/pdlClient';
import { normalizePdlPerson } from '../lib/normalizeCandidate';

type Body = {
  jd_base64?: string;
  jd_mime?: string;
  context?: string;
  sessionId?: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body: Body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { jd_base64, jd_mime, context, sessionId } = body;

    if (!jd_base64 && !(context && context.trim())) {
      return res.status(400).json({ error: 'jd_base64 (with jd_mime) or context is required' });
    }

    const querySpec = await geminiJdToQuerySpec({ jd_base64, jd_mime, context });
    const esQuery = buildPdlQuery(querySpec);
    const pdlResults = await searchPdl(esQuery);
    const candidates = pdlResults
      .map((p, i) => normalizePdlPerson(p, sessionId || 'tmp', i))
      .filter(c => c.url && c.url.includes('linkedin.com'));

    const debugInfo = {
      pdlTotalReturned: pdlResults.length,
      pdlWithLinkedin: pdlResults.filter(p => p?.linkedin_url && String(p.linkedin_url).includes('linkedin.com')).length,
      pdlWithoutLinkedin: pdlResults.filter(p => !p?.linkedin_url || !String(p.linkedin_url).includes('linkedin.com')).length,
      candidatesAfterFilter: candidates.length,
      sampleRawPerson: pdlResults[0] ?? null,
    };

    return res.status(200).json({ querySpec, esQuery, candidates, debug: debugInfo });
  } catch (err: any) {
    console.error('[api/search] failed:', err);
    if (err instanceof PdlError) {
      return res.status(err.status >= 400 && err.status < 600 ? err.status : 500).json({ error: err.message });
    }
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
