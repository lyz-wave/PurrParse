import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, type LanguageModelV1 } from "ai";
import type { z } from "zod";

export type LLMProviderId = "google" | "openai" | "anthropic" | "deepseek" | "custom";

export interface LLMConfig {
  provider: LLMProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface StructuredObjectGenerator {
  generate<T>(params: {
    prompt: string;
    schema: z.ZodType<T, z.ZodTypeDef, unknown>;
    schemaName: string;
  }): Promise<T>;
}

function normalizeBaseUrl(raw?: string): string | undefined {
  const cleaned = raw?.trim().replace(/\/+$/, "");
  return cleaned || undefined;
}

function extractRawJsonCandidate(rawText: string): string {
  const withoutThink = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : withoutThink;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }
  return candidate;
}

function tryRecoverFromErrorText<T>(
  err: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): T | null {
  if (!err || typeof err !== "object") return null;
  const rawText = (err as { text?: unknown }).text;
  if (typeof rawText !== "string" || !rawText.trim()) return null;

  try {
    const jsonStr = extractRawJsonCandidate(rawText);
    const parsedJson = JSON.parse(jsonStr);
    const validated = schema.safeParse(parsedJson);
    if (validated.success) return validated.data;
  } catch {
    return null;
  }
  return null;
}

export function resolveLanguageModel(config: LLMConfig): LanguageModelV1 {
  const apiKey = config.apiKey.trim();
  if (!apiKey) {
    throw new Error("Missing LLM API key. Provide an API key or run in Offline Heuristic Mode.");
  }

  const baseURL = normalizeBaseUrl(config.baseUrl);

  switch (config.provider) {
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL,
      });
      return google(config.model.trim() || "gemini-2.5-flash");
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey,
        baseURL,
      });
      return anthropic(config.model.trim() || "claude-3-7-sonnet-20250219");
    }
    case "deepseek": {
      const deepseek = createOpenAI({
        apiKey,
        baseURL: baseURL || "https://api.deepseek.com/v1",
        compatibility: "compatible",
      });
      return deepseek(config.model.trim() || "deepseek-chat");
    }
    case "custom": {
      const custom = createOpenAI({
        apiKey,
        baseURL: baseURL || "https://api.openai.com/v1",
        compatibility: "compatible",
      });
      return custom(config.model.trim() || "gpt-4o-mini");
    }
    case "openai":
    default: {
      const openai = createOpenAI({
        apiKey,
        baseURL,
        compatibility: baseURL ? "compatible" : "strict",
      });
      return openai(config.model.trim() || "gpt-4o-mini");
    }
  }
}

export function createAiSdkObjectGenerator(config: LLMConfig): StructuredObjectGenerator {
  const model = resolveLanguageModel(config);
  const isOpenAICompatibleProxy =
    config.provider === "deepseek" ||
    config.provider === "custom" ||
    Boolean(normalizeBaseUrl(config.baseUrl));

  return {
    async generate<T>({
      prompt,
      schema,
      schemaName,
    }: {
      prompt: string;
      schema: z.ZodType<T, z.ZodTypeDef, unknown>;
      schemaName: string;
    }): Promise<T> {
      try {
        const result = await generateObject({
          model,
          schema,
          schemaName,
          prompt,
          temperature: 0.2,
          mode: isOpenAICompatibleProxy ? "json" : "auto",
        });
        return result.object;
      } catch (firstErr) {
        const recovered = tryRecoverFromErrorText(firstErr, schema);
        if (recovered !== null) return recovered;

        // Fallback via generateText + explicit JSON extraction for proxies whose json_schema mode omits optional keys
        const fallbackText = await generateText({
          model,
          prompt: `${prompt}\n\n请仅输出严格合法的 JSON 对象（不要包含 Markdown 代码块之外的任何多余解释文字）。`,
          temperature: 0.2,
        });
        const jsonStr = extractRawJsonCandidate(fallbackText.text);
        const parsedJson = JSON.parse(jsonStr);
        return schema.parse(parsedJson);
      }
    },
  };
}
