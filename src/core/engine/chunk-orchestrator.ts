import type {
  BottomArsenalBlock,
  SectionAnchor,
  TopMentalModel,
  WorkbenchDocument,
  WorkbenchUnit,
} from "@/core/contracts/document-ast";
import type {
  RawSourcePayload,
  SourceUnit,
  WorkbenchModePlugin,
} from "@/core/contracts/mode-plugin";
import type { StructuredObjectGenerator } from "./llm-adapters";

export type AnalysisStreamEvent =
  | {
      type: "status";
      phase: "ingesting" | "top-model" | "batch" | "bottom" | "done";
      message: string;
      progress: number;
    }
  | {
      type: "source-ready";
      totalUnits: number;
      units: SourceUnit[];
    }
  | {
      type: "top-model";
      title: string;
      subtitle: string;
      badges: string[];
      topMentalModel: TopMentalModel;
      sections: SectionAnchor[];
      partialDocument?: WorkbenchDocument;
    }
  | {
      type: "unit-batch";
      batchIndex: number;
      totalBatches: number;
      units: WorkbenchUnit[];
      partialDocument?: WorkbenchDocument;
    }
  | {
      type: "bottom";
      bottomTitle: string;
      bottomSubtitle?: string;
      bottomBlocks: BottomArsenalBlock[];
      partialDocument?: WorkbenchDocument;
    }
  | {
      type: "complete";
      document: WorkbenchDocument;
    };

export interface OrchestratorOptions {
  batchSize?: number;
  titleOverride?: string;
  generator?: StructuredObjectGenerator;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const safeSize = Math.max(1, size);
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    batches.push(items.slice(i, i + safeSize));
  }
  return batches;
}

export function buildCompletionChecklist(
  doc: WorkbenchDocument,
  usedLlm: boolean
): NonNullable<WorkbenchDocument["completionChecklist"]> {
  const formulaOrTableCount = doc.units.filter(
    (u) =>
      (u.formulas && u.formulas.length > 0) ||
      Boolean(u.dataTable) ||
      (u.figures && u.figures.length > 0)
  ).length;
  const inconsistencies: string[] = [];
  for (const u of doc.units) {
    const joinedNotes = u.notes.map((n) => n.body).join("\n");
    if (joinedNotes.includes("[原文不一致]") || u.primaryText.includes("[UNREADABLE]")) {
      inconsistencies.push(`${u.unitCode}: 包含原文差异或提取存疑标注`);
    }
  }
  const hasUnparsedMarkers = inconsistencies.length > 0;
  return {
    modeDescription: `${doc.modeName}（${usedLlm ? "在线大模型深度精读" : "离线启发式结构化拆解"}）`,
    unitCount: doc.units.length,
    formulaOrTableCount,
    sectionCount: doc.sections.length,
    inconsistencies,
    manualVerifyHints: [
      `共切分并覆盖 ${doc.units.length} 个核心/基石/过渡单元（含 ${formulaOrTableCount} 个公式或数据表单元），归属 ${doc.sections.length} 个章节。`,
      "计数一致仅说明索引完整，不代表 PDF / 网页提取零误差；请抽查关键公式、表格数值与原文献对齐。",
      hasUnparsedMarkers
        ? "检测到部分单元存在 [原文不一致] 或 [UNREADABLE] 标记，建议优先对照原文 PDF 核对。"
        : "localStorage / IndexedDB 数据依赖当前浏览器存储，重要笔记请定期导出 Markdown 或 Anki CSV。",
    ],
  };
}

/**
 * ChunkedAnalysisEngine:
 * Splits arbitrarily long inputs into deterministic chunks, generates top mental model,
 * streams batch-by-batch structured annotations, and synthesizes bottom workbench blocks.
 * Falls back cleanly to plugin.createHeuristicDocument when no LLM generator is supplied.
 */
export async function* runChunkedAnalysis(
  plugin: WorkbenchModePlugin,
  payload: RawSourcePayload,
  options: OrchestratorOptions = {}
): AsyncGenerator<AnalysisStreamEvent, WorkbenchDocument, void> {
  yield {
    type: "status",
    phase: "ingesting",
    message: `[SEAM 01] 正在通过 ${plugin.name} 预处理器清洗并切分输入源...`,
    progress: 8,
  };

  const sourceUnits = await plugin.preprocessSource(payload);
  if (sourceUnits.length === 0) {
    throw new Error("未能从输入中解析出有效内容单元，请检查输入文本、PDF 文件或链接地址。");
  }

  // Resolve final document title AFTER preprocessSource so fetched arXiv/Web/GitHub metadata can populate payload.title
  const docTitle = options.titleOverride?.trim() || payload.title?.trim() || plugin.name;
  const docId = `${plugin.id}-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const promptContext = {
    readingPurpose: payload.readingPurpose,
    userBackground: payload.userBackground,
    userTopic: payload.userTopic,
  };

  yield {
    type: "source-ready",
    totalUnits: sourceUnits.length,
    units: sourceUnits,
  };

  // Build baseline skeleton document immediately so progressive streaming updates in-place cleanly
  const liveDoc: WorkbenchDocument = {
    ...plugin.createHeuristicDocument(docTitle, sourceUnits),
    id: docId,
    createdAt,
    updatedAt: createdAt,
  };

  // Offline Heuristic Mode (zero API key fallback)
  if (!options.generator) {
    yield {
      type: "status",
      phase: "top-model",
      message: "[OFFLINE HEURISTIC] 未配置 API Key，正在执行本地结构化启发式拆解...",
      progress: 45,
    };

    liveDoc.completionChecklist = buildCompletionChecklist(liveDoc, false);

    yield {
      type: "top-model",
      title: liveDoc.title,
      subtitle: liveDoc.subtitle,
      badges: liveDoc.badges,
      topMentalModel: liveDoc.topMentalModel,
      sections: liveDoc.sections,
      partialDocument: liveDoc,
    };

    yield {
      type: "unit-batch",
      batchIndex: 1,
      totalBatches: 1,
      units: liveDoc.units,
      partialDocument: liveDoc,
    };

    yield {
      type: "bottom",
      bottomTitle: liveDoc.bottomTitle,
      bottomSubtitle: liveDoc.bottomSubtitle,
      bottomBlocks: liveDoc.bottomBlocks,
      partialDocument: liveDoc,
    };

    yield {
      type: "status",
      phase: "done",
      message: "[COMPLETE] 本地启发式拆解完成（可随时填入 API Key 开启深度语义推理）。",
      progress: 100,
    };

    yield { type: "complete", document: liveDoc };
    return liveDoc;
  }

  const generator = options.generator;

  // Step 1: Global Mental Model & Section Skeleton
  yield {
    type: "status",
    phase: "top-model",
    message: "[PHASE 1/3] 正在构建全局认知脚手架、预测试、SVG 拓扑图与术语词典...",
    progress: 20,
  };

  const topOutput = await generator.generate({
    prompt: plugin.buildPrompts.topModelPrompt(docTitle, sourceUnits, promptContext),
    schema: plugin.schemas.topMentalModel,
    schemaName: `${plugin.id}_top_mental_model`,
  });

  liveDoc.title = topOutput.title || docTitle;
  liveDoc.subtitle = topOutput.subtitle;
  liveDoc.badges = topOutput.badges;
  liveDoc.topMentalModel = topOutput.topMentalModel;
  liveDoc.sections = topOutput.sections.length > 0 ? topOutput.sections : liveDoc.sections;
  liveDoc.updatedAt = new Date().toISOString();

  yield {
    type: "top-model",
    title: liveDoc.title,
    subtitle: liveDoc.subtitle,
    badges: liveDoc.badges,
    topMentalModel: liveDoc.topMentalModel,
    sections: liveDoc.sections,
    partialDocument: { ...liveDoc, units: [...liveDoc.units] },
  };

  // Step 2: Sliding-Window Batch Unit Annotations
  const batchSize = options.batchSize ?? 4;
  const batches = chunkArray(sourceUnits, batchSize);
  const allSectionIds = Array.from(new Set(sourceUnits.map((u) => u.sectionId)));
  const hydratedUnits: WorkbenchUnit[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const progress = 25 + Math.round(((i + 1) / batches.length) * 55);
    yield {
      type: "status",
      phase: "batch",
      message: `[PHASE 2/3] 正在逐段深度批注第 ${i + 1} / ${batches.length} 批（共 ${batch.length} 个单元）...`,
      progress,
    };

    const batchResult = await generator.generate({
      prompt: plugin.buildPrompts.batchUnitsPrompt(
        batch,
        topOutput.globalContextSummary,
        allSectionIds
      ),
      schema: plugin.schemas.batchUnits,
      schemaName: `${plugin.id}_batch_${i + 1}`,
    });

    const batchMap = new Map(batchResult.units.map((u) => [u.unitId, u]));
    const batchHydrated: WorkbenchUnit[] = batch.map((src, idx) => {
      const matched = batchMap.get(src.id) ?? batchResult.units[idx];
      if (!matched) {
        return {
          id: src.id,
          unitCode: src.unitCode,
          sectionId: src.sectionId,
          sectionTitle: src.sectionTitle,
          sectionTask: src.sectionTask,
          weight: "support",
          tldr: `${src.sectionTitle} (${src.unitCode})`,
          primaryKind: src.primaryKind,
          codeLanguage: src.codeLanguage,
          filePath: src.metadata?.filePath,
          primaryText: src.rawPrimaryText,
          highlights: [],
          secondaryBlockText: "该批次未返回对应译文/状态追踪，可点击重新生成或手动补充笔记。",
          notes: [],
        };
      }
      return plugin.hydrateUnit(src, matched);
    });

    hydratedUnits.push(...batchHydrated);
    // Replace processed prefix in liveDoc.units while preserving remaining heuristic units
    const hydratedById = new Map(hydratedUnits.map((u) => [u.id, u]));
    liveDoc.units = liveDoc.units.map((existing) => hydratedById.get(existing.id) ?? existing);
    liveDoc.updatedAt = new Date().toISOString();

    yield {
      type: "unit-batch",
      batchIndex: i + 1,
      totalBatches: batches.length,
      units: batchHydrated,
      partialDocument: { ...liveDoc, units: [...liveDoc.units] },
    };
  }

  // Step 3: Bottom Synthesis / Actionable Workbench / Interview Arsenal
  yield {
    type: "status",
    phase: "bottom",
    message: "[PHASE 3/3] 正在生成底部全局复盘、主张-证据表与交错自测...",
    progress: 88,
  };

  const bottomOutput = await generator.generate({
    prompt: plugin.buildPrompts.bottomWorkbenchPrompt(
      docTitle,
      sourceUnits,
      topOutput,
      promptContext
    ),
    schema: plugin.schemas.bottomWorkbench,
    schemaName: `${plugin.id}_bottom_workbench`,
  });

  liveDoc.bottomTitle = bottomOutput.bottomTitle;
  liveDoc.bottomSubtitle = bottomOutput.bottomSubtitle;
  liveDoc.bottomBlocks = bottomOutput.bottomBlocks;
  liveDoc.units = hydratedUnits;
  liveDoc.updatedAt = new Date().toISOString();
  liveDoc.completionChecklist = buildCompletionChecklist(liveDoc, true);

  yield {
    type: "bottom",
    bottomTitle: bottomOutput.bottomTitle,
    bottomSubtitle: bottomOutput.bottomSubtitle,
    bottomBlocks: bottomOutput.bottomBlocks,
    partialDocument: { ...liveDoc },
  };

  yield {
    type: "status",
    phase: "done",
    message: "[COMPLETE] 全部结构化精读与可视化工作台构建完成。",
    progress: 100,
  };

  yield { type: "complete", document: liveDoc };
  return liveDoc;
}
