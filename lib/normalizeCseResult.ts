import type { NormalizedCandidate, CseResult } from './types.js';

export function normalizeLinkedinUrl(raw: string): string {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '').replace(/^[a-z]{2,3}\.linkedin\.com$/i, 'linkedin.com');
    if (!/linkedin\.com$/i.test(host)) return '';
    const m = u.pathname.match(/^\/in\/([^\/]+)/i);
    if (!m) return '';
    const slug = decodeURIComponent(m[1]).toLowerCase();
    return `https://${host}/in/${slug}`;
  } catch {
    return '';
  }
}

function parseTitleLine(title: string): { name: string; role: string; company: string } {
  if (!title) return { name: '', role: '', company: '' };

  // Drop the " | LinkedIn" / " - LinkedIn" / " · LinkedIn" suffix variants
  const stripped = title
    .replace(/\s*[\|·]\s*LinkedIn.*$/i, '')
    .replace(/\s+[-–—]\s+LinkedIn.*$/i, '')
    .trim();

  const parts = stripped.split(/\s+[-–—]\s+/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return { name: '', role: '', company: '' };

  const name = parts[0];
  let role = '';
  let company = '';

  if (parts.length === 2) {
    const rest = parts[1];
    const atMatch = rest.match(/^(.*?)\s+(?:at|@)\s+(.+)$/i);
    if (atMatch) {
      role = atMatch[1].trim();
      company = atMatch[2].trim();
    } else {
      role = rest;
    }
  } else if (parts.length >= 3) {
    role = parts[1];
    company = parts.slice(2).join(' - ');
  }

  return { name, role, company };
}

export function normalizeCseResult(
  item: CseResult,
  sessionId: string,
  idx: number
): NormalizedCandidate | null {
  const url = normalizeLinkedinUrl(item.url);
  if (!url) return null;

  const { name, role, company } = parseTitleLine(item.title);
  if (!name) return null;

  const impactParts = [role, company ? `@ ${company}` : ''].filter(Boolean);

  return {
    id: `${sessionId}-${idx}-${Date.now()}`,
    name,
    title: role,
    company,
    bio: item.snippet || '',
    location: '',
    education: '',
    educationHistory: [],
    platform: 'linkedin',
    url,
    score: 0,
    scoringBreakdown: { techMatch: 0, contributionMatch: 0, seniorityMatch: 0, educationMatch: 0 },
    reasoning: '',
    impactSummary: impactParts.join(' · '),
    socialLinks: [{ platform: 'linkedin', url }],
  };
}
