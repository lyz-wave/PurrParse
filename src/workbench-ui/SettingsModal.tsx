"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { WorkbenchDocument } from "@/core/contracts/document-ast";
import type { LLMConfig, LLMProviderId } from "@/core/engine/llm-adapters";
import {
  PRESET_MODELS_BY_PROVIDER,
  type DiscoveredModelItem,
} from "@/core/engine/model-discovery";
import {
  APP_VERSION,
  createInitialUpdateState,
  formatBytes,
  type AppUpdateState,
} from "@/core/engine/app-updater";
import type { WorkbenchThemeMode } from "@/store/workbench-store";
import { ThemeSelector } from "@/components/ui/theme-selector";
import {
  getPanelGlassTextClasses,
  PanelGlassHeader,
} from "@/components/ui/fluid-orb";

export type SettingsSectionKey = "view" | "export" | "llm" | "update";

interface SettingsModalProps {
  open: boolean;
  doc: WorkbenchDocument;
  config: LLMConfig;
  hideSecondary: boolean;
  hideNotes: boolean;
  autoHideHeader: boolean;
  themeMode?: WorkbenchThemeMode;
  initialFocusSection?: SettingsSectionKey | null;
  updateState?: AppUpdateState;
  isDesktopRuntime?: boolean;
  onCheckForUpdates?: () => void;
  onDownloadUpdate?: () => void;
  onCancelDownload?: () => void;
  onInstallUpdate?: () => void;
  onOpenReleasePage?: (url?: string) => void;
  onRevealDownloadedFile?: () => void;
  onThemeChange?: (theme: WorkbenchThemeMode) => void;
  onToggleSecondary: () => void;
  onToggleNotes: () => void;
  onToggleAutoHideHeader: () => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onExportAnkiCsv?: () => void;
  onSave: (config: LLMConfig) => void;
  onClose: () => void;
  onOpenOnboarding?: () => void;
  startOnHome?: boolean;
  onToggleStartOnHome?: () => void;
}

const PROVIDER_DEFAULTS: Record<
  LLMProviderId,
  { label: string; defaultModel: string; basePlaceholder: string; hint: string }
> = {
  google: {
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    basePlaceholder: "https://generativelanguage.googleapis.com/v1beta（可选代理）",
    hint: "推荐 gemini-2.5-flash 或 gemini-2.5-pro",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    basePlaceholder: "https://api.openai.com/v1（可选中转）",
    hint: "推荐 gpt-4o-mini 或 gpt-4o",
  },
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "claude-3-7-sonnet-latest",
    basePlaceholder: "https://api.anthropic.com/v1（可选中转）",
    hint: "推荐 claude-3-7-sonnet-latest",
  },
  deepseek: {
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    basePlaceholder: "https://api.deepseek.com/v1",
    hint: "默认请求 https://api.deepseek.com/v1",
  },
  custom: {
    label: "Custom (OpenAI 兼容接口)",
    defaultModel: "qwen-plus",
    basePlaceholder: "https://api.example.com/v1 或 http://127.0.0.1:11434/v1",
    hint: "支持本地 Ollama / vLLM / OneAPI 等 OpenAI 兼容网关",
  },
};

const THEME_LABELS: Record<WorkbenchThemeMode, string> = {
  paper: "稿纸",
  aurora: "夜空",
  studio: "纯白",
};

interface CollapsibleSectionProps {
  sectionKey: SettingsSectionKey;
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  sectionKey,
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <section
      data-testid={`settings-section-${sectionKey}`}
      className="rounded-xl border border-[#ddd6c7] bg-white overflow-hidden"
    >
      <button
        type="button"
        aria-expanded={isOpen}
        data-testid={`settings-toggle-${sectionKey}`}
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left bg-[#fcfbf8] hover:bg-[#f4efe5] cursor-pointer transition-colors"
      >
        <div className="min-w-0 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-[#1a2744] tracking-wide">
            {title}
          </span>
          <span className="font-mono text-[11px] text-slate-500 truncate max-w-[260px] sm:max-w-[360px]">
            {summary}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-600 shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && <div className="p-4 border-t border-[#e8e1d3]">{children}</div>}
    </section>
  );
}

export function SettingsModal({
  open,
  doc,
  config,
  hideSecondary,
  hideNotes,
  autoHideHeader,
  themeMode = "paper",
  initialFocusSection = null,
  updateState: updateStateProp,
  isDesktopRuntime = false,
  onCheckForUpdates,
  onDownloadUpdate,
  onCancelDownload,
  onInstallUpdate,
  onOpenReleasePage,
  onRevealDownloadedFile,
  onThemeChange,
  onToggleSecondary,
  onToggleNotes,
  onToggleAutoHideHeader,
  onExportMarkdown,
  onExportHtml,
  onExportAnkiCsv,
  onSave,
  onClose,
  onOpenOnboarding,
  startOnHome = true,
  onToggleStartOnHome,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<LLMConfig>(config);
  const [showApiKey, setShowApiKey] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SettingsSectionKey, boolean>>({
    view: true,
    export: true,
    llm: true,
    update: true,
  });

  const [modelQuery, setModelQuery] = useState("");
  const [remoteModels, setRemoteModels] = useState<DiscoveredModelItem[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<{ tone: "ok" | "error" | "idle"; text: string }>({
    tone: "idle",
    text: "",
  });

  useEffect(() => {
    if (!open) return;
    setDraft(config);
    setModelQuery("");
    setRemoteModels([]);
    setFetchStatus({ tone: "idle", text: "" });
    if (initialFocusSection) {
      setOpenSections({
        view: initialFocusSection === "view",
        export: initialFocusSection === "export",
        llm: initialFocusSection === "llm",
        update: initialFocusSection === "update",
      });
    } else {
      setOpenSections({ view: true, export: true, llm: true, update: true });
    }
  }, [open, config, initialFocusSection]);

  const mergedModels = useMemo<DiscoveredModelItem[]>(() => {
    const presetIds = PRESET_MODELS_BY_PROVIDER[draft.provider] ?? [];
    const seen = new Set<string>();
    const list: DiscoveredModelItem[] = [];
    for (const m of remoteModels) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      list.push(m);
    }
    for (const id of presetIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ id, source: "preset" });
    }
    const q = modelQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.id.toLowerCase().includes(q) || (item.label?.toLowerCase().includes(q) ?? false)
    );
  }, [draft.provider, modelQuery, remoteModels]);

  if (!open) return null;

  const formulaOrTableCount =
    doc.completionChecklist?.formulaOrTableCount ??
    doc.units.filter((u) => (u.formulas && u.formulas.length > 0) || Boolean(u.dataTable)).length;

  const handleProviderChange = (provider: LLMProviderId) => {
    setDraft((prev) => ({
      ...prev,
      provider,
      model: PROVIDER_DEFAULTS[provider].defaultModel,
    }));
    setRemoteModels([]);
    setFetchStatus({ tone: "idle", text: "" });
  };

  const toggleSection = (key: SettingsSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allExpanded =
    openSections.view && openSections.export && openSections.llm && openSections.update;
  const toggleAllSections = () => {
    const next = !allExpanded;
    setOpenSections({ view: next, export: next, llm: next, update: next });
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setFetchStatus({ tone: "idle", text: "正在连接接口拉取可用模型..." });
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: draft.provider,
          apiKey: draft.apiKey,
          baseUrl: draft.baseUrl,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        models?: DiscoveredModelItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `拉取失败 (${res.status})`);
      }
      const list = Array.isArray(data.models) ? data.models : [];
      setRemoteModels(list);
      setFetchStatus({
        tone: "ok",
        text:
          list.length > 0
            ? `已拉取 ${list.length} 个线上可用模型，可在下方搜索点击选中`
            : "接口返回为空，请检查账户权限或直接选用推荐预设模型",
      });
    } catch (err) {
      setFetchStatus({
        tone: "error",
        text: err instanceof Error ? err.message : "检索模型失败，请检查网络或密钥配置",
      });
    } finally {
      setFetchingModels(false);
    }
  };

  const updateState = updateStateProp ?? createInitialUpdateState(APP_VERSION, isDesktopRuntime);
  const viewSummary = `当前 ${THEME_LABELS[themeMode]} · ${autoHideHeader ? "自动收起顶栏" : "固定顶栏"}`;
  const exportSummary = `单元 ${doc.units.length} 条 · Markdown / Anki / HTML`;
  const llmSummary = `${PROVIDER_DEFAULTS[draft.provider].label} · ${draft.model || "未填模型"}`;
  const updateSummary =
    updateState.status === "downloading"
      ? `正在下载 v${updateState.latestVersion ?? ""} (${updateState.progressPercent}%)`
      : updateState.status === "downloaded"
        ? `新版本 v${updateState.latestVersion ?? ""} 已就绪`
        : updateState.hasUpdate && updateState.latestVersion
          ? `发现新版本 v${updateState.latestVersion}`
          : updateState.status === "up-to-date"
            ? `v${updateState.currentVersion} 已是最新`
            : `当前 v${updateState.currentVersion}`;
  const headerCls = getPanelGlassTextClasses(themeMode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="工作台设置与导出中心"
        className="prism-editorial-card w-full max-w-2xl max-h-[92vh] rounded-2xl bg-[#faf8f5] border border-[#ddd6c7] shadow-2xl flex flex-col overflow-hidden"
      >
        <PanelGlassHeader
          testId="settings-modal-header"
          themeMode={themeMode}
          left={
            <div>
              <h2 className={`font-serif text-lg font-semibold ${headerCls.heading}`}>
                工作台设置、视图与导出中心
              </h2>
              <p className={`text-xs ${headerCls.subtitle}`}>
                四大设置模块均可按需折叠展开：视图主题、导出归档、AI 接口与版本更新。
              </p>
            </div>
          }
          right={
            <>
              {onOpenOnboarding && (
                <button
                  type="button"
                  data-testid="onboarding-trigger"
                  onClick={() => {
                    onClose();
                    onOpenOnboarding();
                  }}
                  className={`font-mono text-xs px-3 py-1 rounded-full cursor-pointer transition-colors whitespace-nowrap ${headerCls.subtlePill}`}
                >
                  初次指引
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={`font-mono text-xs px-3 py-1 rounded-full cursor-pointer transition-colors whitespace-nowrap ${headerCls.ghostBtn}`}
              >
                关闭
              </button>
            </>
          }
        />

        <div className="p-4 space-y-3 text-sm overflow-y-auto">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
            <span>点击各分组标题栏即可折叠或展开对应功能区</span>
            <button
              type="button"
              data-testid="settings-toggle-all"
              onClick={toggleAllSections}
              className="font-mono text-[11px] px-2.5 py-1 rounded-full border border-[#ddd6c7] bg-white hover:bg-[#f3efe6] text-[#1a2744] cursor-pointer transition-colors"
            >
              {allExpanded ? "全部折叠" : "全部展开"}
            </button>
          </div>

          {/* Section 1: View, Theme & Topbar Behavior */}
          <CollapsibleSection
            sectionKey="view"
            title="1. 阅读视图、主题质感与顶栏行为"
            summary={viewSummary}
            isOpen={openSections.view}
            onToggle={() => toggleSection("view")}
          >
            <div className="space-y-3">
              {onThemeChange && (
                <div className="pt-1 pb-1.5">
                  <ThemeSelector
                    value={themeMode}
                    onChange={(next) => onThemeChange(next as WorkbenchThemeMode)}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {onToggleStartOnHome && (
                  <button
                    type="button"
                    data-testid="settings-start-on-home-toggle"
                    onClick={onToggleStartOnHome}
                    className={`font-mono text-xs px-3 py-2 rounded-lg border text-left cursor-pointer transition-colors ${
                      startOnHome
                        ? "prism-on-dark bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold"
                        : "bg-[#fcfbf8] text-slate-700 border-[#ddd6c7] hover:bg-[#f3efe6]"
                    }`}
                  >
                    {startOnHome ? "开机进入：工作台主页" : "开机进入：继续上次阅读"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleAutoHideHeader}
                  className={`font-mono text-xs px-3 py-2 rounded-lg border text-left cursor-pointer transition-colors ${
                    autoHideHeader
                      ? "prism-on-dark bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold"
                      : "bg-[#fcfbf8] text-slate-700 border-[#ddd6c7] hover:bg-[#f3efe6]"
                  }`}
                >
                  {autoHideHeader ? "开 · 滚动自动收起顶栏" : "关 · 始终固定单行顶栏"}
                </button>
                <button
                  type="button"
                  onClick={onToggleSecondary}
                  className={`font-mono text-xs px-3 py-2 rounded-lg border text-left cursor-pointer transition-colors ${
                    hideSecondary
                      ? "prism-on-dark bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold"
                      : "bg-[#fcfbf8] text-slate-700 border-[#ddd6c7] hover:bg-[#f3efe6]"
                  }`}
                >
                  {`${hideSecondary ? "已隐藏" : "显示中"} · ${doc.labels.toggleSecondaryButton.replace(/^\[|\]$/g, "")}`}
                </button>
                <button
                  type="button"
                  onClick={onToggleNotes}
                  className={`font-mono text-xs px-3 py-2 rounded-lg border text-left cursor-pointer transition-colors ${
                    hideNotes
                      ? "prism-on-dark bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold"
                      : "bg-[#fcfbf8] text-slate-700 border-[#ddd6c7] hover:bg-[#f3efe6]"
                  }`}
                >
                  {`${hideNotes ? "已隐藏" : "显示中"} · ${doc.labels.toggleNotesButton.replace(/^\[|\]$/g, "")}`}
                </button>
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 2: Exports & Completion Checklist */}
          <CollapsibleSection
            sectionKey="export"
            title="2. 笔记导出与全文覆盖清单"
            summary={exportSummary}
            isOpen={openSections.export}
            onToggle={() => toggleSection("export")}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-600">
                <span>支持多格式无损打包带走</span>
                <span>{`单元 ${doc.units.length} 条 | 公式/表 ${formulaOrTableCount} 处 | 章节 ${doc.sections.length} 个`}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onExportMarkdown}
                  className="font-mono text-xs px-3.5 py-1.5 rounded-full border border-emerald-600/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold cursor-pointer transition-colors"
                >
                  {doc.labels.exportMdButton.replace(/^\[|\]$/g, "")}
                </button>
                {onExportAnkiCsv && (
                  <button
                    type="button"
                    onClick={onExportAnkiCsv}
                    className="font-mono text-xs px-3.5 py-1.5 rounded-full border border-purple-600/30 bg-purple-50 hover:bg-purple-100 text-purple-900 font-semibold cursor-pointer transition-colors"
                  >
                    导出 Anki CSV
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExportHtml}
                  className="font-mono text-xs px-3.5 py-1.5 rounded-full border border-blue-600/30 bg-blue-50 hover:bg-blue-100 text-blue-900 font-semibold cursor-pointer transition-colors"
                >
                  {doc.labels.exportHtmlButton.replace(/^\[|\]$/g, "")}
                </button>
              </div>

              <div className="rounded bg-[#fcfbf8] border border-[#e8e1d3] p-3 text-xs text-slate-600 space-y-1">
                <div className="font-mono text-[11px] text-[#1a2744] font-semibold">
                  {doc.completionChecklist?.modeDescription ?? `${doc.modeName}（全量结构化工作台）`}
                </div>
                <div>
                  认识论溯源徽章：[原文明示] = 原文直接陈述 | [分析推断] = 逻辑推导与解释 | [原文未说明] = 未提供充分证据 | [原文不一致] = 保留原矛盾
                </div>
                {(doc.completionChecklist?.inconsistencies?.length ?? 0) > 0 && (
                  <div className="text-rose-700">
                    原文差异提示：{doc.completionChecklist?.inconsistencies.join("；")}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 3: LLM Engine Configuration (BYOK) + Model Discovery */}
          <CollapsibleSection
            sectionKey="llm"
            title="3. AI 模型引擎配置与模型检索 (BYOK)"
            summary={llmSummary}
            isOpen={openSections.llm}
            onToggle={() => toggleSection("llm")}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSave(draft);
                onClose();
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1">
                    模型提供方 (Provider)
                  </label>
                  <select
                    value={draft.provider}
                    onChange={(e) => handleProviderChange(e.target.value as LLMProviderId)}
                    className="w-full rounded-md border border-[#ddd6c7] bg-white px-3 py-2 text-sm"
                  >
                    {(Object.keys(PROVIDER_DEFAULTS) as LLMProviderId[]).map((key) => (
                      <option key={key} value={key}>
                        {PROVIDER_DEFAULTS[key].label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {PROVIDER_DEFAULTS[draft.provider].hint}
                  </p>
                </div>

                <div>
                  <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1">
                    自定义 Base URL（可选 / 中转网关）
                  </label>
                  <input
                    type="text"
                    value={draft.baseUrl ?? ""}
                    onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                    placeholder={PROVIDER_DEFAULTS[draft.provider].basePlaceholder}
                    className="w-full rounded-md border border-[#ddd6c7] bg-white px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1">
                  API Key（仅存本机浏览器；留空启用离线启发式分析）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={draft.apiKey}
                    onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                    placeholder="sk-... 或 AIza..."
                    className="flex-1 rounded-md border border-[#ddd6c7] bg-white px-3 py-2 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="font-mono text-xs px-3 py-2 rounded-md border border-[#ddd6c7] bg-[#fcfbf8] hover:bg-[#f3efe6] text-[#1a2744] cursor-pointer shrink-0"
                  >
                    {showApiKey ? "隐藏" : "显示"}
                  </button>
                </div>
              </div>

              {/* Model Selection + Live Retrieval + Instant Search */}
              <div className="rounded-lg border border-[#e5decb] bg-[#fcfbf8] p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-mono text-xs font-semibold text-[#1a2744]">
                    模型名称 (Model ID) 与线上检索
                  </label>
                  <button
                    type="button"
                    data-testid="fetch-models-btn"
                    disabled={fetchingModels}
                    onClick={() => void handleFetchModels()}
                    className="font-mono text-[11px] font-semibold px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white cursor-pointer transition-colors"
                  >
                    {fetchingModels ? "检索中..." : "拉取线上可用模型"}
                  </button>
                </div>

                <input
                  type="text"
                  data-testid="model-id-input"
                  value={draft.model}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                  placeholder={PROVIDER_DEFAULTS[draft.provider].defaultModel}
                  className="w-full rounded-md border border-[#ddd6c7] bg-white px-3 py-2 font-mono text-xs"
                />

                {fetchStatus.tone !== "idle" && (
                  <p
                    data-testid="fetch-models-status"
                    className={`text-[11px] ${
                      fetchStatus.tone === "error" ? "text-rose-700" : "text-emerald-800"
                    }`}
                  >
                    {fetchStatus.text}
                  </p>
                )}

                <div className="space-y-1.5">
                  <input
                    type="search"
                    data-testid="model-search-input"
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                    placeholder="输入关键词检索模型（如 flash、gpt-4o、sonnet、deepseek、qwen）"
                    className="w-full rounded-md border border-[#e5decb] bg-white px-2.5 py-1.5 text-xs"
                  />

                  <div className="max-h-36 overflow-y-auto rounded-md border border-[#e8e1d3] bg-white divide-y divide-[#f2ece0]">
                    {mergedModels.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500">
                        未匹配到「{modelQuery}」，你可以直接在上方的 Model ID 输入框手动填写任意模型名。
                      </div>
                    ) : (
                      mergedModels.map((item) => {
                        const selected = draft.model.trim() === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-testid={`model-option-${item.id}`}
                            onClick={() => setDraft((prev) => ({ ...prev, model: item.id }))}
                            className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                              selected
                                ? "bg-blue-50 text-blue-900 font-semibold"
                                : "hover:bg-[#f6f1e7] text-slate-700"
                            }`}
                          >
                            <span className="font-mono truncate">
                              {item.id}
                              {item.label ? ` · ${item.label}` : ""}
                            </span>
                            <span
                              className={`shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                                item.source === "remote"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {item.source === "remote" ? "线上" : "推荐"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ddd6c7]">
                <button
                  type="button"
                  onClick={onClose}
                  className="font-mono text-xs px-4 py-2 rounded-full border border-[#ddd6c7] bg-white hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="prism-on-dark font-mono text-xs px-5 py-2 rounded-full bg-[#1a2744] hover:bg-[#24365c] text-white font-semibold cursor-pointer transition-colors"
                >
                  保存模型配置
                </button>
              </div>
            </form>
          </CollapsibleSection>

          {/* Section 4: App Version & Online Self-Update */}
          <CollapsibleSection
            sectionKey="update"
            title="4. 应用版本与在线更新"
            summary={updateSummary}
            isOpen={openSections.update}
            onToggle={() => toggleSection("update")}
          >
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e5decb] bg-[#fcfaf5] px-3.5 py-2.5">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-[#1a2744]">
                      当前版本 v{updateState.currentVersion}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#ddd6c7] bg-white text-slate-600">
                      {isDesktopRuntime ? "桌面应用模式" : "Web 浏览器模式"}
                    </span>
                    {updateState.status === "up-to-date" && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        已是最新版本
                      </span>
                    )}
                    {updateState.hasUpdate && updateState.latestVersion && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-semibold">
                        可升级至 v{updateState.latestVersion}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {updateState.checkedAt
                      ? `上次检查：${new Date(updateState.checkedAt).toLocaleTimeString()} ${
                          updateState.latestVersion ? `· 最新发布 v${updateState.latestVersion}` : ""
                        }`
                      : "点击右侧「检查更新」获取 GitHub Releases 最新版本信息。"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="settings-check-update-btn"
                    disabled={
                      !onCheckForUpdates ||
                      updateState.status === "checking" ||
                      updateState.status === "downloading" ||
                      updateState.status === "installing"
                    }
                    onClick={() => onCheckForUpdates?.()}
                    className="font-mono text-[11px] px-3 py-1.5 rounded-full border border-[#ddd6c7] bg-white hover:bg-[#f3efe6] text-[#1a2744] font-medium disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {updateState.status === "checking" ? "正在检查..." : "检查更新"}
                  </button>

                  {updateState.status === "available" && (
                    <button
                      type="button"
                      data-testid="settings-download-update-btn"
                      onClick={() => onDownloadUpdate?.()}
                      className="prism-on-dark font-mono text-[11px] px-3.5 py-1.5 rounded-full bg-[#1a2744] hover:bg-[#24365c] text-white font-semibold cursor-pointer transition-colors"
                    >
                      {isDesktopRuntime ? "立即下载更新" : "下载安装包"}
                    </button>
                  )}

                  {updateState.status === "downloaded" && (
                    <button
                      type="button"
                      data-testid="settings-install-update-btn"
                      onClick={() => onInstallUpdate?.()}
                      className="prism-on-dark font-mono text-[11px] px-3.5 py-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer transition-colors"
                    >
                      {updateState.installMode === "hot-patch"
                        ? "重启并应用增量补丁"
                        : updateState.installMode === "self-replace"
                          ? "重启并安装更新"
                          : updateState.assetName?.endsWith(".dmg")
                            ? "打开 DMG 安装包"
                            : "运行安装程序并重启"}
                    </button>
                  )}
                </div>
              </div>

              {updateState.status === "downloading" && (
                <div
                  data-testid="settings-update-progress"
                  className="rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-amber-950">
                    <span>
                      正在下载 {updateState.assetName || `v${updateState.latestVersion ?? ""}`} ·{" "}
                      {updateState.progressPercent}%
                    </span>
                    <button
                      type="button"
                      data-testid="settings-cancel-update-btn"
                      onClick={() => onCancelDownload?.()}
                      className="px-2 py-0.5 rounded border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                  <div className="h-2 w-full rounded-full bg-amber-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-150"
                      style={{ width: `${Math.max(4, updateState.progressPercent)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-amber-900/80 font-mono">
                    {`${formatBytes(updateState.transferredBytes)} / ${formatBytes(
                      updateState.totalBytes || updateState.assetSize || 0
                    )}${updateState.bytesPerSecond > 0 ? ` · ${formatBytes(updateState.bytesPerSecond)}/s` : ""}`}
                  </div>
                </div>
              )}

              {updateState.status === "downloaded" && updateState.downloadedFilePath && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-950">
                  <span className="truncate font-mono">
                    已缓存：{updateState.assetName || updateState.downloadedFilePath}
                  </span>
                  {onRevealDownloadedFile && (
                    <button
                      type="button"
                      onClick={() => onRevealDownloadedFile()}
                      className="shrink-0 font-mono underline hover:no-underline cursor-pointer"
                    >
                      在文件夹中显示
                    </button>
                  )}
                </div>
              )}

              {updateState.status === "installing" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
                  正在安全关闭本地引擎并应用新版本，请稍候…
                </div>
              )}

              {updateState.status === "error" && updateState.error && (
                <div
                  data-testid="settings-update-error"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800"
                >
                  {updateState.error}
                </div>
              )}

              {updateState.releaseNotes && (
                <div className="rounded-lg border border-[#e5decb] bg-white px-3 py-2.5 space-y-1">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    v{updateState.latestVersion ?? ""} 更新说明
                  </div>
                  <div className="max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700">
                    {updateState.releaseNotes}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px] text-slate-500">
                <span>
                  {updateState.assetName
                    ? `${
                        updateState.installMode === "hot-patch" ? "轻量增量补丁" : "匹配安装包"
                      }：${updateState.assetName}${
                        updateState.assetSize ? ` (${formatBytes(updateState.assetSize)})` : ""
                      }`
                    : "支持增量业务补丁与 macOS / Windows 整包自动回退"}
                </span>
                <button
                  type="button"
                  data-testid="settings-open-release-btn"
                  onClick={() => onOpenReleasePage?.(updateState.releaseUrl)}
                  className="font-mono text-[#1a2744] underline hover:no-underline cursor-pointer"
                >
                  查看 GitHub 发布页
                </button>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
