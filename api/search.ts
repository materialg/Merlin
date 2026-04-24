import { geminiExtractJd } from '../lib/geminiExtractJd.js';
import { buildXrayQueries } from '../lib/queryBuilder.js';
import { serpapiSearch, SerpApiError } from '../lib/serpapiClient.js';
import { normalizeSearchResult } from '../lib/normalizeSearchResult.js';
import { scoreCandidate } from '../lib/scorer.js';
import type {
  IssuedQuery,
  NormalizedCandidate,
  QueryDebug,
  SearchResult,
  SitePlatform,
} from '../lib/types.js';

type Body = {
  jd_base64?: string;
  jd_mime?: string;
  context?: string;
  sessionId?: string;
};

const MAX_CANDIDATES = 40;
const RESULTS_PER_QUERY = 20;

type DedupeTrace = {
  nameKey: string;
  mergedFrom: { platform: SitePlatform; url: string; rank: number }[];
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

    console.log('[api/search] extracting JD signals...');
    const extractedJd = await geminiExtractJd({ jd_base64, jd_mime, context });
    console.log('[api/search] extracted:', {
      clusters: extractedJd.keyword_clusters.length,
      locations: extractedJd.location_terms.length,
    });

    const queries: IssuedQuery[] = buildXrayQueries(extractedJd);
    console.log(`[api/search] built ${queries.length} X-ray queries:`);
    for (const q of queries) console.log('  ›', q.platform, q.q);

    console.log(`[api/search] running ${queries.length} SerpAPI queries in parallel (${RESULTS_PER_QUERY} results each)...`);
    const searchResponses = await Promise.allSettled(
      queries.map(q => serpapiSearch(q.q, RESULTS_PER_QUERY))
    );

    const queryDebug: QueryDebug[] = [];
    const perQueryResults: { query: IssuedQuery; items: SearchResult[] }[] = [];
    for (const [i, r] of searchResponses.entries()) {
      const q = queries[i];
      if (r.status === 'fulfilled') {
        queryDebug.push({
          platform: q.platform,
          domain: q.domain,
          q: q.q,
          status: 'ok',
          resultCount: r.value.length,
          rawItemSample: r.value[0],
        });
        perQueryResults.push({ query: q, items: r.value });
        console.log(`[api/search] ✓ ${q.platform}: ${r.value.length} hits`);
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        queryDebug.push({
          platform: q.platform,
          domain: q.domain,
          q: q.q,
          status: 'error',
          resultCount: 0,
          error: msg,
        });
        perQueryResults.push({ query: q, items: [] });
        console.warn(`[api/search] ✗ ${q.platform} query failed:`, msg);
      }
    }

    // Merge across sites: dedupe by normalized name, unioning per-site URLs
    // and ranks. Order of arrival doesn't matter — we keep the candidate's
    // first-seen id and merge the rest.
    const byNameKey = new Map<string, NormalizedCandidate>();
    const dedupeTrace: DedupeTrace[] = [];

    let totalRawItems = 0;
    let totalNormalized = 0;

    for (const { query, items } of perQueryResults) {
      totalRawItems += items.length;
      for (let i = 0; i < items.length; i++) {
        // Prefer SerpAPI's reported position; fall back to array index + 1.
        const rank = typeof items[i].position === 'number' ? items[i].position! : i + 1;
        const hit = normalizeSearchResult(items[i], query.platform, rank, sessionId || 'tmp', i);
        if (!hit) continue;
        totalNormalized++;

        const existing = byNameKey.get(hit.nameKey);
        if (!existing) {
          byNameKey.set(hit.nameKey, hit.candidate);
          dedupeTrace.push({
            nameKey: hit.nameKey,
            mergedFrom: [{ platform: query.platform, url: hit.candidate.url, rank }],
          });
          continue;
        }

        const existingLinks = existing.socialLinks || [];
        const hasLink = existingLinks.some(l => l.url === hit.candidate.url);
        const mergedLinks = hasLink
          ? existingLinks
          : [...existingLinks, { platform: query.platform, url: hit.candidate.url }];

        const mergedRanks = { ...(existing.ranksBySite || {}) };
        const prevRank = mergedRanks[query.platform];
        mergedRanks[query.platform] = prevRank ? Math.min(prevRank, rank) : rank;

        const matchedSites = Array.from(
          new Set([...(existing.matchedSites || []), query.platform])
        );

        const preferLonger = (a: string, b: string) => (b && b.length > a.length ? b : a);
        const merged: NormalizedCandidate = {
          ...existing,
          title: preferLonger(existing.title, hit.candidate.title),
          company: preferLonger(existing.company, hit.candidate.company),
          bio: preferLonger(existing.bio, hit.candidate.bio),
          impactSummary: preferLonger(existing.impactSummary, hit.candidate.impactSummary),
          socialLinks: mergedLinks,
          ranksBySite: mergedRanks,
          matchedSites,
        };
        byNameKey.set(hit.nameKey, merged);

        const traceEntry = dedupeTrace.find(d => d.nameKey === hit.nameKey);
        if (traceEntry) {
          traceEntry.mergedFrom.push({
            platform: query.platform,
            url: hit.candidate.url,
            rank,
          });
        }
      }
    }

    console.log(
      `[api/search] merged: ${totalNormalized} normalized hits → ${byNameKey.size} unique candidates`
    );
    const multiSiteCount = Array.from(byNameKey.values()).filter(
      c => (c.matchedSites?.length || 0) >= 2
    ).length;
    console.log(`[api/search] ${multiSiteCount} candidates found on 2+ sites`);

    const scored = Array.from(byNameKey.values())
      .map(c => scoreCandidate(c))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CANDIDATES);

    console.log(`[api/search] final: ${scored.length} scored candidates (cap ${MAX_CANDIDATES})`);

    const dedupeSummary = dedupeTrace
      .filter(d => d.mergedFrom.length > 1)
      .map(d => ({
        nameKey: d.nameKey,
        sites: d.mergedFrom.map(m => `${m.platform}@${m.rank}`),
      }));

    // Firestore does not allow nested arrays (string[][]). Wrap each cluster
    // in an object so it is persisted as array-of-objects-containing-arrays,
    // which is allowed. The UI reads this wrapped shape directly.
    const wireJd = {
      ...extractedJd,
      keyword_clusters: extractedJd.keyword_clusters.map(terms => ({ terms })),
    };

    const debugInfo = {
      pipeline: 'serpapi',
      extractedJd: wireJd,
      queries,
      queryDebug,
      totalRawItems,
      totalNormalized,
      uniqueCandidates: byNameKey.size,
      multiSiteCandidates: multiSiteCount,
      finalCandidateCount: scored.length,
      mergedAcrossSites: dedupeSummary,
    };

    return res.status(200).json({
      querySpec: wireJd,
      esQuery: { pipeline: 'serpapi', queries },
      candidates: scored,
      debug: debugInfo,
    });
  } catch (err: any) {
    console.error('[api/search] failed:', err);
    if (err instanceof SerpApiError) {
      return res
        .status(err.status >= 400 && err.status < 600 ? err.status : 500)
        .json({ error: err.message });
    }
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
