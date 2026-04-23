import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey) {
  console.error("GEMINI_API_KEY missing");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const systemInstruction = `
  You are an expert technical recruiter and systems engineer.
  Your task is to analyze a job description or search prompt and extract a "Technical Fingerprint".

  You will be provided with:
  1. A text prompt.
  2. PDF attachments (Job Descriptions).
  3. URLs (Job Postings).
  4. A Company Reference Link (LinkedIn or Engineering Blog).

  A Technical Fingerprint includes:
  1. Title, 2. Primary Tech, 3. Secondary Signals, 4. Target Profile,
  5. Search Plan, 6. Company Context (analyze if link provided),
  7. Location Constraint ("United States and Canada").

  Return the result in JSON format.
`;

const prompt = "We're looking for a senior systems engineer with experience in Mac environments, networking, and security.";
const companyLink = "https://inferact.ai";
const urls: string[] = [];

const contents = [
  { text: `Prompt: ${prompt}${urls.length > 0 ? `\nURLs to analyze: ${urls.join(", ")}` : ""}${companyLink ? `\nCompany Reference Link: ${companyLink}` : ""}` },
];

(async () => {
  console.log("Calling extractTechnicalFingerprint equivalent with googleSearch tool...\n");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: contents }],
      tools: [{ googleSearch: {} }] as any,
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
            locationConstraint: { type: Type.STRING },
          },
          required: ["title", "primaryTech", "secondarySignals", "targetProfile", "plan", "sources", "companyContext", "locationConstraint"],
        },
      },
    } as any);

    console.log("=== RAW RESPONSE TEXT ===");
    console.log(response.text);
    console.log("\n=== CANDIDATES ARRAY (length) ===");
    console.log((response as any).candidates?.length ?? "none");
    const cand0 = (response as any).candidates?.[0];
    console.log("\n=== groundingMetadata present? ===");
    console.log(cand0?.groundingMetadata ? "YES" : "NO");
    if (cand0?.groundingMetadata) {
      const gm = cand0.groundingMetadata;
      console.log("webSearchQueries:", gm.webSearchQueries);
      console.log("groundingChunks count:", gm.groundingChunks?.length);
      console.log("first 3 chunks:", JSON.stringify(gm.groundingChunks?.slice(0, 3), null, 2));
    }

    console.log("\n=== PARSED JSON ATTEMPT ===");
    try {
      const match = response.text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : response.text);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e: any) {
      console.log("Parse failed:", e.message);
    }

    console.log("\n=== VERDICT ===");
    console.log("No errors thrown. API call succeeded.");
  } catch (err: any) {
    console.error("=== ERROR ===");
    console.error("message:", err?.message);
    console.error("status:", err?.status);
    console.error("full:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2).slice(0, 2000));
    process.exit(2);
  }
})();
