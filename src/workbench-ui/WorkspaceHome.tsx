"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  getPanelGlassTextClasses,
  getTopbarGlassStyle,
  PanelGlassHeader,
  TopbarGlassBackdrop,
} from "@/components/ui/fluid-orb";
import { Folder, type FolderDocumentPreview } from "@/components/ui/folder-component";
import { MatrixOrb, type MatrixOrbState } from "@/components/ui/matrix-orb";
import type {
  MasteryStageKey,
  UserAnnotationsState,
  WorkbenchDocument,
} from "@/core/contracts/document-ast";
import type { RawSourcePayload } from "@/core/contracts/mode-plugin";
import type { LLMConfig } from "@/core/engine/llm-adapters";
import {
  computeDocumentLearningStats,
  inferDocumentTaxonomy,
} from "@/core/engine/library-organizer";
import { defaultPluginRegistry } from "@/plugins";
import { useWorkbenchStore, type WorkbenchThemeMode } from "@/store/workbench-store";
import {
  enqueueBackgroundAnalysis,
  splitOmniBatchInputs,
} from "./analysis-task-manager";
import { detectOmniSource, filesToSourcePayload } from "./analyze-client";
import { TasksTopbarPill } from "./BackgroundTasksDock";
import { isMacDesktopRuntime, isWinDesktopRuntime } from "./desktop-runtime";

const THEME_CYCLE_ORDER: WorkbenchThemeMode[] = ["paper", "aurora", "studio"];

const THEME_LABELS: Record<WorkbenchThemeMode, string> = {
  paper: "暖纸",
  aurora: "夜读",
  studio: "纯白",
};

const STAGE_BADGE_LIGHT_CLS: Record<MasteryStageKey, string> = {
  unread: "bg-slate-500/12 text-slate-600 border-slate-400/30",
  struggling: "bg-rose-500/12 text-rose-600 border-rose-400/35",
  review_due: "bg-amber-500/15 text-amber-700 border-amber-400/40",
  mastered: "bg-emerald-500/15 text-emerald-700 border-emerald-400/40",
};

const STAGE_BADGE_DARK_CLS: Record<MasteryStageKey, string> = {
  unread: "bg-slate-400/15 text-slate-200 border-slate-400/35",
  struggling: "bg-rose-400/18 text-rose-200 border-rose-300/45",
  review_due: "bg-amber-400/18 text-amber-200 border-amber-300/45",
  mastered: "bg-emerald-400/18 text-emerald-200 border-emerald-300/45",
};

const MODE_SHORT_LABEL: Record<string, string> = {
  "academic-paper": "学术论文",
  "cognitive-essay": "长文 / 视频",
  "repo-deconstruct": "源码架构",
};

export interface WorkspaceHomeProps {
  documents: WorkbenchDocument[];
  activeDocumentId: string;
  annotationsByDoc: Record<string, UserAnnotationsState>;
  llmConfig: LLMConfig;
  themeMode: WorkbenchThemeMode;
  startOnHome?: boolean;
  tasksDockOpen?: boolean;
  hasAppUpdate?: boolean;
  onThemeChange: (theme: WorkbenchThemeMode) => void;
  onToggleStartOnHome?: () => void;
  onToggleTasksDock?: () => void;
  onTasksEnqueued?: () => void;
  onOpenDocument: (docId: string) => void;
  onOpenReview: (docId: string) => void;
  onOpenLibrary: (originEl?: HTMLElement | null) => void;
  onOpenStudio: () => void;
  onOpenSettings: () => void;
  onOpenApiSettings: () => void;
  onOpenOnboarding?: () => void;
  onDocumentReady?: (doc: WorkbenchDocument) => void;
}

export function WorkspaceHome({
  documents,
  activeDocumentId,
  annotationsByDoc,
  llmConfig,
  themeMode,
  tasksDockOpen = false,
  hasAppUpdate = false,
  onThemeChange,
  onToggleTasksDock,
  onTasksEnqueued,
  onOpenDocument,
  onOpenReview,
  onOpenLibrary,
  onOpenStudio,
  onOpenSettings,
  onOpenApiSettings,
}: WorkspaceHomeProps) {
  const analysisTasks = useWorkbenchStore((s) => s.analysisTasks);
  const analysisSpeedMode = useWorkbenchStore((s) => s.analysisSpeedMode);
  const setAnalysisSpeedMode = useWorkbenchStore((s) => s.setAnalysisSpeedMode);

  const plugins = useMemo(() => defaultPluginRegistry.list(), []);
  const [selectedModeId, setSelectedModeId] = useState<string>(
    plugins[0]?.id ?? "academic-paper"
  );
  const [manualModeLocked, setManualModeLocked] = useState(false);
  const [omniText, setOmniText] = useState("");
  const [attachedFilePayload, setAttachedFilePayload] = useState<RawSourcePayload | null>(null);
  const [attachedFileLabel, setAttachedFileLabel] = useState("");
  const [attachedTitle, setAttachedTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [queueFeedbackMsg, setQueueFeedbackMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [omniFocused, setOmniFocused] = useState(false);
  const [submitHovered, setSubmitHovered] = useState(false);
  const [folderExpanded, setFolderExpanded] = useState(false);
  const [folderQuery, setFolderQuery] = useState("");
  const [folderModeFilter, setFolderModeFilter] = useState<string>("all");
  const [folderOriginOffset, setFolderOriginOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 180,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderStageRef = useRef<HTMLDivElement | null>(null);
  const folderVisualRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!folderExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFolderExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [folderExpanded]);

  const openFolderPopup = () => {
    const anchor = folderVisualRef.current ?? folderStageRef.current;
    if (anchor && typeof window !== "undefined") {
      const rect = anchor.getBoundingClientRect();
      setFolderOriginOffset({
        x: Math.round(rect.left + rect.width / 2 - window.innerWidth / 2),
        y: Math.round(rect.top + rect.height / 2 - window.innerHeight / 2),
      });
    }
    setFolderExpanded(true);
  };

  const isMacDesktop = useMemo(() => isMacDesktopRuntime(), []);
  const isWinDesktop = useMemo(() => isWinDesktopRuntime(), []);

  const activePlugin = useMemo(
    () => plugins.find((p) => p.id === selectedModeId) ?? plugins[0],
    [plugins, selectedModeId]
  );

  const smartDetection = useMemo(
    () => detectOmniSource(omniText, plugins),
    [omniText, plugins]
  );

  const batchOmniItems = useMemo(
    () => (attachedFilePayload ? null : splitOmniBatchInputs(omniText, plugins)),
    [attachedFilePayload, omniText, plugins]
  );

  useEffect(() => {
    if (!manualModeLocked && smartDetection.suggestedModeId && !batchOmniItems) {
      setSelectedModeId(smartDetection.suggestedModeId);
    }
  }, [manualModeLocked, smartDetection.suggestedModeId, batchOmniItems]);

  const handleCycleTheme = () => {
    const idx = THEME_CYCLE_ORDER.indexOf(themeMode);
    const next = THEME_CYCLE_ORDER[(idx + 1) % THEME_CYCLE_ORDER.length];
    onThemeChange(next);
  };

  const docStatsList = useMemo(() => {
    return documents.map((doc) => ({
      doc,
      stats: computeDocumentLearningStats(doc, annotationsByDoc[doc.id]),
      taxonomy: inferDocumentTaxonomy(doc),
    }));
  }, [documents, annotationsByDoc]);

  const resumeEntry = useMemo(() => {
    return docStatsList.find((item) => item.doc.id === activeDocumentId) ?? docStatsList[0] ?? null;
  }, [docStatsList, activeDocumentId]);

  const reviewSummary = useMemo(() => {
    let totalFuzzy = 0;
    let totalQa = 0;
    let topTarget: (typeof docStatsList)[number] | null = null;

    for (const entry of docStatsList) {
      totalFuzzy += entry.stats.fuzzyOrConfusedCount;
      totalQa += entry.stats.qaCount;
      const entryScore = entry.stats.fuzzyOrConfusedCount * 10 + entry.stats.qaCount;
      const currentTopScore = topTarget
        ? topTarget.stats.fuzzyOrConfusedCount * 10 + topTarget.stats.qaCount
        : -1;
      if (entryScore > 0 && entryScore > currentTopScore) {
        topTarget = entry;
      }
    }

    return {
      totalFuzzy,
      totalQa,
      targetDoc: (topTarget ?? resumeEntry)?.doc ?? null,
      targetStats: (topTarget ?? resumeEntry)?.stats ?? null,
    };
  }, [docStatsList, resumeEntry]);

  const sortedLibraryEntries = useMemo(() => {
    return [...docStatsList].sort((a, b) => {
      const pinDiff = (b.doc.libraryMeta?.pinned ? 1 : 0) - (a.doc.libraryMeta?.pinned ? 1 : 0);
      if (pinDiff !== 0) return pinDiff;
      if (a.doc.id === activeDocumentId) return -1;
      if (b.doc.id === activeDocumentId) return 1;
      return 0;
    });
  }, [docStatsList, activeDocumentId]);

  const folderPreviewItems = useMemo<FolderDocumentPreview[]>(() => {
    return sortedLibraryEntries.slice(0, 3).map(({ doc, stats }) => ({
      id: doc.id,
      title: doc.title,
      modeName: MODE_SHORT_LABEL[doc.modeId] ?? doc.modeName,
      masteryPercent: stats.masteryPercent,
    }));
  }, [sortedLibraryEntries]);

  const filteredFolderEntries = useMemo(() => {
    const q = folderQuery.trim().toLowerCase();
    return sortedLibraryEntries.filter(({ doc, taxonomy }) => {
      if (folderModeFilter !== "all" && doc.modeId !== folderModeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        (doc.subtitle ?? "").toLowerCase().includes(q) ||
        doc.modeName.toLowerCase().includes(q) ||
        taxonomy.domainCategory.toLowerCase().includes(q)
      );
    });
  }, [sortedLibraryEntries, folderQuery, folderModeFilter]);

  const modeCounts = useMemo(() => {
    const counts = { paper: 0, essay: 0, repo: 0 };
    for (const d of documents) {
      if (d.modeId === "academic-paper") counts.paper++;
      else if (d.modeId === "cognitive-essay") counts.essay++;
      else if (d.modeId === "repo-deconstruct") counts.repo++;
    }
    return counts;
  }, [documents]);

  const ingestFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setErrorMsg("");

    let nextPlugin = activePlugin;
    if (files.length === 1 && files[0].name.toLowerCase().endsWith(".pdf")) {
      const paperPlugin = plugins.find((p) => p.inputConfig.acceptedFileTypes?.includes(".pdf"));
      if (paperPlugin) {
        nextPlugin = paperPlugin;
        setSelectedModeId(paperPlugin.id);
      }
    } else if (files.length > 1 || /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp)$/i.test(files[0].name)) {
      const repoPlugin = plugins.find((p) => p.inputConfig.supportsRepoUrl);
      if (repoPlugin) {
        nextPlugin = repoPlugin;
        setSelectedModeId(repoPlugin.id);
      }
    }

    const result = await filesToSourcePayload(
      files,
      Boolean(nextPlugin?.inputConfig.supportsRepoUrl)
    );

    if (!mountedRef.current) return;

    if (result.payload) {
      setAttachedFilePayload(result.payload);
      setAttachedFileLabel(result.label);
      setAttachedTitle(result.suggestedTitle);
    } else if (result.textContent !== undefined) {
      setAttachedFilePayload(null);
      setAttachedFileLabel(result.label);
      setAttachedTitle(result.suggestedTitle);
      setOmniText(result.textContent);
    }
  };

  const handleFilePickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    await ingestFiles(files);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    await ingestFiles(files);
  };

  const clearAttachedFile = () => {
    setAttachedFilePayload(null);
    setAttachedFileLabel("");
    setAttachedTitle("");
  };

  const handleAnalyzeSubmit = () => {
    if (!activePlugin) return;
    setErrorMsg("");

    const showFeedback = (msg: string) => {
      setQueueFeedbackMsg(msg);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setQueueFeedbackMsg("");
      }, 4500);
    };

    const trimmed = omniText.trim();
    if (!attachedFilePayload && batchOmniItems && batchOmniItems.length >= 2) {
      for (const item of batchOmniItems) {
        enqueueBackgroundAnalysis({
          modeId: item.suggestedModeId || activePlugin.id,
          payload: {
            kind: item.detectedKind,
            content: item.rawLine,
          },
          llmConfig,
          speedMode: analysisSpeedMode,
        });
      }
      setOmniText("");
      setManualModeLocked(false);
      showFeedback(`已将 ${batchOmniItems.length} 个链接加入后台并行队列，可随时切换阅读其他文章`);
      onTasksEnqueued?.();
      return;
    }

    let payload: RawSourcePayload | null = attachedFilePayload;

    if (!payload) {
      if (!trimmed) {
        setErrorMsg("请粘贴文章 / 论文 / 视频或 GitHub 链接（支持多行批量），输入研究主题，或拖入 PDF / 源码文件。");
        return;
      }
      const kind = smartDetection.detectedKind ?? "text";
      if (kind === "repo-url") {
        payload = { kind: "repo-url", content: trimmed };
      } else if (kind === "remote-url") {
        payload = { kind: "remote-url", content: trimmed };
      } else if (kind === "search-query") {
        payload = { kind: "search-query", content: trimmed };
      } else {
        payload = { kind: "text", content: trimmed };
      }
    }

    enqueueBackgroundAnalysis({
      modeId: activePlugin.id,
      title: attachedTitle || undefined,
      payload,
      llmConfig,
      speedMode: analysisSpeedMode,
    });

    setOmniText("");
    setAttachedFilePayload(null);
    setAttachedFileLabel("");
    setAttachedTitle("");
    setManualModeLocked(false);
    showFeedback("已加入后台并行解析队列，可继续添加下一篇或阅读其他文章");
    onTasksEnqueued?.();
  };

  const apiConfigured = Boolean(llmConfig.apiKey.trim());
  const hasActiveTasks = analysisTasks.some(
    (t) => t.status === "running" || t.status === "queued"
  );
  const isDark = themeMode === "aurora";
  const stageBadgeCls = isDark ? STAGE_BADGE_DARK_CLS : STAGE_BADGE_LIGHT_CLS;
  const headerCls = getPanelGlassTextClasses(themeMode);

  return (
    <div
      data-testid="workspace-home"
      className="min-h-screen flex flex-col overflow-x-clip"
      style={{ color: "var(--prism-ink)" }}
    >
      {/* Top Translucent Frosted Liquid Glass Chrome + FluidOrb Dynamic Fog */}
      <header
        data-testid="home-topbar"
        data-mac-desktop={isMacDesktop ? "true" : "false"}
        data-win-desktop={isWinDesktop ? "true" : "false"}
        style={getTopbarGlassStyle(themeMode)}
        className={`sticky top-0 z-30 h-12 border-b electron-drag transition-colors duration-200 ${
          isDark ? "text-slate-100" : "text-[#1a2744]"
        }`}
      >
        <TopbarGlassBackdrop themeMode={themeMode} />
        <div
          className={`relative z-10 max-w-[1460px] mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 ${
            isMacDesktop ? "pl-[84px]" : ""
          } ${isWinDesktop ? "pr-[144px] sm:pr-[148px]" : ""}`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 electron-no-drag">
            <div className="group flex items-center gap-1.5 sm:gap-2 shrink-0 select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand-logo.svg"
                alt="PurrParse Logo"
                data-testid="home-brand-logo"
                width={28}
                height={31}
                draggable={false}
                className="h-[26px] w-[23px] sm:h-[30px] sm:w-[27px] object-contain shrink-0 drop-shadow-[0_2px_4px_rgba(15,23,42,0.18)] transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105"
              />
              <span
                className={`font-serif text-[14px] sm:text-[15px] font-bold tracking-tight whitespace-nowrap ${
                  isDark ? "text-white" : "text-[#1a2744]"
                }`}
              >
                PurrParse
              </span>
              <span
                className={`hidden sm:inline font-mono text-[10px] uppercase tracking-widest border-l pl-2 whitespace-nowrap ${
                  isDark
                    ? "text-slate-300 border-white/15"
                    : "text-[#5a5347] border-[#1a2744]/15"
                }`}
              >
                主动精读工作台
              </span>
            </div>

            <button
              type="button"
              data-testid="home-open-library-btn"
              onClick={(e) => onOpenLibrary(e.currentTarget)}
              className={`sm:ml-1 inline-flex items-center gap-1 sm:gap-1.5 text-xs font-medium px-2 sm:px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? "text-slate-100 hover:text-white hover:bg-white/12"
                  : "text-[#1a2744] hover:bg-[#1a2744]/8"
              }`}
            >
              <svg className="w-3.5 h-3.5 opacity-80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>文库</span>
              <span
                className={`hidden sm:inline font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                  isDark ? "bg-white/12 text-slate-200" : "bg-[#1a2744]/10 text-[#1a2744]"
                }`}
              >
                {documents.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 electron-no-drag shrink-0">
            <TasksTopbarPill
              tasks={analysisTasks}
              themeMode={themeMode}
              open={tasksDockOpen}
              onToggle={() => onToggleTasksDock?.()}
            />

            <button
              type="button"
              data-testid="home-theme-btn"
              onClick={handleCycleTheme}
              title={`切换主题（当前：${THEME_LABELS[themeMode]}）`}
              className={`inline-flex items-center gap-1 sm:gap-1.5 text-xs font-medium px-1.5 sm:px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? "text-slate-100 hover:text-white hover:bg-white/12"
                  : "text-[#1a2744] hover:bg-[#1a2744]/8"
              }`}
            >
              {themeMode === "aurora" ? (
                <svg className="w-3.5 h-3.5 text-amber-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : themeMode === "studio" ? (
                <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1-8.313-12.454z" />
                </svg>
              )}
              <span>{THEME_LABELS[themeMode]}</span>
            </button>

            <button
              type="button"
              data-testid="home-open-settings-btn"
              onClick={onOpenSettings}
              className={`relative inline-flex items-center gap-1 sm:gap-1.5 text-xs font-medium px-1.5 sm:px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? "text-slate-100 hover:text-white hover:bg-white/12"
                  : "text-[#1a2744] hover:bg-[#1a2744]/8"
              }`}
            >
              <svg className="w-3.5 h-3.5 opacity-80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">设置与导出</span>
              <span className="sm:hidden">设置</span>
              {hasAppUpdate && (
                <span
                  data-testid="settings-update-dot"
                  aria-label="发现新版本"
                  className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Workspace Canvas */}
      <main className="flex-1 w-full max-w-[1060px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col justify-center gap-3.5 sm:gap-4">
        {/* Hero + Omni-Input Launcher */}
        <section className="max-w-3xl w-full mx-auto space-y-2.5">
          <div className="text-center space-y-1">
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border"
              style={{
                borderColor: "var(--prism-border)",
                background: "var(--prism-surface)",
                color: "var(--prism-ink-muted)",
              }}
            >
              <span>多模态主动精读 · 知识工作台</span>
            </span>
            <h1
              className="font-serif text-2xl sm:text-[28px] font-semibold tracking-tight leading-tight"
              style={{ color: "var(--prism-heading)" }}
            >
              今天想拆解什么？
            </h1>
          </div>

          {/* 3 Mode Selector Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {plugins.map((plugin) => {
              const active = plugin.id === activePlugin?.id;
              return (
                <button
                  key={plugin.id}
                  type="button"
                  data-testid={`home-mode-${plugin.id}`}
                  onClick={() => {
                    setSelectedModeId(plugin.id);
                    setManualModeLocked(true);
                  }}
                  className={`font-mono text-xs px-3 py-1 rounded-full border cursor-pointer transition-all ${
                    active
                      ? isDark
                        ? "bg-amber-300/20 text-amber-200 border-amber-300/65 font-semibold shadow-sm"
                        : "prism-on-dark bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold shadow-sm"
                      : "hover:border-amber-500/50"
                  }`}
                  style={
                    active
                      ? undefined
                      : {
                          background: "var(--prism-surface)",
                          borderColor: "var(--prism-border)",
                          color: "var(--prism-ink-muted)",
                        }
                  }
                >
                  {MODE_SHORT_LABEL[plugin.id] ?? plugin.name}
                </button>
              );
            })}
          </div>

          {/* Omni-Input Dropzone Card */}
          <div
            data-testid="home-omni-card"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`prism-editorial-card rounded-2xl border p-3.5 sm:p-4 transition-all shadow-sm ${
              isDragging
                ? "ring-2 ring-amber-400 border-amber-400"
                : ""
            }`}
            style={{
              background: "var(--prism-surface)",
              borderColor: isDragging ? undefined : "var(--prism-border)",
            }}
          >
            {attachedFileLabel && (
              <div
                className="mb-2.5 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs"
                style={{
                  background: "var(--prism-surface-subtle)",
                  borderColor: "var(--prism-border)",
                }}
              >
                <span className="font-mono truncate">{attachedFileLabel}</span>
                <button
                  type="button"
                  onClick={clearAttachedFile}
                  className="font-mono text-[11px] px-2 py-0.5 rounded-md hover:bg-rose-500/10 text-rose-500 cursor-pointer shrink-0"
                >
                  移除附件
                </button>
              </div>
            )}

            <textarea
              data-testid="home-omni-input"
              rows={2}
              value={omniText}
              onFocus={() => setOmniFocused(true)}
              onBlur={() => setOmniFocused(false)}
              onChange={(e) => {
                setOmniText(e.target.value);
                if (!e.target.value.trim()) setManualModeLocked(false);
                if (errorMsg) setErrorMsg("");
                if (queueFeedbackMsg) setQueueFeedbackMsg("");
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleAnalyzeSubmit();
                }
              }}
              placeholder={
                activePlugin?.id === "repo-deconstruct"
                  ? "粘贴 GitHub 仓库链接（支持多行同时解析多篇），或拖入源码文件..."
                  : activePlugin?.id === "cognitive-essay"
                    ? "粘贴抖音 / B站 / YouTube / X 分享链接（支持多行批量），或整篇长文..."
                    : "粘贴 arXiv 论文链接 / ID、网页文章（支持多行批量提交）、关键词，或拖入 PDF..."
              }
              className="w-full resize-none bg-transparent border-0 outline-none text-sm leading-relaxed placeholder:opacity-60"
              style={{ color: "var(--prism-ink)" }}
            />

            {(batchOmniItems || smartDetection.hint) && (
              <div className={`mt-2 flex items-center gap-1.5 text-[11.5px] font-mono ${isDark ? "text-amber-300" : "text-amber-600"}`}>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>
                  {batchOmniItems
                    ? `已识别 ${batchOmniItems.length} 条链接，点击即可同时并行后台解析`
                    : smartDetection.hint}
                </span>
              </div>
            )}

            <div
              className="mt-2 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2"
              style={{ borderColor: "var(--prism-border)" }}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.markdown,.tex,.srt,.vtt,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.c,.cpp,.json"
                  onChange={handleFilePickerChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors hover:border-amber-500/50"
                  style={{
                    borderColor: "var(--prism-border)",
                    color: "var(--prism-ink-muted)",
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span>上传文件</span>
                </button>

                <button
                  type="button"
                  data-testid="home-open-studio-btn"
                  onClick={onOpenStudio}
                  className="text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors hover:border-amber-500/50"
                  style={{
                    borderColor: "var(--prism-border)",
                    color: "var(--prism-ink-muted)",
                  }}
                >
                  高级定制
                </button>

                <button
                  type="button"
                  data-testid="home-speed-toggle"
                  onClick={() =>
                    setAnalysisSpeedMode(analysisSpeedMode === "fast" ? "balanced" : "fast")
                  }
                  title="点击切换解析速度策略（极速模式精简字段输出并提升至 5 路并发；标准精读保留全量深度批注与 4 路并发）"
                  className={`font-mono text-[11px] px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    analysisSpeedMode === "fast"
                      ? isDark
                        ? "bg-amber-400/18 text-amber-200 border-amber-300/45 hover:bg-amber-400/24"
                        : "bg-amber-500/12 text-amber-800 border-amber-500/40 hover:bg-amber-500/18"
                      : isDark
                        ? "border-white/15 text-slate-300 hover:border-white/30"
                        : "hover:border-amber-500/50"
                  }`}
                  style={
                    analysisSpeedMode === "balanced" && !isDark
                      ? {
                          borderColor: "var(--prism-border)",
                          color: "var(--prism-ink-muted)",
                        }
                      : undefined
                  }
                >
                  {analysisSpeedMode === "fast" ? "极速模式 · 5并发" : "标准精读 · 4并发"}
                </button>

                <button
                  type="button"
                  data-testid="home-api-status-btn"
                  onClick={onOpenApiSettings}
                  className={`font-mono text-[11px] px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    apiConfigured
                      ? isDark
                        ? "bg-emerald-400/15 text-emerald-200 border-emerald-300/35 hover:bg-emerald-400/20"
                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/15"
                      : isDark
                        ? "bg-amber-400/15 text-amber-200 border-amber-300/40 hover:bg-amber-400/20"
                        : "bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/15"
                  }`}
                >
                  {apiConfigured
                    ? `AI 就绪 · ${llmConfig.model || llmConfig.provider}`
                    : "配置 API Key →"}
                </button>
              </div>

              <button
                type="button"
                data-testid="home-omni-submit"
                onClick={handleAnalyzeSubmit}
                onMouseEnter={() => setSubmitHovered(true)}
                onMouseLeave={() => setSubmitHovered(false)}
                className={`group inline-flex items-center gap-2.5 font-mono text-xs font-semibold pl-2.5 pr-4 py-1.5 rounded-full cursor-pointer transition-all shadow-sm ${
                  isDark
                    ? "bg-amber-300 text-[#0f172a] hover:bg-amber-200 hover:shadow-md"
                    : "prism-on-dark bg-[#1a2744] text-amber-200 hover:bg-[#24365c] hover:shadow-md"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center rounded-full p-0.5 transition-colors ${
                    isDark ? "bg-[#0f172a]/12" : "bg-white/10"
                  }`}
                >
                  <MatrixOrb
                    size={26}
                    dots={7}
                    state={
                      (omniText.trim() || attachedFilePayload || omniFocused || submitHovered
                        ? "listening"
                        : "idle") satisfies MatrixOrbState
                    }
                    color={isDark ? "#9a3412" : "#FF8F1F"}
                    showLabel={false}
                  />
                </span>
                <span>{hasActiveTasks ? "加入并行解析" : "开始精读解析"}</span>
                <span className="transition-transform duration-150 group-hover:translate-x-0.5">
                  →
                </span>
              </button>
            </div>

            {queueFeedbackMsg && (
              <div
                data-testid="home-queue-feedback"
                className={`mt-2.5 px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center justify-between gap-2 ${
                  isDark
                    ? "bg-emerald-400/12 border-emerald-300/35 text-emerald-200"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
                }`}
              >
                <span>{queueFeedbackMsg}</span>
                {onToggleTasksDock && (
                  <button
                    type="button"
                    onClick={onToggleTasksDock}
                    className="underline cursor-pointer shrink-0"
                  >
                    查看任务队列
                  </button>
                )}
              </div>
            )}

            {errorMsg && (
              <div className={`mt-3 px-3 py-2 rounded-xl border text-xs ${isDark ? "bg-rose-400/15 border-rose-300/40 text-rose-200" : "bg-rose-500/10 border-rose-500/30 text-rose-600"}`}>
                {errorMsg}
              </div>
            )}
          </div>
        </section>

        {/* Resume & Review Quick Strip */}
        {resumeEntry && (
          <section className="max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Card 1: Continue Last Reading */}
            <div
              data-testid="home-resume-card"
              onClick={() => onOpenDocument(resumeEntry.doc.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenDocument(resumeEntry.doc.id);
                }
              }}
              className="prism-editorial-card group rounded-2xl border p-4 cursor-pointer transition-all hover:border-amber-500/60 shadow-sm flex flex-col justify-between gap-2.5"
              style={{
                background: "var(--prism-surface)",
                borderColor: "var(--prism-border)",
              }}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-[11px] uppercase tracking-wider font-semibold ${isDark ? "text-amber-300" : "text-amber-600"}`}>
                    继续上次精读
                  </span>
                  <span className={`font-mono text-[10.5px] px-2 py-0.5 rounded-full border ${stageBadgeCls[resumeEntry.stats.stage]}`}>
                    {`掌握 ${resumeEntry.stats.masteryPercent}%`}
                  </span>
                </div>
                <h2
                  className="font-serif text-base sm:text-lg font-semibold leading-snug line-clamp-1"
                  style={{ color: "var(--prism-heading)" }}
                >
                  {resumeEntry.doc.title}
                </h2>
                {resumeEntry.doc.subtitle && (
                  <p
                    className="text-xs leading-relaxed line-clamp-1"
                    style={{ color: "var(--prism-ink-muted)" }}
                  >
                    {resumeEntry.doc.subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t" style={{ borderColor: "var(--prism-border)" }}>
                <span className="font-mono text-[11px]" style={{ color: "var(--prism-ink-muted)" }}>
                  {`${resumeEntry.doc.modeName} · 懂 ${resumeEntry.stats.understoodCount}/${resumeEntry.stats.totalUnits} 段`}
                </span>
                <span className="font-mono font-semibold group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--prism-heading)" }}>
                  继续阅读 →
                </span>
              </div>
            </div>

            {/* Card 2: Whole-Library Pending Review */}
            <div
              data-testid="home-review-card"
              onClick={() => {
                if (reviewSummary.targetDoc) {
                  onOpenReview(reviewSummary.targetDoc.id);
                } else {
                  onOpenLibrary();
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (reviewSummary.targetDoc) {
                    onOpenReview(reviewSummary.targetDoc.id);
                  } else {
                    onOpenLibrary();
                  }
                }
              }}
              className="prism-editorial-card group rounded-2xl border p-4 cursor-pointer transition-all hover:border-amber-500/60 shadow-sm flex flex-col justify-between gap-2.5"
              style={{
                background: "var(--prism-surface)",
                borderColor: "var(--prism-border)",
              }}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-[11px] uppercase tracking-wider font-semibold ${isDark ? "text-rose-300" : "text-rose-600"}`}>
                    全库待复习与疑点回顾
                  </span>
                  <span className={`font-mono text-[10.5px] px-2 py-0.5 rounded-full border ${isDark ? "border-rose-300/45 bg-rose-400/18 text-rose-200" : "border-rose-400/35 bg-rose-500/10 text-rose-600"}`}>
                    {reviewSummary.totalFuzzy > 0 || reviewSummary.totalQa > 0
                      ? `${reviewSummary.totalFuzzy} 疑点 · ${reviewSummary.totalQa} 追问`
                      : "全库零积压"}
                  </span>
                </div>
                <h2
                  className="font-serif text-base sm:text-lg font-semibold leading-snug line-clamp-1"
                  style={{ color: "var(--prism-heading)" }}
                >
                  {reviewSummary.totalFuzzy > 0 || reviewSummary.totalQa > 0
                    ? `优先回顾：${reviewSummary.targetDoc?.title ?? ""}`
                    : "主动回忆 + 费曼输出抽查"}
                </h2>
                <p
                  className="text-xs leading-relaxed line-clamp-1"
                  style={{ color: "var(--prism-ink-muted)" }}
                >
                  {reviewSummary.totalFuzzy > 0 || reviewSummary.totalQa > 0
                    ? "一键切入复习模式，聚焦已标「模糊 / 不懂」段落与历史 AI 追问卡片，搭配费曼复述完成内化。"
                    : "当前文库暂无标记卡壳的段落；你仍可一键进入复习视图，检验核心段落的自测回忆与费曼输出。"}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t" style={{ borderColor: "var(--prism-border)" }}>
                <span className="font-mono text-[11px]" style={{ color: "var(--prism-ink-muted)" }}>
                  {reviewSummary.targetStats
                    ? `${reviewSummary.targetStats.fuzzyOrConfusedCount} 疑点 · ${reviewSummary.targetStats.qaCount} 条对话`
                    : "全库统计"}
                </span>
                <span
                  data-testid="home-review-cta"
                  className={`font-mono font-semibold group-hover:translate-x-0.5 transition-transform ${isDark ? "text-rose-300" : "text-rose-600"}`}
                >
                  进入复习模式 →
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Interactive 3D Library Folder Stage */}
        <section
          ref={folderStageRef}
          data-testid="home-library-folder-section"
          className="max-w-5xl w-full mx-auto"
        >
          <div
            className="prism-editorial-card rounded-3xl border p-4 sm:px-6 sm:py-4 shadow-sm transition-all"
            style={{
              background: "var(--prism-surface)",
              borderColor: "var(--prism-border)",
            }}
          >
            <div className="flex flex-col md:flex-row items-center gap-5 md:gap-8">
              {/* Rare UI 3D Frosted Folder */}
              <div ref={folderVisualRef} className="pt-4 pb-1 px-2 shrink-0 flex flex-col items-center">
                <Folder
                  data-testid="home-library-folder"
                  color={isDark ? "blue" : themeMode === "studio" ? "blue" : "navy"}
                  size="sm"
                  open={folderExpanded}
                  onOpenChange={(next) => (next ? openFolderPopup() : setFolderExpanded(false))}
                  compactOpenLift={true}
                  items={folderPreviewItems}
                  folderLabel="精读文库"
                  itemCount={documents.length}
                  onSelectItem={(docId) => {
                    setFolderExpanded(false);
                    onOpenDocument(docId);
                  }}
                />
              </div>

              {/* Folder Summary & Popup Launch Controls */}
              <div className="flex-1 min-w-0 space-y-2.5 text-center md:text-left">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <span
                      className={`font-mono text-[10.5px] uppercase tracking-widest font-semibold ${
                        isDark ? "text-amber-300" : "text-amber-600"
                      }`}
                    >
                      PERSONAL ARCHIVE · 文库文件夹
                    </span>
                    <span
                      className="font-mono text-[10px] px-2 py-0.5 rounded-full border"
                      style={{
                        background: "var(--prism-surface-subtle)",
                        borderColor: "var(--prism-border)",
                        color: "var(--prism-ink-muted)",
                      }}
                    >
                      {folderExpanded ? "已弹出文件夹页" : "已收纳"}
                    </span>
                  </div>

                  <h2
                    className="font-serif text-lg sm:text-xl font-semibold tracking-tight"
                    style={{ color: "var(--prism-heading)" }}
                  >
                    {`文库文档已收纳于此文件夹（${documents.length} 篇）`}
                  </h2>

                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--prism-ink-muted)" }}
                  >
                    悬停可扇形预览前 3 篇卡片；点击文件夹顺滑弹出全部精读文档页，或打开四维分类抽屉整理。
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 font-mono text-[11px]">
                  <span
                    className="px-2.5 py-0.5 rounded-full border"
                    style={{
                      background: "var(--prism-surface-subtle)",
                      borderColor: "var(--prism-border)",
                      color: "var(--prism-ink-muted)",
                    }}
                  >
                    {`学术论文 · ${modeCounts.paper}`}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full border"
                    style={{
                      background: "var(--prism-surface-subtle)",
                      borderColor: "var(--prism-border)",
                      color: "var(--prism-ink-muted)",
                    }}
                  >
                    {`长文 / 视频 · ${modeCounts.essay}`}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full border"
                    style={{
                      background: "var(--prism-surface-subtle)",
                      borderColor: "var(--prism-border)",
                      color: "var(--prism-ink-muted)",
                    }}
                  >
                    {`源码架构 · ${modeCounts.repo}`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-0.5">
                  <button
                    type="button"
                    data-testid="home-folder-toggle-btn"
                    onClick={openFolderPopup}
                    className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer transition-colors shadow-sm ${
                      isDark
                        ? "bg-amber-300 text-[#0f172a] hover:bg-amber-200"
                        : "prism-on-dark bg-[#1a2744] text-amber-200 hover:bg-[#24365c]"
                    }`}
                  >
                    <span>{`打开文库文件夹 (${documents.length}) ↗`}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="home-view-all-library-btn"
                    onClick={() => onOpenLibrary(folderStageRef.current)}
                    className="font-mono text-xs px-3.5 py-2 rounded-xl border cursor-pointer transition-colors hover:border-amber-500/50"
                    style={{
                      background: "var(--prism-surface-subtle)",
                      borderColor: "var(--prism-border)",
                      color: "var(--prism-heading)",
                    }}
                  >
                    四维分类与智能整理抽屉 →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Smooth Spring Popup Page Unfurling Directly from the 3D Folder */}
      <AnimatePresence>
        {folderExpanded && (
          <motion.div
            key="home-folder-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setFolderExpanded(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/45 backdrop-blur-xs"
          >
            <motion.div
              key="home-folder-modal"
              role="dialog"
              aria-modal="true"
              aria-label="精读文库文件夹页面"
              data-testid="home-folder-modal"
              initial={{
                opacity: 0,
                scale: 0.36,
                x: folderOriginOffset.x,
                y: folderOriginOffset.y,
              }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.4,
                x: folderOriginOffset.x,
                y: folderOriginOffset.y,
              }}
              transition={{ type: "spring", stiffness: 290, damping: 26, mass: 0.86 }}
              style={{
                background: "var(--prism-surface)",
                borderColor: "var(--prism-border)",
                color: "var(--prism-ink)",
              }}
              className="prism-editorial-card w-full max-w-4xl max-h-[84vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden"
            >
              <PanelGlassHeader
                testId="home-folder-modal-header"
                themeMode={themeMode}
                className="px-6 py-4"
                left={
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className={`font-serif text-lg sm:text-xl font-semibold tracking-tight ${headerCls.heading}`}>
                        精读文库文件夹
                      </h2>
                      <span className={`font-mono text-[10.5px] px-2 py-0.5 rounded-full ${headerCls.subtlePill}`}>
                        {`共 ${documents.length} 篇`}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${headerCls.subtitle}`}>
                      点击任意卡片即可进入主动精读工作台 · Esc 可收起返回主页
                    </p>
                  </div>
                }
                right={
                  <>
                    <button
                      type="button"
                      data-testid="home-folder-open-drawer-btn"
                      onClick={() => {
                        setFolderExpanded(false);
                        onOpenLibrary(folderStageRef.current);
                      }}
                      className={`font-mono text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${headerCls.subtlePill}`}
                    >
                      四维分类抽屉 →
                    </button>
                    <button
                      type="button"
                      data-testid="home-folder-close-btn"
                      onClick={() => setFolderExpanded(false)}
                      className={`font-mono text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${headerCls.ghostBtn}`}
                    >
                      关闭
                    </button>
                  </>
                }
              />

              {/* Controls Row Inside Popup Folder Page */}
              <div
                className="px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0"
                style={{
                  background: "var(--prism-surface-subtle)",
                  borderColor: "var(--prism-border)",
                }}
              >
                <div className="relative flex-1 min-w-[210px] max-w-sm">
                  <svg
                    className="w-3.5 h-3.5 opacity-50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    data-testid="home-folder-search"
                    value={folderQuery}
                    onChange={(e) => setFolderQuery(e.target.value)}
                    placeholder="在文库页面中筛选标题、领域或模式..."
                    className="w-full rounded-full border pl-8 pr-3.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                    style={{
                      background: "var(--prism-surface)",
                      borderColor: "var(--prism-border)",
                      color: "var(--prism-ink)",
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  {[
                    { key: "all", label: `全部 ${documents.length}` },
                    { key: "academic-paper", label: `学术论文 ${modeCounts.paper}` },
                    { key: "cognitive-essay", label: `长文/视频 ${modeCounts.essay}` },
                    { key: "repo-deconstruct", label: `源码架构 ${modeCounts.repo}` },
                  ].map((item) => {
                    const active = folderModeFilter === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setFolderModeFilter(item.key)}
                        className={`px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                          active
                            ? isDark
                              ? "bg-amber-300 text-[#0f172a] border-amber-300 font-semibold"
                              : "prism-on-dark bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold"
                            : "hover:border-amber-500/50"
                        }`}
                        style={
                          active
                            ? undefined
                            : {
                                background: "var(--prism-surface)",
                                borderColor: "var(--prism-border)",
                                color: "var(--prism-ink-muted)",
                              }
                        }
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable Cards Grid Inside Popup Page */}
              <div className="p-6 overflow-y-auto">
                {filteredFolderEntries.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed p-8 text-center text-xs"
                    style={{
                      borderColor: "var(--prism-border)",
                      color: "var(--prism-ink-muted)",
                    }}
                  >
                    当前筛选词暂无匹配的文库文档。
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredFolderEntries.map(({ doc, stats, taxonomy }, index) => {
                      const isCurrent = doc.id === activeDocumentId;
                      return (
                        <motion.div
                          key={doc.id}
                          data-testid={`home-doc-card-${doc.id}`}
                          initial={{ opacity: 0, y: 12, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 280,
                            damping: 24,
                            delay: Math.min(index * 0.035, 0.2),
                          }}
                          onClick={() => {
                            setFolderExpanded(false);
                            onOpenDocument(doc.id);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setFolderExpanded(false);
                              onOpenDocument(doc.id);
                            }
                          }}
                          className={`rounded-2xl border p-4 cursor-pointer transition-all hover:border-amber-500/60 flex flex-col justify-between gap-3 ${
                            isCurrent ? "ring-1 ring-amber-400/50" : ""
                          }`}
                          style={{
                            background: "var(--prism-surface-subtle)",
                            borderColor: "var(--prism-border)",
                          }}
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span
                                className="font-mono text-[10px] px-2 py-0.5 rounded-full border"
                                style={{
                                  background: "var(--prism-surface)",
                                  borderColor: "var(--prism-border)",
                                  color: "var(--prism-ink-muted)",
                                }}
                              >
                                {doc.modeName}
                              </span>
                              <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${stageBadgeCls[stats.stage]}`}>
                                {doc.libraryMeta?.pinned ? "📌 置顶" : stats.stageLabel}
                              </span>
                            </div>

                            <h3
                              className="font-serif text-base font-semibold leading-snug line-clamp-2"
                              style={{ color: "var(--prism-heading)" }}
                            >
                              {doc.title}
                            </h3>

                            {doc.subtitle && (
                              <p
                                className="text-xs leading-relaxed line-clamp-2"
                                style={{ color: "var(--prism-ink-muted)" }}
                              >
                                {doc.subtitle}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--prism-border)" }}>
                            <div className="flex items-center justify-between font-mono text-[10.5px]" style={{ color: "var(--prism-ink-muted)" }}>
                              <span className="truncate">{taxonomy.domainCategory}</span>
                              <span className="shrink-0 ml-2">{`掌握 ${stats.masteryPercent}%`}</span>
                            </div>
                            <div className="h-1 w-full rounded-full overflow-hidden bg-slate-500/15">
                              <div
                                className="h-full bg-amber-500 transition-all"
                                style={{ width: `${Math.max(stats.masteryPercent, 3)}%` }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
