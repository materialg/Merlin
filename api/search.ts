import { geminiExtractJd } from '../lib/geminiExtractJd.js';
import { buildXrayQueries } from '../lib/queryBuilder.js';
import { searchCSE, CseError } from '../lib/cseClient.js';
import { normalizeCseResult, normalizeLinkedinUrl } from '../lib/normalizeCseResult.js';
import { scoreCandidate } from '../lib/scorer.js';
import type { CseResult } from '../lib/types.js';

type Body = {
  jd_base64?: string;
  jd_mime?: string;
  context?: string;
  sessionId?: string;
};

const MAX_CSE_QUERIES = 5;
const MAX_CANDIDATES = 20;

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

    console.log('[api/search] extracting JD signals...');
    const extractedJd = await geminiExtractJd({ jd_base64, jd_mime, context });
    console.log('[api/search] extracted:', {
      titles: extractedJd.titles.length,
      skills: extractedJd.skills.length,
      companies: extractedJd.companies.length,
      seniority: extractedJd.seniority,
    });

    const queries = buildXrayQueries(extractedJd).slice(0, MAX_CSE_QUERIES);
    console.log(`[api/search] built ${queries.length} X-ray queries`);
    for (const q of queries) console.log('  ›', q);

    console.log(`[api/search] running ${queries.length} CSE queries in parallel (10 results each)...`);
    const cseResponses = await Promise.allSettled(queries.map(q => searchCSE(q, 10)));

    const allResults: CseResult[] = [];
    let cseSuccesses = 0;
    let cseFailures = 0;
    const cseErrors: string[] = [];
    for (const [i, r] of cseResponses.entries()) {
      if (r.status === 'fulfilled') {
        cseSuccesses++;
        allResults.push(...r.value);
      } else {
        cseFailures++;
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        cseErrors.push(`q${i + 1}: ${msg}`);
        console.warn(`[api/search] CSE query ${i + 1} failed:`, msg);
      }
    }
    console.log(`[api/search] CSE: ${cseSuccesses} ok, ${cseFailures} failed, ${allResults.length} total items`);

    const linkedinResults = allResults.filter(it => /linkedin\.com\/in\//i.test(it.url));
    console.log(`[api/search] LinkedIn filter: ${linkedinResults.length} of ${allResults.length}`);

    // Dedupe by normalized LinkedIn URL, preserving CSE result order (= rank)
    const seen = new Set<string>();
    const unique: CseResult[] = [];
    for (const it of linkedinResults) {
      const key = normalizeLinkedinUrl(it.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(it);
    }
    console.log(`[api/search] unique after dedupe: ${unique.length}`);

    const capped = unique.slice(0, MAX_CANDIDATES);
    console.log(`[api/search] capped at ${MAX_CANDIDATES}: ${capped.length} kept`);

    const candidates = capped
      .map((it, i) => normalizeCseResult(it, sessionId || 'tmp', i))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map(c => scoreCandidate(c, extractedJd));

    candidates.sort((a, b) => b.score - a.score);
    console.log(`[api/search] final: ${candidates.length} scored candidates`);

    const debugInfo = {
      pipeline: 'cse',
      extractedJd,
      queries,
      cseSuccesses,
      cseFailures,
      cseErrors,
      cseRawItemCount: allResults.length,
      cseLinkedinUrlCount: linkedinResults.length,
      cseUniqueUrlCount: unique.length,
      cseAfterCap: capped.length,
      finalCandidateCount: candidates.length,
      sampleCseItem: capped[0] ?? null,
    };

    return res.status(200).json({
      // Kept for UI compatibility — querySpec/esQuery card renders these as-is
      querySpec: extractedJd,
      esQuery: { pipeline: 'cse', queries },
      candidates,
      debug: debugInfo,
    });
  } catch (err: any) {
    console.error('[api/search] failed:', err);
    if (err instanceof CseError) {
      return res.status(err.status >= 400 && err.status < 600 ? err.status : 500).json({ error: err.message });
    }
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
