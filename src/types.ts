export interface SocialActivity {
  platform: string;
  content: string;
  date?: string;
  url?: string;
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
  avatar?: string;
  location?: string;
  education?: string;
  socialLinks?: { platform: string; url: string }[];
  recentActivity?: SocialActivity[];
  scoringBreakdown?: {
    techMatch: number;
    contributionMatch: number;
    seniorityMatch: number;
    educationMatch: number;
  };
}

export interface SearchSession {
  id: string;
  title: string;
  prompt: string;
  timestamp: string;
  plan: string;
  sources: string[];
  candidates: Candidate[];
  status: 'idle' | 'searching' | 'completed' | 'error';
  attachments: { name: string; type: string; url?: string }[];
  urls: string[];
}
