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
    abortSignal?: AbortSignal;
    maxTokens?: number;
  }): Promise<T>;
}

function normalizeBaseUrl(raw?: string): string | undefined {
  const cleaned = raw?.trim().replace(/\/+$/, "");
  return cleaned || undefined;
}

function isAbortError(err: unknown, parentSignal?: AbortSignal): boolean {
  if (parentSignal?.aborted) return true;
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError";
}

function createCallAbortSignal(
  parentSignal?: AbortSignal,
  timeoutMs = 120_000
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onParentAbort = () => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
      return { signal: controller.signal, cleanup: () => {} };
    }
    parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }

  const timer = setTimeout(() => {
    controller.abort(new Error(`LLM request timed out after ${Math.round(timeoutMs / 1000)}s`));
  }, timeoutMs);

  const cleanup = () => {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener("abort", onParentAbort);
    }
  };

  return { signal: controller.signal, cleanup };
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

function collectCandidateErrorTexts(err: unknown): string[] {
  if (!err || typeof err !== "object") return [];
  const rec = err as {
    text?: unknown;
    responseBody?: unknown;
    cause?: { text?: unknown; responseBody?: unknown } | null;
  };
  const candidates = [rec.text, rec.cause?.text, rec.responseBody, rec.cause?.responseBody];
  const texts: string[] = [];
  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) {
      texts.push(item);
      // Unwrap OpenAI-compatible responseBody envelopes if JSON was valid at wrapper level
      try {
        const parsed = JSON.parse(item) as {
          choices?: Array<{ message?: { content?: unknown } }>;
        };
        const content = parsed?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) {
          texts.push(content);
        }
      } catch {
        // Not a JSON wrapper envelope; raw text candidate is still checked below
      }
    }
  }
  return texts;
}

function tryRecoverFromErrorText<T>(
  err: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): T | null {
  const texts = collectCandidateErrorTexts(err);
  for (const rawText of texts) {
    try {
      const jsonStr = extractRawJsonCandidate(rawText);
      const parsedJson = JSON.parse(jsonStr);
      const validated = schema.safeParse(parsedJson);
      if (validated.success) return validated.data;
    } catch {
      // Continue trying next candidate text
    }
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
      abortSignal,
      maxTokens = 8192,
    }: {
      prompt: string;
      schema: z.ZodType<T, z.ZodTypeDef, unknown>;
      schemaName: string;
      abortSignal?: AbortSignal;
      maxTokens?: number;
    }): Promise<T> {
      const { signal: callSignal, cleanup } = createCallAbortSignal(abortSignal, 120_000);
      try {
        const result = await generateObject({
          model,
          schema,
          schemaName,
          prompt,
          temperature: 0.2,
          maxTokens,
          maxRetries: 1,
          abortSignal: callSignal,
          mode: isOpenAICompatibleProxy ? "json" : "auto",
        });
        return result.object;
      } catch (firstErr) {
        if (isAbortError(firstErr, abortSignal)) {
          throw firstErr;
        }
        const recovered = tryRecoverFromErrorText(firstErr, schema);
        if (recovered !== null) return recovered;

        const { signal: fallbackSignal, cleanup: cleanupFallback } = createCallAbortSignal(
          abortSignal,
          120_000
        );
        try {
          // Fallback via generateText + explicit JSON extraction for proxies whose json_schema mode omits optional keys
          const fallbackText = await generateText({
            model,
            prompt: `${prompt}\n\n请仅输出严格合法的 JSON 对象（不要包含 Markdown 代码块之外的任何多余解释文字）。`,
            temperature: 0.2,
            maxTokens,
            maxRetries: 0,
            abortSignal: fallbackSignal,
          });
          const jsonStr = extractRawJsonCandidate(fallbackText.text);
          const parsedJson = JSON.parse(jsonStr);
          return schema.parse(parsedJson);
        } finally {
          cleanupFallback();
        }
      } finally {
        cleanup();
      }
    },
  };
}
