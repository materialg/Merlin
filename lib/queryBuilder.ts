import type { ExtractedJD } from './types';

const SITE = 'site:linkedin.com/in/';

function quote(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return '';
  return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
}

function join(parts: string[]): string {
  return [SITE, ...parts.filter(Boolean)].join(' ').trim();
}

export function buildXrayQueries(jd: ExtractedJD): string[] {
  const titles = (jd.titles || []).slice(0, 3);
  const skills = (jd.skills || []).slice(0, 4);
  const companies = (jd.companies || []).slice(0, 3);
  const seniority = (jd.seniority || [])[0] || '';

  const queries: string[] = [];

  // Q1: primary title + top 2 skills
  if (titles[0] && skills.length >= 1) {
    queries.push(join([quote(titles[0]), ...skills.slice(0, 2).map(quote)]));
  }

  // Q2: primary title + top company
  if (titles[0] && companies[0]) {
    queries.push(join([quote(titles[0]), quote(companies[0])]));
  }

  // Q3: secondary title + top 2 skills
  if (titles[1] && skills.length >= 1) {
    queries.push(join([quote(titles[1]), ...skills.slice(0, 2).map(quote)]));
  }

  // Q4: seniority + primary title
  if (seniority && titles[0]) {
    queries.push(join([quote(seniority), quote(titles[0])]));
  }

  // Q5: multi-skill OR
  if (skills.length >= 2) {
    const orSkills = skills.slice(0, 4).map(quote).filter(Boolean).join(' OR ');
    if (orSkills) queries.push(`${SITE} (${orSkills})`);
  }

  // Fallbacks to guarantee 5 when the JD is thin
  if (queries.length < 5 && titles[0]) {
    queries.push(join([quote(titles[0])]));
  }
  if (queries.length < 5 && skills[0]) {
    queries.push(join([quote(skills[0]), quote(skills[1] || '')]));
  }

  return Array.from(new Set(queries)).slice(0, 5);
}
