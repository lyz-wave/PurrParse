import { z } from "zod";
import { resolveSearchQueryWithTools } from "@/core/engine/agent-search";
import { runChunkedAnalysis } from "@/core/engine/chunk-orchestrator";
import { createAiSdkObjectGenerator } from "@/core/engine/llm-adapters";
import { defaultPluginRegistry } from "@/plugins";

const AnalyzeRequestSchema = z.object({
  modeId: z.string().min(1),
  title: z.string().optional(),
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

  const { modeId, title, payload, llmConfig } = parsed.data;
  if (!defaultPluginRegistry.has(modeId)) {
    return new Response(`Unknown workbench mode plugin: ${modeId}`, { status: 400 });
  }

  const plugin = defaultPluginRegistry.get(modeId);
  const generator =
    llmConfig && llmConfig.apiKey.trim().length > 0
      ? createAiSdkObjectGenerator(llmConfig)
      : undefined;

  const encoder = new TextEncoder();
  const enqueueEvent = (controller: ReadableStreamDefaultController<Uint8Array>, obj: unknown) => {
    controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
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
          generator,
        })) {
          enqueueEvent(controller, event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected analysis error";
        enqueueEvent(controller, { type: "error", message });
      } finally {
        controller.close();
      }
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
