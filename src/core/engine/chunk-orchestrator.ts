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

export type AnalysisSpeedMode = "balanced" | "fast";

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
  concurrency?: number;
  speedMode?: AnalysisSpeedMode;
  abortSignal?: AbortSignal;
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

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("分析任务已取消");
    err.name = "AbortError";
    throw err;
  }
}

function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    const err = new Error("分析任务已取消");
    err.name = "AbortError";
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      const err = new Error("分析任务已取消");
      err.name = "AbortError";
      reject(err);
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isNonRetryableAuthOrQuotaError(err: unknown): boolean {
  const status = (err as { statusCode?: unknown })?.statusCode;
  return status === 401 || status === 402 || status === 403 || status === 404;
}

function appendPromptModeHint(
  prompt: string,
  stage: "top-model" | "batch" | "bottom",
  speedMode: AnalysisSpeedMode
): string {
  if (stage === "top-model") {
    return speedMode === "fast"
      ? `${prompt}\n\n【极速精简模式】请大幅压缩单字段篇幅：卡片正文限 1 句，glossary 保留 3~4 条，fadedExamples 仅生成 level=1 的 1 个示例，designChoices 限 2~3 条，sections 仅按大章节 sectionId 输出（严禁按段落 unitId 展开）且每节 summary 不超过 1 句话，确保极快输出完整 JSON。`
      : `${prompt}\n\n【输出控制】请保持字段简洁凝练（卡片正文每条 1~2 句，sections 仅按大章节 sectionId 输出且每节 summary 限 1~2 句，术语定义各 1 句），确保单轮完整输出合法 JSON 不截断。`;
  }
  if (speedMode === "fast") {
    if (stage === "batch") {
      return `${prompt}\n\n【极速精简模式】每单元 secondaryBlockText 保留准确流畅意译，tldr 限 1 句，notes 4 条各限 1~2 句核心要点，highlights 每段最多 3 条最关键短语。`;
    }
    return `${prompt}\n\n【极速精简模式】底部各模块保持完整结构但每条内容精炼到 1 句话，socratic-qa 输出 3 题，控制整体长度实现快速响应。`;
  }
  return prompt;
}

function createAsyncEventQueue<T>() {
  const buffer: T[] = [];
  let closed = false;
  let failure: unknown = null;
  let hasFailure = false;
  let waitingResolver: ((res: IteratorResult<T>) => void) | null = null;
  let waitingRejecter: ((err: unknown) => void) | null = null;

  return {
    push(item: T) {
      if (closed || hasFailure) return;
      if (waitingResolver) {
        const resolve = waitingResolver;
        waitingResolver = null;
        waitingRejecter = null;
        resolve({ value: item, done: false });
      } else {
        buffer.push(item);
      }
    },
    close() {
      if (closed || hasFailure) return;
      closed = true;
      if (waitingResolver) {
        const resolve = waitingResolver;
        waitingResolver = null;
        waitingRejecter = null;
        resolve({ value: undefined as T, done: true });
      }
    },
    fail(err: unknown) {
      if (closed || hasFailure) return;
      hasFailure = true;
      failure = err;
      if (waitingRejecter) {
        const reject = waitingRejecter;
        waitingResolver = null;
        waitingRejecter = null;
        reject(err);
      }
    },
    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next() {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift() as T, done: false });
          }
          if (hasFailure) {
            return Promise.reject(failure);
          }
          if (closed) {
            return Promise.resolve({ value: undefined as T, done: true });
          }
          return new Promise<IteratorResult<T>>((resolve, reject) => {
            waitingResolver = resolve;
            waitingRejecter = reject;
          });
        },
      };
    },
  };
}

/**
 * ChunkedAnalysisEngine:
 * Splits arbitrarily long inputs into deterministic chunks, generates top mental model,
 * streams parallel batch & bottom structured annotations cleanly via a bounded worker pool,
 * and falls back cleanly to plugin.createHeuristicDocument when no LLM generator is supplied.
 */
export async function* runChunkedAnalysis(
  plugin: WorkbenchModePlugin,
  payload: RawSourcePayload,
  options: OrchestratorOptions = {}
): AsyncGenerator<AnalysisStreamEvent, WorkbenchDocument, void> {
  throwIfAborted(options.abortSignal);

  yield {
    type: "status",
    phase: "ingesting",
    message: `[SEAM 01] 正在通过 ${plugin.name} 预处理器清洗并切分输入源...`,
    progress: 8,
  };

  let preprocessDone = false;
  const preprocessPromise = plugin.preprocessSource(payload).finally(() => {
    preprocessDone = true;
  });
  let tick = 0;
  while (!preprocessDone) {
    await Promise.race([
      preprocessPromise.then(
        () => undefined,
        () => undefined
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 15000)),
    ]);
    throwIfAborted(options.abortSignal);
    if (!preprocessDone) {
      tick += 1;
      yield {
        type: "status",
        phase: "ingesting",
        message: `[SEAM 01] 正在拉取/转写输入源（已等待 ${tick * 15}s）...`,
        progress: Math.min(16, 8 + tick),
      };
    }
  }
  const sourceUnits = await preprocessPromise;
  throwIfAborted(options.abortSignal);

  if (sourceUnits.length === 0) {
    throw new Error("未能从输入中解析出有效内容单元，请检查输入文本、PDF 文件或链接地址。");
  }

  // Resolve final document title AFTER preprocessSource so fetched arXiv/Web/GitHub metadata can populate payload.title
  const docTitle = options.titleOverride?.trim() || payload.title?.trim() || plugin.name;
  const docId = `${plugin.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
  const speedMode: AnalysisSpeedMode = options.speedMode ?? "balanced";
  const batchSize = options.batchSize ?? (speedMode === "fast" ? 8 : 6);
  const concurrency = Math.max(
    1,
    Math.min(6, options.concurrency ?? (speedMode === "fast" ? 5 : 4))
  );

  // Step 1: Global Mental Model & Section Skeleton
  throwIfAborted(options.abortSignal);
  yield {
    type: "status",
    phase: "top-model",
    message: `[PHASE 1/3] 正在构建全局认知脚手架、拓扑图与术语词典（${
      speedMode === "fast" ? "极速" : "标准"
    } · ${concurrency}路并发）...`,
    progress: 18,
  };

  const topOutput = await generator.generate({
    prompt: appendPromptModeHint(
      plugin.buildPrompts.topModelPrompt(docTitle, sourceUnits, promptContext),
      "top-model",
      speedMode
    ),
    schema: plugin.schemas.topMentalModel,
    schemaName: `${plugin.id}_top_mental_model`,
    abortSignal: options.abortSignal,
    maxTokens: 8192,
  });

  throwIfAborted(options.abortSignal);

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

  // Step 2 & 3 Combined Parallel Worker Pool (Batches + Bottom Workbench)
  const batches = chunkArray(sourceUnits, batchSize);
  const allSectionIds = Array.from(new Set(sourceUnits.map((u) => u.sectionId)));
  const baselineById = new Map(liveDoc.units.map((u) => [u.id, u]));
  const hydratedById = new Map<string, WorkbenchUnit>();

  const totalWorkUnits = batches.length + 1;
  const activeWorkers = Math.min(concurrency, totalWorkUnits);
  const queue = createAsyncEventQueue<AnalysisStreamEvent>();

  yield {
    type: "status",
    phase: "batch",
    message: `[PHASE 2/3] 正在并行拆解 ${batches.length} 批正文 + 底部复盘（${activeWorkers} 路并发）...`,
    progress: 26,
  };

  type PoolTask =
    | { kind: "batch"; index: number; batch: SourceUnit[] }
    | { kind: "bottom" };

  const workItems: PoolTask[] = [
    ...batches.map((batch, index): PoolTask => ({ kind: "batch", index, batch })),
    { kind: "bottom" },
  ];

  let cursor = 0;
  let completedBatches = 0;
  let completedBottom = false;
  let failedBatchCount = 0;
  let firstBatchError: unknown = null;

  const computePoolProgress = () =>
    26 + Math.min(68, Math.round(((completedBatches + (completedBottom ? 1 : 0)) / totalWorkUnits) * 68));

  const hydrateBatchDirect = async (
    targetBatch: SourceUnit[],
    batchLabel: string
  ): Promise<WorkbenchUnit[]> => {
    const batchResult = await generator.generate({
      prompt: appendPromptModeHint(
        plugin.buildPrompts.batchUnitsPrompt(
          targetBatch,
          topOutput.globalContextSummary,
          allSectionIds
        ),
        "batch",
        speedMode
      ),
      schema: plugin.schemas.batchUnits,
      schemaName: batchLabel,
      abortSignal: options.abortSignal,
      maxTokens: 8192,
    });

    const batchMap = new Map<string, (typeof batchResult.units)[number]>();
    for (const u of batchResult.units) {
      if (u.unitId) batchMap.set(u.unitId, u);
    }

    return targetBatch.map((src, idx) => {
      const matched =
        batchMap.get(src.id) ?? batchMap.get(src.unitCode) ?? batchResult.units[idx];
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
  };

  const hydrateBatchWithRetry = async (
    targetBatch: SourceUnit[],
    batchNum: number
  ): Promise<{ units: WorkbenchUnit[]; anyFailed: boolean; err?: unknown }> => {
    const baseLabel = `${plugin.id}_batch_${batchNum}`;
    try {
      return { units: await hydrateBatchDirect(targetBatch, baseLabel), anyFailed: false };
    } catch (err) {
      if (
        options.abortSignal?.aborted ||
        (err instanceof Error && err.name === "AbortError") ||
        isNonRetryableAuthOrQuotaError(err)
      ) {
        throw err;
      }

      await waitWithAbort(1200, options.abortSignal);
      if (targetBatch.length >= 4) {
        const mid = Math.ceil(targetBatch.length / 2);
        const halves = [targetBatch.slice(0, mid), targetBatch.slice(mid)];
        const combined: WorkbenchUnit[] = [];
        let halfFailed = false;
        let lastHalfErr: unknown = err;

        for (let hIdx = 0; hIdx < halves.length; hIdx++) {
          const half = halves[hIdx];
          try {
            combined.push(
              ...(await hydrateBatchDirect(half, `${baseLabel}_part${hIdx + 1}`))
            );
          } catch (halfErr) {
            if (
              options.abortSignal?.aborted ||
              (halfErr instanceof Error && halfErr.name === "AbortError")
            ) {
              throw halfErr;
            }
            halfFailed = true;
            lastHalfErr = halfErr;
            const reason =
              halfErr instanceof Error && halfErr.message
                ? halfErr.message.slice(0, 60)
                : "请求超时或异常";
            for (const src of half) {
              const base = baselineById.get(src.id)!;
              combined.push({
                ...base,
                secondaryBlockText: `该批次翻译生成失败（${reason}），已保留原文与基础结构（可稍后重试该篇）。`,
              });
            }
          }
        }
        return {
          units: combined,
          anyFailed: halfFailed,
          err: halfFailed ? lastHalfErr : undefined,
        };
      }

      try {
        return {
          units: await hydrateBatchDirect(targetBatch, `${baseLabel}_retry`),
          anyFailed: false,
        };
      } catch (retryErr) {
        if (
          options.abortSignal?.aborted ||
          (retryErr instanceof Error && retryErr.name === "AbortError")
        ) {
          throw retryErr;
        }
        return { units: [], anyFailed: true, err: retryErr };
      }
    }
  };

  const workers = Array.from({ length: activeWorkers }, async () => {
    while (true) {
      throwIfAborted(options.abortSignal);
      const nextIdx = cursor++;
      if (nextIdx >= workItems.length) return;
      const task = workItems[nextIdx];

      if (task.kind === "batch") {
        try {
          const outcome = await hydrateBatchWithRetry(task.batch, task.index + 1);
          if (outcome.units.length === 0 && outcome.anyFailed) {
            throw outcome.err;
          }
          if (outcome.anyFailed) {
            failedBatchCount += 1;
            if (!firstBatchError && outcome.err) firstBatchError = outcome.err;
            if (failedBatchCount === batches.length) {
              throw outcome.err ?? new Error("全部批次正文解析失败");
            }
          }

          for (const u of outcome.units) {
            hydratedById.set(u.id, u);
          }
          liveDoc.units = sourceUnits.map(
            (src) => hydratedById.get(src.id) ?? baselineById.get(src.id)!
          );
          liveDoc.updatedAt = new Date().toISOString();
          completedBatches += 1;

          queue.push({
            type: "unit-batch",
            batchIndex: completedBatches,
            totalBatches: batches.length,
            units: outcome.units,
            partialDocument: { ...liveDoc, units: [...liveDoc.units] },
          });
          queue.push({
            type: "status",
            phase: "batch",
            message: `[PHASE 2/3] 已并行完成 ${completedBatches}/${batches.length} 批正文${
              completedBottom ? " + 底部复盘" : ""
            }...`,
            progress: computePoolProgress(),
          });
        } catch (err) {
          if (options.abortSignal?.aborted || (err instanceof Error && err.name === "AbortError")) {
            throw err;
          }
          failedBatchCount += 1;
          if (!firstBatchError) firstBatchError = err;

          if (batches.length === 1 || failedBatchCount === batches.length) {
            throw err;
          }

          const shortReason =
            err instanceof Error && err.message ? err.message.slice(0, 60) : "请求超时或异常";
          const fallbackUnits: WorkbenchUnit[] = task.batch.map((src) => {
            const base = baselineById.get(src.id)!;
            return {
              ...base,
              secondaryBlockText: `该批次翻译生成失败（${shortReason}），已保留原文与基础结构（可稍后重试该篇）。`,
            };
          });
          for (const u of fallbackUnits) {
            hydratedById.set(u.id, u);
          }
          liveDoc.units = sourceUnits.map(
            (src) => hydratedById.get(src.id) ?? baselineById.get(src.id)!
          );
          liveDoc.updatedAt = new Date().toISOString();
          completedBatches += 1;

          queue.push({
            type: "unit-batch",
            batchIndex: completedBatches,
            totalBatches: batches.length,
            units: fallbackUnits,
            partialDocument: { ...liveDoc, units: [...liveDoc.units] },
          });
        }
      } else {
        const bottomOutput = await generator.generate({
          prompt: appendPromptModeHint(
            plugin.buildPrompts.bottomWorkbenchPrompt(
              docTitle,
              sourceUnits,
              topOutput,
              promptContext
            ),
            "bottom",
            speedMode
          ),
          schema: plugin.schemas.bottomWorkbench,
          schemaName: `${plugin.id}_bottom_workbench`,
          abortSignal: options.abortSignal,
          maxTokens: 8192,
        });

        liveDoc.bottomTitle = bottomOutput.bottomTitle;
        liveDoc.bottomSubtitle = bottomOutput.bottomSubtitle;
        liveDoc.bottomBlocks = bottomOutput.bottomBlocks;
        liveDoc.updatedAt = new Date().toISOString();
        completedBottom = true;

        queue.push({
          type: "bottom",
          bottomTitle: bottomOutput.bottomTitle,
          bottomSubtitle: bottomOutput.bottomSubtitle,
          bottomBlocks: bottomOutput.bottomBlocks,
          partialDocument: { ...liveDoc, units: [...liveDoc.units] },
        });
        queue.push({
          type: "status",
          phase: "bottom",
          message:
            completedBatches >= batches.length
              ? "[PHASE 3/3] 底部复盘与论证矩阵已生成..."
              : `[PHASE 2/3] 底部复盘已就绪，已完成 ${completedBatches}/${batches.length} 批正文...`,
          progress: computePoolProgress(),
        });
      }
    }
  });

  void Promise.all(workers).then(
    () => {
      if (failedBatchCount === batches.length && firstBatchError) {
        queue.fail(firstBatchError);
      } else {
        queue.close();
      }
    },
    (err) => {
      queue.fail(err);
    }
  );

  for await (const ev of queue) {
    yield ev;
  }

  throwIfAborted(options.abortSignal);

  liveDoc.units = sourceUnits.map((src) => hydratedById.get(src.id) ?? baselineById.get(src.id)!);
  liveDoc.updatedAt = new Date().toISOString();
  liveDoc.completionChecklist = buildCompletionChecklist(liveDoc, true);

  yield {
    type: "status",
    phase: "done",
    message: "[COMPLETE] 全部结构化精读与可视化工作台构建完成。",
    progress: 100,
  };

  yield { type: "complete", document: liveDoc };
  return liveDoc;
}
