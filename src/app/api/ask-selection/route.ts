import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import {
  createAiSdkObjectGenerator,
  resolveLanguageModel,
  type LLMConfig,
} from "@/core/engine/llm-adapters";
import type { QaEvidenceItem, QaScope } from "@/core/contracts/document-ast";

export const runtime = "nodejs";
export const maxDuration = 60;

export type QaEffortLevel = "quick" | "think" | "deep";

interface ContextUnitPayload {
  unitId: string;
  unitCode: string;
  sectionTitle?: string;
  tldr: string;
  primaryText: string;
  secondaryText?: string;
}

interface AskSelectionRequestBody {
  docTitle?: string;
  modeName?: string;
  unitId?: string;
  unitCode?: string;
  sectionTitle?: string;
  selectedText?: string;
  unitPrimaryText?: string;
  unitSecondaryText?: string;
  unitTldr?: string;
  scope?: QaScope;
  effort?: QaEffortLevel;
  stream?: boolean;
  question?: string;
  previousTurns?: Array<{ question: string; answer: string }>;
  contextUnits?: ContextUnitPayload[];
  llmConfig?: Partial<LLMConfig>;
}

const QaAnswerSchema = z.object({
  answer: z.string().min(1),
  evidences: z
    .array(
      z.object({
        unitCode: z.string(),
        unitId: z.string().optional(),
        quote: z.string(),
        rationale: z.string(),
      })
    )
    .default([]),
  suggestedFollowUps: z.array(z.string()).default([]),
});

function tokenizeKeywords(text: string): string[] {
  const cleaned = text
    .replace(/[`*_~()[\]{}<>,.;:!?'"\\/|+=-]/g, " ")
    .toLowerCase();
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const cjkBigrams: string[] = [];
  const cjkRuns = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  for (const run of cjkRuns) {
    cjkBigrams.push(run);
    for (let i = 0; i < run.length - 1; i++) {
      cjkBigrams.push(run.slice(i, i + 2));
    }
  }
  return Array.from(new Set([...tokens, ...cjkBigrams])).slice(0, 36);
}

function buildExcerpt(text: string, keywords: string[], maxLen = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;

  const lower = normalized.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx !== -1) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(normalized.length, idx + maxLen - 60);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < normalized.length ? "..." : "";
      return `${prefix}${normalized.slice(start, end).trim()}${suffix}`;
    }
  }

  return `${normalized.slice(0, maxLen).trim()}...`;
}

function findLocalEvidences(params: {
  unitId: string;
  unitCode: string;
  sectionTitle: string;
  selectedText: string;
  unitPrimaryText: string;
  question: string;
  scope: QaScope;
  contextUnits: ContextUnitPayload[];
}): {
  evidences: QaEvidenceItem[];
  keywords: string[];
  topNeighbors: Array<{ unit: ContextUnitPayload; score: number }>;
} {
  const {
    unitId,
    unitCode,
    sectionTitle,
    selectedText,
    unitPrimaryText,
    question,
    scope,
    contextUnits,
  } = params;

  const keywords = tokenizeKeywords(`${selectedText} ${question}`);
  const snippetLower = selectedText.trim().toLowerCase();

  const targetEvidence: QaEvidenceItem = {
    unitCode,
    unitId,
    quote: buildExcerpt(selectedText || unitPrimaryText, keywords, 220),
    rationale: `问题直接锚定的目标段落 (${sectionTitle || unitCode})`,
  };

  const scoredNeighbors = contextUnits
    .filter((u) => u.unitId !== unitId)
    .map((u) => {
      const haystack = `${u.primaryText} ${u.secondaryText ?? ""} ${u.tldr}`.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (haystack.includes(kw.toLowerCase())) {
          score += kw.length >= 4 ? 3 : 1;
        }
      }
      if (snippetLower.length >= 6 && haystack.includes(snippetLower.slice(0, 24))) {
        score += 5;
      }
      return { unit: u, score };
    })
    .sort((a, b) => b.score - a.score);

  const neighborLimit = scope === "document" ? 3 : 1;
  const topNeighbors = scoredNeighbors.filter((item) => item.score > 0).slice(0, neighborLimit);

  const evidences: QaEvidenceItem[] = [
    targetEvidence,
    ...topNeighbors.map(({ unit }) => ({
      unitCode: unit.unitCode,
      unitId: unit.unitId,
      quote: buildExcerpt(unit.primaryText, keywords, 200),
      rationale:
        scope === "document"
          ? `全文检索匹配到相关论证段落 (${unit.sectionTitle || unit.unitCode})：${unit.tldr}`
          : `邻近上下文支撑段 (${unit.sectionTitle || unit.unitCode})：${unit.tldr}`,
    })),
  ];

  return { evidences, keywords, topNeighbors };
}

function buildHeuristicResponse(params: {
  docTitle: string;
  unitId: string;
  unitCode: string;
  sectionTitle: string;
  selectedText: string;
  unitPrimaryText: string;
  unitSecondaryText: string;
  unitTldr: string;
  scope: QaScope;
  effort?: QaEffortLevel;
  question: string;
  contextUnits: ContextUnitPayload[];
  previousTurns: Array<{ question: string; answer: string }>;
  llmErrorNote?: string;
}): {
  answer: string;
  scopeUsed: QaScope;
  evidences: QaEvidenceItem[];
  suggestedFollowUps: string[];
  engine: "heuristic";
} {
  const {
    docTitle,
    unitId,
    unitCode,
    sectionTitle,
    selectedText,
    unitPrimaryText,
    unitSecondaryText,
    unitTldr,
    scope,
    effort = "think",
    question,
    contextUnits,
    previousTurns,
    llmErrorNote,
  } = params;

  const { evidences, keywords, topNeighbors } = findLocalEvidences({
    unitId,
    unitCode,
    sectionTitle,
    selectedText,
    unitPrimaryText,
    question,
    scope,
    contextUnits,
  });

  const lines: string[] = [];
  if (llmErrorNote) {
    lines.push(`[提示] 远端模型暂不可用（${llmErrorNote}），已自动切换为本地原文证据检索解析。`);
    lines.push("");
  }

  lines.push(
    `**[原文明示 · 片段定锚 ${unitCode}]** 所选片段位于《${docTitle}》${sectionTitle ? `「${sectionTitle}」` : ""}，原段主旨为：${unitTldr || "解释该节核心机制"}。`
  );
  if (unitSecondaryText.trim() && effort !== "quick") {
    lines.push(
      `对照意译上下文：${buildExcerpt(unitSecondaryText, keywords, 240)}`
    );
  }
  lines.push("");
  lines.push(
    `**[分析推断 · 针对「${question}」的${scope === "document" ? "全文跨节" : "本段聚焦"}解析]**`
  );
  lines.push(
    `1. **片段语义角色**：在 ${unitCode} 中，“${buildExcerpt(selectedText, keywords, 120)}” 承担了推进「${unitTldr || sectionTitle || unitCode}」的关键环节。结合上下文，理解该句时应抓住其中的核心概念（\`${keywords.slice(0, 5).join(" / ") || "主句实体"}\`）与其前后的因果/约束关系。`
  );

  if (topNeighbors.length > 0) {
    const crossRefs = topNeighbors
      .map(({ unit }) => `${unit.unitCode}（${unit.tldr}）`)
      .join("；");
    lines.push(
      `2. **${scope === "document" ? "跨节证据联动" : "上下文衔接"}**：原文在 ${crossRefs} 中给出了进一步支撑或补充条件，可以点击下方证据卡片直接跳转核对。`
    );
  } else {
    lines.push(
      `2. **证据范围说明**：当前在${scope === "document" ? "全文" : "本段邻域"}内未检出高重合度的跨段引用；建议切换为「全文跨节证据」或补充配置 LLM API Key 获取更深入的公式推导与类比。`
    );
  }

  if (effort === "deep") {
    lines.push(
      `3. **深层假设与适用边界排查**：阅读此处时建议核对两项前提——该结论是否依赖特定实验规模/数据分布，以及与前后节机制（尤其是关键变量与超参数约束）的耦合边界。`
    );
  } else if (previousTurns.length > 0) {
    lines.push(
      `3. **连续追问承接**：本回答承接了此前 ${previousTurns.length} 轮追问语境，聚焦当前问题的新增疑点。`
    );
  }

  return {
    answer: lines.join("\n"),
    scopeUsed: scope,
    evidences,
    suggestedFollowUps: [
      `这一结论在 ${unitCode} 中的前提条件或适用边界是什么？`,
      "能结合全文其他章节的实验/例子给出具体数值或流程对比吗？",
      "如果去掉或替换该片段中的核心设计，系统表现会有什么变化？",
    ],
    engine: "heuristic",
  };
}

function buildQaContextPrompt(params: {
  docTitle: string;
  modeName: string;
  unitId: string;
  unitCode: string;
  sectionTitle: string;
  selectedText: string;
  unitPrimaryText: string;
  unitSecondaryText: string;
  unitTldr: string;
  scope: QaScope;
  effort: QaEffortLevel;
  question: string;
  previousTurns: Array<{ question: string; answer: string }>;
  contextUnits: ContextUnitPayload[];
  streamMode: boolean;
}): string {
  const {
    docTitle,
    modeName,
    unitId,
    unitCode,
    sectionTitle,
    selectedText,
    unitPrimaryText,
    unitSecondaryText,
    unitTldr,
    scope,
    effort,
    question,
    previousTurns,
    contextUnits,
    streamMode,
  } = params;

  const scopedUnits =
    scope === "document"
      ? contextUnits.slice(0, 48)
      : contextUnits.filter((u) => {
          const idx = contextUnits.findIndex((item) => item.unitId === unitId);
          if (idx === -1) return u.unitId === unitId;
          const curIdx = contextUnits.indexOf(u);
          return Math.abs(curIdx - idx) <= 2;
        });

  const contextBlock = scopedUnits
    .map(
      (u) =>
        `[${u.unitCode} | id=${u.unitId} | ${u.sectionTitle ?? ""}]\nTL;DR: ${u.tldr}\nText: ${u.primaryText.slice(0, scope === "document" ? 420 : 900)}`
    )
    .join("\n\n---\n\n");

  const historyBlock =
    previousTurns.length > 0
      ? previousTurns
          .map((t, i) => `Turn ${i + 1} Q: ${t.question}\nTurn ${i + 1} A: ${t.answer}`)
          .join("\n\n")
      : "无（首次提问）";

  const effortInstruction =
    effort === "quick"
      ? "回答深度：【快速精讲】控制在 180-280 字以内，先给出一句话核心直觉，再列出 2 条关键机制要点。"
      : effort === "deep"
        ? "回答深度：【跨节深度推演】进行详尽的第一性原理拆解：涵盖机制动机、公式/复杂度直观推导、跨章节联动对照、前置假设与反例边界。"
        : "回答深度：【深度剖析】清晰拆解核心逻辑、上下文因果作用与具体直观类比。";

  const formatInstruction = streamMode
    ? [
        `输出格式（严格遵守以便流式直出）：`,
        `1. 第一部分直接输出清晰排版的中文 Markdown 正文（可使用小标题、分点列表、**加粗**、行内代码与标准 LaTeX 公式 \`$...$\` / \`$$...$$\`；重要判断标出 **[原文明示]** 或 **[分析推断]**；绝不使用 Emoji，不编造原文不存在的数字或结论，原文未提及处注明 **[原文未说明]**）。`,
        `2. 正文结束后，换行并严格附加以下隐藏元数据标签（前端会自动剥离渲染成可点击证据卡片）：`,
        `<PURR_META>{"evidences":[{"unitCode":"精确单元编号","unitId":"对应unitId","quote":"原文逐字短句","rationale":"支撑说明"}],"suggestedFollowUps":["后续追问1","后续追问2"]}</PURR_META>`,
      ].join("\n")
    : [
        `输出要求：`,
        `1. \`answer\`：用清晰、有深度、教学感强的中文详细解答。重要判断必须显式标出 [原文明示] 或 [分析推断]；涉及公式请使用标准 LaTeX（$...$ 或 $$...$$）；绝不使用任何 Emoji；绝不编造原文没有的数字或实验结论，若原文未交代需明确指出 [原文未说明]。`,
        `2. \`evidences\`：返回 1-4 条严格可追溯的证据项，每条包含 \`unitCode\`、\`unitId\`、\`quote\`、\`rationale\`。`,
        `3. \`suggestedFollowUps\`：给出 2-3 个紧扣当前困惑的后续深度追问建议。`,
      ].join("\n");

  return [
    `你是一位严谨的学术与技术深度精读导师。用户正在阅读《${docTitle}》（模式：${modeName}），并在段落 [${unitCode}]（章节：${sectionTitle}）选中了以下片段提出问题。`,
    ``,
    `【解答范围】${scope === "document" ? "基于全文跨节证据综合解答 (Full Document)" : "聚焦本段与邻近上下文精讲 (Paragraph & Local Context)"}`,
    effortInstruction,
    `【目标段落编号】${unitCode} (unitId=${unitId})`,
    `【用户选中的片段】${selectedText || "(用户直接针对整段提问)"}`,
    `【目标段落原文】${unitPrimaryText}`,
    unitSecondaryText ? `【目标段落意译】${unitSecondaryText}` : "",
    `【目标段落主旨】${unitTldr}`,
    ``,
    `【此前追问记录】\n${historyBlock}`,
    ``,
    `【可用证据上下文单元】\n${contextBlock}`,
    ``,
    `【用户本次问题】\n${question}`,
    ``,
    formatInstruction,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeEvidences(
  rawEvidences: Array<{ unitCode?: string; unitId?: string; quote?: string; rationale?: string }>,
  unitId: string,
  unitCode: string,
  selectedText: string,
  unitPrimaryText: string,
  contextUnits: ContextUnitPayload[]
): QaEvidenceItem[] {
  const unitIdByCode = new Map<string, string>();
  unitIdByCode.set(unitCode, unitId);
  for (const u of contextUnits) {
    unitIdByCode.set(u.unitCode, u.unitId);
  }

  const normalized: QaEvidenceItem[] = rawEvidences
    .filter((ev) => ev && (ev.quote || ev.rationale))
    .map((ev) => ({
      unitCode: ev.unitCode || unitCode,
      unitId: ev.unitId || unitIdByCode.get(ev.unitCode || "") || unitId,
      quote: ev.quote || "",
      rationale: ev.rationale || "原文相关证据",
    }));

  if (normalized.length > 0) return normalized.slice(0, 4);

  return [
    {
      unitCode,
      unitId,
      quote: selectedText || unitPrimaryText.slice(0, 180),
      rationale: "用户选中并提问的目标段落原文锚点",
    },
  ];
}

function chunkTextForSmoothStream(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const slice = text.slice(i, i + 16);
    chunks.push(slice);
    i += slice.length;
  }
  return chunks;
}

const META_OPEN = "<PURR_META>";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AskSelectionRequestBody;

    const docTitle = body.docTitle?.trim() || "当前精读文档";
    const modeName = body.modeName?.trim() || "深度精读";
    const unitId = body.unitId?.trim() || "unit-unknown";
    const unitCode = body.unitCode?.trim() || "Unit";
    const sectionTitle = body.sectionTitle?.trim() || "";
    const selectedText = body.selectedText?.trim() || "";
    const unitPrimaryText = body.unitPrimaryText?.trim() || "";
    const unitSecondaryText = body.unitSecondaryText?.trim() || "";
    const unitTldr = body.unitTldr?.trim() || "";
    const effort: QaEffortLevel =
      body.effort === "quick" || body.effort === "deep" ? body.effort : "think";
    const scope: QaScope =
      effort === "deep" ? "document" : body.scope === "paragraph" ? "paragraph" : "document";
    const question = body.question?.trim() || "";
    const previousTurns = Array.isArray(body.previousTurns) ? body.previousTurns : [];
    const contextUnits = Array.isArray(body.contextUnits) ? body.contextUnits : [];
    const wantStream = body.stream === true;

    if (!question) {
      return NextResponse.json({ error: "请输入需要追问的问题。" }, { status: 400 });
    }
    if (!selectedText && !unitPrimaryText) {
      return NextResponse.json(
        { error: "缺少待解析的选中片段或段落文本。" },
        { status: 400 }
      );
    }

    const llmConfig: LLMConfig = {
      provider: body.llmConfig?.provider ?? "google",
      apiKey: body.llmConfig?.apiKey?.trim() ?? "",
      model: body.llmConfig?.model?.trim() || "gemini-2.5-flash",
      baseUrl: body.llmConfig?.baseUrl?.trim() ?? "",
    };

    if (wantStream) {
      const encoder = new TextEncoder();
      const send = (controller: ReadableStreamDefaultController<Uint8Array>, data: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
      };

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const streamHeuristic = async (llmErrorNote?: string) => {
            const heuristic = buildHeuristicResponse({
              docTitle,
              unitId,
              unitCode,
              sectionTitle,
              selectedText: selectedText || unitPrimaryText.slice(0, 140),
              unitPrimaryText,
              unitSecondaryText,
              unitTldr,
              scope,
              effort,
              question,
              contextUnits,
              previousTurns,
              llmErrorNote,
            });
            send(controller, {
              type: "meta",
              scopeUsed: heuristic.scopeUsed,
              engine: heuristic.engine,
              evidences: heuristic.evidences,
            });
            for (const piece of chunkTextForSmoothStream(heuristic.answer)) {
              if (request.signal.aborted) break;
              send(controller, { type: "delta", text: piece });
              await new Promise((r) => setTimeout(r, 16));
            }
            if (!request.signal.aborted) {
              send(controller, {
                type: "done",
                answer: heuristic.answer,
                scopeUsed: heuristic.scopeUsed,
                evidences: heuristic.evidences,
                suggestedFollowUps: heuristic.suggestedFollowUps,
                engine: heuristic.engine,
              });
            }
          };

          try {
            if (!llmConfig.apiKey) {
              await streamHeuristic();
              controller.close();
              return;
            }

            const baseline = findLocalEvidences({
              unitId,
              unitCode,
              sectionTitle,
              selectedText: selectedText || unitPrimaryText.slice(0, 140),
              unitPrimaryText,
              question,
              scope,
              contextUnits,
            });

            send(controller, {
              type: "meta",
              scopeUsed: scope,
              engine: "llm",
              evidences: baseline.evidences,
            });

            const prompt = buildQaContextPrompt({
              docTitle,
              modeName,
              unitId,
              unitCode,
              sectionTitle,
              selectedText,
              unitPrimaryText,
              unitSecondaryText,
              unitTldr,
              scope,
              effort,
              question,
              previousTurns,
              contextUnits,
              streamMode: true,
            });

            let emittedDelta = false;
            try {
              const result = streamText({
                model: resolveLanguageModel(llmConfig),
                prompt,
                temperature: 0.2,
                abortSignal: request.signal,
              });

              let rawFull = "";
              let pending = "";
              let hitMeta = false;
              const TAIL_KEEP = META_OPEN.length - 1;

              for await (const chunk of result.textStream) {
                if (request.signal.aborted) break;
                rawFull += chunk;
                if (hitMeta) continue;

                pending += chunk;
                const metaIdx = pending.indexOf(META_OPEN);
                if (metaIdx !== -1) {
                  const before = pending.slice(0, metaIdx);
                  if (before) {
                    emittedDelta = true;
                    send(controller, { type: "delta", text: before });
                  }
                  hitMeta = true;
                  pending = "";
                } else if (pending.length > TAIL_KEEP) {
                  const flush = pending.slice(0, pending.length - TAIL_KEEP);
                  pending = pending.slice(pending.length - TAIL_KEEP);
                  if (flush) {
                    emittedDelta = true;
                    send(controller, { type: "delta", text: flush });
                  }
                }
              }

              if (!hitMeta && pending && !request.signal.aborted) {
                emittedDelta = true;
                send(controller, { type: "delta", text: pending });
              }

              if (request.signal.aborted) {
                controller.close();
                return;
              }

              const metaMatch = rawFull.match(/<PURR_META>([\s\S]*?)(?:<\/PURR_META>|$)/);
              const cleanAnswer = rawFull
                .replace(/<PURR_META>[\s\S]*$/g, "")
                .replace(/<think>[\s\S]*?<\/think>/gi, "")
                .trim();

              let parsedMeta: {
                evidences?: Array<{
                  unitCode?: string;
                  unitId?: string;
                  quote?: string;
                  rationale?: string;
                }>;
                suggestedFollowUps?: string[];
              } | null = null;

              if (metaMatch?.[1]) {
                try {
                  const jsonCandidate = metaMatch[1].trim();
                  const firstBrace = jsonCandidate.indexOf("{");
                  const lastBrace = jsonCandidate.lastIndexOf("}");
                  if (firstBrace !== -1 && lastBrace > firstBrace) {
                    parsedMeta = JSON.parse(jsonCandidate.slice(firstBrace, lastBrace + 1));
                  }
                } catch {
                  parsedMeta = null;
                }
              }

              const finalEvidences = parsedMeta?.evidences?.length
                ? normalizeEvidences(
                    parsedMeta.evidences,
                    unitId,
                    unitCode,
                    selectedText,
                    unitPrimaryText,
                    contextUnits
                  )
                : baseline.evidences;

              const suggestedFollowUps =
                Array.isArray(parsedMeta?.suggestedFollowUps) &&
                parsedMeta.suggestedFollowUps.length > 0
                  ? parsedMeta.suggestedFollowUps.slice(0, 3)
                  : [
                      `这一结论在 ${unitCode} 中的前提条件或适用边界是什么？`,
                      "能结合全文给出具体数值案例或反例对比吗？",
                    ];

              send(controller, {
                type: "done",
                answer: cleanAnswer || rawFull.trim(),
                scopeUsed: scope,
                evidences: finalEvidences,
                suggestedFollowUps,
                engine: "llm",
              });
              controller.close();
            } catch (llmErr) {
              if (request.signal.aborted) {
                controller.close();
                return;
              }
              if (emittedDelta) {
                const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
                send(controller, { type: "error", message: msg });
              } else {
                const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
                await streamHeuristic(msg.slice(0, 100));
              }
              controller.close();
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "AI 追问流式生成失败";
            send(controller, { type: "error", message: msg });
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    if (!llmConfig.apiKey) {
      const heuristic = buildHeuristicResponse({
        docTitle,
        unitId,
        unitCode,
        sectionTitle,
        selectedText: selectedText || unitPrimaryText.slice(0, 140),
        unitPrimaryText,
        unitSecondaryText,
        unitTldr,
        scope,
        effort,
        question,
        contextUnits,
        previousTurns,
      });
      return NextResponse.json(heuristic);
    }

    const prompt = buildQaContextPrompt({
      docTitle,
      modeName,
      unitId,
      unitCode,
      sectionTitle,
      selectedText,
      unitPrimaryText,
      unitSecondaryText,
      unitTldr,
      scope,
      effort,
      question,
      previousTurns,
      contextUnits,
      streamMode: false,
    });

    try {
      const generator = createAiSdkObjectGenerator(llmConfig);
      const generated = await generator.generate({
        prompt,
        schema: QaAnswerSchema,
        schemaName: "SelectionQaResponse",
      });

      const evidences = normalizeEvidences(
        generated.evidences,
        unitId,
        unitCode,
        selectedText,
        unitPrimaryText,
        contextUnits
      );

      return NextResponse.json({
        answer: generated.answer,
        scopeUsed: scope,
        evidences,
        suggestedFollowUps: generated.suggestedFollowUps.slice(0, 3),
        engine: "llm" as const,
      });
    } catch (llmErr) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      const fallback = buildHeuristicResponse({
        docTitle,
        unitId,
        unitCode,
        sectionTitle,
        selectedText: selectedText || unitPrimaryText.slice(0, 140),
        unitPrimaryText,
        unitSecondaryText,
        unitTldr,
        scope,
        effort,
        question,
        contextUnits,
        previousTurns,
        llmErrorNote: msg.slice(0, 100),
      });
      return NextResponse.json(fallback);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI 追问接口发生未知错误" },
      { status: 500 }
    );
  }
}
