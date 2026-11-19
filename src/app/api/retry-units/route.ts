import { NextResponse } from "next/server";
import { z } from "zod";
import type { SourceUnit } from "@/core/contracts/mode-plugin";
import { retryBatchUnits } from "@/core/engine/chunk-orchestrator";
import { createAiSdkObjectGenerator } from "@/core/engine/llm-adapters";
import { defaultPluginRegistry } from "@/plugins";

const RetryUnitInputSchema = z.object({
  id: z.string().min(1),
  unitCode: z.string().min(1),
  sectionId: z.string().min(1),
  sectionTitle: z.string().min(1),
  sectionTask: z.string().optional(),
  primaryKind: z.enum(["prose", "code"]).optional(),
  codeLanguage: z.string().optional(),
  filePath: z.string().optional(),
  rawPrimaryText: z.string().min(1),
  formulas: z
    .array(
      z.object({
        latex: z.string(),
        flowLabel: z.string().optional(),
        flowText: z.string().optional(),
      })
    )
    .optional(),
  figures: z
    .array(
      z.object({
        label: z.string().optional(),
        caption: z.string(),
        imageUrls: z.array(z.string()),
      })
    )
    .optional(),
  dataTable: z
    .object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .optional(),
  calloutList: z
    .object({
      title: z.string(),
      items: z.array(z.string()),
    })
    .optional(),
});

const RetryUnitsRequestSchema = z.object({
  modeId: z.string().min(1),
  globalContextSummary: z.string().optional(),
  allSectionIds: z.array(z.string()).optional(),
  speedMode: z.enum(["balanced", "fast"]).optional(),
  units: z.array(RetryUnitInputSchema).min(1).max(24),
  llmConfig: z.object({
    provider: z.enum(["google", "openai", "anthropic", "deepseek", "custom"]),
    apiKey: z.string(),
    model: z.string(),
    baseUrl: z.string().optional(),
  }),
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const parsed = RetryUnitsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `请求参数不合法：${parsed.error.issues[0]?.message || "invalid payload"}` },
      { status: 400 }
    );
  }

  const { modeId, globalContextSummary, allSectionIds, speedMode, units, llmConfig } =
    parsed.data;

  if (!defaultPluginRegistry.has(modeId)) {
    return NextResponse.json({ error: `未知阅读模式插件：${modeId}` }, { status: 400 });
  }

  if (!llmConfig.apiKey.trim()) {
    return NextResponse.json(
      { error: "请先在右上角「设置」中填入有效的 API Key，再重试该段翻译。" },
      { status: 400 }
    );
  }

  const plugin = defaultPluginRegistry.get(modeId);
  const generator = createAiSdkObjectGenerator(llmConfig);

  const sourceUnits: SourceUnit[] = units.map((u) => {
    const hasMeta =
      Boolean(u.filePath) ||
      Boolean(u.formulas?.length) ||
      Boolean(u.figures?.length) ||
      Boolean(u.dataTable);
    return {
      id: u.id,
      unitCode: u.unitCode,
      sectionId: u.sectionId,
      sectionTitle: u.sectionTitle,
      sectionTask: u.sectionTask,
      primaryKind: u.primaryKind ?? "prose",
      codeLanguage: u.codeLanguage,
      rawPrimaryText: u.rawPrimaryText,
      metadata: hasMeta
        ? {
            filePath: u.filePath,
            formulas: u.formulas?.map((f) => f.latex),
            figures: u.figures,
            dataTable: u.dataTable,
          }
        : undefined,
    };
  });

  const effectiveSectionIds =
    allSectionIds && allSectionIds.length > 0
      ? allSectionIds
      : Array.from(new Set(sourceUnits.map((u) => u.sectionId)));

  try {
    const updatedUnits = await retryBatchUnits(plugin, sourceUnits, {
      generator,
      globalContextSummary:
        globalContextSummary?.trim() || "请结合上下文忠实翻译当前段落并补全 4 栏深度拆解。",
      allSectionIds: effectiveSectionIds,
      speedMode,
      abortSignal: req.signal,
    });
    return NextResponse.json({ units: updatedUnits });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "重试翻译请求失败，请检查网络或中转接口配置。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
