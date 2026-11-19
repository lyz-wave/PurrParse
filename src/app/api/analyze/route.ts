import { z } from "zod";
import { resolveSearchQueryWithTools } from "@/core/engine/agent-search";
import { runChunkedAnalysis } from "@/core/engine/chunk-orchestrator";
import { createAiSdkObjectGenerator } from "@/core/engine/llm-adapters";
import {
  formatV2tResultToSections,
  isV2tAvailable,
  runVideoToTextBridge,
} from "@/core/engine/v2t-bridge";
import { registerVideoTranscriber } from "@/core/engine/web-fetchers";
import { defaultPluginRegistry } from "@/plugins";

if (isV2tAvailable()) {
  registerVideoTranscriber(async (url, cacheKey, startSectionIndex, lang = "zh") => {
    const res = await runVideoToTextBridge(url, cacheKey, lang);
    if (!res) return null;
    const sections = formatV2tResultToSections(res, startSectionIndex);
    if (sections.length === 0) return null;
    return {
      sections,
      title: res.source.title,
      uploader: res.source.uploader,
      durationSec: res.source.duration,
    };
  });
}

const AnalyzeRequestSchema = z.object({
  modeId: z.string().min(1),
  title: z.string().optional(),
  speedMode: z.enum(["balanced", "fast"]).optional(),
  batchSize: z.number().int().min(1).max(12).optional(),
  concurrency: z.number().int().min(1).max(6).optional(),
  payload: z.object({
    title: z.string().optional(),
    kind: z.enum(["text", "pdf-base64", "repo-url", "repo-files", "remote-url", "search-query"]),
    content: z.string(),
    fileName: z.string().optional(),
    files: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
    readingPurpose: z.string().optional(),
    userBackground: z.string().optional(),
    userTopic: z.string().optional(),
  }),
  llmConfig: z
    .object({
      provider: z.enum(["google", "openai", "anthropic", "deepseek", "custom"]),
      apiKey: z.string(),
      model: z.string(),
      baseUrl: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON request body", { status: 400 });
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(`Invalid request payload: ${parsed.error.message}`, { status: 400 });
  }

  const { modeId, title, speedMode, batchSize, concurrency, payload, llmConfig } = parsed.data;
  if (!defaultPluginRegistry.has(modeId)) {
    return new Response(`Unknown workbench mode plugin: ${modeId}`, { status: 400 });
  }

  const plugin = defaultPluginRegistry.get(modeId);
  const generator =
    llmConfig && llmConfig.apiKey.trim().length > 0
      ? createAiSdkObjectGenerator(llmConfig)
      : undefined;

  const encoder = new TextEncoder();
  let streamClosed = false;
  const enqueueEvent = (controller: ReadableStreamDefaultController<Uint8Array>, obj: unknown) => {
    if (streamClosed || req.signal.aborted) return;
    try {
      controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
    } catch {
      streamClosed = true;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let effectivePayload = payload;
        let effectiveTitle = title;

        if (payload.kind === "search-query") {
          const resolution = await resolveSearchQueryWithTools({
            query: payload.content,
            plugin,
            llmConfig,
            onProgress: (message) =>
              enqueueEvent(controller, {
                type: "status",
                phase: "ingesting",
                message,
                progress: 12,
              }),
          });
          effectivePayload = resolution.payload;
          if (!effectiveTitle && resolution.resolvedTitle) {
            effectiveTitle = resolution.resolvedTitle;
          }
        }

        for await (const event of runChunkedAnalysis(plugin, effectivePayload, {
          titleOverride: effectiveTitle,
          speedMode,
          batchSize,
          concurrency,
          abortSignal: req.signal,
          generator,
        })) {
          enqueueEvent(controller, event);
        }
      } catch (err) {
        if (!req.signal.aborted && !(err instanceof Error && err.name === "AbortError")) {
          console.error("[/api/analyze] error:", err);
          const rawMsg =
            err instanceof Error
              ? err.message || `${err.name}: 未知服务端异常`
              : typeof err === "string"
                ? err
                : "Unexpected analysis error";
          enqueueEvent(controller, { type: "error", message: rawMsg || "Unexpected analysis error" });
        }
      } finally {
        if (!streamClosed) {
          streamClosed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
    cancel() {
      streamClosed = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
