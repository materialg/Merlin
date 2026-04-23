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
    const candidates = pdlResults.map((p, i) => normalizePdlPerson(p, sessionId || 'tmp', i));

    return res.status(200).json({ querySpec, esQuery, candidates });
  } catch (err: any) {
    console.error('[api/search] failed:', err);
    if (err instanceof PdlError) {
      return res.status(err.status >= 400 && err.status < 600 ? err.status : 500).json({ error: err.message });
    }
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
