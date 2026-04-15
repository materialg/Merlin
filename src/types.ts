export interface SocialActivity {
  platform: string;
  content: string;
  date?: string;
  url?: string;
}

export interface Education {
  school: string;
  degree?: string;
  field?: string;
  year?: string;
}

export interface Candidate {
  id: string;
  name: string;
  title: string;
  bio: string;
  platform: 'github' | 'arxiv' | 'huggingface' | 'linkedin' | 'other';
  url: string;
  score: number;
  reasoning: string;
  impactSummary: string;
  company?: string;
  email?: string;
  avatar?: string;
  location?: string;
  education?: string;
  anchorProfileUrl?: string;
  educationHistory?: Education[];
  socialLinks?: { platform: string; url: string }[];
  recentActivity?: SocialActivity[];
  scoringBreakdown?: {
    techMatch: number;
    contributionMatch: number;
    seniorityMatch: number;
    educationMatch: number;
  };
}

export type ViewMode = 'classic' | 'list';
export type NavTab = 'search' | 'contacts' | 'projects';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  candidateIds: string[];
}

export interface Contact extends Candidate {
  addedAt: string;
  tags?: string[];
  projects?: string[];
}

export interface SearchSession {
  id: string;
  title: string;
  prompt: string;
  timestamp: string;
  plan: string;
  sources: string[];
  fingerprint?: any;
  candidates: Candidate[];
  status: 'idle' | 'searching' | 'completed' | 'error';
  attachments: { name: string; type: string; url?: string }[];
  urls: string[];
  companyLink?: string;
  shortlistedIds?: string[];
  rejectedIds?: string[];
  sourcedCandidates?: Candidate[];
  isShortlistLocked?: boolean;
  sourcingStatus?: 'idle' | 'sourcing' | 'completed' | 'error';
  feedbackMap?: Record<string, string>;
}
