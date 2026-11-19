import { describe, expect, it } from "vitest";
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
import type { StructuredObjectGenerator } from "./llm-adapters";
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
