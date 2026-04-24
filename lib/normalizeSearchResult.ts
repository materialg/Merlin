import type { SearchResult, NormalizedCandidate, SitePlatform } from './types.js';

const SITE_SUFFIXES: Record<SitePlatform, RegExp[]> = {
  linkedin: [
    /\s*[\|·]\s*LinkedIn.*$/i,
    /\s+[-–—]\s+LinkedIn.*$/i,
  ],
  github: [
    /\s*[\|·]\s*GitHub.*$/i,
    /\s+[-–—]\s+GitHub.*$/i,
  ],
  x: [
    /\s*\/\s*X.*$/i,            // "... / X"
    /\s+on\s+X[:\s].*$/i,        // "Name on X: tweet..."
    /\s*[\|·]\s*X.*$/i,
    /\s*\/\s*Twitter.*$/i,       // legacy
    /\s+on\s+Twitter[:\s].*$/i,
  ],
};

export function detectPlatform(url: string): SitePlatform | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (/linkedin\.com$/.test(host) || /^[a-z]{2,3}\.linkedin\.com$/.test(host)) return 'linkedin';
    if (/(?:^|\.)github\.com$/.test(host)) return 'github';
    if (/(?:^|\.)(?:x|twitter)\.com$/.test(host)) return 'x';
    return null;
  } catch {
    return null;
  }
}

export function normalizeCanonicalUrl(raw: string): string {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    const platform = detectPlatform(raw);
    if (platform === 'linkedin') {
      const canonicalHost = host.replace(/^[a-z]{2,3}\.linkedin\.com$/i, 'linkedin.com');
      const m = u.pathname.match(/^\/in\/([^\/]+)/i);
      if (!m) return '';
      const slug = decodeURIComponent(m[1]).toLowerCase();
      return `https://${canonicalHost}/in/${slug}`;
    }
    if (platform === 'github') {
      const seg = u.pathname.split('/').filter(Boolean)[0];
      if (!seg) return '';
      if (/^(orgs|topics|search|about|pricing|features|marketplace|explore|events|collections|trending|enterprise|readme)$/i.test(seg)) return '';
      return `https://github.com/${seg.toLowerCase()}`;
    }
    if (platform === 'x') {
      const seg = u.pathname.split('/').filter(Boolean)[0];
      if (!seg) return '';
      if (/^(home|explore|notifications|messages|search|i|compose|settings|tos|privacy|about)$/i.test(seg)) return '';
      return `https://x.com/${seg.toLowerCase()}`;
    }
    return '';
  } catch {
    return '';
  }
}

// Kept for existing callers that only care about LinkedIn URLs.
export function normalizeLinkedinUrl(raw: string): string {
  return detectPlatform(raw) === 'linkedin' ? normalizeCanonicalUrl(raw) : '';
}

function stripSiteSuffix(title: string, platform: SitePlatform): string {
  let t = title;
  for (const re of SITE_SUFFIXES[platform]) t = t.replace(re, '');
  return t.trim();
}

function looksLikePersonName(s: string): boolean {
  if (!s) return false;
  if (/[_/@#]/.test(s)) return false;
  if (s.length > 60) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;
  return words.some(w => /^[A-ZÀ-Ÿ]/.test(w));
}

function parseLinkedinTitle(title: string): { name: string; role: string; company: string } {
  const stripped = stripSiteSuffix(title, 'linkedin');
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

function parseGithubTitle(title: string, url: string): { name: string; handle: string } {
  const stripped = stripSiteSuffix(title, 'github');
  const parenMatch = stripped.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const left = parenMatch[1].trim();
    const right = parenMatch[2].trim().replace(/^@/, '');
    if (looksLikePersonName(left)) return { name: left, handle: right };
    if (looksLikePersonName(right)) return { name: right, handle: left };
  }
  const dotSplit = stripped.split(/\s+·\s+/).map(s => s.trim()).filter(Boolean);
  if (dotSplit.length >= 2 && looksLikePersonName(dotSplit[0])) {
    return { name: dotSplit[0], handle: dotSplit[1] };
  }
  const handle = (() => {
    try { return new URL(url).pathname.split('/').filter(Boolean)[0] || ''; } catch { return ''; }
  })();
  if (looksLikePersonName(stripped)) return { name: stripped, handle };
  return { name: '', handle };
}

function parseXTitle(title: string, url: string): { name: string; handle: string } {
  const stripped = stripSiteSuffix(title, 'x');
  const atMatch = stripped.match(/^(.+?)\s*\(\s*@([A-Za-z0-9_]+)\s*\)\s*$/);
  if (atMatch) return { name: atMatch[1].trim(), handle: atMatch[2] };
  const handleOnly = stripped.match(/^@([A-Za-z0-9_]+)$/);
  if (handleOnly) return { name: '', handle: handleOnly[1] };
  const handle = (() => {
    try { return new URL(url).pathname.split('/').filter(Boolean)[0] || ''; } catch { return ''; }
  })();
  if (looksLikePersonName(stripped)) return { name: stripped, handle };
  return { name: '', handle };
}

// Case-insensitive, diacritic-folded, punctuation-stripped name key used
// for cross-site dedupe. Victor's call: collisions are rare enough to
// accept.
export function normalizeNameKey(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type NormalizedSearchHit = {
  candidate: NormalizedCandidate;
  nameKey: string;
  platform: SitePlatform;
  rank: number; // 1-based within its own site
};

export function normalizeSearchResult(
  item: SearchResult,
  platform: SitePlatform,
  rank: number,
  sessionId: string,
  idx: number
): NormalizedSearchHit | null {
  const url = normalizeCanonicalUrl(item.url);
  if (!url) return null;

  let name = '';
  let title = '';
  let company = '';

  if (platform === 'linkedin') {
    const parsed = parseLinkedinTitle(item.title);
    name = parsed.name;
    title = parsed.role;
    company = parsed.company;
  } else if (platform === 'github') {
    const parsed = parseGithubTitle(item.title, item.url);
    name = parsed.name;
    title = parsed.handle ? `@${parsed.handle}` : '';
  } else if (platform === 'x') {
    const parsed = parseXTitle(item.title, item.url);
    name = parsed.name;
    title = parsed.handle ? `@${parsed.handle}` : '';
  }

  const nameKey = normalizeNameKey(name);
  if (!nameKey) return null;

  const impactParts = [title, company ? `@ ${company}` : ''].filter(Boolean);

  const candidate: NormalizedCandidate = {
    id: `${sessionId}-${platform}-${idx}-${Date.now()}`,
    name,
    title,
    company,
    bio: item.snippet || '',
    location: '',
    education: '',
    educationHistory: [],
    platform,
    url,
    score: 0,
    scoringBreakdown: { techMatch: 0, contributionMatch: 0, seniorityMatch: 0, educationMatch: 0 },
    reasoning: '',
    impactSummary: impactParts.join(' · '),
    socialLinks: [{ platform, url }],
    ranksBySite: { [platform]: rank },
    matchedSites: [platform],
  };

  return { candidate, nameKey, platform, rank };
}
