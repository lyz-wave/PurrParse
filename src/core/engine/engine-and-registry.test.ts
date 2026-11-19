import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { WorkbenchDocument, WorkbenchUnit } from "@/core/contracts/document-ast";
import type {
  AnnotatedUnitOutput,
  BottomStepOutput,
  SourceUnit,
  TopModelStepOutput,
  WorkbenchModePlugin,
} from "@/core/contracts/mode-plugin";
import {
  BatchUnitsBaseSchema,
  BottomStepBaseSchema,
  TopModelBaseSchema,
  buildHydratedUnit,
} from "@/core/contracts/shared-schemas";
import { chunkArray, runChunkedAnalysis } from "./chunk-orchestrator";
import {
  createAiSdkObjectGenerator,
  createNormalizingOpenAiFetch,
  tryRepairTruncatedJson,
  type StructuredObjectGenerator,
} from "./llm-adapters";
import { PluginRegistry } from "../registry/plugin-registry";
import { academicPaperPlugin, defaultPluginRegistry } from "@/plugins";
import { compileDocumentToStandaloneHtml } from "@/exporters/html-compiler";
import { exportDocumentToMarkdown } from "@/exporters/markdown-exporter";

describe("ChunkedAnalysisEngine & PluginRegistry Extensibility", () => {
  it("chunks units cleanly into expected batch sizes", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("orchestrates TopModel -> Batched Units -> Bottom steps using StructuredObjectGenerator", async () => {
    const promptsSeen: string[] = [];
    const mockGenerator: StructuredObjectGenerator = {
      async generate<T>({ prompt }: { prompt: string; schema: unknown }): Promise<T> {
        promptsSeen.push(prompt);
        if (promptsSeen.length === 1) {
          const top: TopModelStepOutput = {
            title: "Mocked Paper",
            subtitle: "Mocked Subtitle",
            badges: ["MOCK"],
            globalContextSummary: "CTX_GLOBAL_TOKEN",
            topMentalModel: {
              title: "00. Top Model",
              subtitle: "Sub",
              cards: [{ tag: "Thesis", body: "Core Claim" }],
              diagram: {
                title: "Flow",
                hint: "Hint",
                nodes: [{ id: "n1", label: "Node 1", targetUnitId: "sec-1-p1" }],
                edges: [],
              },
              glossaryTitle: "Glossary",
              glossary: [{ term: "Attention", definition: "Weighted sum" }],
            },
            sections: [
              {
                id: "sec-1",
                navLabel: "01. Intro",
                title: "1. Introduction",
                taskBadge: "Task",
              },
            ],
          };
          return top as T;
        }
        if (promptsSeen.length === 2) {
          return {
            units: [
              {
                unitId: "sec-abstract-p1",
                weight: "core",
                tldr: "TLDR 1",
                secondaryBlockText: "中文翻译 1",
                highlights: [],
                notes: [
                  { body: "n1" },
                  { body: "n2" },
                  { body: "n3" },
                  { body: "n4" },
                ],
              },
              {
                unitId: "sec-1-p1",
                weight: "support",
                tldr: "TLDR 2",
                secondaryBlockText: "中文翻译 2",
                highlights: [],
                notes: [
                  { body: "n1" },
                  { body: "n2" },
                  { body: "n3" },
                  { body: "n4" },
                ],
              },
            ],
          } as T;
        }
        const bottom: BottomStepOutput = {
          bottomTitle: "08. Bottom",
          bottomBlocks: [{ type: "statement-banner", tag: "DONE", body: "Summary" }],
        };
        return bottom as T;
      },
    };

    const events: string[] = [];
    let finalDoc: WorkbenchDocument | undefined;

    const gen = runChunkedAnalysis(
      academicPaperPlugin,
      {
        kind: "text",
        content: `Abstract\n\nFirst full paragraph in the paper abstract describing sequence modeling without recurrence.\n\n1. Introduction\n\nSecond full paragraph in the introduction detailing multi-head scaled dot-product attention.`,
      },
      { generator: mockGenerator, batchSize: 4 }
    );

    while (true) {
      const next = await gen.next();
      if (next.done) {
        finalDoc = next.value;
        break;
      }
      events.push(next.value.type);
    }

    expect(events).toContain("source-ready");
    expect(events).toContain("top-model");
    expect(events).toContain("unit-batch");
    expect(events).toContain("bottom");
    expect(events).toContain("complete");
    expect(promptsSeen[1]).toContain("CTX_GLOBAL_TOKEN");
    expect(finalDoc?.units.length).toBe(2);
    expect(finalDoc?.units[0].tldr).toBe("TLDR 1");
  });

  it("supports plugging in a brand-new 4th mode without modifying engine, UI, or exporters", async () => {
    const customModuleLabels: [string, string, string, string] = [
      "01 / Claim Scope",
      "02 / Prior Art Delta",
      "03 / Infringement Boundary",
      "04 / Invalidity Risk",
    ];

    const patentPlugin: WorkbenchModePlugin<
      TopModelStepOutput,
      { units: AnnotatedUnitOutput[] },
      BottomStepOutput
    > = {
      id: "patent-claim",
      name: "专利权利要求拆解",
      shortLabel: "MODE 04 · 专利审查",
      description: "第四个热插拔模式验证插件",
      layoutRatio: [50, 50],
      inputConfig: {
        placeholder: "Paste patent claims...",
        hint: "Heuristic test plugin",
        supportsFileUpload: false,
        acceptedFileTypes: ".txt",
        supportsRepoUrl: false,
      },
      dimensions: [
        { key: "dim1", colorSlot: "yellow", label: "独立权项", extractionRule: "Independent claim" },
        { key: "dim2", colorSlot: "red", label: "技术特征", extractionRule: "Element", enableTooltip: true },
        { key: "dim3", colorSlot: "blue", label: "实施例", extractionRule: "Embodiment" },
        { key: "dim4", colorSlot: "green", label: "等同边界", extractionRule: "Equivalence" },
        { key: "dim5", colorSlot: "purple", label: "无效风险", extractionRule: "Prior art" },
      ],
      annotationModuleLabels: customModuleLabels,
      documentLabels: {
        paretoButton: "[80/20 核心权项]",
        toggleSecondaryButton: "[显/隐中文释义]",
        toggleNotesButton: "[显/隐审查批注]",
        exportMdButton: "[导出 MD]",
        exportHtmlButton: "[导出 HTML]",
        userNoteButton: "[+ 随手笔记]",
        userNotePlaceholder: "Patent note...",
        transitionPrefix: "[CLAIM LINK]",
        mentalNavLabel: "00. 权利要求总览",
        bottomNavLabel: "08. 侵权核查清单",
      },
      async preprocessSource(payload): Promise<SourceUnit[]> {
        return [
          {
            id: "claim-1",
            unitCode: "Claim 1",
            sectionId: "sec-claims",
            sectionTitle: "Claims",
            primaryKind: "prose",
            rawPrimaryText: payload.content,
          },
        ];
      },
      schemas: {
        topMentalModel: TopModelBaseSchema,
        batchUnits: BatchUnitsBaseSchema,
        bottomWorkbench: BottomStepBaseSchema,
      },
      buildPrompts: {
        topModelPrompt: (t) => t,
        batchUnitsPrompt: () => "batch",
        bottomWorkbenchPrompt: (t) => t,
      },
      hydrateUnit(source, ann): WorkbenchUnit {
        return buildHydratedUnit(source, ann, customModuleLabels);
      },
      createHeuristicDocument(title, units): WorkbenchDocument {
        return {
          id: "doc-patent-test",
          modeId: "patent-claim",
          modeName: "专利权利要求拆解",
          title,
          subtitle: "Custom 4th Mode",
          badges: ["MODE 04"],
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
          layoutRatio: [50, 50],
          dimensions: this.dimensions,
          labels: this.documentLabels,
          topMentalModel: {
            title: "00. Patent Map",
            subtitle: "Plugin test",
            cards: [{ tag: "Scope", body: "Broad claim coverage" }],
            diagram: {
              title: "Claim Tree",
              hint: "Click claim",
              nodes: [{ id: "c1", label: "Claim 1", targetUnitId: "claim-1" }],
              edges: [],
            },
            glossaryTitle: "Terms",
            glossary: [{ term: "Preamble", definition: "Opening scope" }],
          },
          sections: [
            { id: "sec-claims", navLabel: "Claims", title: "1. Independent Claims", taskBadge: "Scope" },
          ],
          units: units.map((u) =>
            this.hydrateUnit(u, {
              unitId: u.id,
              weight: "core",
              tldr: "Core independent claim",
              secondaryBlockText: "一种用于...",
              highlights: [{ text: "method", dim: "dim1" }],
              notes: [{ body: "Broad claim" }, { body: "Role" }, { body: "Mechanism" }, { body: "Risk" }],
            })
          ),
          bottomTitle: "08. Infringement Checklist",
          bottomBlocks: [{ type: "checklist", title: "Elements", items: [{ id: "e1", tag: "E1", text: "Step A" }] }],
        };
      },
    };

    const registry = new PluginRegistry();
    defaultPluginRegistry.list().forEach((p) => registry.register(p));
    registry.register(patentPlugin);

    expect(registry.has("patent-claim")).toBe(true);
    expect(registry.list().length).toBe(4);

    const gen = runChunkedAnalysis(registry.get("patent-claim"), {
      kind: "text",
      content: "A method for distributed consensus comprising...",
    });
    let doc: WorkbenchDocument | undefined;
    while (true) {
      const step = await gen.next();
      if (step.done) {
        doc = step.value;
        break;
      }
    }

    expect(doc?.modeId).toBe("patent-claim");
    const md = exportDocumentToMarkdown(doc!);
    const html = compileDocumentToStandaloneHtml(doc!);
    expect(md).toContain("Claim 1");
    expect(html).toContain("00. Patent Map");
  });

  it("executes batch and bottom tasks concurrently and preserves original unit order despite out-of-order completion", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let callIndex = 0;

    const mockGenerator: StructuredObjectGenerator = {
      async generate<T>({ schemaName }: { schemaName: string }): Promise<T> {
        callIndex += 1;
        if (schemaName.endsWith("_top_mental_model")) {
          const top: TopModelStepOutput = {
            title: "Parallel Paper",
            subtitle: "Concurrency Test",
            badges: ["FAST"],
            globalContextSummary: "CTX_PARALLEL",
            topMentalModel: {
              title: "00. Parallel Map",
              subtitle: "Sub",
              cards: [{ tag: "Thesis", body: "Core Claim" }],
              diagram: {
                title: "Flow",
                hint: "Hint",
                nodes: [{ id: "n1", label: "Node 1", targetUnitId: "sec-1-p1" }],
                edges: [],
              },
              glossaryTitle: "Glossary",
              glossary: [{ term: "Concurrency", definition: "Parallel pool" }],
            },
            sections: [
              { id: "sec-1", navLabel: "1. Intro", title: "1. Introduction", taskBadge: "Task" },
            ],
          };
          return top as T;
        }

        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          if (schemaName.endsWith("_batch_1")) {
            // Delay batch 1 longer than batch 2 & bottom so completion arrives out-of-order
            await new Promise((r) => setTimeout(r, 45));
            return {
              units: [
                {
                  unitId: "sec-1-p1",
                  weight: "core",
                  tldr: "BATCH1_FIRST",
                  secondaryBlockText: "中文第一段",
                  highlights: [],
                  notes: [{ body: "a" }, { body: "b" }, { body: "c" }, { body: "d" }],
                },
                {
                  unitId: "sec-1-p2",
                  weight: "support",
                  tldr: "BATCH1_SECOND",
                  secondaryBlockText: "中文第二段",
                  highlights: [],
                  notes: [{ body: "a" }, { body: "b" }, { body: "c" }, { body: "d" }],
                },
              ],
            } as T;
          }
          if (schemaName.endsWith("_batch_2")) {
            await new Promise((r) => setTimeout(r, 10));
            return {
              units: [
                {
                  unitId: "sec-1-p3",
                  weight: "support",
                  tldr: "BATCH2_THIRD",
                  secondaryBlockText: "中文第三段",
                  highlights: [],
                  notes: [{ body: "a" }, { body: "b" }, { body: "c" }, { body: "d" }],
                },
                {
                  unitId: "sec-1-p4",
                  weight: "core",
                  tldr: "BATCH2_FOURTH",
                  secondaryBlockText: "中文第四段",
                  highlights: [],
                  notes: [{ body: "a" }, { body: "b" }, { body: "c" }, { body: "d" }],
                },
              ],
            } as T;
          }

          await new Promise((r) => setTimeout(r, 5));
          const bottom: BottomStepOutput = {
            bottomTitle: "08. Bottom",
            bottomBlocks: [{ type: "statement-banner", tag: "DONE", body: "Parallel done" }],
          };
          return bottom as T;
        } finally {
          inFlight -= 1;
        }
      },
    };

    const fourUnits = [
      "1. Introduction",
      "Paragraph one explains scaled dot-product attention in transformer encoders across deep sequence layers, examining how query and key dot products scale by inverse square root dimension to keep softmax gradients stable across long academic benchmarks and diverse training regimes.",
      "Paragraph two discusses residual connections and layer normalization across stacked sublayers, demonstrating how identity skip paths mitigate vanishing gradients and preserve stable representation magnitudes from bottom token embeddings to final classifier heads.",
      "Paragraph three examines multi-head projections across parallel representation subspaces, enabling the attention mechanism to jointly attend to syntactic dependencies and semantic coreference relations across distant positions without sequential recurrence bottlenecks.",
      "Paragraph four evaluates BLEU translation scores and training wall-clock efficiency on standard WMT English-to-German and English-to-French benchmarks, establishing consistent quality improvements alongside substantial parallel hardware utilization gains.",
    ].join("\n\n");

    const gen = runChunkedAnalysis(
      academicPaperPlugin,
      { kind: "text", content: fourUnits },
      { generator: mockGenerator, batchSize: 2, concurrency: 3 }
    );

    let finalDoc: WorkbenchDocument | undefined;
    while (true) {
      const next = await gen.next();
      if (next.done) {
        finalDoc = next.value;
        break;
      }
    }

    expect(callIndex).toBe(4);
    expect(maxInFlight).toBeGreaterThanOrEqual(2);
    expect(finalDoc?.units.map((u) => u.tldr)).toEqual([
      "BATCH1_FIRST",
      "BATCH1_SECOND",
      "BATCH2_THIRD",
      "BATCH2_FOURTH",
    ]);
  });

  it("uses larger batches and fast prompts in speedMode='fast' and respects abortSignal", async () => {
    const batchSchemas: string[] = [];
    const seenPrompts: string[] = [];
    const fastGenerator: StructuredObjectGenerator = {
      async generate<T>({
        schemaName,
        prompt,
      }: {
        schemaName: string;
        prompt: string;
      }): Promise<T> {
        seenPrompts.push(prompt);
        if (schemaName.includes("_batch_")) {
          batchSchemas.push(schemaName);
          return { units: [] } as T;
        }
        if (schemaName.endsWith("_top_mental_model")) {
          return {
            title: "Fast Doc",
            subtitle: "Sub",
            badges: [],
            globalContextSummary: "CTX",
            topMentalModel: {
              title: "00",
              subtitle: "s",
              cards: [{ tag: "T", body: "B" }],
              diagram: { title: "D", hint: "H", nodes: [], edges: [] },
              glossaryTitle: "G",
              glossary: [],
            },
            sections: [{ id: "sec-1", navLabel: "1", title: "1. Intro", taskBadge: "T" }],
          } as T;
        }
        return {
          bottomTitle: "08",
          bottomBlocks: [{ type: "statement-banner", tag: "DONE", body: "Fast" }],
        } as T;
      },
    };

    const nineParas = [
      "1. Introduction",
      ...Array.from(
        { length: 9 },
        (_, i) =>
          `Paragraph number ${i + 1} presents detailed empirical evidence about sequence modeling architectures, gradient flow stability, representation capacity, and parallel training throughput across large-scale NLP and multimodal benchmarks without collapsing adjacent paragraphs.`
      ),
    ].join("\n\n");

    const fastGen = runChunkedAnalysis(
      academicPaperPlugin,
      { kind: "text", content: nineParas },
      { generator: fastGenerator, speedMode: "fast" }
    );
    while (!(await fastGen.next()).done) {
      // drain
    }

    // 9 units with fast batchSize=8 -> 2 batches
    expect(batchSchemas).toHaveLength(2);
    expect(seenPrompts.some((p) => p.includes("极速精简模式"))).toBe(true);

    const abortController = new AbortController();
    abortController.abort();
    const abortedGen = runChunkedAnalysis(
      academicPaperPlugin,
      { kind: "text", content: nineParas },
      { generator: fastGenerator, abortSignal: abortController.signal }
    );
    await expect(abortedGen.next()).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("LLM Adapter Gateway Normalization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const SampleSchema = z.object({
    ok: z.boolean(),
    label: z.string(),
  });

  it("turns HTTP 200 empty choices into a descriptive error instead of undefined.message crash", async () => {
    const baseFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "cmpl-empty",
          object: "chat.completion",
          choices: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const normalizedFetch = createNormalizingOpenAiFetch(baseFetch);
    await expect(
      normalizedFetch("https://relay.example.com/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ model: "deepseek-chat" }),
      })
    ).rejects.toThrow(/模型网关返回了空的 choices 列表/);

    const seenUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        seenUrls.push(String(input));
        return new Response(
          JSON.stringify({
            id: "cmpl-empty-2",
            object: "chat.completion",
            choices: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );

    const generator = createAiSdkObjectGenerator({
      provider: "openai",
      apiKey: "sk-test",
      model: "deepseek-chat",
      baseUrl: "https://relay.example.com",
    });

    let caughtError: unknown;
    try {
      await generator.generate({
        schema: SampleSchema,
        schemaName: "sample_empty_choices",
        prompt: "return sample",
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    const msg = (caughtError as Error).message;
    expect(msg).not.toContain("Cannot read properties of undefined");
    expect(msg).toMatch(/[\u4e00-\u9fa5]/);
    expect(seenUrls[0]).toBe("https://relay.example.com/v1/chat/completions");
  });

  it("converts SSE text/event-stream responses on non-streaming requests into valid completions", async () => {
    const ssePayload = [
      'data: {"id":"sse-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"{\\"ok\\":true,"}}]}',
      "",
      'data: {"id":"sse-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"\\"label\\":\\"sse\\"}"}}]}',
      "",
      'data: {"id":"sse-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const normalizedFetch = createNormalizingOpenAiFetch(async () =>
      new Response(ssePayload, {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      })
    );
    const normalizedRes = await normalizedFetch("https://relay.example.com/v1/chat/completions", {
      method: "POST",
    });
    expect(normalizedRes.ok).toBe(true);
    expect(normalizedRes.headers.get("content-type")).toContain("application/json");
    const parsedJson = (await normalizedRes.json()) as {
      choices: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    expect(parsedJson.choices).toHaveLength(1);
    expect(parsedJson.choices[0]?.message?.content).toBe('{"ok":true,"label":"sse"}');

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(ssePayload, {
          status: 200,
          headers: { "content-type": "text/event-stream; charset=utf-8" },
        })
      )
    );

    const generator = createAiSdkObjectGenerator({
      provider: "openai",
      apiKey: "sk-test",
      model: "deepseek-chat",
      baseUrl: "https://relay.example.com/v1",
    });

    const result = await generator.generate({
      schema: SampleSchema,
      schemaName: "sample_sse",
      prompt: "return sample",
    });
    expect(result).toEqual({ ok: true, label: "sse" });
  });

  it("merges multi-choice reasoning and JSON content responses", async () => {
    const multiChoicePayload = {
      id: "cmpl-multi",
      object: "chat.completion",
      choices: [
        {
          index: 0,
          message: { role: "assistant", reasoning_content: "thinking step" },
          finish_reason: null,
        },
        {
          index: 1,
          message: { role: "assistant", content: '{"ok":true,"label":"merged"}' },
          finish_reason: "stop",
        },
      ],
    };

    const normalizedFetch = createNormalizingOpenAiFetch(async () =>
      new Response(JSON.stringify(multiChoicePayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const res = await normalizedFetch("https://relay.example.com/v1/chat/completions", {
      method: "POST",
    });
    const mergedBody = (await res.json()) as {
      choices: Array<{ message?: { content?: string } }>;
    };
    expect(mergedBody.choices).toHaveLength(1);
    expect(mergedBody.choices[0]?.message?.content).toBe('{"ok":true,"label":"merged"}');

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(multiChoicePayload), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const generator = createAiSdkObjectGenerator({
      provider: "openai",
      apiKey: "sk-test",
      model: "deepseek-reasoner",
      baseUrl: "https://relay.example.com/v1",
    });
    const result = await generator.generate({
      schema: SampleSchema,
      schemaName: "sample_multi_choice",
      prompt: "return sample",
    });
    expect(result).toEqual({ ok: true, label: "merged" });
  });

  it("surfaces HTTP 200 error envelopes from upstream gateways", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "Upstream quota exceeded",
              code: "insufficient_quota",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const generator = createAiSdkObjectGenerator({
      provider: "openai",
      apiKey: "sk-test",
      model: "deepseek-chat",
      baseUrl: "https://relay.example.com/v1",
    });

    await expect(
      generator.generate({
        schema: SampleSchema,
        schemaName: "sample_http200_error",
        prompt: "return sample",
      })
    ).rejects.toThrow(/Upstream quota exceeded/);
  });

  it("skips redundant generateText fallback on HTTP 401 authentication errors", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Invalid API key",
            type: "authentication_error",
          },
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const generator = createAiSdkObjectGenerator({
      provider: "openai",
      apiKey: "sk-invalid",
      model: "deepseek-chat",
      baseUrl: "https://relay.example.com/v1",
    });

    await expect(
      generator.generate({
        schema: SampleSchema,
        schemaName: "sample_auth_401",
        prompt: "return sample",
      })
    ).rejects.toThrow(/Invalid API key/);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("uses stream: true with JSON schema prompt first for OpenAI-compatible proxies and handles heartbeat/reasoning SSE quirks", async () => {
    const capturedBodies: Array<{ stream?: boolean; response_format?: unknown; messages?: Array<{ role: string; content: string }> }> = [];
    const messySse = [
      ": keepalive",
      'data: {"id":"s1","choices":[]}',
      'data: {"id":"s1","choices":[{"delta":{"role":"model","reasoning_content":"<think>planning</think>"}}]}',
      'data: {"id":"s1","choices":[{"delta":{"role":"","content":"```json\\n{\\"ok\\":true,"}}]}',
      'data: {"id":"s1","choices":[{"delta":{"content":"\\"label\\":\\"streamed\\"}\\n```"},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ].join("\n\n");

    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === "string") {
        capturedBodies.push(JSON.parse(init.body));
      }
      return new Response(messySse, {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const generator = createAiSdkObjectGenerator({
      provider: "deepseek",
      apiKey: "sk-test",
      model: "deepseek-v4.1-flash-eco",
      baseUrl: "https://relay.example.com",
    });

    const result = await generator.generate({
      schema: SampleSchema,
      schemaName: "sample_proxy_stream",
      prompt: "return sample",
    });

    expect(result).toEqual({ ok: true, label: "streamed" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(capturedBodies[0]?.stream).toBe(true);
    expect(capturedBodies[0]?.response_format).toBeUndefined();
    const systemMsg = capturedBodies[0]?.messages?.find((m) => m.role === "system")?.content ?? "";
    expect(systemMsg).toContain('"label"');
  });

  it("extracts JSON from reasoning-only SSE streams when content delta is absent", async () => {
    const reasoningOnlySse = [
      'data: {"id":"r1","choices":[{"delta":{"role":"assistant","reasoning_content":"Thinking... {\\"ok\\":false,\\"label\\":\\"from-reasoning\\"}"}}]}',
      'data: {"id":"r1","choices":[{"delta":{},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ].join("\n\n");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(reasoningOnlySse, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        })
      )
    );

    const generator = createAiSdkObjectGenerator({
      provider: "custom",
      apiKey: "sk-test",
      model: "deepseek-reasoner",
      baseUrl: "https://relay.example.com/v1",
    });

    const result = await generator.generate({
      schema: SampleSchema,
      schemaName: "sample_reasoning_only",
      prompt: "return sample",
    });
    expect(result).toEqual({ ok: false, label: "from-reasoning" });
  });

  it("surfaces clear error on empty SSE stream without burning redundant non-stream call", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response("data: [DONE]\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const generator = createAiSdkObjectGenerator({
      provider: "custom",
      apiKey: "sk-test",
      model: "deepseek-v4.1-flash-eco",
      baseUrl: "https://relay.example.com/v1",
    });

    await expect(
      generator.generate({
        schema: SampleSchema,
        schemaName: "sample_empty_sse",
        prompt: "return sample",
      })
    ).rejects.toThrow(/空的流式响应/);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to generateObject backup only when streamed text fails JSON schema parsing", async () => {
    let callCount = 0;
    const fetchSpy = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          [
            'data: {"id":"bad-json","choices":[{"index":0,"delta":{"role":"assistant","content":"not valid json at all"},"finish_reason":"stop"}]}',
            "data: [DONE]",
          ].join("\n\n"),
          { status: 200, headers: { "content-type": "text/event-stream" } }
        );
      }
      return new Response(
        JSON.stringify({
          id: "backup-ok",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: '{"ok":true,"label":"backup"}' },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const generator = createAiSdkObjectGenerator({
      provider: "custom",
      apiKey: "sk-test",
      model: "deepseek-chat",
      baseUrl: "https://relay.example.com/v1",
    });

    const result = await generator.generate({
      schema: SampleSchema,
      schemaName: "sample_backup_obj",
      prompt: "return sample",
    });
    expect(result).toEqual({ ok: true, label: "backup" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("repairs and recovers TopModel JSON truncated mid-section by max_tokens without failing", async () => {
    const truncatedTopModelJson =
      '{"title":"Deep Residual Learning","subtitle":"恒等捷径","globalContextSummary":"CTX","topMentalModel":{"title":"00","subtitle":"s","cards":[{"tag":"T","body":"B"}],"diagram":{"title":"D","hint":"H","nodes":[],"edges":[]},"glossaryTitle":"G","glossary":[]},"sections":[{"id":"sec-1","navLabel":"1","title":"1. Intro","taskBadge":"T","summary":{"established":"ok","openQuestions":"q","rhetoricStrategy":"r","referenceRecall":"ref","reviewerCritique":"rev","socraticQuestions":[]}},{"id":"sec-2","navLabel":"2","title":"2. Related","taskBadge":"T","summary":{"established":"partial","openQuestions":"q","rhetoricStrategy":"r","referenceRecall":"ref","reviewerCritique":"rev","socraticQuestions":[{"category":"澄清概念","question":"退化看训练误差还是测试误差？';

    const directRepaired = tryRepairTruncatedJson(truncatedTopModelJson) as {
      title?: string;
      sections?: Array<{ id: string }>;
    } | null;
    expect(directRepaired?.title).toBe("Deep Residual Learning");
    expect(directRepaired?.sections?.map((s) => s.id)).toEqual(["sec-1"]);

    const fetchSpy = vi.fn(async () =>
      new Response(
        [
          `data: ${JSON.stringify({
            id: "trunc-1",
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: truncatedTopModelJson },
                finish_reason: "length",
              },
            ],
          })}`,
          "data: [DONE]",
        ].join("\n\n"),
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const generator = createAiSdkObjectGenerator({
      provider: "custom",
      apiKey: "sk-test",
      model: "deepseek-v4.1-flash-eco",
      baseUrl: "https://relay.example.com/v1",
    });

    const recovered = await generator.generate({
      schema: TopModelBaseSchema,
      schemaName: "academic_top_mental_model",
      prompt: "analyze paper",
    });

    expect(recovered.title).toBe("Deep Residual Learning");
    expect(recovered.sections).toHaveLength(1);
    expect(recovered.sections[0]?.id).toBe("sec-1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("allocates full 8192 maxTokens and explicit sectionId list in fast mode to prevent truncation", async () => {
    const seenMaxTokens: number[] = [];
    const seenPrompts: string[] = [];
    const probeGenerator: StructuredObjectGenerator = {
      async generate<T>({
        schemaName,
        prompt,
        maxTokens,
      }: {
        schemaName: string;
        prompt: string;
        maxTokens?: number;
      }): Promise<T> {
        seenMaxTokens.push(maxTokens ?? 0);
        seenPrompts.push(prompt);
        if (schemaName.includes("_batch_")) return { units: [] } as T;
        if (schemaName.endsWith("_top_mental_model")) {
          return {
            title: "Doc",
            subtitle: "Sub",
            badges: [],
            globalContextSummary: "CTX",
            topMentalModel: {
              title: "00",
              subtitle: "s",
              cards: [{ tag: "T", body: "B" }],
              diagram: { title: "D", hint: "H", nodes: [], edges: [] },
              glossaryTitle: "G",
              glossary: [],
            },
            sections: [{ id: "sec-1", navLabel: "1", title: "1. Intro", taskBadge: "T" }],
          } as T;
        }
        return {
          bottomTitle: "08",
          bottomBlocks: [{ type: "statement-banner", tag: "DONE", body: "Fast" }],
        } as T;
      },
    };

    const samplePaper = [
      "Abstract",
      "Deep neural networks for image recognition require residual learning to resolve optimization degradation cleanly across hundreds of layers without overfitting.",
      "1. Introduction",
      "First introductory paragraph detailing deep residual networks and identity mapping shortcuts across layers in modern convolutional architectures.",
      "Second introductory paragraph analyzing degradation of training accuracy when plain networks grow deeper than standard baselines on ImageNet.",
    ].join("\n\n");

    const gen = runChunkedAnalysis(
      academicPaperPlugin,
      { kind: "text", content: samplePaper },
      { generator: probeGenerator, speedMode: "fast" }
    );
    while (!(await gen.next()).done) {
      // drain
    }

    expect(seenMaxTokens.every((m) => m === 8192)).toBe(true);
    expect(seenPrompts[0]).toContain("逻辑章节列表");
    expect(seenPrompts[0]).toContain("sec-abstract");
    expect(seenPrompts[0]).toContain("sec-1");
  });
});
