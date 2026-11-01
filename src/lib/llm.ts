import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export function llmConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function llmModel(): string {
  return process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
}

// Free-tier limits are per model, so a busy minute on one can still be served by the other.
function modelsToTry(): string[] {
  return [...new Set([llmModel(), "gemini-3.1-flash-lite"])];
}

function isRateLimit(error: unknown): boolean {
  return error instanceof Error && /\b429\b|RESOURCE_EXHAUSTED/.test(error.message);
}

/**
 * Asks the model for JSON matching the schema. Returns null if no key is set, or
 * on any error, invalid output or rate limit, so each agent can use its rules.
 * Nothing here retries against a paid tier.
 */
export async function askJson<T>(system: string, user: string, schema: z.ZodType<T>): Promise<T | null> {
  if (!llmConfigured()) return null;
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  for (const model of modelsToTry()) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
        },
      });
      const parsed = schema.safeParse(JSON.parse(response.text ?? ""));
      return parsed.success ? parsed.data : null;
    } catch (error) {
      if (isRateLimit(error)) {
        console.warn(`${model} is rate limited.`);
        continue;
      }
      console.warn("LLM call failed, using rules instead:", error instanceof Error ? error.message.slice(0, 200) : error);
      return null;
    }
  }
  return null;
}
