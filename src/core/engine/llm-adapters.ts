import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  APICallError,
  generateObject,
  NoObjectGeneratedError,
  streamText,
  zodSchema,
  type LanguageModelV1,
} from "ai";
import { ZodError, type z } from "zod";

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

interface OpenAiRequestInfo {
  isStream: boolean;
  model?: string;
  hasResponseFormat: boolean;
}

interface GatewayCallDiagnostic {
  target: string;
  model?: string;
  isStream: boolean;
  hasResponseFormat: boolean;
  startedAt: number;
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

function inspectOpenAiRequest(init?: RequestInit): OpenAiRequestInfo {
  if (!init || typeof init.body !== "string") {
    return { isStream: false, hasResponseFormat: false };
  }
  try {
    const parsed = JSON.parse(init.body) as {
      stream?: unknown;
      model?: unknown;
      response_format?: unknown;
    };
    return {
      isStream: parsed.stream === true,
      model: typeof parsed.model === "string" ? parsed.model : undefined,
      hasResponseFormat: parsed.response_format != null,
    };
  } catch {
    return { isStream: false, hasResponseFormat: false };
  }
}

function safeTargetLabel(input: RequestInfo | URL): string {
  const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const u = new URL(rawUrl);
    return `${u.origin}${u.pathname}`;
  } catch {
    return String(rawUrl).split("?")[0] || "unknown-gateway";
  }
}

function formatElapsedSec(startedAt: number): string {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}

function extractGatewayErrorMessage(payload: Record<string, unknown> | null | undefined): string {
  if (!payload || typeof payload !== "object") return "";
  const errObj = payload.error as Record<string, unknown> | string | undefined;
  if (typeof errObj === "string" && errObj.trim()) return errObj.trim();
  if (errObj && typeof errObj === "object") {
    const msg = errObj.message ?? errObj.msg ?? errObj.err_msg ?? errObj.error_msg ?? errObj.detail;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  const direct =
    payload.message ??
    payload.msg ??
    payload.err_msg ??
    payload.error_msg ??
    payload.status_msg ??
    payload.reason ??
    payload.detail;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return "";
}

function parseSseOpenAiCompletion(rawSse: string): Record<string, unknown> | null {
  const textParts: string[] = [];
  const reasoningParts: string[] = [];
  const toolCallsByIndex = new Map<
    number,
    { id?: string; type: "function"; function: { name: string; arguments: string } }
  >();
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
            reasoning?: string | null;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          message?: {
            content?: string | null;
            reasoning_content?: string | null;
            reasoning?: string | null;
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
        const reasoningPiece =
          typeof ch.delta?.reasoning_content === "string"
            ? ch.delta.reasoning_content
            : typeof ch.delta?.reasoning === "string"
              ? ch.delta.reasoning
              : typeof ch.message?.reasoning_content === "string"
                ? ch.message.reasoning_content
                : typeof ch.message?.reasoning === "string"
                  ? ch.message.reasoning
                  : null;
        if (reasoningPiece) reasoningParts.push(reasoningPiece);
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

function normalizeErrorResponse(rawText: string, trimmed: string, response: Response): Response {
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

function normalizeOpenAiJsonBody(
  rawText: string,
  responseStatus: number,
  diag: GatewayCallDiagnostic
): Record<string, unknown> | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return null;
  }

  const upstreamError = extractGatewayErrorMessage(json);
  if (!Array.isArray(json.choices)) {
    if (upstreamError || (typeof json.code === "number" && json.code >= 400)) {
      throw new Error(
        `模型接口返回异常：${upstreamError || `错误码 ${String(json.code ?? "未知")}`}`
      );
    }
    return null;
  }

  if (json.choices.length === 0) {
    const elapsedSec = formatElapsedSec(diag.startedAt);
    console.warn("[llm-gateway] empty choices payload", {
      target: diag.target,
      model: diag.model,
      status: responseStatus,
      elapsedSec,
      isStream: diag.isStream,
      hasResponseFormat: diag.hasResponseFormat,
      keys: Object.keys(json),
      upstreamError: upstreamError || undefined,
    });
    throw new Error(
      upstreamError
        ? `模型服务返回错误（choices 为空）：${upstreamError}`
        : `模型网关返回了空的 choices 列表（HTTP ${responseStatus}，耗时 ${elapsedSec}s），可能因超时、上游限流或该模型不支持当前参数，请检查模型/中转配置后重试。`
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
  return json;
}

function jsonCompletionToSsePayload(json: Record<string, unknown>): string {
  const firstChoice = Array.isArray(json.choices)
    ? (json.choices[0] as {
        finish_reason?: string | null;
        message?: { content?: string | null; tool_calls?: unknown[] };
      })
    : undefined;
  const content = firstChoice?.message?.content;
  const toolCalls = firstChoice?.message?.tool_calls;
  const chunk = {
    id: json.id,
    object: "chat.completion.chunk",
    created: json.created,
    model: json.model,
    choices: [
      {
        index: 0,
        delta: {
          role: "assistant",
          ...(typeof content === "string" ? { content } : {}),
          ...(Array.isArray(toolCalls) && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: firstChoice?.finish_reason ?? "stop",
      },
    ],
    ...(json.usage ? { usage: json.usage } : {}),
  };
  return `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
}

/**
 * Line-buffered SSE normalizer for streaming responses:
 * - Fixes missing choice indices or non-standard roles/logprobs so @ai-sdk/openai chunk schema never crashes
 * - Buffers reasoning_content as fallback only when zero content or tool_calls arrive
 * - Emits a clear diagnostic SSE error when a relay finishes [DONE] with empty output
 */
function createNormalizingOpenAiSseStream(
  diag: GatewayCallDiagnostic
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let lineBuffer = "";
  let hasContentOrTools = false;
  let sawError = false;
  let sawDone = false;
  let lastMeta: { id?: string; model?: string; created?: number } = {};
  const reasoningParts: string[] = [];

  const enqueueLine = (controller: TransformStreamDefaultController<Uint8Array>, dataLine: string) => {
    controller.enqueue(encoder.encode(`${dataLine}\n\n`));
  };

  const finalizeIfNeeded = (controller: TransformStreamDefaultController<Uint8Array>) => {
    if (sawDone) return;
    sawDone = true;
    if (!hasContentOrTools && !sawError) {
      if (reasoningParts.length > 0) {
        enqueueLine(
          controller,
          `data: ${JSON.stringify({
            ...lastMeta,
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: reasoningParts.join("") },
                finish_reason: "stop",
              },
            ],
          })}`
        );
      } else {
        const elapsedSec = formatElapsedSec(diag.startedAt);
        console.warn("[llm-gateway] empty SSE stream", {
          target: diag.target,
          model: diag.model,
          elapsedSec,
        });
        enqueueLine(
          controller,
          `data: ${JSON.stringify({
            error: {
              message: `模型网关返回了空的流式响应（耗时 ${elapsedSec}s，未输出任何内容），可能因超时、上游限流或模型异常，请检查模型/中转配置后重试。`,
            },
          })}`
        );
      }
    }
    enqueueLine(controller, "data: [DONE]");
  };

  const processLine = (
    rawLine: string,
    controller: TransformStreamDefaultController<Uint8Array>
  ) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith(":")) return;
    if (!trimmed.startsWith("data:")) return;

    const payload = trimmed.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") {
      finalizeIfNeeded(controller);
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return;
    }

    if (typeof parsed.id === "string") lastMeta.id = parsed.id;
    if (typeof parsed.model === "string") lastMeta.model = parsed.model;
    if (typeof parsed.created === "number") lastMeta.created = parsed.created;

    if (parsed.error != null || (!Array.isArray(parsed.choices) && extractGatewayErrorMessage(parsed))) {
      sawError = true;
      const msg = extractGatewayErrorMessage(parsed) || "上游 SSE 流返回错误";
      enqueueLine(controller, `data: ${JSON.stringify({ error: { message: msg } })}`);
      return;
    }

    if (!Array.isArray(parsed.choices)) {
      return;
    }

    const normalizedChoices: Array<Record<string, unknown>> = [];
    for (let idx = 0; idx < parsed.choices.length; idx++) {
      const ch = parsed.choices[idx] as Record<string, unknown> | null | undefined;
      if (!ch || typeof ch !== "object") continue;

      const delta = (ch.delta && typeof ch.delta === "object"
        ? { ...(ch.delta as Record<string, unknown>) }
        : {}) as Record<string, unknown>;

      if (delta.content == null) {
        const msg = ch.message as Record<string, unknown> | undefined;
        if (typeof msg?.content === "string") {
          delta.content = msg.content;
        } else if (typeof ch.text === "string") {
          delta.content = ch.text;
        }
      }

      if ("role" in delta && delta.role !== "assistant" && delta.role !== null) {
        delete delta.role;
      }
      if (typeof delta.content === "string" && delta.content.length > 0) {
        hasContentOrTools = true;
      }
      if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
        hasContentOrTools = true;
        delta.tool_calls = (delta.tool_calls as Array<Record<string, unknown>>).map((tc, tIdx) => ({
          ...tc,
          index: typeof tc.index === "number" ? tc.index : tIdx,
          type: tc.type ?? "function",
        }));
      }
      if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length > 0) {
        reasoningParts.push(delta.reasoning_content);
      } else if (typeof delta.reasoning === "string" && delta.reasoning.length > 0) {
        reasoningParts.push(delta.reasoning);
      }

      const nextChoice: Record<string, unknown> = {
        index: typeof ch.index === "number" ? ch.index : idx,
        delta,
      };
      if (typeof ch.finish_reason === "string" || ch.finish_reason === null) {
        nextChoice.finish_reason = ch.finish_reason;
      }
      normalizedChoices.push(nextChoice);
    }

    const cleanFrame: Record<string, unknown> = {
      ...lastMeta,
      choices: normalizedChoices,
    };
    if (parsed.usage != null) cleanFrame.usage = parsed.usage;

    enqueueLine(controller, `data: ${JSON.stringify(cleanFrame)}`);
  };

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      lineBuffer += decoder.decode(chunk, { stream: true });
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line, controller);
      }
    },
    flush(controller) {
      const remaining = lineBuffer + decoder.decode();
      if (remaining) {
        for (const line of remaining.split(/\r?\n/)) {
          processLine(line, controller);
        }
      }
      finalizeIfNeeded(controller);
    },
  });
}

/**
 * Wraps fetch for OpenAI-compatible gateways & relays to handle both non-streaming and SSE streams cleanly:
 * prevents @ai-sdk/openai `undefined.message` crashes on empty choices, normalizes unexpected JSON/SSE mismatches,
 * merges multi-choice reasoning relays, and emits diagnostic context on gateway errors.
 */
export function createNormalizingOpenAiFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const reqInfo = inspectOpenAiRequest(init);
    const diag: GatewayCallDiagnostic = {
      target: safeTargetLabel(input),
      model: reqInfo.model,
      isStream: reqInfo.isStream,
      hasResponseFormat: reqInfo.hasResponseFormat,
      startedAt: Date.now(),
    };

    const response = await baseFetch(input, init);
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

    // True streaming path: pipe live SSE responses without blocking on response.text()
    if (reqInfo.isStream) {
      if (!response.ok) {
        const rawText = await response.text();
        return normalizeErrorResponse(rawText, rawText.trim(), response);
      }

      if (contentType.includes("text/event-stream") && response.body) {
        const headers = new Headers(response.headers);
        headers.set("content-type", "text/event-stream; charset=utf-8");
        headers.delete("content-length");
        return new Response(response.body.pipeThrough(createNormalizingOpenAiSseStream(diag)), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      // Gateway ignored `stream: true` and replied with buffered JSON or text
      const rawText = await response.text();
      const trimmed = rawText.trim();
      if (!trimmed) {
        throw new Error(
          `模型网关返回空响应体（HTTP ${response.status}，耗时 ${formatElapsedSec(diag.startedAt)}s），请检查中转站配置或稍后重试。`
        );
      }
      if (/^data:\s*\{/m.test(trimmed)) {
        const headers = new Headers(response.headers);
        headers.set("content-type", "text/event-stream; charset=utf-8");
        headers.delete("content-length");
        const sseStream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(rawText));
            controller.close();
          },
        }).pipeThrough(createNormalizingOpenAiSseStream(diag));
        return new Response(sseStream, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      const normalized = normalizeOpenAiJsonBody(rawText, response.status, diag);
      if (normalized) {
        const headers = new Headers(response.headers);
        headers.set("content-type", "text/event-stream; charset=utf-8");
        headers.delete("content-length");
        return new Response(jsonCompletionToSsePayload(normalized), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
      return new Response(rawText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // Non-streaming path
    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (!response.ok) {
      return normalizeErrorResponse(rawText, trimmed, response);
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
      throw new Error(
        `模型网关返回空响应体（HTTP ${response.status}，耗时 ${formatElapsedSec(diag.startedAt)}s），请检查中转站配置或稍后重试。`
      );
    }

    const normalized = normalizeOpenAiJsonBody(rawText, response.status, diag);
    if (normalized) {
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      headers.delete("content-length");
      return new Response(JSON.stringify(normalized), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return new Response(rawText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

function createNormalizingGoogleFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.includes("text/event-stream")) {
      return response;
    }

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

function isNonRetryableGatewayStatus(err: unknown): boolean {
  if (!APICallError.isInstance(err)) return false;
  const status = err.statusCode;
  return status === 401 || status === 402 || status === 403 || status === 404 || status === 429;
}

function isFormatOrParseFailure(err: unknown): boolean {
  return (
    err instanceof SyntaxError ||
    err instanceof ZodError ||
    NoObjectGeneratedError.isInstance(err)
  );
}

function shouldFallbackFromGenerateObject(err: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(err)) return true;
  if (isNonRetryableGatewayStatus(err)) return false;
  if (APICallError.isInstance(err)) {
    const status = err.statusCode;
    const msg = (err.message || "").toLowerCase();
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

function buildJsonSchemaSystemPrompt<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>): string {
  try {
    const jsonSchemaDef = zodSchema(schema as z.ZodTypeAny).jsonSchema;
    return [
      "You MUST answer with a single valid JSON object matching the JSON schema below.",
      "Do NOT include prose explanations or commentary outside the JSON object.",
      `JSON schema:\n${JSON.stringify(jsonSchemaDef)}`,
    ].join("\n\n");
  } catch {
    return "You MUST answer with a single valid JSON object only.";
  }
}

async function generateViaStreamText<T>(params: {
  model: LanguageModelV1;
  prompt: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  abortSignal: AbortSignal;
  maxTokens: number;
}): Promise<T> {
  const { model, prompt, schema, abortSignal, maxTokens } = params;
  let streamError: unknown = null;

  const result = streamText({
    model,
    system: buildJsonSchemaSystemPrompt(schema),
    prompt: `${prompt}\n\n请严格仅输出符合上述 JSON Schema 的单个合法 JSON 对象。`,
    temperature: 0.2,
    maxTokens,
    maxRetries: 0,
    abortSignal,
    onError: ({ error }) => {
      streamError = error;
    },
  });

  let collectedText = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      collectedText += part.textDelta;
    } else if (part.type === "error") {
      const rawErr = part.error;
      if (rawErr instanceof Error) throw rawErr;
      const msg = extractGatewayErrorMessage(rawErr as Record<string, unknown>);
      throw new Error(msg || (typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr)));
    }
  }

  if (streamError) {
    if (streamError instanceof Error) throw streamError;
    const msg = extractGatewayErrorMessage(streamError as Record<string, unknown>);
    throw new Error(msg || String(streamError));
  }

  if (!collectedText.trim()) {
    throw new Error("模型网关未返回任何有效文本内容（流式输出为空），请检查模型/中转配置后重试。");
  }

  const jsonStr = extractRawJsonCandidate(collectedText);
  const parsedJson = JSON.parse(jsonStr);
  return schema.parse(parsedJson);
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
        // For OpenAI-compatible proxies/relays, stream first (with JSON Schema in system prompt) to avoid
        // reverse-proxy non-streaming idle timeouts and `stream: false` empty choices aggregator bugs.
        if (isOpenAICompatibleProxy) {
          try {
            return await generateViaStreamText({
              model,
              prompt,
              schema,
              abortSignal: callSignal,
              maxTokens,
            });
          } catch (streamErr) {
            if (isAbortError(streamErr, abortSignal) || callSignal.aborted) {
              throw streamErr;
            }
            const recovered = tryRecoverFromErrorText(streamErr, schema);
            if (recovered !== null) return recovered;

            // Only fall back to strict json_object generateObject if the model responded with non-JSON text;
            // skip fallback when auth/quota/rate-limit/gateway-empty errors already failed at HTTP/stream level.
            if (!isFormatOrParseFailure(streamErr)) {
              throw streamErr;
            }

            const { signal: objSignal, cleanup: cleanupObj } = createCallAbortSignal(
              abortSignal,
              120_000
            );
            try {
              const result = await generateObject({
                model,
                schema,
                schemaName,
                prompt,
                temperature: 0.2,
                maxTokens,
                maxRetries: 0,
                abortSignal: objSignal,
                mode: "json",
              });
              return result.object;
            } finally {
              cleanupObj();
            }
          }
        }

        // Direct official providers (Google, Anthropic, direct OpenAI) use structured generateObject first
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
            mode: "auto",
          });
          return result.object;
        } catch (firstErr) {
          if (isAbortError(firstErr, abortSignal) || callSignal.aborted) {
            throw firstErr;
          }
          const recovered = tryRecoverFromErrorText(firstErr, schema);
          if (recovered !== null) return recovered;

          if (!shouldFallbackFromGenerateObject(firstErr)) {
            throw firstErr;
          }

          const { signal: fallbackSignal, cleanup: cleanupFallback } = createCallAbortSignal(
            abortSignal,
            120_000
          );
          try {
            return await generateViaStreamText({
              model,
              prompt,
              schema,
              abortSignal: fallbackSignal,
              maxTokens,
            });
          } finally {
            cleanupFallback();
          }
        }
      } finally {
        cleanup();
      }
    },
  };
}
