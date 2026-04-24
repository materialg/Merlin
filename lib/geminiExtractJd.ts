import { GoogleGenAI, Type } from '@google/genai';
import type { ExtractedJD } from './types';
import levels from '../data/pdl/levels.json';

const LEVELS = levels as string[];

export type GeminiExtractArgs = {
  jd_base64?: string;
  jd_mime?: string;
  context?: string;
};

export async function geminiExtractJd(args: GeminiExtractArgs): Promise<ExtractedJD> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in the server environment');
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are a recruiting assistant. Extract the core search signals from a Job Description so we can build a LinkedIn X-ray search (site:linkedin.com/in/ "phrase" "skill").

Output strict JSON with these fields:

- titles: 2-4 job title phrases a candidate would write on their LinkedIn profile. Include close variants. For a "Systems Engineer" role you might include "Systems Engineer", "IT Engineer", "Systems Administrator", "Network Engineer". Keep them short and searchable.

- skills: 4-8 specific technical skills, tools, or technologies from the JD. Prefer concrete named tools (e.g. "Jamf", "Intune", "Cisco IOS", "Okta") over generic categories ("networking", "security"). Lowercase. No marketing fluff.

- companies: Current/past employers named in the JD AND 2-4 likely competitor or peer-industry companies. If the JD is for "Annenberg Foundation" (a film/media nonprofit), peer orgs might be "Getty", "LACMA", "Smithsonian", "Ford Foundation". Useful for finding candidates with similar backgrounds.

- seniority: Match the JD level to one or more values from this canonical list: ${LEVELS.join(', ')}. Return 1-3 levels. Pick broadly — include adjacent levels so we don't over-filter.

- location: Optional free-form location string (city, state, or ZIP) if the JD specifies one.

Be specific. Favor terms likely to appear verbatim on a LinkedIn profile headline or experience section.`;

  const parts: any[] = [];
  if (args.jd_base64 && args.jd_mime) {
    parts.push({ inlineData: { data: args.jd_base64, mimeType: args.jd_mime } });
  }
  if (args.context && args.context.trim()) {
    parts.push({ text: `Additional context from the user: ${args.context.trim()}` });
  }
  if (parts.length === 0) throw new Error('No JD or context provided to Gemini extract');
  parts.push({ text: 'Extract the JD signals as JSON.' });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts }],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titles: { type: Type.ARRAY, items: { type: Type.STRING } },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          companies: { type: Type.ARRAY, items: { type: Type.STRING } },
          seniority: { type: Type.ARRAY, items: { type: Type.STRING } },
          location: { type: Type.STRING },
        },
        required: ['titles', 'skills', 'companies', 'seniority'],
      },
    },
  } as any);

  const text = (response as any).text as string;
  let parsed: ExtractedJD;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : text) as ExtractedJD;
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text?.slice(0, 300)}`);
  }

  parsed.seniority = (parsed.seniority || []).filter(v => LEVELS.includes(v));
  parsed.titles = parsed.titles || [];
  parsed.skills = parsed.skills || [];
  parsed.companies = parsed.companies || [];

  // Synthesize a short human title for the session header
  const titleBits = [parsed.seniority[0], parsed.titles[0]].filter(Boolean) as string[];
  parsed.title = titleBits.length ? titleBits.join(' ') : undefined;

  return parsed;
}
