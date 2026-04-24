import type { NormalizedCandidate, SitePlatform } from './types.js';

// Placeholder scorer — rank-based until the real Gemini semantic scorer
// lands. Victor's spec:
//   base = piecewise-linear decay over CSE rank
//     rank 1  → 100
//     rank 10 → 50
//     rank 25 → 4
//     rank >25 tapers linearly to 0
//   multiplier = { 1: 1.0, 2: 1.3, 3: 1.5 } keyed by distinct sites matched
//   final = round(clamp(0..100, base * multiplier))
// For multi-site candidates we take the best (lowest) rank across sites,
// since appearing well-ranked on any site is strong signal.

const SITE_MULTIPLIER: Record<number, number> = { 1: 1.0, 2: 1.3, 3: 1.5 };

export function rankToBaseScore(rank: number): number {
  if (rank <= 0) return 0;
  if (rank <= 10) {
    // 1 → 100, 10 → 50.
    return 100 - ((100 - 50) / (10 - 1)) * (rank - 1);
  }
  if (rank <= 25) {
    // 10 → 50, 25 → 4.
    return 50 - ((50 - 4) / (25 - 10)) * (rank - 10);
  }
  // 25 → 4 tapering to 0 over the next 20 ranks.
  return Math.max(0, 4 - (rank - 25) * 0.2);
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
    // Sub-scores deprecated under the CSE pipeline — kept at 0 for type
    // compatibility. UI shows the unified `score` only.
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
