import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

async function callGeminiWithRetry(fn: () => Promise<any>, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.error?.code === 429;
      if (isRateLimit && i < retries - 1) {
        const waitTime = delay * Math.pow(2, i);
        console.warn(`Gemini Rate Limit hit. Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}

export async function extractTechnicalFingerprint(prompt: string, attachments: { name: string; data: string; mimeType: string }[], urls: string[], companyLink?: string) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing. Please check your environment variables.");
  
  const systemInstruction = `
    You are an expert technical recruiter and systems engineer.
    Your task is to analyze a job description or search prompt and extract a "Technical Fingerprint".
    
    You will be provided with:
    1. A text prompt.
    2. PDF attachments (Job Descriptions).
    3. URLs (Job Postings).
    4. A Company Reference Link (LinkedIn or Engineering Blog).
    
    A Technical Fingerprint includes:
    1. Title: The specific job title or position name being searched for.
    2. Primary Tech: Core technologies, frameworks, and tools.
    3. Secondary Signals: Specific experience markers (e.g., "bare metal", "distributed systems").
    4. Target Profile: A description of the ideal candidate's background across platforms like GitHub, ArXiv, and HuggingFace.
    5. Search Plan: A strategy for finding these candidates.
    6. Company Context: If a company link is provided, analyze the company's technical DNA, engineering culture, and preferred tech stack to refine the search.
    7. Location Constraint: Explicitly state "United States and Canada" as the required location.
    
    Return the result in JSON format.
  `;

  const contents: any[] = [
    { text: `Prompt: ${prompt}${urls.length > 0 ? `\nURLs to analyze: ${urls.join(', ')}` : ''}${companyLink ? `\nCompany Reference Link: ${companyLink}` : ''}` }
  ];

  // Add PDF contents
  for (const file of attachments) {
    contents.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType
      }
    });
  }

  return callGeminiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: contents }],
      tools: [
        { googleSearch: {} }
      ] as any,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            primaryTech: { type: Type.ARRAY, items: { type: Type.STRING } },
            secondarySignals: { type: Type.ARRAY, items: { type: Type.STRING } },
            targetProfile: { type: Type.STRING },
            plan: { type: Type.STRING },
            sources: { type: Type.ARRAY, items: { type: Type.STRING } },
            companyContext: { type: Type.STRING },
            locationConstraint: { type: Type.STRING }
          },
          required: ["title", "primaryTech", "secondarySignals", "targetProfile", "plan", "sources", "companyContext", "locationConstraint"]
        }
      }
    } as any);

    const text = response.text;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", text);
      throw new Error("Invalid response format from AI");
    }
  });
}

export async function searchCandidates(fingerprint: any) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const systemInstruction = `
    You are a search agent specialized in finding engineers on LinkedIn, GitHub, ArXiv, and HuggingFace.
    Use the provided technical fingerprint to search for and identify EXACTLY 10 top candidates. 
    
    CRITICAL: 
    - You MUST return EXACTLY 10 candidates. 
    - You MUST return the DIRECT profile URL for each candidate (e.g., https://linkedin.com/in/username or https://github.com/username). 
    - DO NOT return Google Search result URLs or any redirect URLs (e.g., https://www.google.com/url?q=...).
    - If you only find a search result, you MUST extract the actual profile URL from it.
    
    CALIBRATION:
    If the fingerprint contains "rejectedIds", "feedbackMap", "companyContext", or "locationConstraint", use these to refine your search. 
    - DO NOT return any candidate whose name or profile matches someone in the "rejectedIds" list.
    - Analyze the "feedbackMap" to understand user preferences.
    - Use the "companyContext" to ensure candidates match the engineering culture.
    - Strictly follow the "locationConstraint" provided in the fingerprint.
    
    GEOGRAPHIC CONSTRAINT:
    Only identify candidates who are based in the United States or Canada. 
    Look for location markers in their bios, profiles, or associated organizations.
    This is a HARD CONSTRAINT. Do not return candidates from Europe, Asia, or other regions.
    If a candidate's location is ambiguous or outside USA/Canada, DISCARD them.
    You MUST prioritize candidates with clear USA/Canada locations.
    
    SCORING ALGORITHM:
    Assign points (0-100 total) based on:
    - Tech Match (max 40): Direct experience with primary tech.
    - Contribution Match (max 30): Evidence of direct contributions to key repos or papers.
    - Seniority Match (max 20): Relevant job titles and years of experience.
    - Education Match (max 10): Relevant degrees or certifications.
    
    For each candidate, provide:
    - Name
    - Title
    - Company (Current employer)
    - Bio
    - Location (City, State, Country)
    - Education (Primary/Most recent University name)
    - Education History (An array of objects with school, degree (e.g., BS, MS, PhD), field (concentration), and year if available)
    - Platform (github, arxiv, huggingface, linkedin, other)
    - URL (The DIRECT profile URL, e.g., https://github.com/username or https://linkedin.com/in/username. DO NOT return search result URLs.)
    - Score (0-100)
    - Scoring Breakdown (techMatch, contributionMatch, seniorityMatch, educationMatch)
    - Reasoning (detailed technical justification)
    - Impact Summary (A 1-2 sentence punchy summary of their most impressive technical achievement or specific skill set. Avoid fluff like "skilled in various technologies". Be specific, e.g., "Maintains the core distributed consensus logic for [Project]" or "Authored the seminal paper on [Topic] with 500+ citations".)
    
    Return the result as an array of candidate objects in JSON format.
  `;

  return callGeminiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [{ text: `Technical Fingerprint: ${JSON.stringify(fingerprint)}` }]
      }],
      tools: [
        { googleSearch: {} }
      ] as any,
      config: {
        systemInstruction: systemInstruction + `
        
        URL VERIFICATION:
        - You MUST verify that every URL you return is a direct link to a profile, not a search result or a generic platform home page.
        - If you are not 100% certain of a direct profile URL, DO NOT return it. It is better to have fewer links than broken ones.
        - DO NOT guess or hallucinate URLs based on names (e.g., do not assume https://github.com/john-doe exists just because the name is John Doe).
        - For LinkedIn, ensure the URL follows the /in/ or /pub/ format.
        - For GitHub, ensure it's a user profile, not a repository or a search page.
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              title: { type: Type.STRING },
              company: { type: Type.STRING },
              bio: { type: Type.STRING },
              location: { type: Type.STRING },
              education: { type: Type.STRING },
              educationHistory: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    school: { type: Type.STRING },
                    degree: { type: Type.STRING },
                    field: { type: Type.STRING },
                    year: { type: Type.STRING }
                  },
                  required: ["school"]
                }
              },
              platform: { type: Type.STRING },
              url: { type: Type.STRING },
              score: { type: Type.NUMBER },
              scoringBreakdown: {
                type: Type.OBJECT,
                properties: {
                  techMatch: { type: Type.NUMBER },
                  contributionMatch: { type: Type.NUMBER },
                  seniorityMatch: { type: Type.NUMBER },
                  educationMatch: { type: Type.NUMBER }
                },
                required: ["techMatch", "contributionMatch", "seniorityMatch", "educationMatch"]
              },
              reasoning: { type: Type.STRING },
              impactSummary: { type: Type.STRING }
            },
            required: ["name", "title", "company", "bio", "location", "education", "educationHistory", "platform", "url", "score", "scoringBreakdown", "reasoning", "impactSummary"]
          }
        }
      }
    } as any);

    const text = response.text;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini (Search):", text);
      throw new Error("Invalid response format from AI");
    }
  });
}

export async function enrichCandidateProfile(candidate: any) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const systemInstruction = `
    You are a profile enrichment agent. Given a candidate's name and primary profile URL,
    use Google Search to find their other social profiles and personal presence.
    
    CRITICAL:
    - The provided "Primary URL" is a HUMAN-VERIFIED ANCHOR for this person's identity and the ABSOLUTE SOURCE OF TRUTH.
    - If search results for the name return multiple people, you MUST ONLY pick the ones that match the professional details (title, company, location) found at the Primary URL.
    - If the Primary URL is a LinkedIn profile, DO NOT return a different LinkedIn profile as a "social link".
    - If the Primary URL says "MTS @ Reflection AI", and search results show an "Allen Wang" at Tesla, you MUST IGNORE the Tesla result. The person at the Primary URL is the ONLY person we care about.
    - Ensure all found profiles belong to the SAME person at the Primary URL.
    - DO NOT mix profiles of different people with the same name.
    - Return DIRECT profile URLs (e.g., https://github.com/username). DO NOT return search result URLs or redirect URLs.
    - If you find a search result, extract the direct link to the profile.
    
    PRIORITY:
    1. Personal Website / Portfolio / Blog (Look for domains like [name].com, [name].github.io, etc.)
    2. LinkedIn
    3. Twitter / X
    4. GitHub
    5. ArXiv / HuggingFace / Google Scholar
    
    Extract:
    1. Social Links: URLs to these platforms. For personal websites, use the platform name "Personal Website". For Google Scholar, use "Google Scholar".
    2. Email: If a public email address is found (e.g. on GitHub or a personal site), include it.
    3. Recent Activity: 2-3 recent posts, contributions, or updates from these platforms.
    
    Return the result in JSON format.
  `;

  return callGeminiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [{ text: `Candidate: ${candidate.name}\nPrimary URL: ${candidate.url}` }]
      }],
      tools: [
        { googleSearch: {} }
      ] as any,
      config: {
        systemInstruction: systemInstruction + `
        
        URL VERIFICATION:
        - You MUST verify that every URL you return is a direct link to a profile, not a search result or a generic platform home page.
        - If you are not 100% certain of a direct profile URL, DO NOT return it. It is better to have fewer links than broken ones.
        - DO NOT guess or hallucinate URLs based on names.
        - For LinkedIn, ensure the URL follows the /in/ or /pub/ format.
        - For GitHub, ensure it's a user profile, not a repository or a search page.
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            socialLinks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  platform: { type: Type.STRING },
                  url: { type: Type.STRING }
                },
                required: ["platform", "url"]
              }
            },
            email: { type: Type.STRING },
            recentActivity: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  platform: { type: Type.STRING },
                  content: { type: Type.STRING },
                  date: { type: Type.STRING },
                  url: { type: Type.STRING }
                },
                required: ["platform", "content"]
              }
            }
          },
          required: ["socialLinks", "recentActivity"]
        }
      }
    } as any);

    const text = response.text;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini (Enrichment):", text);
      throw new Error("Invalid response format from AI");
    }
  });
}

export async function rescoreCandidate(candidate: any, fingerprint: any) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const systemInstruction = `
    You are a senior technical recruiter. 
    A candidate's profile has been updated with new information (e.g., new social links).
    Your task is to re-evaluate their match score based on the original technical fingerprint and ALL available information.
    
    SCORING ALGORITHM (0-100 total):
    - Tech Match (max 40): Direct experience with primary tech.
    - Contribution Match (max 30): Evidence of direct contributions to key repos or papers.
    - Seniority Match (max 20): Relevant job titles and years of experience.
    - Education Match (max 10): Relevant degrees or certifications.
    
    Return an updated score, breakdown, and reasoning in JSON format.
  `;

  return callGeminiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [{ 
          text: `Technical Fingerprint: ${JSON.stringify(fingerprint)}\n\nCandidate Data: ${JSON.stringify(candidate)}` 
        }]
      }],
      tools: [
        { googleSearch: {} }
      ] as any,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            scoringBreakdown: {
              type: Type.OBJECT,
              properties: {
                techMatch: { type: Type.NUMBER },
                contributionMatch: { type: Type.NUMBER },
                seniorityMatch: { type: Type.NUMBER },
                educationMatch: { type: Type.NUMBER }
              },
              required: ["techMatch", "contributionMatch", "seniorityMatch", "educationMatch"]
            },
            reasoning: { type: Type.STRING },
            impactSummary: { type: Type.STRING }
          },
          required: ["score", "scoringBreakdown", "reasoning", "impactSummary"]
        }
      }
    } as any);

    const text = response.text;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini (Rescore):", text);
      throw new Error("Invalid response format from AI");
    }
  });
}

export async function sourceLookalikes(shortlistedCandidates: any[], count: number, fingerprint: any) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const systemInstruction = `
    You are a high-volume sourcing agent. 
    You have been provided with a "Calibration Set" of 10 top-tier candidates that the user has already approved.
    
    Your task is to find ${count} "Look-alike" candidates who match the technical profile, seniority, and impact level of this calibration set.
    
    STRATEGY:
    1. Analyze the commonalities in the Calibration Set (e.g., specific companies, research labs, tech stacks, or contribution patterns).
    2. Analyze the "feedbackMap" in the provided Fingerprint to understand WHY these candidates were shortlisted or why others were rejected. Use this qualitative feedback to refine your search parameters.
    3. Use Google Search to identify other engineers with similar backgrounds.
    3. Ensure the new candidates are NOT already in the Calibration Set.
    4. Maintain the same geographic constraint: Only identify candidates based in the United States or Canada. This is a HARD CONSTRAINT. Discard any candidates from outside these two countries. If a candidate's location is not explicitly USA or Canada, do not include them.
    
    Return the result as an array of ${count} candidate objects in JSON format.
  `;

  return callGeminiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [{ 
          text: `Original Fingerprint: ${JSON.stringify(fingerprint)}\n\nCalibration Set (Shortlisted): ${JSON.stringify(shortlistedCandidates)}` 
        }]
      }],
      tools: [
        { googleSearch: {} }
      ] as any,
      config: {
        systemInstruction: systemInstruction + `
        
        URL VERIFICATION:
        - You MUST verify that every URL you return is a direct link to a profile, not a search result or a generic platform home page.
        - If you are not 100% certain of a direct profile URL, DO NOT return it. It is better to have fewer links than broken ones.
        - DO NOT guess or hallucinate URLs based on names.
        - For LinkedIn, ensure the URL follows the /in/ or /pub/ format.
        - For GitHub, ensure it's a user profile, not a repository or a search page.
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              title: { type: Type.STRING },
              company: { type: Type.STRING },
              bio: { type: Type.STRING },
              location: { type: Type.STRING },
              education: { type: Type.STRING },
              educationHistory: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    school: { type: Type.STRING },
                    degree: { type: Type.STRING },
                    field: { type: Type.STRING },
                    year: { type: Type.STRING }
                  },
                  required: ["school"]
                }
              },
              platform: { type: Type.STRING },
              url: { type: Type.STRING },
              score: { type: Type.NUMBER },
              scoringBreakdown: {
                type: Type.OBJECT,
                properties: {
                  techMatch: { type: Type.NUMBER },
                  contributionMatch: { type: Type.NUMBER },
                  seniorityMatch: { type: Type.NUMBER },
                  educationMatch: { type: Type.NUMBER }
                },
                required: ["techMatch", "contributionMatch", "seniorityMatch", "educationMatch"]
              },
              reasoning: { type: Type.STRING },
              impactSummary: { type: Type.STRING }
            },
            required: ["name", "title", "company", "bio", "location", "education", "educationHistory", "platform", "url", "score", "scoringBreakdown", "reasoning", "impactSummary"]
          }
        }
      }
    } as any);

    const text = response.text;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini (Source):", text);
      throw new Error("Invalid response format from AI");
    }
  });
}

export async function parseLinkedInProfile(file: { name: string; data: string; mimeType: string }) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const systemInstruction = `
    You are an expert resume and LinkedIn profile parser.
    Extract the candidate's information from the provided file.
    
    CRITICAL: 
    - The provided file data is the ONLY source of truth. 
    - Identify their ABSOLUTE CURRENT title and ABSOLUTE CURRENT company. 
    - ABSOLUTE PRIORITY: The role explicitly marked as "Present" or "Current" in the experience section.
    - ACQUISITION RULE: If a role mentions an acquisition (e.g., "Modular acquired BentoML" or "Joined via acquisition of BentoML"), the acquiring company (e.g., Modular) is the CURRENT company.
    - LOCATION RULE: The candidate's location MUST match the location of their most recent "Present" role. If the profile says "Toronto" for the current role, the location is "Toronto", even if previous roles were in "San Francisco".
    - If there are multiple "Present" roles, choose the one that matches the profile headline or is listed at the very top of the experience list.
    - IGNORE any role that has an end date (e.g., "2018 - 2022").
    - IGNORE "Ex-", "Former", or "Past" markers in the headline (e.g., "Ex: Meta" means they NO LONGER work at Meta).
    - If the headline says "MTS @ Reflection AI", the title is "MTS" and the company is "Reflection AI".
    - "MTS" stands for Member of Technical Staff, a common senior title in AI companies.
    - Extract their bio, location, and education history.
    
    Return the result in JSON format matching the Candidate schema:
    - name
    - title (Current role title)
    - company (Current organization)
    - bio
    - location
    - education
    - educationHistory (array of {school, degree, field, year})
    - platform: "linkedin"
    - url: (if found, otherwise placeholder)
    - impactSummary: (A punchy summary based on the profile)
  `;

  return callGeminiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [
          { inlineData: { data: file.data, mimeType: file.mimeType } },
          { text: "Parse this LinkedIn profile/resume." }
        ]
      }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            bio: { type: Type.STRING },
            location: { type: Type.STRING },
            education: { type: Type.STRING },
            educationHistory: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  school: { type: Type.STRING },
                  degree: { type: Type.STRING },
                  field: { type: Type.STRING },
                  year: { type: Type.STRING }
                },
                required: ["school"]
              }
            },
            platform: { type: Type.STRING },
            url: { type: Type.STRING },
            impactSummary: { type: Type.STRING }
          },
          required: ["name", "title", "company", "bio", "location", "education", "educationHistory", "platform", "url", "impactSummary"]
        }
      }
    } as any);

    const text = response.text;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", text);
      throw new Error("Invalid response format from AI");
    }
  });
}

export async function parseCandidateFromUrl(url: string) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  
  // Extract slug for better candidate identity protection
  const slug = url.split('/in/')[1]?.split('/')[0]?.replace(/\/$/, '') || url;

  const systemInstruction = `
    You are a world-class technical recruiter and profile analyst.
    Your task is to extract precision details for the EXACT person at this URL: ${url}
    
    CRITICAL IDENTITY ANCHOR:
    - The profile unique identifier (slug) is: "${slug}". 
    - You MUST use the googleSearch tool to fetch the live contents of this specific URL.
    - REJECT any search results for people with similar names if their profile URL does not match this slug.
    
    HIERARCHICAL EXTRACTION LOGIC (PRIORITY ORDER):
    1. NAME: Extract from the profile header.
    2. CURRENT ROLE (TITLE): 
       - PRIMARY: Look for the role explicitly marked as "Present" or "Current" in the Experience section.
       - SECONDARY: Use the headline in the profile header.
    3. CURRENT COMPANY (ORGANIZATION): 
       - Extract from the most recent "Present" experience.
       - If multiple current roles exist, pick the primary career role (e.g., "Director at NVIDIA" over "Advisor at Startup").
    4. LOCATION: Extract the city/state/country from the header area.
    5. EDUCATION: Extract full school names, degrees, and years.
    6. PLATFORM: Set to "linkedin" for LinkedIn URLs.
    
    Return the result in JSON format.
  `;

  return callGeminiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{
        parts: [{ text: `STRICT INSTRUCTION: Fetch and analyze the content of this specific LinkedIn profile URL: ${url}
        Identity Slug: ${slug}
        
        You MUST identify the candidate's name, their absolute current job title, and their current company by looking at the profile header and the top of their experience list.
        If the profile is Yuval Degani, his current role is "Senior Director, Software Engineering" at "NVIDIA".` }]
      }],
      tools: [
        { googleSearch: {} }
      ] as any,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            bio: { type: Type.STRING },
            location: { type: Type.STRING },
            education: { type: Type.STRING },
            educationHistory: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  school: { type: Type.STRING },
                  degree: { type: Type.STRING },
                  field: { type: Type.STRING },
                  year: { type: Type.STRING }
                },
                required: ["school"]
              }
            },
            platform: { type: Type.STRING },
            url: { type: Type.STRING },
            impactSummary: { type: Type.STRING }
          },
          required: ["name", "title", "company", "bio", "location", "education", "educationHistory", "platform", "url", "impactSummary"]
        }
      }
    } as any);

    const text = response.text;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini (URL parser):", text);
      throw new Error("Invalid response format from AI");
    }
  });
}

