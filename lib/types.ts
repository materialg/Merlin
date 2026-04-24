export type ExtractedJD = {
  title?: string;
  titles: string[];
  skills: string[];
  companies: string[];
  seniority: string[];
  location?: string;
};

export type CseResult = {
  url: string;
  title: string;
  snippet: string;
  pagemap?: any;
};

export type QuerySpec = {
  title?: string;
  skill_clusters: string[][];
  job_title_roles?: string[];
  job_title_sub_roles: string[];
  job_title_levels?: string[];
  years_experience_min?: number;
  location?: {
    postal_code?: string;
    radius_miles?: number;
    region?: string;
  };
  disqualifiers?: {
    levels?: string[];
  };
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
  platform: 'linkedin' | 'github' | 'arxiv' | 'huggingface' | 'x' | 'other';
  url: string;
  email?: string;
  phone?: string;
  score: number;
  scoringBreakdown: { techMatch: number; contributionMatch: number; seniorityMatch: number; educationMatch: number };
  reasoning: string;
  impactSummary: string;
  socialLinks: { platform: string; url: string }[];
};
