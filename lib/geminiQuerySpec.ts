import { GoogleGenAI, Type } from '@google/genai';
import type { QuerySpec } from './types';
import roles from '../data/pdl/roles.json';
import subRoles from '../data/pdl/sub_roles.json';
import levels from '../data/pdl/levels.json';

const ROLES = roles as string[];
const SUB_ROLES = subRoles as string[];
const LEVELS = levels as string[];

export type GeminiJdArgs = {
  jd_base64?: string;
  jd_mime?: string;
  context?: string;
};

export async function geminiJdToQuerySpec(args: GeminiJdArgs): Promise<QuerySpec> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in the server environment');
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are a recruiting assistant that parses a Job Description into a PDL Person Search query spec.

CANONICAL VOCABULARY — you MUST pick only from these lists. Do not invent values.
- job_title_roles: ${ROLES.join(', ')}
- job_title_sub_roles: ${SUB_ROLES.join(', ')}
- job_title_levels: ${LEVELS.join(', ')}

PHILOSOPHY: recall over precision. Cast wide.
- Skill clusters group interchangeable synonyms/variants (e.g. ["python", "py"] or ["kubernetes", "k8s"]). OR aggressively inside a cluster. Clusters are ANDed across — include 2–4 clusters that all feel essential.
- Pick multiple sub_roles if the JD is ambiguous between them (e.g. a "systems engineer" JD might include software, information_technology, devops).
- Use disqualifiers sparingly — only when the JD explicitly rules someone out (e.g. "individual contributor, not a manager").

LOCATION: if the JD names a ZIP/postal code or specific coordinates, set location.postal_code and location.radius_miles (default 25 if not specified). If the JD only mentions a state/region, set location.region (lowercase, e.g. "california").

TITLE: set a short human-readable title field summarizing the role (e.g. "Senior Systems Engineer — Mac environments").

Output strict JSON matching the schema. Omit optional fields when the JD gives no signal.`;

  const parts: any[] = [];
  if (args.jd_base64 && args.jd_mime) {
    parts.push({ inlineData: { data: args.jd_base64, mimeType: args.jd_mime } });
  }
  if (args.context && args.context.trim()) {
    parts.push({ text: `Additional context from the user: ${args.context.trim()}` });
  }
  if (parts.length === 0) {
    throw new Error('No JD or context provided to Gemini JD parser');
  }
  parts.push({ text: 'Extract the PDL Person Search query spec from the above.' });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts }],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          skill_clusters: {
            type: Type.ARRAY,
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          job_title_roles: { type: Type.ARRAY, items: { type: Type.STRING } },
          job_title_sub_roles: { type: Type.ARRAY, items: { type: Type.STRING } },
          job_title_levels: { type: Type.ARRAY, items: { type: Type.STRING } },
          years_experience_min: { type: Type.NUMBER },
          location: {
            type: Type.OBJECT,
            properties: {
              postal_code: { type: Type.STRING },
              radius_miles: { type: Type.NUMBER },
              region: { type: Type.STRING },
            },
          },
          disqualifiers: {
            type: Type.OBJECT,
            properties: {
              levels: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
        required: ['skill_clusters', 'job_title_sub_roles'],
      },
    },
  } as any);

  const text = (response as any).text as string;
  let parsed: QuerySpec;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : text) as QuerySpec;
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text?.slice(0, 300)}`);
  }

  parsed.job_title_sub_roles = (parsed.job_title_sub_roles || []).filter(v => SUB_ROLES.includes(v));
  parsed.job_title_roles = (parsed.job_title_roles || []).filter(v => ROLES.includes(v));
  parsed.job_title_levels = (parsed.job_title_levels || []).filter(v => LEVELS.includes(v));
  if (parsed.disqualifiers?.levels) {
    parsed.disqualifiers.levels = parsed.disqualifiers.levels.filter(v => LEVELS.includes(v));
  }

  return parsed;
}
