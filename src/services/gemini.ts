import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractTechnicalFingerprint(prompt: string, attachments: { name: string; data: string; mimeType: string }[], urls: string[]) {
  const systemInstruction = `
    You are an expert technical recruiter and systems engineer.
    Your task is to analyze a job description or search prompt and extract a "Technical Fingerprint".
    
    You will be provided with:
    1. A text prompt.
    2. PDF attachments (Job Descriptions).
    3. URLs (Job Postings).
    
    A Technical Fingerprint includes:
    1. Title: The specific job title or position name being searched for (e.g., "Staff Software Engineer", "ML Researcher"). Extract this from the prompt or job description. This MUST be a short, professional string (2-5 words). If multiple roles are mentioned, create a combined title like "Backend & Frontend Engineer".
    2. Primary Tech: Core technologies, frameworks, and tools.
    3. Secondary Signals: Specific experience markers (e.g., "bare metal", "distributed systems").
    4. Target Profile: A description of the ideal candidate's background across platforms like GitHub, ArXiv, and HuggingFace.
    5. Search Plan: A strategy for finding these candidates.
    
    Return the result in JSON format.
  `;

  const contents: any[] = [
    { text: `Prompt: ${prompt}${urls.length > 0 ? `\nURLs to analyze: ${urls.join(', ')}` : ''}` }
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
          sources: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "primaryTech", "secondarySignals", "targetProfile", "plan", "sources"]
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
    You are a search agent specialized in finding engineers on GitHub, ArXiv, and HuggingFace.
    Use the provided technical fingerprint to search for and identify 3-5 top candidates.
    
    GEOGRAPHIC CONSTRAINT:
    Only identify candidates who are based in the United States or Canada. 
    Look for location markers in their bios, profiles, or associated organizations.
    
    SCORING ALGORITHM:
    Assign points (0-100 total) based on:
    - Tech Match (max 40): Direct experience with primary tech.
    - Contribution Match (max 30): Evidence of direct contributions to key repos or papers.
    - Seniority Match (max 20): Relevant job titles and years of experience.
    - Education Match (max 10): Relevant degrees or certifications.
    
    For each candidate, provide:
    - Name
    - Title
    - Bio
    - Location (City, State, Country)
    - Education (University name)
    - Platform (github, arxiv, huggingface)
    - URL
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
            bio: { type: Type.STRING },
            location: { type: Type.STRING },
            education: { type: Type.STRING },
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
          required: ["name", "title", "bio", "location", "education", "platform", "url", "score", "scoringBreakdown", "reasoning", "impactSummary"]
        }
      }
    }
  } as any);

  return JSON.parse(response.text);
}

export async function enrichCandidateProfile(candidate: any) {
  const systemInstruction = `
    You are a profile enrichment agent. Given a candidate's name and primary profile URL,
    use Google Search to find their other social profiles (LinkedIn, Twitter/X, GitHub, ArXiv, HuggingFace, Facebook, Personal Blog).
    
    Extract:
    1. Social Links: URLs to other platforms.
    2. Recent Activity: 2-3 recent posts, contributions, or updates from these platforms.
    
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

  return JSON.parse(response.text);
}

