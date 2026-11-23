"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getPanelGlassTextClasses,
  PanelGlassHeader,
} from "@/components/ui/fluid-orb";
import { useWorkbenchStore, type WorkbenchThemeMode } from "@/store/workbench-store";
import type { WorkbenchDocument } from "@/core/contracts/document-ast";
import type { RawSourcePayload } from "@/core/contracts/mode-plugin";
import type { LLMConfig } from "@/core/engine/llm-adapters";
import { defaultPluginRegistry } from "@/plugins";
import { enqueueBackgroundAnalysis } from "./analysis-task-manager";
import { detectOmniSource, filesToSourcePayload } from "./analyze-client";

interface IngestionStudioModalProps {
  open: boolean;
  llmConfig: LLMConfig;
  themeMode?: WorkbenchThemeMode;
  onClose: () => void;
  onCreated?: (doc: WorkbenchDocument) => void;
  onTaskEnqueued?: () => void;
}

type InputTab = "text-or-file" | "remote-url" | "agent-search";

export function IngestionStudioModal({
  open,
  llmConfig,
  themeMode = "paper",
  onClose,
  onTaskEnqueued,
}: IngestionStudioModalProps) {
  const analysisSpeedMode = useWorkbenchStore((s) => s.analysisSpeedMode);
  const setAnalysisSpeedMode = useWorkbenchStore((s) => s.setAnalysisSpeedMode);

  const plugins = useMemo(() => defaultPluginRegistry.list(), []);
  const videoPlugin = useMemo(
    () => plugins.find((p) => p.inputConfig.acceptedFileTypes?.includes(".srt")),
    [plugins]
  );
  const [selectedModeId, setSelectedModeId] = useState<string>(plugins[0]?.id ?? "");
  const [autoSwitchedHint, setAutoSwitchedHint] = useState("");
  const [activeTab, setActiveTab] = useState<InputTab>("text-or-file");
  const [title, setTitle] = useState("");
  const [textInput, setTextInput] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadedPayload, setUploadedPayload] = useState<RawSourcePayload | null>(null);
  const [uploadedLabel, setUploadedLabel] = useState<string>("");
  const [readingPurpose, setReadingPurpose] = useState("彻底理解");
  const [userBackground, setUserBackground] = useState("");
  const [userTopic, setUserTopic] = useState("");
  const [showCustomContext, setShowCustomContext] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headerCls = getPanelGlassTextClasses(themeMode);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const activePlugin = plugins.find((p) => p.id === selectedModeId) ?? plugins[0];
  const hasRemoteInput = Boolean(
    activePlugin.inputConfig.supportsRemoteUrl || activePlugin.inputConfig.supportsRepoUrl
  );
  const hasSearchInput = Boolean(activePlugin.inputConfig.supportsAgentSearch);

  const maybeAutoSwitchVideoMode = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      setAutoSwitchedHint("");
      return;
    }
    if (!videoPlugin || selectedModeId !== plugins[0]?.id) return;
    const detected = detectOmniSource(trimmed, plugins);
    if (detected.suggestedModeId === videoPlugin.id && detected.hint) {
      setSelectedModeId(videoPlugin.id);
      setAutoSwitchedHint(detected.hint);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setErrorMsg("");

    const result = await filesToSourcePayload(
      Array.from(fileList),
      Boolean(activePlugin.inputConfig.supportsRepoUrl)
    );
    if (result.payload) {
      setUploadedPayload(result.payload);
    } else {
      setTextInput(result.textContent ?? "");
      setUploadedPayload(null);
    }
    setUploadedLabel(result.label);
    if (!title.trim() && result.suggestedTitle) setTitle(result.suggestedTitle);
  };

  const buildSubmissionPayload = (): RawSourcePayload | null => {
    const personalization = {
      readingPurpose: readingPurpose.trim() || undefined,
      userBackground: userBackground.trim() || undefined,
      userTopic: userTopic.trim() || undefined,
    };

    if (activeTab === "agent-search" && searchQuery.trim()) {
      return {
        kind: "search-query",
        content: searchQuery.trim(),
        title: title.trim() || undefined,
        ...personalization,
      };
    }
    if (activeTab === "remote-url" && remoteUrl.trim()) {
      return {
        kind: activePlugin.inputConfig.supportsRepoUrl ? "repo-url" : "remote-url",
        content: remoteUrl.trim(),
        title: title.trim() || undefined,
        ...personalization,
      };
    }
    if (uploadedPayload) return { ...uploadedPayload, ...personalization };
    if (textInput.trim()) {
      return {
        kind: "text",
        content: textInput.trim(),
        title: title.trim() || undefined,
        ...personalization,
      };
    }
    // Convenience fallback: if user typed in remoteUrl or searchQuery without switching tab
    if (remoteUrl.trim()) {
      return {
        kind: activePlugin.inputConfig.supportsRepoUrl ? "repo-url" : "remote-url",
        content: remoteUrl.trim(),
        title: title.trim() || undefined,
        ...personalization,
      };
    }
    if (searchQuery.trim()) {
      return {
        kind: "search-query",
        content: searchQuery.trim(),
        title: title.trim() || undefined,
        ...personalization,
      };
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const payload = buildSubmissionPayload();
    if (!payload) {
      setErrorMsg("请先粘贴文本/上传文件、填写 arXiv 号或网页链接，或输入 AI 检索关键词。");
      return;
    }

    enqueueBackgroundAnalysis({
      modeId: activePlugin.id,
      title: title.trim() || undefined,
      payload,
      llmConfig,
      speedMode: analysisSpeedMode,
    });

    setTextInput("");
    setRemoteUrl("");
    setSearchQuery("");
    setUploadedPayload(null);
    setUploadedLabel("");
    setTitle("");
    onTaskEnqueued?.();
    onClose();
  };

  const isRunning = false;
  const activeEngineLabel = llmConfig.apiKey.trim()
    ? `${llmConfig.provider} · ${llmConfig.model}`
    : "离线启发式引擎";
  const remoteTabLabel = activePlugin.inputConfig.supportsRepoUrl
    ? "GitHub 仓库"
    : activePlugin.inputConfig.acceptedFileTypes?.includes(".srt")
      ? "视频 / 网页链接"
      : "arXiv / 链接";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRunning) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="新建精读与拆解工作台"
        className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: "var(--prism-surface, #fcf9f2)",
          borderColor: "var(--prism-border, #d8ccb5)",
          color: "var(--prism-ink, #1f242d)",
        }}
      >
        <PanelGlassHeader
          testId="studio-modal-header"
          themeMode={themeMode}
          left={
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h2 className={`font-serif text-[17px] font-semibold tracking-tight ${headerCls.heading}`}>
                新建解析
              </h2>
              <span className={`font-mono text-[11px] opacity-80 ${headerCls.subtitle}`}>
                {activeEngineLabel}
              </span>
            </div>
          }
          right={
            <button
              type="button"
              disabled={isRunning}
              onClick={onClose}
              aria-label="关闭"
              className={`font-mono text-xs px-2.5 py-1 rounded-full cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap ${headerCls.ghostBtn}`}
            >
              关闭
            </button>
          }
        />

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto text-sm">
          {/* Segmented Mode Selector */}
          <div className="space-y-2">
            <div
              className="grid grid-cols-3 gap-1 rounded-xl p-1 border"
              style={{
                backgroundColor: "var(--prism-surface-muted, #e8dec9)",
                borderColor: "var(--prism-border, #d8ccb5)",
              }}
            >
              {plugins.map((plugin) => {
                const selected = plugin.id === activePlugin.id;
                return (
                  <button
                    key={plugin.id}
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setSelectedModeId(plugin.id);
                      setAutoSwitchedHint("");
                      setUploadedPayload(null);
                      setUploadedLabel("");
                      setRemoteUrl("");
                      setSearchQuery("");
                      setActiveTab("text-or-file");
                    }}
                    className={`rounded-lg px-2.5 py-2 text-center text-xs sm:text-[13px] font-medium transition-all cursor-pointer truncate ${
                      selected
                        ? "shadow-sm font-semibold"
                        : "opacity-70 hover:opacity-100"
                    }`}
                    style={
                      selected
                        ? {
                            backgroundColor: "var(--prism-surface, #fcf9f2)",
                            color: "var(--prism-heading, #1a2744)",
                          }
                        : {
                            color: "var(--prism-ink, #1f242d)",
                          }
                    }
                  >
                    {plugin.name}
                  </button>
                );
              })}
            </div>
            {autoSwitchedHint && (
              <p className="text-[11px] font-mono text-amber-800 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-1.5">
                {autoSwitchedHint}
              </p>
            )}
          </div>

          {/* Unified Source Composer */}
          <div
            className="rounded-xl border overflow-hidden transition-colors"
            style={{
              backgroundColor: "var(--prism-surface-subtle, #f6f0e3)",
              borderColor: "var(--prism-border, #d8ccb5)",
            }}
          >
            <div
              className="flex items-center justify-between gap-2 px-3 py-2 border-b"
              style={{ borderColor: "var(--prism-border, #d8ccb5)" }}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setActiveTab("text-or-file")}
                  className={`text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    activeTab === "text-or-file"
                      ? "font-semibold"
                      : "opacity-65 hover:opacity-100"
                  }`}
                  style={
                    activeTab === "text-or-file"
                      ? {
                          backgroundColor: "var(--prism-heading, #1a2744)",
                          color: "var(--prism-bg, #f1eadc)",
                        }
                      : undefined
                  }
                >
                  文本 / 文件
                </button>

                {hasRemoteInput && (
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setActiveTab("remote-url")}
                    className={`text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                      activeTab === "remote-url"
                        ? "font-semibold"
                        : "opacity-65 hover:opacity-100"
                    }`}
                    style={
                      activeTab === "remote-url"
                        ? {
                            backgroundColor: "var(--prism-heading, #1a2744)",
                            color: "var(--prism-bg, #f1eadc)",
                          }
                        : undefined
                    }
                  >
                    {remoteTabLabel}
                  </button>
                )}

                {hasSearchInput && (
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setActiveTab("agent-search")}
                    className={`text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                      activeTab === "agent-search"
                        ? "font-semibold"
                        : "opacity-65 hover:opacity-100"
                    }`}
                    style={
                      activeTab === "agent-search"
                        ? {
                            backgroundColor: "var(--prism-heading, #1a2744)",
                            color: "var(--prism-bg, #f1eadc)",
                          }
                        : undefined
                    }
                  >
                    AI 搜索
                  </button>
                )}
              </div>
            </div>

            {activeTab === "text-or-file" && (
              <div>
                <textarea
                  value={textInput}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setTextInput(nextVal);
                    setUploadedPayload(null);
                    maybeAutoSwitchVideoMode(nextVal);
                  }}
                  disabled={isRunning}
                  rows={7}
                  placeholder={activePlugin.inputConfig.placeholder}
                  className="w-full bg-transparent px-3.5 py-3 text-[13px] leading-relaxed focus:outline-none resize-y"
                  style={{ color: "var(--prism-ink, #1f242d)" }}
                />
                {activePlugin.inputConfig.supportsFileUpload && (
                  <div
                    className="flex items-center justify-between gap-2 px-3 py-2 border-t text-xs"
                    style={{ borderColor: "var(--prism-border, #d8ccb5)" }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple={activePlugin.inputConfig.supportsRepoUrl}
                      accept={activePlugin.inputConfig.acceptedFileTypes}
                      disabled={isRunning}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] cursor-pointer transition-colors hover:opacity-85 shrink-0"
                        style={{
                          backgroundColor: "var(--prism-surface, #fcf9f2)",
                          borderColor: "var(--prism-border, #d8ccb5)",
                          color: "var(--prism-ink, #1f242d)",
                        }}
                      >
                        <span aria-hidden="true">+</span>
                        <span>上传文件</span>
                      </button>
                      {uploadedLabel ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-700 truncate">
                          <span className="truncate">{uploadedLabel}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedPayload(null);
                              setUploadedLabel("");
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="opacity-65 hover:opacity-100 cursor-pointer"
                            aria-label="移除已上传文件"
                          >
                            ×
                          </button>
                        </span>
                      ) : (
                        <span
                          className="font-mono text-[11px] truncate opacity-60"
                          style={{ color: "var(--prism-ink-muted, #5a5347)" }}
                        >
                          {activePlugin.inputConfig.acceptedFileTypes}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "remote-url" && hasRemoteInput && (
              <div className="p-3.5 space-y-2">
                <input
                  type="text"
                  value={remoteUrl}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setRemoteUrl(nextVal);
                    maybeAutoSwitchVideoMode(nextVal);
                  }}
                  disabled={isRunning}
                  placeholder={activePlugin.inputConfig.remoteUrlPlaceholder || "粘贴 URL 或 arXiv 编号..."}
                  className="w-full rounded-lg border px-3 py-2.5 font-mono text-xs focus:outline-none"
                  style={{
                    backgroundColor: "var(--prism-surface, #fcf9f2)",
                    borderColor: "var(--prism-border, #d8ccb5)",
                    color: "var(--prism-ink, #1f242d)",
                  }}
                />
                <p
                  className="text-[11px] opacity-75"
                  style={{ color: "var(--prism-ink-muted, #5a5347)" }}
                >
                  自动抓取远端正文、PDF、视频字幕或仓库核心代码。
                </p>
              </div>
            )}

            {activeTab === "agent-search" && hasSearchInput && (
              <div className="p-3.5 space-y-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isRunning}
                  placeholder={
                    activePlugin.inputConfig.searchPlaceholder ||
                    "输入论文名、关键词、作者或 GitHub 项目..."
                  }
                  className="w-full rounded-lg border px-3 py-2.5 font-mono text-xs focus:outline-none"
                  style={{
                    backgroundColor: "var(--prism-surface, #fcf9f2)",
                    borderColor: "var(--prism-border, #d8ccb5)",
                    color: "var(--prism-ink, #1f242d)",
                  }}
                />
                <p
                  className="text-[11px] opacity-75"
                  style={{ color: "var(--prism-ink-muted, #5a5347)" }}
                >
                  {llmConfig.apiKey.trim()
                    ? "将由 AI 检索 arXiv / GitHub / 公开网页一手原文并完成拆解。"
                    : "将通过直连检索器匹配公开源后进行离线拆解。"}
                </p>
              </div>
            )}
          </div>

          {errorMsg && (
            <p className="text-xs font-mono text-rose-600 px-1">{errorMsg}</p>
          )}

          {/* Optional Title & Reading Context (Collapsed by default for clean canvas) */}
          <div
            className="rounded-xl border px-3.5 py-2.5"
            style={{
              backgroundColor: "var(--prism-surface, #fcf9f2)",
              borderColor: "var(--prism-border, #d8ccb5)",
            }}
          >
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setShowCustomContext((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs cursor-pointer"
              style={{ color: "var(--prism-ink-muted, #5a5347)" }}
            >
              <span className="font-medium flex items-center gap-2">
                <span>自定义标题与阅读背景</span>
                <span className="font-mono text-[10px] opacity-65">可选</span>
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                className={`w-3.5 h-3.5 transition-transform ${showCustomContext ? "rotate-180" : ""}`}
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {showCustomContext && (
              <div className="mt-3 pt-3 border-t space-y-2.5 text-xs" style={{ borderColor: "var(--prism-border, #d8ccb5)" }}>
                <div>
                  <label
                    className="block font-mono text-[11px] mb-1 opacity-75"
                    style={{ color: "var(--prism-ink-muted, #5a5347)" }}
                  >
                    工作台标题（留空自动提取）
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isRunning}
                    placeholder="例如：LoRA 原论文精读 / nanoid 源码拆解"
                    className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{
                      backgroundColor: "var(--prism-surface-subtle, #f6f0e3)",
                      borderColor: "var(--prism-border, #d8ccb5)",
                      color: "var(--prism-ink, #1f242d)",
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      className="block font-mono text-[11px] mb-1 opacity-75"
                      style={{ color: "var(--prism-ink-muted, #5a5347)" }}
                    >
                      阅读目的
                    </label>
                    <select
                      value={readingPurpose}
                      onChange={(e) => setReadingPurpose(e.target.value)}
                      disabled={isRunning}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                      style={{
                        backgroundColor: "var(--prism-surface-subtle, #f6f0e3)",
                        borderColor: "var(--prism-border, #d8ccb5)",
                        color: "var(--prism-ink, #1f242d)",
                      }}
                    >
                      <option value="彻底理解">彻底理解（构建完整心智模型）</option>
                      <option value="复现">代码复现（排查超参与实现缺口）</option>
                      <option value="审稿">审稿质疑（排查隐含假设与漏洞）</option>
                      <option value="写相关工作">写相关工作（提炼差异定位）</option>
                      <option value="面试深挖">技术面试准备（深挖边界条件）</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className="block font-mono text-[11px] mb-1 opacity-75"
                      style={{ color: "var(--prism-ink-muted, #5a5347)" }}
                    >
                      个人背景
                    </label>
                    <input
                      type="text"
                      value={userBackground}
                      onChange={(e) => setUserBackground(e.target.value)}
                      disabled={isRunning}
                      placeholder="例：熟悉 PyTorch，初学扩散模型"
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                      style={{
                        backgroundColor: "var(--prism-surface-subtle, #f6f0e3)",
                        borderColor: "var(--prism-border, #d8ccb5)",
                        color: "var(--prism-ink, #1f242d)",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="block font-mono text-[11px] mb-1 opacity-75"
                    style={{ color: "var(--prism-ink-muted, #5a5347)" }}
                  >
                    关联课题 / 工作方向
                  </label>
                  <input
                    type="text"
                    value={userTopic}
                    onChange={(e) => setUserTopic(e.target.value)}
                    disabled={isRunning}
                    placeholder="例：长文本 RAG 检索优化"
                    className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{
                      backgroundColor: "var(--prism-surface-subtle, #f6f0e3)",
                      borderColor: "var(--prism-border, #d8ccb5)",
                      color: "var(--prism-ink, #1f242d)",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Minimal Footer */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t"
            style={{ borderColor: "var(--prism-border, #d8ccb5)" }}
          >
            <div
              className="inline-flex items-center gap-0.5 rounded-lg border p-0.5 font-mono text-[11px]"
              style={{
                backgroundColor: "var(--prism-surface-subtle, #f6f0e3)",
                borderColor: "var(--prism-border, #d8ccb5)",
              }}
            >
              <button
                type="button"
                data-testid="studio-speed-balanced"
                title="先完整生成前 5 段后再开放进入阅读，第 6 段起严格逐段（1 段/次）稳步生成"
                onClick={() => setAnalysisSpeedMode("balanced")}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  analysisSpeedMode === "balanced" ? "font-semibold shadow-sm" : "opacity-65 hover:opacity-100"
                }`}
                style={
                  analysisSpeedMode === "balanced"
                    ? {
                        backgroundColor: "var(--prism-heading, #1a2744)",
                        color: "var(--prism-bg, #f1eadc)",
                      }
                    : undefined
                }
              >
                标准逐段
              </button>
              <button
                type="button"
                data-testid="studio-speed-fast"
                title="先完整生成前 5 段后再开放进入阅读，后续微批轻并发加速"
                onClick={() => setAnalysisSpeedMode("fast")}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  analysisSpeedMode === "fast" ? "font-semibold shadow-sm" : "opacity-65 hover:opacity-100"
                }`}
                style={
                  analysisSpeedMode === "fast"
                    ? {
                        backgroundColor: "var(--prism-surface, #fcf9f2)",
                        color: "var(--prism-heading, #1a2744)",
                      }
                    : undefined
                }
              >
                极速微批
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded-lg cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              >
                取消
              </button>
              <button
                type="submit"
                className="text-xs px-4 py-2 rounded-lg font-semibold cursor-pointer transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: "var(--prism-heading, #1a2744)",
                  color: "var(--prism-bg, #f1eadc)",
                }}
              >
                开始解析
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
