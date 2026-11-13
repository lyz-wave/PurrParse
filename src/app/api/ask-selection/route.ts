import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAiSdkObjectGenerator, type LLMConfig } from "@/core/engine/llm-adapters";
import type { QaEvidenceItem, QaScope } from "@/core/contracts/document-ast";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    question,
    contextUnits,
    previousTurns,
    llmErrorNote,
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

  const lines: string[] = [];
  if (llmErrorNote) {
    lines.push(`[提示] 远端模型暂不可用（${llmErrorNote}），已自动切换为本地原文证据检索解析。`);
    lines.push("");
  }

  lines.push(
    `[原文明示 · 片段定锚 ${unitCode}] 所选片段位于《${docTitle}》${sectionTitle ? `「${sectionTitle}」` : ""}，原段主旨为：${unitTldr || "解释该节核心机制"}。`
  );
  if (unitSecondaryText.trim()) {
    lines.push(
      `对照意译上下文：${buildExcerpt(unitSecondaryText, keywords, 240)}`
    );
  }
  lines.push("");
  lines.push(
    `[分析推断 · 针对「${question}」的${scope === "document" ? "全文跨节" : "本段聚焦"}解析]`
  );
  lines.push(
    `1. 片段语义角色：在 ${unitCode} 中，“${buildExcerpt(selectedText, keywords, 120)}” 承担了推进「${unitTldr || sectionTitle || unitCode}」的关键环节。结合上下文，理解该句时应抓住其中出现的核心概念（${keywords.slice(0, 5).join(" / ") || "主句实体"}）与其前后的因果/约束关系。`
  );

  if (topNeighbors.length > 0) {
    const crossRefs = topNeighbors
      .map(({ unit }) => `${unit.unitCode}（${unit.tldr}）`)
      .join("；");
    lines.push(
      `2. ${scope === "document" ? "跨节证据联动" : "上下文衔接"}：原文在 ${crossRefs} 中给出了进一步支撑或补充条件，可以点击下方证据卡片直接跳转核对。`
    );
  } else {
    lines.push(
      `2. 证据范围说明：当前在${scope === "document" ? "全文" : "本段邻域"}内未检出高重合度的同词跨段引用；建议切换为「基于全文跨节证据解答」或补充配置 LLM API Key 获取更深入的公式推导与类比。`
    );
  }

  if (previousTurns.length > 0) {
    lines.push(
      `3. 连续追问承接：本回答承接了此前 ${previousTurns.length} 轮追问语境，聚焦当前问题的新增疑点。`
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AskSelectionRequestBody;

    const docTitle = body.docTitle?.trim() || "当前精读文档";
    const unitId = body.unitId?.trim() || "unit-unknown";
    const unitCode = body.unitCode?.trim() || "Unit";
    const sectionTitle = body.sectionTitle?.trim() || "";
    const selectedText = body.selectedText?.trim() || "";
    const unitPrimaryText = body.unitPrimaryText?.trim() || "";
    const unitSecondaryText = body.unitSecondaryText?.trim() || "";
    const unitTldr = body.unitTldr?.trim() || "";
    const scope: QaScope = body.scope === "document" ? "document" : "paragraph";
    const question = body.question?.trim() || "";
    const previousTurns = Array.isArray(body.previousTurns) ? body.previousTurns : [];
    const contextUnits = Array.isArray(body.contextUnits) ? body.contextUnits : [];

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
        question,
        contextUnits,
        previousTurns,
      });
      return NextResponse.json(heuristic);
    }

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

    const prompt = [
      `你是一位严谨的学术与技术深度精读导师。用户正在阅读《${docTitle}》（模式：${body.modeName ?? "深度精读"}），并在段落 [${unitCode}]（章节：${sectionTitle}）选中了以下片段提出问题。`,
      ``,
      `【解答范围】${scope === "document" ? "基于全文跨节证据综合解答 (Full Document)" : "聚焦本段与邻近上下文精讲 (Paragraph & Local Context)"}`,
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
      `输出要求：`,
      `1. \`answer\`：用清晰、有深度、教学感强的中文详细解答。重要判断必须显式标出 [原文明示] 或 [分析推断]；涉及公式请使用标准 LaTeX（$...$ 或 $$...$$）；绝不使用任何 Emoji；绝不编造原文没有的数字或实验结论，若原文未交代需明确指出 [原文未说明]。`,
      `2. \`evidences\`：返回 1-4 条严格可追溯的证据项，每条包含：`,
      `   - \`unitCode\`: 上下文中出现过的精确单元编号（如 ${unitCode}）；`,
      `   - \`unitId\`: 对应单元的 id（如 ${unitId}），便于前端一键跳转；`,
      `   - \`quote\`: 原文逐字摘录短句；`,
      `   - \`rationale\`: 说明该证据如何支撑回答。`,
      `3. \`suggestedFollowUps\`：给出 2-3 个紧扣当前困惑的后续深度追问建议。`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const generator = createAiSdkObjectGenerator(llmConfig);
      const generated = await generator.generate({
        prompt,
        schema: QaAnswerSchema,
        schemaName: "SelectionQaResponse",
      });

      const unitIdByCode = new Map<string, string>();
      unitIdByCode.set(unitCode, unitId);
      for (const u of contextUnits) {
        unitIdByCode.set(u.unitCode, u.unitId);
      }

      const normalizedEvidences: QaEvidenceItem[] = generated.evidences.map((ev) => ({
        unitCode: ev.unitCode || unitCode,
        unitId: ev.unitId || unitIdByCode.get(ev.unitCode) || unitId,
        quote: ev.quote,
        rationale: ev.rationale,
      }));

      return NextResponse.json({
        answer: generated.answer,
        scopeUsed: scope,
        evidences:
          normalizedEvidences.length > 0
            ? normalizedEvidences
            : [
                {
                  unitCode,
                  unitId,
                  quote: selectedText || unitPrimaryText.slice(0, 180),
                  rationale: "用户选中并提问的目标段落原文锚点",
                },
              ],
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
