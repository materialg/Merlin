import type { ExtractedJD, IssuedQuery, SitePlatform } from './types.js';

// One query per site. Shape:
//   site:DOMAIN (clusterA_OR_terms) (clusterB_OR_terms) ... (location_OR_terms)
// Parenthesized groups are implicitly AND-ed; we never emit the literal word
// "AND" (Google treats spaces as AND and can be confused by explicit AND in
// some query templates).

const SITES: { platform: SitePlatform; domain: string }[] = [
  { platform: 'linkedin', domain: 'linkedin.com/in/' },
  { platform: 'github', domain: 'github.com' },
  { platform: 'x', domain: 'x.com' },
];

function quoteIfNeeded(s: string): string {
  const t = s.trim();
  if (!t) return '';
  // Already-quoted phrases pass through untouched.
  if (t.startsWith('"') && t.endsWith('"')) return t;
  // Quote anything with whitespace OR a dash (Google would otherwise treat
  // the dash as a negative operator).
  return /[\s\-]/.test(t) ? `"${t.replace(/"/g, '')}"` : t;
}

function orGroup(terms: string[]): string {
  const cleaned = Array.from(new Set(terms.map(quoteIfNeeded).filter(Boolean)));
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return `(${cleaned[0]})`;
  return `(${cleaned.join(' OR ')})`;
}

export function buildXrayQueries(jd: ExtractedJD): IssuedQuery[] {
  const clusterGroups = (jd.keyword_clusters || [])
    .map(cluster => orGroup(cluster))
    .filter(Boolean);

  const locationGroup = orGroup(jd.location_terms || []);
  // Region group is AND'd against the city group to block profiles that
  // mention the target city incidentally while living elsewhere.
  const regionGroup = orGroup(jd.location_region_terms || []);

  const queries: IssuedQuery[] = [];
  for (const { platform, domain } of SITES) {
    const parts = [
      `site:${domain}`,
      ...clusterGroups,
      locationGroup,
      regionGroup,
    ].filter(Boolean);

    const q = parts.join(' ').replace(/\s+/g, ' ').trim();

    // Skip sites where the query is only the site: operator — that would
    // dump a full directory rather than a filtered search.
    if (q === `site:${domain}`) continue;

    queries.push({ platform, domain, q });
  }

  return queries;
}
