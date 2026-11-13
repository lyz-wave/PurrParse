import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { LibraryTaxonomyMeta, WorkbenchDocument } from "@/core/contracts/document-ast";
import { inferDocumentTaxonomy } from "@/core/engine/library-organizer";
import { createAiSdkObjectGenerator, type LLMConfig } from "@/core/engine/llm-adapters";

export const runtime = "nodejs";
export const maxDuration = 60;

interface OrganizeLibraryPayload {
  documents?: WorkbenchDocument[];
  llmConfig?: Partial<LLMConfig>;
}

const OrganizeOutputSchema = z.object({
  items: z.array(
    z.object({
      docId: z.string(),
      domainCategory: z.string(),
      paradigmType: z.string(),
      tags: z.array(z.string()).max(4),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OrganizeLibraryPayload;
    const docs = Array.isArray(body.documents) ? body.documents : [];
    if (docs.length === 0) {
      return NextResponse.json({ taxonomies: {}, engine: "heuristic" as const });
    }

    const baseTaxonomies: Record<string, LibraryTaxonomyMeta> = {};
    for (const doc of docs) {
      baseTaxonomies[doc.id] = inferDocumentTaxonomy(doc);
    }

    const llmConfig: LLMConfig = {
      provider: body.llmConfig?.provider ?? "google",
      apiKey: body.llmConfig?.apiKey?.trim() ?? "",
      model: body.llmConfig?.model?.trim() || "gemini-2.5-flash",
      baseUrl: body.llmConfig?.baseUrl?.trim() ?? "",
    };

    if (!llmConfig.apiKey) {
      return NextResponse.json({
        taxonomies: baseTaxonomies,
        engine: "heuristic" as const,
      });
    }

    const docSummaries = docs.map((d) => ({
      docId: d.id,
      title: d.title,
      modeName: d.modeName,
      subtitle: d.subtitle.slice(0, 160),
      skeleton: d.topMentalModel.oneSentenceSkeleton ?? "",
      terms: d.topMentalModel.glossary.slice(0, 5).map((g) => g.term),
      unitCount: d.units.length,
      codeUnits: d.units.filter((u) => u.primaryKind === "code").length,
      formulas: d.units.reduce((s, u) => s + (u.formulas?.length ?? 0), 0),
    }));

    const prompt = [
      `你是一个个人学术与技术精读文库的知识管理专家。请对以下 ${docs.length} 份工作台文档执行跨文档语义聚类与精细分类。`,
      ``,
      `文档摘要列表：`,
      JSON.stringify(docSummaries, null, 2),
      ``,
      `分类要求（绝不使用任何 Emoji）：`,
      `1. \`domainCategory\`（学科主题聚类）：尽量把主题相近的文档合并到同一个简洁清晰的中文主题类名下（例如「AI 与序列注意力架构」「智能体与强化学习」「系统工程与并发源码」「认知科学与主动学习」「智能建造与工程优化」或其它精准中文领域名），避免每篇都起一个孤立类名。`,
      `2. \`paradigmType\`（研究/内容范式）：从以下标准类别中择一或精准归类：「方法与架构创新型」「理论推导与数学建模」「实证评测与实验型」「综述与脉络梳理型」「核心源码与工程实现」「认知方法与思维框架」。`,
      `3. \`tags\`：每篇生成 2-4 个简短中文或中英术语标签（不含 # 号）。`,
    ].join("\n");

    try {
      const generator = createAiSdkObjectGenerator(llmConfig);
      const result = await generator.generate({
        prompt,
        schema: OrganizeOutputSchema,
        schemaName: "LibraryOrganizeResponse",
      });

      const now = new Date().toISOString();
      const merged: Record<string, LibraryTaxonomyMeta> = { ...baseTaxonomies };
      for (const item of result.items) {
        if (!merged[item.docId]) continue;
        merged[item.docId] = {
          domainCategory: item.domainCategory.trim() || merged[item.docId].domainCategory,
          paradigmType: item.paradigmType.trim() || merged[item.docId].paradigmType,
          tags:
            item.tags.length > 0
              ? item.tags.map((t) => t.replace(/^#+/, "").trim()).filter(Boolean).slice(0, 4)
              : merged[item.docId].tags,
          pinned: merged[item.docId].pinned,
          organizedAt: now,
        };
      }

      return NextResponse.json({
        taxonomies: merged,
        engine: "llm" as const,
      });
    } catch {
      return NextResponse.json({
        taxonomies: baseTaxonomies,
        engine: "heuristic" as const,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "文库智能整理失败" },
      { status: 500 }
    );
  }
}
