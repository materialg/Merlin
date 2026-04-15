import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractTechnicalFingerprint(prompt: string, attachments: { name: string; data: string; mimeType: string }[], urls: string[], companyLink?: string) {
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

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ parts: contents }],
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
}

export async function searchCandidates(fingerprint: any) {
  const systemInstruction = `
    You are a search agent specialized in finding engineers on LinkedIn, GitHub, ArXiv, and HuggingFace.
    Use the provided technical fingerprint to search for and identify EXACTLY 10 top candidates. 
    
    CRITICAL: 
    - You MUST return EXACTLY 10 candidates. 
    - You MUST return the DIRECT profile URL for each candidate (e.g., https://linkedin.com/in/username or https://github.com/username). 
    - DO NOT return Google Search result URLs.
    
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{
      parts: [{ text: `Technical Fingerprint: ${JSON.stringify(fingerprint)}` }]
    }],
    tools: [
      { googleSearch: {} }
    ] as any,
    config: {
      systemInstruction,
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
}

export async function enrichCandidateProfile(candidate: any) {
  const systemInstruction = `
    You are a profile enrichment agent. Given a candidate's name and primary profile URL,
    use Google Search to find their other social profiles and personal presence.
    
    CRITICAL:
    - Return DIRECT profile URLs (e.g., https://github.com/username). DO NOT return search result URLs.
    - If you find a LinkedIn profile, ensure it's the correct one for the candidate based on their current role/company.
    
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{
      parts: [{ text: `Candidate: ${candidate.name}\nPrimary URL: ${candidate.url}` }]
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
}

export async function rescoreCandidate(candidate: any, fingerprint: any) {
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
}

export async function sourceLookalikes(shortlistedCandidates: any[], count: number, fingerprint: any) {
  const systemInstruction = `
    You are a high-volume sourcing agent. 
    You have been provided with a "Calibration Set" of 10 top-tier candidates that the user has already approved.
    
    Your task is to find ${count} "Look-alike" candidates who match the technical profile, seniority, and impact level of this calibration set.
    
    STRATEGY:
    1. Analyze the commonalities in the Calibration Set (e.g., specific companies, research labs, tech stacks, or contribution patterns).
    2. Use Google Search to identify other engineers with similar backgrounds.
    3. Ensure the new candidates are NOT already in the Calibration Set.
    4. Maintain the same geographic constraint: Only identify candidates based in the United States or Canada. This is a HARD CONSTRAINT. Discard any candidates from outside these two countries. If a candidate's location is not explicitly USA or Canada, do not include them.
    
    Return the result as an array of ${count} candidate objects in JSON format.
  `;

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
      systemInstruction,
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
}

export async function parseLinkedInProfile(file: { name: string; data: string; mimeType: string }) {
  const systemInstruction = `
    You are an expert resume and LinkedIn profile parser.
    Extract the candidate's information from the provided file.
    
    CRITICAL: 
    - Identify their CURRENT title and CURRENT company. 
    - If the profile shows multiple roles, pick the one that is currently active.
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

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
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
}

export async function parseCandidateFromUrl(url: string) {
  const systemInstruction = `
    You are an expert technical recruiter and profile analyst.
    Given a URL (LinkedIn, GitHub, X, etc.), use Google Search to find the most up-to-date information about the person associated with this profile.
    
    CRITICAL: 
    - Identify their CURRENT title and CURRENT company. 
    - If the profile shows multiple roles, pick the one that is currently active (e.g., "Software Engineer at Google" instead of a past "Founder" role).
    - Extract their bio, location, and education history.
    
    Extract:
    - name
    - title (Current role title)
    - company (Current organization)
    - bio
    - location
    - education (Summary of education)
    - educationHistory (array of {school, degree, field, year})
    - platform: (github, linkedin, arxiv, huggingface, or other)
    - url: (the provided URL)
    - impactSummary: (A punchy summary based on the profile)
    
    Return the result in JSON format matching the Candidate schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{
      parts: [{ text: `Analyze this profile URL and find the person's current professional details: ${url}` }]
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
}

