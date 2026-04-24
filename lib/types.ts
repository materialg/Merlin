export type SitePlatform = 'linkedin' | 'github' | 'x';

// What Gemini extracts from the JD. No titles, companies, or seniority as
// targets — see geminiExtractJd.ts for the rationale.
export type ExtractedJD = {
  keyword_clusters: string[][];
  location_terms: string[];
};

export type CseResult = {
  url: string;
  title: string;
  snippet: string;
  pagemap?: any;
};

// A single issued Google CSE query, tagged with its target site so we can
// rebuild per-site ranks after merging.
export type IssuedQuery = {
  platform: SitePlatform;
  domain: string;
  q: string;
};

// Per-query debug record persisted to the search session so the UI can
// inspect exactly what came back from each dork.
export type QueryDebug = {
  platform: SitePlatform;
  domain: string;
  q: string;
  status: 'ok' | 'error';
  resultCount: number;
  error?: string;
  rawItemSample?: CseResult;
};

export type DedupeDecision = {
  nameKey: string;
  mergedFrom: { platform: SitePlatform; url: string; rank: number }[];
};

export type NormalizedCandidate = {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  location: string;
  education: string;
  educationHistory: { school: string; degree: string; field: string; year: string }[];
  platform: SitePlatform | 'arxiv' | 'huggingface' | 'other';
  url: string;
  email?: string;
  phone?: string;
  score: number;
  scoringBreakdown: { techMatch: number; contributionMatch: number; seniorityMatch: number; educationMatch: number };
  reasoning: string;
  impactSummary: string;
  socialLinks: { platform: string; url: string }[];
  // Per-site CSE rank (1-based). Missing entries mean the candidate was
  // absent from that site's results.
  ranksBySite?: Partial<Record<SitePlatform, number>>;
  matchedSites?: SitePlatform[];
};
