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

The query builder ANDs every cluster together into a single dork per site, so every extra cluster you emit narrows the search. Zero results is the failure mode we are fighting. When in doubt, emit FEWER clusters.

Output strict JSON matching this schema exactly — no other fields:

{
  "keyword_clusters": string[][],
  "location_terms": string[],
  "disqualifier_terms": string[]
}

HARD RULES:

1. NO titles. Never emit job titles as search terms.
2. NO companies. Never invent or infer employer names.
3. NO seniority as targets. Seniority words only go in disqualifier_terms, and only when the JD explicitly excludes them.
4. DO NOT EXPAND CATEGORY WORDS. The JD saying "security", "networking", "DevOps", "cloud", "infrastructure", "observability", etc. is NOT permission to emit clusters of specific vendors in that category. Only emit a cluster when the JD names at least ONE specific tool, product, or concrete skill in that category. If the JD just says "security" with no named tool, emit zero security-related clusters.
5. keyword_clusters: for each SPECIFIC skill or tool named in the JD, emit a cluster of 2–6 functionally interchangeable substitutes a recruiter would accept. Use your knowledge of the landscape (MDM vendors, EDR tools, identity providers, etc.) but only to expand a named tool, never to expand a category word. Include the canonical name plus common shorthands ("macOS" + "Mac", "Kubernetes" + "k8s"). Do not include the parent category as a term ("MDM", "EDR", "SSO") — it matches too broadly.
6. TARGET 1–5 CLUSTERS. If the JD is thin or vague, emit fewer (even 1 or 0 is acceptable). Never pad to reach a minimum. Ten clusters of 6 terms AND'd together return zero candidates.
7. location_terms: include only the place(s) the JD actually names, plus common abbreviations and the metro-area phrasing. Do NOT enumerate neighborhoods or sub-cities unless the JD names them. Example for "Los Angeles": ["Los Angeles", "LA", "Greater Los Angeles"] — NOT Santa Monica, Beverly Hills, Culver City. Empty array if the JD names no location.
8. disqualifier_terms: only include terms the JD EXPLICITLY excludes ("this is an IC role, not a manager" → add Manager/Director/VP; "no recruiters" → add recruiter). Default to empty. Do not invent disqualifiers like "Intern" or "Junior" unless the JD rules them out.
9. If the JD does not specify something, leave the field empty. Do not fill gaps with assumptions or the hiring company's inferred peer set.

FEW-SHOT EXAMPLES:

JD: "System engineer with macOS, Jamf, and CrowdStrike experience. Based in LA."
{
  "keyword_clusters": [
    ["macOS", "Mac"],
    ["Jamf", "Mosyle", "Kandji", "Addigy"],
    ["CrowdStrike", "SentinelOne", "Jamf Protect"]
  ],
  "location_terms": ["Los Angeles", "LA", "Greater Los Angeles"],
  "disqualifier_terms": []
}

JD: "Systems engineer with experience in mac environments, networking, and security. Los Angeles."
// "mac environments" → macOS cluster; "networking" and "security" are category words with no named tool — SKIP them entirely. Do not invent CrowdStrike, Fortinet, Okta, etc.
{
  "keyword_clusters": [
    ["macOS", "Mac"]
  ],
  "location_terms": ["Los Angeles", "LA", "Greater Los Angeles"],
  "disqualifier_terms": []
}

JD: "Senior IC SRE with Kubernetes, Terraform, and Datadog. No managers."
// "Senior" and "IC" are signals — "Senior" is a target we ignore (rule 3), the IC-only constraint becomes Manager/Director disqualifiers.
{
  "keyword_clusters": [
    ["Kubernetes", "k8s"],
    ["Terraform", "OpenTofu"],
    ["Datadog", "New Relic", "Splunk"]
  ],
  "location_terms": [],
  "disqualifier_terms": ["Manager", "Director", "VP"]
}

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
