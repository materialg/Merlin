import type { NormalizedCandidate } from './types';

function inferDegreeCategory(raw: string): string {
  if (!raw) return '';
  const r = raw.toLowerCase();
  if (r.includes('phd') || r.includes('doctor') || r.includes('doctorate')) return 'PhD';
  if (r.includes('master') || r.includes('msc') || r.includes('mba') || r.startsWith('ms ') || r === 'ms') return 'MS';
  if (r.includes('bachelor') || r.includes('bsc') || r.startsWith('bs ') || r === 'bs' || r.includes('ba ')) return 'BS';
  return raw;
}

function normalizeUrl(raw: string): string {
  if (!raw) return '';
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function normalizePdlPerson(p: any, sessionId: string, idx: number): NormalizedCandidate {
  const url = normalizeUrl(p.linkedin_url || '');

  // Placeholder scoring until the real Gemini scorer is built.
  // PDL's `likelihood` is a 0–10 confidence on match quality; rough but better than hardcoded 0.
  const score = typeof p.likelihood === 'number' ? Math.round(p.likelihood * 10) : 0;

  const educationHistory = Array.isArray(p.education)
    ? p.education
        .map((e: any) => ({
          school: e?.school?.name || '',
          degree: inferDegreeCategory(Array.isArray(e?.degrees) ? e.degrees[0] || '' : ''),
          field: Array.isArray(e?.majors) ? e.majors[0] || '' : '',
          year: e?.end_date ? String(e.end_date).slice(0, 4) : '',
        }))
        .filter((e: any) => e.school)
    : [];

  const primaryEdu = educationHistory[0]?.school || '';

  const yearsExp = typeof p.inferred_years_experience === 'number' ? `${p.inferred_years_experience}y exp` : '';
  const impactParts = [
    p.job_title || '',
    p.job_company_name ? `@ ${p.job_company_name}` : '',
    yearsExp,
  ].filter(Boolean);

  const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '';

  const location = p.location_name
    || [p.location_locality, p.location_region, p.location_country].filter(Boolean).join(', ');

  return {
    id: `${sessionId}-${idx}-${Date.now()}`,
    name,
    title: p.job_title || '',
    company: p.job_company_name || '',
    bio: p.summary || p.headline || '',
    location: location || '',
    education: primaryEdu,
    educationHistory,
    platform: 'linkedin',
    url,
    score,
    scoringBreakdown: { techMatch: 0, contributionMatch: 0, seniorityMatch: 0, educationMatch: 0 },
    reasoning: '',
    impactSummary: impactParts.join(' · '),
    socialLinks: url ? [{ platform: 'linkedin', url }] : [],
  };
}
