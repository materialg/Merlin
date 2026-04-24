import type { NormalizedCandidate, ExtractedJD } from './types';

const norm = (s: string) => s.toLowerCase().trim();
const contains = (haystack: string, needle: string) =>
  !!needle && norm(haystack).includes(norm(needle));

/**
 * Score a CSE-derived candidate against the extracted JD.
 *
 * Field semantics in this PR (without PDL enrichment):
 *   techMatch        (/40) - skill overlap in title + snippet
 *   contributionMatch (/30) - parsed current company vs JD companies
 *   seniorityMatch   (/20) - seniority keyword in title/snippet
 *   educationMatch   (/10) - placeholder for tenure; 0 until PDL enrich lands
 *
 * Field names are kept for UI compatibility; labels in the card UI may
 * later be renamed once the PDL enrichment path goes live.
 */
export function scoreCandidate(c: NormalizedCandidate, jd: ExtractedJD): NormalizedCandidate {
  const searchable = `${c.title} ${c.company} ${c.bio}`;

  // techMatch: fraction of JD skills found anywhere in title + company + bio
  const skills = jd.skills || [];
  const matchedSkillCount = skills.filter(s => contains(searchable, s)).length;
  const techMatch = skills.length === 0
    ? 0
    : Math.min(40, Math.round((matchedSkillCount / skills.length) * 40));

  // contributionMatch: parsed current-company match
  const companies = jd.companies || [];
  let contributionMatch = 0;
  if (c.company && companies.length > 0) {
    const hit = companies.some(jc =>
      contains(c.company, jc) || contains(jc, c.company)
    );
    if (hit) contributionMatch = 30;
  }

  // seniorityMatch: any JD seniority keyword appears in title or bio
  const seniorities = jd.seniority || [];
  const titleBio = `${c.title} ${c.bio}`;
  const seniorityHit = seniorities.some(s => contains(titleBio, s));
  const seniorityMatch = seniorityHit ? 20 : 0;

  // educationMatch: repurposed for tenure, unavailable without PDL enrich
  const educationMatch = 0;

  const score = techMatch + contributionMatch + seniorityMatch + educationMatch;

  return {
    ...c,
    score,
    scoringBreakdown: { techMatch, contributionMatch, seniorityMatch, educationMatch },
  };
}
