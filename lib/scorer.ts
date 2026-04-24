import type { NormalizedCandidate, SitePlatform } from './types.js';

// Placeholder scorer — rank-based until the real Gemini semantic scorer
// lands. Victor's spec:
//   base = linear decay over SerpAPI position
//     rank 1  → 100
//     rank 20 → 5
//     rank >20 tapers linearly to 0 (slope -5)
//   multiplier = { 1: 1.0, 2: 1.3, 3: 1.5 } keyed by distinct sites matched
//   final = round(clamp(0..100, base * multiplier))
// For multi-site candidates we take the best (lowest) rank across sites,
// since appearing well-ranked on any site is strong signal.

const SITE_MULTIPLIER: Record<number, number> = { 1: 1.0, 2: 1.3, 3: 1.5 };

export function rankToBaseScore(rank: number): number {
  if (rank <= 0) return 0;
  // Solve y = 100 - 5(x - 1): y(1)=100, y(20)=5, slope -5 per rank.
  return Math.max(0, 100 - 5 * (rank - 1));
}

export function siteMultiplier(siteCount: number): number {
  return SITE_MULTIPLIER[siteCount] ?? 1.0;
}

export function scoreCandidate(c: NormalizedCandidate): NormalizedCandidate {
  const ranks = Object.values(c.ranksBySite || {}).filter((r): r is number => typeof r === 'number' && r > 0);
  const matchedSiteCount = ranks.length;
  if (matchedSiteCount === 0) {
    return { ...c, score: 0, scoringBreakdown: { techMatch: 0, contributionMatch: 0, seniorityMatch: 0, educationMatch: 0 } };
  }
  const bestRank = Math.min(...ranks);
  const base = rankToBaseScore(bestRank);
  const mult = siteMultiplier(matchedSiteCount);
  const final = Math.max(0, Math.min(100, Math.round(base * mult)));
  return {
    ...c,
    score: final,
    // Sub-scores deprecated under the search pipeline — kept at 0 for
    // type compatibility. UI shows the unified `score` only.
    scoringBreakdown: { techMatch: 0, contributionMatch: 0, seniorityMatch: 0, educationMatch: 0 },
  };
}

export type MergeSummary = {
  candidates: NormalizedCandidate[];
  dedupeDecisions: {
    nameKey: string;
    mergedFrom: { platform: SitePlatform; url: string; rank: number }[];
  }[];
};
