"use client";

import React, { useMemo, useState } from "react";
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

  const headerCls = getPanelGlassTextClasses(themeMode);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="新建精读与拆解工作台"
        className="w-full max-w-2xl rounded-2xl bg-[#faf8f5] border border-[#ddd6c7] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <PanelGlassHeader
          testId="studio-modal-header"
          themeMode={themeMode}
          left={
            <div>
              <h2 className={`font-serif text-lg font-semibold ${headerCls.heading}`}>
                新建精读 / 拆解工作台
              </h2>
              <p className={`text-xs ${headerCls.subtitle}`}>
                当前模式引擎：
                {llmConfig.apiKey.trim()
                  ? ` 在线大模型 (${llmConfig.provider} · ${llmConfig.model})`
                  : " 离线启发式引擎（无 API Key 亦可立刻体验）"}
              </p>
            </div>
          }
          right={
            <button
              type="button"
              disabled={isRunning}
              onClick={onClose}
              className={`font-mono text-xs px-3 py-1 rounded-full cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap ${headerCls.ghostBtn}`}
            >
              关闭
            </button>
          }
        />

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto text-sm">
          <div>
            <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1.5">
              1. 选择分析模式插件 (Plugin)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    className={`text-left rounded-lg border p-3 transition-all cursor-pointer ${
                      selected
                        ? "bg-[#1a2744] text-white border-[#1a2744]"
                        : "bg-white border-[#ddd6c7] hover:border-[#1a2744]/50 text-slate-800"
                    }`}
                  >
                    <div className="font-mono text-[10.5px] opacity-80">{plugin.shortLabel}</div>
                    <div className="font-serif font-semibold text-sm mt-0.5">{plugin.name}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-600 mt-1.5">{activePlugin.description}</p>
            {autoSwitchedHint && (
              <p className="text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 mt-1.5">
                {autoSwitchedHint}
              </p>
            )}
          </div>

          <div>
            <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1">
              2. 工作台标题（可选，留空自动从 PDF / arXiv / 仓库 / 网页提取）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isRunning}
              placeholder="例如：LoRA 原论文精读 / nanoid 源码拆解..."
              className="w-full rounded-md border border-[#ddd6c7] bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1.5">
              3. 选择资料输入方式
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setActiveTab("text-or-file")}
                className={`font-mono text-xs px-3 py-1.5 rounded-md border cursor-pointer ${
                  activeTab === "text-or-file"
                    ? "bg-[#1a2744] text-white border-[#1a2744]"
                    : "bg-white text-slate-700 border-[#ddd6c7] hover:border-[#1a2744]/40"
                }`}
              >
                粘贴正文 / 上传文件
              </button>

              {hasRemoteInput && (
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setActiveTab("remote-url")}
                  className={`font-mono text-xs px-3 py-1.5 rounded-md border cursor-pointer ${
                    activeTab === "remote-url"
                      ? "bg-[#1a2744] text-white border-[#1a2744]"
                      : "bg-white text-slate-700 border-[#ddd6c7] hover:border-[#1a2744]/40"
                  }`}
                >
                  {activePlugin.inputConfig.remoteUrlLabel || "arXiv / URL 链接直达"}
                </button>
              )}

              {hasSearchInput && (
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setActiveTab("agent-search")}
                  className={`font-mono text-xs px-3 py-1.5 rounded-md border cursor-pointer ${
                    activeTab === "agent-search"
                      ? "bg-[#1a2744] text-white border-[#1a2744]"
                      : "bg-white text-slate-700 border-[#ddd6c7] hover:border-[#1a2744]/40"
                  }`}
                >
                  {activePlugin.inputConfig.searchLabel || "AI 联网调用工具搜索"}
                </button>
              )}
            </div>

            {activeTab === "text-or-file" && (
              <div className="space-y-3">
                {activePlugin.inputConfig.supportsFileUpload && (
                  <div>
                    <label className="block font-mono text-xs text-slate-700 mb-1">
                      上传文件 ({activePlugin.inputConfig.acceptedFileTypes})
                    </label>
                    <input
                      type="file"
                      multiple={activePlugin.inputConfig.supportsRepoUrl}
                      accept={activePlugin.inputConfig.acceptedFileTypes}
                      disabled={isRunning}
                      onChange={handleFileChange}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-[#ddd6c7] file:bg-white file:text-xs file:font-mono hover:file:bg-slate-100"
                    />
                    {uploadedLabel && (
                      <p className="text-xs text-emerald-700 font-mono mt-1">{uploadedLabel}</p>
                    )}
                  </div>
                )}

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
                    rows={6}
                    placeholder={activePlugin.inputConfig.placeholder}
                    className="w-full rounded-md border border-[#ddd6c7] bg-white px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {activeTab === "remote-url" && hasRemoteInput && (
              <div className="bg-white border border-[#ddd6c7] rounded-lg p-3.5 space-y-2">
                <label className="block font-mono text-xs font-semibold text-[#1a2744]">
                  {activePlugin.inputConfig.remoteUrlLabel || "源地址 / arXiv 编号"}
                </label>
                <input
                  type="text"
                  value={remoteUrl}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setRemoteUrl(nextVal);
                    maybeAutoSwitchVideoMode(nextVal);
                  }}
                  disabled={isRunning}
                  placeholder={activePlugin.inputConfig.remoteUrlPlaceholder || "https://..."}
                  className="w-full rounded-md border border-[#ddd6c7] bg-[#fcfbf8] px-3 py-2 font-mono text-xs"
                />
                <p className="text-xs text-slate-500">
                  输入后系统将自动抓取远端论文 PDF、网页正文或仓库核心代码并切分单元。
                </p>
              </div>
            )}

            {activeTab === "agent-search" && hasSearchInput && (
              <div className="bg-white border border-[#ddd6c7] rounded-lg p-3.5 space-y-2">
                <label className="block font-mono text-xs font-semibold text-[#1a2744]">
                  {activePlugin.inputConfig.searchLabel || "AI 工具联网搜索"}
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isRunning}
                  placeholder={
                    activePlugin.inputConfig.searchPlaceholder ||
                    "输入论文名、关键词、作者或 GitHub 项目描述..."
                  }
                  className="w-full rounded-md border border-[#ddd6c7] bg-[#fcfbf8] px-3 py-2 text-xs font-mono"
                />
                <p className="text-xs text-slate-500">
                  {llmConfig.apiKey.trim()
                    ? "已启用在线模型：大模型将自主调用 arXiv / GitHub / Web 检索工具查找到一手原文，再完成全套拆解。"
                    : "当前未配置 API Key：将自动使用内置直连检索器匹配 arXiv / GitHub / 公开网页后离线拆解。"}
                </p>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-1.5">{activePlugin.inputConfig.hint}</p>
          </div>

          <div className="border border-[#ddd6c7] rounded-lg bg-white p-3">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setShowCustomContext((prev) => !prev)}
              className="w-full flex items-center justify-between font-mono text-xs font-semibold text-[#1a2744] cursor-pointer"
            >
              <span>4. 阅读定制（阅读目的 / 个人背景 / 研究课题 - 选填）</span>
              <span>{showCustomContext ? "[收起]" : "[展开配置]"}</span>
            </button>
            {showCustomContext && (
              <div className="mt-3 space-y-2.5 text-xs">
                <div>
                  <label className="block font-mono text-[11px] text-slate-700 mb-1">
                    阅读目的
                  </label>
                  <select
                    value={readingPurpose}
                    onChange={(e) => setReadingPurpose(e.target.value)}
                    disabled={isRunning}
                    className="w-full rounded border border-[#ddd6c7] bg-[#fcfbf8] px-2.5 py-1.5"
                  >
                    <option value="彻底理解">彻底理解（构建完整心智模型）</option>
                    <option value="复现">代码复现（重点排查数据、超参与实现缺口）</option>
                    <option value="审稿">审稿质疑（重点排查隐含假设、对照与替代解释）</option>
                    <option value="写相关工作">写相关工作（提炼差异定位与英文学术句式）</option>
                    <option value="面试深挖">技术面试准备（深挖边界条件与项目改造话术）</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[11px] text-slate-700 mb-1">
                    我的知识背景（生成定制前置知识地图，留空则不猜测）
                  </label>
                  <input
                    type="text"
                    value={userBackground}
                    onChange={(e) => setUserBackground(e.target.value)}
                    disabled={isRunning}
                    placeholder="例如：熟悉 Python 与 PyTorch，不熟悉统计因果推断与扩散模型"
                    className="w-full rounded border border-[#ddd6c7] bg-[#fcfbf8] px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] text-slate-700 mb-1">
                    我的研究课题 / 工作方向（在底部复盘对比可借鉴点与不适用点）
                  </label>
                  <input
                    type="text"
                    value={userTopic}
                    onChange={(e) => setUserTopic(e.target.value)}
                    disabled={isRunning}
                    placeholder="例如：长文本 RAG 检索优化 / 高并发调度网关"
                    className="w-full rounded border border-[#ddd6c7] bg-[#fcfbf8] px-2.5 py-1.5"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#ddd6c7]">
            <div className="inline-flex items-center gap-1 rounded-lg border border-[#ddd6c7] bg-white p-0.5 font-mono text-[11px]">
              <button
                type="button"
                data-testid="studio-speed-balanced"
                onClick={() => setAnalysisSpeedMode("balanced")}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  analysisSpeedMode === "balanced"
                    ? "bg-[#1a2744] text-amber-200 font-semibold"
                    : "text-slate-600 hover:text-[#1a2744]"
                }`}
              >
                标准精读 · 4并发
              </button>
              <button
                type="button"
                data-testid="studio-speed-fast"
                onClick={() => setAnalysisSpeedMode("fast")}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  analysisSpeedMode === "fast"
                    ? "bg-amber-400/25 text-amber-900 font-semibold"
                    : "text-slate-600 hover:text-[#1a2744]"
                }`}
              >
                极速模式 · 5并发
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-xs px-3.5 py-2 rounded border border-[#ddd6c7] bg-white hover:bg-slate-100 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="font-mono text-xs px-4 py-2 rounded bg-[#1a2744] hover:bg-[#24365c] text-white font-semibold cursor-pointer"
              >
                加入后台并行解析
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
