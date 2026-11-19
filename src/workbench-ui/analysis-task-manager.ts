import type { WorkbenchDocument } from "@/core/contracts/document-ast";
import type { RawSourcePayload, WorkbenchModePlugin } from "@/core/contracts/mode-plugin";
import type { AnalysisSpeedMode } from "@/core/engine/chunk-orchestrator";
import type { LLMConfig } from "@/core/engine/llm-adapters";
import { extractUrlFromShareText } from "@/core/engine/social-url";
import { parseArxivIdentifier } from "@/core/engine/web-fetchers";
import { defaultPluginRegistry } from "@/plugins";
import { useWorkbenchStore } from "@/store/workbench-store";
import { detectOmniSource, runStreamedAnalysis } from "./analyze-client";

export const MAX_CONCURRENT_DOCS = 3;

export interface EnqueueAnalysisParams {
  modeId: string;
  title?: string;
  payload: RawSourcePayload;
  llmConfig: LLMConfig;
  speedMode?: AnalysisSpeedMode;
  batchSize?: number;
  concurrency?: number;
  onDocumentComplete?: (doc: WorkbenchDocument) => void;
}

export interface BatchOmniSourceItem {
  rawLine: string;
  suggestedModeId?: string;
  detectedKind: "remote-url" | "repo-url";
}

const activeControllers = new Map<string, AbortController>();
const taskSpecs = new Map<string, EnqueueAnalysisParams>();
const pendingQueue: string[] = [];

/**
 * Generates a concise display title for background queue cards from raw input payload.
 */
export function deriveTaskTitle(
  modeName: string,
  payload: RawSourcePayload,
  titleOverride?: string
): string {
  const manual = titleOverride?.trim() || payload.title?.trim();
  if (manual) return manual;

  if (payload.fileName?.trim()) {
    return payload.fileName.trim().replace(/\.pdf$/i, "");
  }

  if (payload.kind === "repo-files") {
    return `${payload.files?.length ?? 0} 个源码文件 (${modeName})`;
  }

  const trimmed = payload.content.trim();
  if (payload.kind === "remote-url" || payload.kind === "repo-url") {
    const arxivId = parseArxivIdentifier(trimmed);
    if (arxivId) return `arXiv ${arxivId}`;

    const ghMatch = trimmed.match(/github\.com\/([^/\s]+\/[^/\s#?]+)/i);
    if (ghMatch) return ghMatch[1].replace(/\.git$/i, "");

    const extracted = extractUrlFromShareText(trimmed);
    const targetUrl = extracted?.url || trimmed;
    try {
      const parsed = new URL(targetUrl);
      const shortPath = parsed.pathname.replace(/\/+$/, "");
      return `${parsed.hostname.replace(/^www\./, "")}${shortPath.slice(0, 22)}`;
    } catch {
      return trimmed.slice(0, 32);
    }
  }

  if (payload.kind === "search-query") {
    return `检索 · ${trimmed.slice(0, 28)}`;
  }

  const firstLine = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (firstLine) {
    return firstLine.length > 28 ? `${firstLine.slice(0, 28)}…` : firstLine;
  }

  return `${modeName} · 新任务`;
}

function buildSourceLabel(modeName: string, payload: RawSourcePayload): string {
  if (payload.kind === "pdf-base64") return `PDF · ${payload.fileName || modeName}`;
  if (payload.kind === "repo-url") return "GitHub 仓库";
  if (payload.kind === "repo-files") return `本地源码 (${payload.files?.length ?? 0})`;
  if (payload.kind === "remote-url") {
    return parseArxivIdentifier(payload.content) ? "arXiv 论文" : "网页 / 视频链接";
  }
  if (payload.kind === "search-query") return "AI 检索";
  return modeName;
}

/**
 * Splits multi-line URL / arXiv ID / repo link batches into independent concurrent jobs
 * while leaving regular multi-line prose untouched.
 */
export function splitOmniBatchInputs(
  rawText: string,
  plugins: WorkbenchModePlugin[]
): BatchOmniSourceItem[] | null {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2 || lines.length > 10) {
    return null;
  }

  const items: BatchOmniSourceItem[] = [];
  for (const line of lines) {
    const detected = detectOmniSource(line, plugins);
    if (detected.detectedKind !== "remote-url" && detected.detectedKind !== "repo-url") {
      return null;
    }
    items.push({
      rawLine: line,
      suggestedModeId: detected.suggestedModeId,
      detectedKind: detected.detectedKind,
    });
  }

  return items;
}

async function executeTask(taskId: string) {
  const spec = taskSpecs.get(taskId);
  if (!spec) {
    pumpQueue();
    return;
  }

  const store = useWorkbenchStore.getState();
  const existing = store.analysisTasks.find((t) => t.id === taskId);
  if (!existing || existing.status === "cancelled") {
    pumpQueue();
    return;
  }

  const controller = new AbortController();
  activeControllers.set(taskId, controller);

  store.updateAnalysisTask(taskId, {
    status: "running",
    progress: 6,
    message: "正在初始化解析管线...",
    error: undefined,
  });

  try {
    const completedDoc = await runStreamedAnalysis({
      modeId: spec.modeId,
      title: spec.title,
      payload: spec.payload,
      llmConfig: spec.llmConfig,
      speedMode: spec.speedMode ?? "balanced",
      batchSize: spec.batchSize,
      concurrency: spec.concurrency,
      signal: controller.signal,
      onProgress: (pct, text) => {
        if (controller.signal.aborted) return;
        useWorkbenchStore.getState().updateAnalysisTask(taskId, {
          progress: pct,
          message: text,
        });
      },
      onPartialDocument: (partial) => {
        if (controller.signal.aborted) return;
        const st = useWorkbenchStore.getState();
        st.upsertDocument(partial, { activate: false });
        const curTask = st.analysisTasks.find((t) => t.id === taskId);
        const partialTitle = partial.title?.trim();
        st.updateAnalysisTask(taskId, {
          documentId: partial.id,
          hasPartialDoc: true,
          title:
            partialTitle && partialTitle !== curTask?.modeName
              ? partialTitle
              : curTask?.title || partial.id,
        });
      },
    });

    if (controller.signal.aborted) {
      return;
    }

    const st = useWorkbenchStore.getState();
    st.upsertDocument(completedDoc, { activate: false });
    const curTask = st.analysisTasks.find((t) => t.id === taskId);
    const doneTitle = completedDoc.title?.trim();
    st.updateAnalysisTask(taskId, {
      status: "completed",
      progress: 100,
      message: "精读工作台已就绪",
      documentId: completedDoc.id,
      hasPartialDoc: true,
      title:
        doneTitle && doneTitle !== curTask?.modeName
          ? doneTitle
          : curTask?.title || completedDoc.id,
      finishedAt: Date.now(),
      error: undefined,
    });
    spec.onDocumentComplete?.(completedDoc);
  } catch (err) {
    const st = useWorkbenchStore.getState();
    const isAbort =
      controller.signal.aborted ||
      (err instanceof Error && err.name === "AbortError");
    if (isAbort) {
      st.updateAnalysisTask(taskId, {
        status: "cancelled",
        message: "已手动取消解析",
        finishedAt: Date.now(),
      });
    } else {
      const msg =
        err instanceof Error
          ? err.message || `${err.name}: 解析过程异常`
          : typeof err === "string" && err.trim()
            ? err
            : "解析过程中出现错误，请检查网络或 AI 接口配置。";
      st.updateAnalysisTask(taskId, {
        status: "error",
        message: "解析失败，可点击重试",
        error: msg,
        finishedAt: Date.now(),
      });
    }
  } finally {
    activeControllers.delete(taskId);
    pumpQueue();
  }
}

function pumpQueue() {
  while (activeControllers.size < MAX_CONCURRENT_DOCS && pendingQueue.length > 0) {
    const nextId = pendingQueue.shift();
    if (!nextId) continue;
    if (activeControllers.has(nextId)) continue;
    const task = useWorkbenchStore.getState().analysisTasks.find((t) => t.id === nextId);
    if (!task || task.status === "cancelled") continue;
    void executeTask(nextId);
  }
}

/**
 * Enqueues a non-blocking analysis job into the background worker pool (up to 3 concurrent documents).
 * Persisting partial & completed documents never steals active reader focus unless the user clicks in.
 */
export function enqueueBackgroundAnalysis(params: EnqueueAnalysisParams): string {
  const modeName = defaultPluginRegistry.has(params.modeId)
    ? defaultPluginRegistry.get(params.modeId).name
    : params.modeId;
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const speedMode = params.speedMode ?? "balanced";
  const title = deriveTaskTitle(modeName, params.payload, params.title);
  const sourceLabel = buildSourceLabel(modeName, params.payload);

  taskSpecs.set(taskId, { ...params, speedMode });

  useWorkbenchStore.getState().addAnalysisTask({
    id: taskId,
    modeId: params.modeId,
    modeName,
    title,
    sourceLabel,
    speedMode,
    status: "queued",
    progress: 2,
    message: "已加入并行队列，等待调度...",
    startedAt: Date.now(),
  });

  pendingQueue.push(taskId);
  pumpQueue();
  return taskId;
}

export function cancelBackgroundAnalysis(taskId: string): void {
  const qIdx = pendingQueue.indexOf(taskId);
  if (qIdx !== -1) {
    pendingQueue.splice(qIdx, 1);
  }

  const controller = activeControllers.get(taskId);
  if (controller) {
    useWorkbenchStore.getState().updateAnalysisTask(taskId, {
      status: "cancelled",
      message: "正在取消...",
      finishedAt: Date.now(),
    });
    controller.abort();
    return;
  }

  useWorkbenchStore.getState().updateAnalysisTask(taskId, {
    status: "cancelled",
    message: "已手动取消解析",
    finishedAt: Date.now(),
  });
}

export function retryBackgroundAnalysis(taskId: string): boolean {
  const spec = taskSpecs.get(taskId);
  if (!spec) return false;

  if (activeControllers.has(taskId)) {
    activeControllers.get(taskId)?.abort();
    activeControllers.delete(taskId);
  }
  const qIdx = pendingQueue.indexOf(taskId);
  if (qIdx !== -1) {
    pendingQueue.splice(qIdx, 1);
  }

  useWorkbenchStore.getState().updateAnalysisTask(taskId, {
    status: "queued",
    progress: 2,
    message: "已重新排队，等待并行调度...",
    startedAt: Date.now(),
    finishedAt: undefined,
    error: undefined,
  });

  pendingQueue.push(taskId);
  pumpQueue();
  return true;
}

export function resetAnalysisTaskManagerForTests(): void {
  for (const controller of activeControllers.values()) {
    controller.abort();
  }
  activeControllers.clear();
  pendingQueue.length = 0;
  taskSpecs.clear();
}
