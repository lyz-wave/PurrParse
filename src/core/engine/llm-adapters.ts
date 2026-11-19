import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateObject, generateText, NoObjectGeneratedError, type LanguageModelV1 } from "ai";
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

function normalizeOpenAiBaseUrl(raw?: string): string | undefined {
  const cleaned = normalizeBaseUrl(raw);
  if (!cleaned) return undefined;
  if (cleaned.endsWith("/v1") || /\/v\d+(?:alpha|beta)?$/i.test(cleaned)) {
    return cleaned;
  }
  return `${cleaned}/v1`;
}

function extractGatewayErrorMessage(payload: Record<string, unknown> | null | undefined): string {
  if (!payload || typeof payload !== "object") return "";
  const errObj = payload.error as Record<string, unknown> | string | undefined;
  if (typeof errObj === "string" && errObj.trim()) return errObj.trim();
  if (errObj && typeof errObj === "object") {
    const msg = errObj.message ?? errObj.msg ?? errObj.detail;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  const direct = payload.message ?? payload.msg ?? payload.detail;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return "";
}

function parseSseOpenAiCompletion(rawSse: string): Record<string, unknown> | null {
  const textParts: string[] = [];
  const reasoningParts: string[] = [];
  const toolCallsByIndex = new Map<number, { id?: string; type: "function"; function: { name: string; arguments: string } }>();
  let finishReason: string | null = null;
  let id: string | undefined;
  let model: string | undefined;
  let created: number | undefined;
  let usage: unknown;
  let sawChunk = false;

  for (const rawLine of rawSse.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as {
        id?: string;
        model?: string;
        created?: number;
        usage?: unknown;
        error?: unknown;
        choices?: Array<{
          finish_reason?: string | null;
          delta?: {
            content?: string | null;
            reasoning_content?: string | null;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          message?: {
            content?: string | null;
            reasoning_content?: string | null;
          };
        }>;
      };
      if (parsed.error) {
        const msg = extractGatewayErrorMessage(parsed as Record<string, unknown>);
        throw new Error(msg || "上游 SSE 流返回错误");
      }
      sawChunk = true;
      if (parsed.id) id = parsed.id;
      if (parsed.model) model = parsed.model;
      if (typeof parsed.created === "number") created = parsed.created;
      if (parsed.usage) usage = parsed.usage;

      for (const ch of parsed.choices ?? []) {
        if (typeof ch.delta?.content === "string") textParts.push(ch.delta.content);
        if (typeof ch.message?.content === "string") textParts.push(ch.message.content);
        if (typeof ch.delta?.reasoning_content === "string") reasoningParts.push(ch.delta.reasoning_content);
        if (Array.isArray(ch.delta?.tool_calls)) {
          for (const tc of ch.delta.tool_calls) {
            const idx = typeof tc.index === "number" ? tc.index : 0;
            const cur = toolCallsByIndex.get(idx) ?? {
              id: tc.id,
              type: "function" as const,
              function: { name: "", arguments: "" },
            };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.function.name += tc.function.name;
            if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
            toolCallsByIndex.set(idx, cur);
          }
        }
        if (ch.finish_reason) finishReason = ch.finish_reason;
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("上游 SSE 流")) throw err;
    }
  }

  if (!sawChunk) return null;

  const content =
    textParts.join("") || (reasoningParts.length > 0 ? reasoningParts.join("") : "");
  const toolCalls = Array.from(toolCallsByIndex.values());
  if (!content && toolCalls.length === 0) return null;

  return {
    id,
    model,
    created,
    choices: [
      {
        index: 0,
        finish_reason: finishReason ?? (toolCalls.length > 0 ? "tool_calls" : "stop"),
        message: {
          role: "assistant",
          content: content || null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
      },
    ],
    ...(usage ? { usage } : {}),
  };
}

/**
 * Wraps fetch for OpenAI-compatible gateways & relays to prevent @ai-sdk/openai crashes
 * such as `Cannot read properties of undefined (reading 'message')` on empty choices,
 * normalize SSE-wrapped responses, merge multi-choice reasoning relays, and surface
 * clear upstream errors.
 */
export function createNormalizingOpenAiFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (!response.ok) {
      let normalizedErrorJson: string | null = null;
      if (trimmed.startsWith("{")) {
        try {
          const errJson = JSON.parse(trimmed) as Record<string, unknown>;
          const errObj = errJson.error as Record<string, unknown> | undefined;
          if (!errObj || typeof errObj.message !== "string") {
            const msg =
              extractGatewayErrorMessage(errJson) ||
              response.statusText ||
              `HTTP ${response.status}`;
            normalizedErrorJson = JSON.stringify({
              error: { message: msg, code: response.status },
            });
          }
        } catch {
          // ignore malformed error JSON
        }
      }
      if (!normalizedErrorJson) {
        const snippet = trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
        normalizedErrorJson = JSON.stringify({
          error: {
            message: snippet
              ? `HTTP ${response.status}: ${snippet}`
              : `HTTP ${response.status} ${response.statusText || "Request failed"}`,
            code: response.status,
          },
        });
      }
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      headers.delete("content-length");
      return new Response(normalizedErrorJson, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // Handle gateways that ignore `stream: false` and reply with text/event-stream
    if (contentType.includes("text/event-stream") || /^data:\s*\{/m.test(trimmed)) {
      const assembled = parseSseOpenAiCompletion(rawText);
      if (assembled) {
        const headers = new Headers(response.headers);
        headers.set("content-type", "application/json; charset=utf-8");
        headers.delete("content-length");
        return new Response(JSON.stringify(assembled), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    if (!trimmed) {
      throw new Error("模型网关返回空响应体（HTTP 200），请检查中转站配置或稍后重试。");
    }

    try {
      const json = JSON.parse(rawText) as Record<string, unknown>;
      const upstreamError = extractGatewayErrorMessage(json);

      if (!Array.isArray(json.choices)) {
        if (upstreamError || (typeof json.code === "number" && json.code >= 400)) {
          throw new Error(
            `模型接口返回异常：${upstreamError || `错误码 ${String(json.code ?? "未知")}`}`
          );
        }
        return new Response(rawText, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      if (json.choices.length === 0) {
        throw new Error(
          upstreamError
            ? `模型服务返回错误（choices 为空）：${upstreamError}`
            : "模型网关返回了空的 choices 列表，可能因超时、上游限流或该模型不支持 json_object 结构化模式，请检查模型/中转配置后重试。"
        );
      }

      const textParts: string[] = [];
      const reasoningParts: string[] = [];
      const mergedToolCalls: Array<Record<string, unknown>> = [];
      let finishReason: string | null | undefined;
      let role = "assistant";

      for (const rawChoice of json.choices as Array<Record<string, unknown> | null | undefined>) {
        if (!rawChoice || typeof rawChoice !== "object") continue;
        const msg = (rawChoice.message ?? rawChoice.delta) as Record<string, unknown> | undefined;
        if (msg && typeof msg.role === "string" && msg.role) {
          role = msg.role;
        }
        const directContent =
          typeof msg?.content === "string"
            ? msg.content
            : typeof rawChoice.text === "string"
              ? rawChoice.text
              : null;
        if (directContent && directContent.trim().length > 0) {
          textParts.push(directContent);
        }
        const reasoningVal =
          typeof msg?.reasoning_content === "string"
            ? msg.reasoning_content
            : typeof msg?.reasoning === "string"
              ? msg.reasoning
              : null;
        if (reasoningVal && reasoningVal.trim().length > 0) {
          reasoningParts.push(reasoningVal);
        }
        if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls as Array<Record<string, unknown>>) {
            mergedToolCalls.push({
              ...tc,
              index: mergedToolCalls.length,
            });
          }
        }
        if (typeof rawChoice.finish_reason === "string" && rawChoice.finish_reason) {
          finishReason = rawChoice.finish_reason;
        }
      }

      const finalContent =
        textParts.length > 0
          ? textParts.join("\n")
          : reasoningParts.length > 0 && mergedToolCalls.length === 0
            ? reasoningParts.join("\n")
            : null;

      json.choices = [
        {
          index: 0,
          finish_reason: finishReason ?? (mergedToolCalls.length > 0 ? "tool_calls" : "stop"),
          message: {
            role,
            content: finalContent,
            ...(mergedToolCalls.length > 0 ? { tool_calls: mergedToolCalls } : {}),
          },
        },
      ];

      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      headers.delete("content-length");
      return new Response(JSON.stringify(json), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err) {
      if (err instanceof Error && (err.message.startsWith("模型") || err.message.startsWith("上游 SSE"))) {
        throw err;
      }
      return new Response(rawText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
  };
}

function createNormalizingGoogleFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (response.ok && trimmed.startsWith("{")) {
      try {
        const json = JSON.parse(trimmed) as {
          error?: unknown;
          candidates?: Array<{ content?: unknown }>;
          promptFeedback?: { blockReason?: string };
        };
        if (json.error) {
          const msg = extractGatewayErrorMessage(json as Record<string, unknown>);
          throw new Error(`Gemini 接口返回错误：${msg || trimmed.slice(0, 180)}`);
        }
        if (Array.isArray(json.candidates) && json.candidates.length === 0) {
          const blockReason = json.promptFeedback?.blockReason;
          throw new Error(
            blockReason
              ? `Gemini 未返回候选内容（安全/策略拦截：${blockReason}）`
              : "Gemini 未返回候选结果（candidates 为空），请稍后重试。"
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Gemini ")) {
          throw err;
        }
      }
    }

    return new Response(rawText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

function isAbortError(err: unknown, parentSignal?: AbortSignal): boolean {
  if (parentSignal?.aborted) return true;
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError" || name === "TimeoutError";
}

function shouldFallbackToGenerateText(err: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(err)) return true;
  if (APICallError.isInstance(err)) {
    const status = err.statusCode;
    // Do NOT burn another 90s falling back on auth / billing / missing model / rate limit
    if (status === 401 || status === 402 || status === 403 || status === 404 || status === 429) {
      return false;
    }
    const msg = (err.message || "").toLowerCase();
    // Retry with plain generateText if server rejected json_object / json_schema / response_format
    if (
      status === 400 ||
      msg.includes("response_format") ||
      msg.includes("json_object") ||
      msg.includes("json_schema") ||
      msg.includes("structured") ||
      msg.includes("choices")
    ) {
      return true;
    }
    if (status && status >= 500) {
      return false;
    }
  }
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (message.includes("choices 为空") || message.includes("reading 'message'")) {
    return true;
  }
  return true;
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
          choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown } }>;
        };
        const content = parsed?.choices?.[0]?.message?.content;
        const reasoning = parsed?.choices?.[0]?.message?.reasoning_content;
        if (typeof content === "string" && content.trim()) {
          texts.push(content);
        }
        if (typeof reasoning === "string" && reasoning.trim()) {
          texts.push(reasoning);
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
  const openAiBaseURL = normalizeOpenAiBaseUrl(config.baseUrl);
  const openAiFetch = createNormalizingOpenAiFetch();

  switch (config.provider) {
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL,
        fetch: createNormalizingGoogleFetch(),
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
        baseURL: openAiBaseURL || "https://api.deepseek.com/v1",
        compatibility: "compatible",
        fetch: openAiFetch,
      });
      return deepseek(config.model.trim() || "deepseek-chat");
    }
    case "custom": {
      const custom = createOpenAI({
        apiKey,
        baseURL: openAiBaseURL || "https://api.openai.com/v1",
        compatibility: "compatible",
        fetch: openAiFetch,
      });
      return custom(config.model.trim() || "gpt-4o-mini");
    }
    case "openai":
    default: {
      const openai = createOpenAI({
        apiKey,
        baseURL: openAiBaseURL,
        compatibility: openAiBaseURL ? "compatible" : "strict",
        fetch: openAiFetch,
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
        if (isAbortError(firstErr, abortSignal) || callSignal.aborted) {
          throw firstErr;
        }
        const recovered = tryRecoverFromErrorText(firstErr, schema);
        if (recovered !== null) return recovered;

        if (!shouldFallbackToGenerateText(firstErr)) {
          throw firstErr;
        }

        const { signal: fallbackSignal, cleanup: cleanupFallback } = createCallAbortSignal(
          abortSignal,
          120_000
        );
        try {
          // Fallback via plain generateText without response_format for proxies that fail json_object/json_schema
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
