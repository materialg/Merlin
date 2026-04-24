import { GoogleGenAI, Type } from '@google/genai';
import type { ExtractedJD } from './types.js';

async function callWithRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 800): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err || '');
      const retryable =
        msg.includes('UNAVAILABLE') ||
        msg.includes('"code":503') ||
        msg.includes('"code":429') ||
        err?.status === 503 ||
        err?.status === 429;
      if (!retryable || i === attempts - 1) throw err;
      const delay = baseDelayMs * Math.pow(2, i);
      console.warn(`[gemini] retryable error (${msg.slice(0, 80)}); waiting ${delay}ms before retry ${i + 2}/${attempts}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export type GeminiExtractArgs = {
  jd_base64?: string;
  jd_mime?: string;
  context?: string;
};

const SYSTEM_INSTRUCTION = `You extract search signals from a Job Description for a Google dork pipeline that searches LinkedIn, GitHub, and X.

Output strict JSON matching this schema exactly — no other fields:

{
  "keyword_clusters": string[][],
  "location_terms": string[],
  "disqualifier_terms": string[]
}

RULES — follow all of them:

1. NO titles. Never emit job titles ("Systems Engineer", "SWE", "Recruiter") as search terms.
2. NO companies. Never invent or infer employer names. Only include a company if it is named verbatim in the JD or the user context, and even then prefer skills/tools over company names.
3. NO seniority as targets. Words like "Senior", "Staff", "Principal", "Lead" go in disqualifier_terms only when the JD explicitly rules them out.
4. keyword_clusters: for each skill/tool/technology mentioned in the JD, output a cluster of 2–6 functionally interchangeable terms a recruiter would treat as substitutes. Use your own knowledge of the landscape — MDM vendors (Jamf / Mosyle / Kandji / Addigy / Workspace ONE / Intune), EDR tools (CrowdStrike / SentinelOne / Jamf Protect / Sophos), identity providers (Entra / Azure AD / Okta / OneLogin / JumpCloud), cloud platforms, CI systems, etc. Include the canonical name plus common shorthands ("macOS" + "Mac", "Kubernetes" + "k8s"). Do not include the skill's parent category as a term ("MDM", "EDR", "SSO") — those match too broadly.
5. location_terms: include the full place name, common abbreviations, and the metro-area phrasing. Example for Los Angeles: ["Los Angeles", "LA", "Greater Los Angeles"]. For New York: ["New York", "NYC", "Greater New York"]. Empty array if the JD does not specify a location.
6. disqualifier_terms: single words or short phrases that, when present on a candidate's profile, mean they're the wrong person. Typical disqualifiers: management titles the role excludes ("Manager", "Director", "VP"), adjacent-but-wrong roles ("recruiter", "sales"), explicitly-excluded seniority. Empty array if the JD does not exclude anything.
7. If the JD does not specify something, leave the corresponding field empty. Do not fill gaps with assumptions, synonyms of the company name, or guesses about the hiring company's peer set.
8. Prefer recall over precision — recruiters will narrow by hand.

Return only the JSON object. No prose.`;

export async function geminiExtractJd(args: GeminiExtractArgs): Promise<ExtractedJD> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in the server environment');
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  if (args.jd_base64 && args.jd_mime) {
    parts.push({ inlineData: { data: args.jd_base64, mimeType: args.jd_mime } });
  }
  if (args.context && args.context.trim()) {
    parts.push({ text: `Additional context from the user: ${args.context.trim()}` });
  }
  if (parts.length === 0) throw new Error('No JD or context provided to Gemini extract');
  parts.push({ text: 'Extract the signals as JSON.' });

  const response = await callWithRetry(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          keyword_clusters: {
            type: Type.ARRAY,
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          location_terms: { type: Type.ARRAY, items: { type: Type.STRING } },
          disqualifier_terms: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['keyword_clusters', 'location_terms', 'disqualifier_terms'],
      },
    },
  } as any));

  const text = (response as any).text as string;
  let parsed: ExtractedJD;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : text) as ExtractedJD;
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text?.slice(0, 300)}`);
  }

  // Defensive cleanup — strip empties, dedupe, trim.
  const cleanList = (xs: unknown): string[] =>
    Array.isArray(xs)
      ? Array.from(new Set(xs.map(x => String(x).trim()).filter(Boolean)))
      : [];

  return {
    keyword_clusters: Array.isArray(parsed.keyword_clusters)
      ? parsed.keyword_clusters
          .map(cluster => cleanList(cluster))
          .filter(cluster => cluster.length > 0)
      : [],
    location_terms: cleanList(parsed.location_terms),
    disqualifier_terms: cleanList(parsed.disqualifier_terms),
  };
}
