import type { WorkbenchDocument } from "@/core/contracts/document-ast";
import type { RawSourcePayload, WorkbenchModePlugin } from "@/core/contracts/mode-plugin";
import type { AnalysisSpeedMode, AnalysisStreamEvent } from "@/core/engine/chunk-orchestrator";
import type { LLMConfig } from "@/core/engine/llm-adapters";
import { extractUrlFromShareText } from "@/core/engine/social-url";

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const SOCIAL_PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音",
  bilibili: "B站",
  x: "X (Twitter)",
  youtube: "YouTube",
  xiaohongshu: "小红书",
  tiktok: "TikTok",
};

export interface SmartDetectionResult {
  suggestedModeId?: string;
  hint?: string;
  detectedKind?: RawSourcePayload["kind"];
}

/**
 * Inspects pasted text or share links to infer the best-matching mode plugin
 * and source payload kind.
 */
export function detectOmniSource(
  rawValue: string,
  plugins: WorkbenchModePlugin[]
): SmartDetectionResult {
  const trimmed = rawValue.trim();
  if (!trimmed) return {};

  const paperPlugin = plugins.find((p) => p.inputConfig.acceptedFileTypes?.includes(".pdf"));
  const videoPlugin = plugins.find((p) => p.inputConfig.acceptedFileTypes?.includes(".srt"));
  const repoPlugin = plugins.find((p) => p.inputConfig.supportsRepoUrl);

  // GitHub repo URL
  if (/^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+/i.test(trimmed)) {
    return {
      suggestedModeId: repoPlugin?.id,
      hint: repoPlugin ? `已识别 GitHub 仓库，自动匹配「${repoPlugin.name}」` : undefined,
      detectedKind: "repo-url",
    };
  }

  // Social / video share text or URL
  const social = extractUrlFromShareText(trimmed);
  if (social && social.platform in SOCIAL_PLATFORM_LABELS) {
    const label = SOCIAL_PLATFORM_LABELS[social.platform] ?? "视频";
    return {
      suggestedModeId: videoPlugin?.id,
      hint: videoPlugin
        ? `已识别${label}链接，已自动切换为「${videoPlugin.name}」模式`
        : undefined,
      detectedKind: "remote-url",
    };
  }

  // arXiv ID or arXiv URL
  if (
    /^(\d{4}\.\d{4,5}(v\d+)?)$/i.test(trimmed) ||
    /^https?:\/\/arxiv\.org\/(abs|pdf)\//i.test(trimmed)
  ) {
    return {
      suggestedModeId: paperPlugin?.id,
      hint: paperPlugin ? `已识别 arXiv 论文标识，匹配「${paperPlugin.name}」` : undefined,
      detectedKind: "remote-url",
    };
  }

  // Generic HTTP(S) URL
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    const isPdf = /\.pdf(\?|$)/i.test(trimmed);
    return {
      suggestedModeId: isPdf ? paperPlugin?.id : undefined,
      hint: isPdf && paperPlugin ? `已识别在线 PDF，匹配「${paperPlugin.name}」` : "已识别网页链接，将自动抓取正文",
      detectedKind: "remote-url",
    };
  }

  // Short single-line query without CJK punctuation heavy prose
  if (!trimmed.includes("\n") && trimmed.length <= 80 && !/[。；！？]/.test(trimmed)) {
    return {
      detectedKind: "search-query",
      hint: "识别为检索关键词，将先在线搜寻一手资料再精读拆解",
    };
  }

  return { detectedKind: "text" };
}

export async function filesToSourcePayload(
  files: File[],
  supportsRepoUrl: boolean
): Promise<{
  payload: RawSourcePayload | null;
  textContent?: string;
  label: string;
  suggestedTitle: string;
}> {
  if (files.length === 1 && files[0].name.toLowerCase().endsWith(".pdf")) {
    const buf = await files[0].arrayBuffer();
    const base64 = arrayBufferToBase64(buf);
    return {
      payload: {
        kind: "pdf-base64",
        content: base64,
        fileName: files[0].name,
      },
      label: `已加载 PDF：${files[0].name} (${Math.ceil(files[0].size / 1024)} KB)`,
      suggestedTitle: files[0].name.replace(/\.pdf$/i, ""),
    };
  }

  if (supportsRepoUrl) {
    const loadedFiles = await Promise.all(
      files.map(async (f) => ({
        path: f.webkitRelativePath || f.name,
        content: await f.text(),
      }))
    );
    return {
      payload: {
        kind: "repo-files",
        content: "",
        files: loadedFiles,
      },
      label: `已读取 ${loadedFiles.length} 个源码文件`,
      suggestedTitle: files[0].name.replace(/\.[^.]+$/, ""),
    };
  }

  const combinedText = (await Promise.all(files.map((f) => f.text()))).join("\n\n");
  return {
    payload: null,
    textContent: combinedText,
    label: `已导入文件文本：${files.map((f) => f.name).join(", ")}`,
    suggestedTitle: files[0].name.replace(/\.[^.]+$/, ""),
  };
}

export interface StreamedAnalysisParams {
  modeId: string;
  title?: string;
  payload: RawSourcePayload;
  llmConfig: LLMConfig;
  speedMode?: AnalysisSpeedMode;
  batchSize?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress: (pct: number, text: string) => void;
  onPartialDocument?: (doc: WorkbenchDocument) => void;
}

/**
 * Streams NDJSON events from `/api/analyze` and returns the completed WorkbenchDocument.
 */
export async function runStreamedAnalysis({
  modeId,
  title,
  payload,
  llmConfig,
  speedMode = "balanced",
  batchSize,
  concurrency,
  signal,
  onProgress,
  onPartialDocument,
}: StreamedAnalysisParams): Promise<WorkbenchDocument> {
  onProgress(
    8,
    payload.kind === "search-query"
      ? "正在启动 AI 联网工具检索源资料..."
      : "正在读取与切片清洗源内容..."
  );

  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      modeId,
      title: title?.trim() || undefined,
      speedMode,
      batchSize,
      concurrency,
      payload,
      llmConfig: llmConfig.apiKey.trim() ? llmConfig : undefined,
    }),
  });

  if (!response.ok || !response.body) {
    const errBody = await response.text();
    throw new Error(errBody || `请求失败 (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completedDoc: WorkbenchDocument | null = null;

  const processLine = (rawLine: string) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed) as
      | AnalysisStreamEvent
      | { type: "error"; message?: string };
    if (!event || typeof event !== "object") return;
    if (event.type === "status") {
      onProgress(event.progress, event.message);
    } else if (event.type === "source-ready") {
      onProgress(16, `已清洗提取 ${event.totalUnits} 个单元，正在精译开篇前 5 段...`);
    } else if (event.type === "top-model") {
      if (event.readyForReading !== false) {
        onProgress(40, "已构建顶层心智模型与架构图（可进入阅读）...");
        if (event.partialDocument) onPartialDocument?.(event.partialDocument);
      } else {
        onProgress(22, "已构建全局框架，正在完整精译前 5 段以备无缝开读...");
      }
    } else if (event.type === "unit-batch") {
      const pct = Math.min(88, 35 + Math.round((event.batchIndex / Math.max(1, event.totalBatches)) * 52));
      if (event.readyForReading !== false && event.partialDocument) {
        onPartialDocument?.(event.partialDocument);
      }
      if (event.batchIndex >= 1 && event.totalBatches > 1 && event.readyForReading !== false) {
        onProgress(
          pct,
          event.batchIndex <= 2
            ? "前 5 段已译妥可进入阅读 · 后续正文逐段生成中..."
            : `正在逐段生成正文（${event.batchIndex}/${event.totalBatches}）...`
        );
      } else {
        onProgress(pct, `正在精译开篇前 5 段（${event.batchIndex}/${event.totalBatches}）...`);
      }
    } else if (event.type === "bottom") {
      onProgress(94, "已生成底部实战与复盘军火库...");
      if (event.partialDocument) onPartialDocument?.(event.partialDocument);
    } else if (event.type === "error") {
      throw new Error(event.message || "服务端解析返回未知错误");
    } else if (event.type === "complete") {
      completedDoc = event.document;
      onProgress(100, "精读工作台已就绪");
    }
  };

  try {
    while (true) {
      if (signal?.aborted) {
        const abortErr = new Error("分析任务已取消");
        abortErr.name = "AbortError";
        throw abortErr;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      processLine(buffer);
    }
  } finally {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {});
    }
  }

  if (!completedDoc) {
    throw new Error("分析流已结束但未收到完整文档输出，请重试。");
  }

  return completedDoc;
}
