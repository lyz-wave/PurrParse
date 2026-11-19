"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { WorkbenchUnit } from "@/core/contracts/document-ast";
import { exportDocumentToAnkiCsv } from "@/exporters/anki-exporter";
import { exportDocumentToMarkdown } from "@/exporters/markdown-exporter";
import { compileDocumentToStandaloneHtml } from "@/exporters/html-compiler";
import { useWorkbenchStore } from "@/store/workbench-store";
import {
  ProximitySidebar,
  type ProximitySection,
} from "@/components/ui/proximity-sidebar";
import { RailToc } from "@/components/ui/rail-toc";
import { BackJumpFloater } from "./BackJumpFloater";
import {
  cancelBackgroundAnalysis,
  retryBackgroundAnalysis,
} from "./analysis-task-manager";
import { BackgroundTasksDock, TasksTopbarPill } from "./BackgroundTasksDock";
import { BottomArsenalRenderer } from "./BottomArsenalRenderer";
import {
  isMacDesktopRuntime,
  isWinDesktopRuntime,
  syncDesktopWindowTheme,
} from "./desktop-runtime";
import { DualColumnRow, isFailedTranslationUnit } from "./DualColumnRow";
import { GlobalTooltip } from "./GlobalTooltip";
import { HeaderConsole } from "./HeaderConsole";
import { IngestionStudioModal } from "./IngestionStudioModal";
import { LibraryDrawer, type LibraryOriginRect } from "./LibraryDrawer";
import { OnboardingTour } from "./OnboardingTour";
import { SectionSummaryCard } from "./SectionSummaryCard";
import { SelectionQaModal, type SelectionQaOpenPayload } from "./SelectionQaModal";
import { SettingsModal, type SettingsSectionKey } from "./SettingsModal";
import { SubNavBar } from "./SubNavBar";
import { TopMentalPanel } from "./TopMentalPanel";
import { UpdateBanner } from "./UpdateBanner";
import { useAppUpdater } from "./use-app-updater";
import { WorkspaceHome } from "./WorkspaceHome";

interface SelectionPillState {
  unitId: string;
  unitCode: string;
  selectedText: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toSafeFilename(title: string, ext: string): string {
  const clean = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${clean || "workbench-document"}.${ext}`;
}

export function WorkbenchShell() {
  const {
    documents,
    activeDocumentId,
    annotationsByDocId,
    llmConfig,
    activeDimFilter,
    paretoMode,
    fuzzyOnlyMode,
    firstPassMode,
    hideSecondary,
    hideNotes,
    autoHideHeader,
    themeMode,
    viewMode,
    startOnHome,
    readingDepthMode,
    pureLangMode,
    flashUnitId,
    onboardingOpen,
    analysisTasks,
    hydrateFromStorage,
    openOnboarding,
    completeOnboarding,
    setActiveDocument,
    openDocumentForReview,
    upsertDocument,
    replaceDocumentUnits,
    removeAnalysisTask,
    clearFinishedAnalysisTasks,
    deleteDocument,
    autoOrganizeLibrary,
    updateDocumentLibraryMeta,
    setLlmConfig,
    setUnitNote,
    setJournalAnswer,
    toggleChecklistItem,
    setBeforeAfterDiff,
    setUnitUnderstanding,
    setUnitPrediction,
    unlockUnitNotes,
    setPretestAnswer,
    setSectionRecall,
    setSocraticAnswer,
    setFeynmanEssay,
    addUnitQaThread,
    appendUnitQaFollowUp,
    deleteUnitQaThread,
    toggleDimFilter,
    toggleParetoMode,
    toggleFuzzyOnlyMode,
    toggleFirstPassMode,
    toggleHideSecondary,
    toggleHideNotes,
    toggleAutoHideHeader,
    setThemeMode,
    setViewMode,
    toggleStartOnHome,
    setReadingDepthMode,
    setPureLangMode,
    jumpToUnit,
    showTooltip,
    hideTooltip,
  } = useWorkbenchStore();

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryOriginRect, setLibraryOriginRect] = useState<LibraryOriginRect | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);

  const openLibraryFrom = (originEl?: HTMLElement | null) => {
    if (originEl && typeof originEl.getBoundingClientRect === "function") {
      const rect = originEl.getBoundingClientRect();
      setLibraryOriginRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setLibraryOriginRect(null);
    }
    setLibraryOpen(true);
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFocusSection, setSettingsFocusSection] = useState<SettingsSectionKey | null>(null);
  const [pureTocOpen, setPureTocOpen] = useState(false);
  const [blurredSectionId, setBlurredSectionId] = useState<string | null>(null);
  const [selectionQaPayload, setSelectionQaPayload] = useState<SelectionQaOpenPayload | null>(null);
  const [selectionPill, setSelectionPill] = useState<SelectionPillState | null>(null);
  const [selectionCopied, setSelectionCopied] = useState(false);
  const [isMacDesktop, setIsMacDesktop] = useState(false);
  const [isWinDesktop, setIsWinDesktop] = useState(false);
  const [tasksDockOpen, setTasksDockOpen] = useState(false);
  const [retryingUnitIds, setRetryingUnitIds] = useState<Record<string, boolean>>({});
  const [retryingAllFailed, setRetryingAllFailed] = useState(false);
  const [retryErrorsByUnitId, setRetryErrorsByUnitId] = useState<Record<string, string>>({});

  const appUpdater = useAppUpdater({
    autoCheck: true,
    onMenuCheckRequest: () => {
      setSettingsFocusSection("update");
      setSettingsOpen(true);
    },
  });

  const isPureMode = readingDepthMode === "pure";
  const isReviewMode = readingDepthMode === "review";

  useEffect(() => {
    setIsMacDesktop(isMacDesktopRuntime());
    setIsWinDesktop(isWinDesktopRuntime());
  }, []);

  useEffect(() => {
    syncDesktopWindowTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (libraryOpen || studioOpen || settingsOpen || onboardingOpen || selectionQaPayload) {
      setSelectionPill(null);
    }
  }, [libraryOpen, studioOpen, settingsOpen, onboardingOpen, selectionQaPayload]);

  useEffect(() => {
    if (!selectionPill) return;
    const hidePill = () => setSelectionPill(null);
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-testid="selection-ask-pill"]')) return;
      hidePill();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hidePill();
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", hidePill, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", hidePill);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectionPill]);

  const handleMainMouseUp = (e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if (libraryOpen || studioOpen || settingsOpen || onboardingOpen || selectionQaPayload) return;

    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest('[data-testid="selection-ask-pill"], input, textarea, button, [role="dialog"]')) {
      return;
    }

    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel || sel.isCollapsed) {
      setSelectionPill(null);
      return;
    }

    const rawText = sel.toString().trim();
    if (rawText.length < 2) {
      setSelectionPill(null);
      return;
    }

    const anchorNode = sel.anchorNode;
    const anchorEl =
      anchorNode?.nodeType === 3 ? anchorNode.parentElement : (anchorNode as HTMLElement | null);
    if (!anchorEl || anchorEl.closest("textarea, input, [role='dialog']")) {
      return;
    }

    const articleEl = anchorEl.closest("article[id]");
    const unitId = articleEl?.getAttribute("id");
    const matchedUnit = unitId ? activeDoc.units.find((u) => u.id === unitId) : undefined;
    if (!matchedUnit) return;

    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    const viewW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const centerX = rect && rect.width > 0 ? rect.left + rect.width / 2 : e.clientX;
    const clampedX = Math.min(Math.max(88, centerX), Math.max(88, viewW - 88));
    const topY =
      rect && (rect.height > 0 || rect.top > 0)
        ? rect.top > 72
          ? rect.top - 46
          : rect.bottom + 8
        : Math.max(60, e.clientY - 46);

    setSelectionCopied(false);
    setSelectionPill({
      unitId: matchedUnit.id,
      unitCode: matchedUnit.unitCode,
      selectedText: rawText.slice(0, 1200),
      x: clampedX,
      y: topY,
      anchorX: rect?.left ?? e.clientX,
      anchorY: rect?.top ?? e.clientY,
    });
  };

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!isPureMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !libraryOpen && !studioOpen && !settingsOpen && !onboardingOpen && !selectionQaPayload) {
        setPureTocOpen(false);
        setReadingDepthMode("workbench");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPureMode, libraryOpen, studioOpen, settingsOpen, onboardingOpen, selectionQaPayload, setReadingDepthMode]);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocumentId) ?? documents[0],
    [documents, activeDocumentId]
  );

  const activeAnnotations = annotationsByDocId[activeDoc.id];

  const failedUnits = useMemo(
    () => activeDoc.units.filter((u) => isFailedTranslationUnit(u)),
    [activeDoc.units]
  );

  const handleRetryUnits = async (targets: WorkbenchUnit[], isBulk = false) => {
    if (targets.length === 0) return;
    if (!llmConfig.apiKey.trim()) {
      const firstId = targets[0].id;
      setRetryErrorsByUnitId((prev) => ({
        ...prev,
        [firstId]: "请先在右上角「设置」中填入有效的 API Key，再点击重试。",
      }));
      setSettingsFocusSection("llm");
      setSettingsOpen(true);
      return;
    }

    const ids = targets.map((u) => u.id);
    if (isBulk) setRetryingAllFailed(true);
    setRetryingUnitIds((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = true;
      return next;
    });
    setRetryErrorsByUnitId((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });

    try {
      const allSectionIds = activeDoc.sections.map((s) => s.id);
      const summary =
        activeDoc.topMentalModel.rawSummaryBanner?.body ||
        activeDoc.subtitle ||
        activeDoc.title;

      const chunkSize = 6;
      for (let offset = 0; offset < targets.length; offset += chunkSize) {
        const chunk = targets.slice(offset, offset + chunkSize);
        const resp = await fetch("/api/retry-units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modeId: activeDoc.modeId,
            globalContextSummary: summary,
            allSectionIds,
            units: chunk.map((u) => ({
              id: u.id,
              unitCode: u.unitCode,
              sectionId: u.sectionId,
              sectionTitle: u.sectionTitle,
              sectionTask: u.sectionTask,
              primaryKind: u.primaryKind,
              codeLanguage: u.codeLanguage,
              filePath: u.filePath,
              rawPrimaryText: u.primaryText,
              formulas: u.formulas,
              figures: u.figures,
              dataTable: u.dataTable,
              calloutList: u.calloutList,
            })),
            llmConfig,
          }),
        });
        const json = (await resp.json()) as { units?: WorkbenchUnit[]; error?: string };
        if (!resp.ok || !Array.isArray(json.units)) {
          throw new Error(json.error || `重试请求失败 (${resp.status})`);
        }
        replaceDocumentUnits(activeDoc.id, json.units);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "重试翻译失败，请稍后再试";
      setRetryErrorsByUnitId((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = msg;
        return next;
      });
    } finally {
      if (isBulk) setRetryingAllFailed(false);
      setRetryingUnitIds((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
    }
  };

  const fuzzyOrConfusedCount = useMemo(() => {
    const map = activeAnnotations?.unitUnderstanding ?? {};
    return activeDoc.units.filter((u) => map[u.id] === "fuzzy" || map[u.id] === "confused").length;
  }, [activeDoc.units, activeAnnotations?.unitUnderstanding]);

  const groupedSections = useMemo(() => {
    const recommendedIds = new Set(activeDoc.topMentalModel.readingPath?.recommendedUnitIds ?? []);
    const groups: Array<{
      sectionId: string;
      title: string;
      taskBadge?: string;
      summary?: typeof activeDoc.sections[number]["summary"];
      units: typeof activeDoc.units;
    }> = [];

    for (const unit of activeDoc.units) {
      if (paretoMode && unit.weight !== "core") continue;
      if (firstPassMode && !unit.firstPassRecommended && !recommendedIds.has(unit.id) && unit.weight !== "core") {
        continue;
      }
      if (fuzzyOnlyMode || isReviewMode) {
        const status = activeAnnotations?.unitUnderstanding?.[unit.id];
        const hasQaThreads = (activeAnnotations?.unitQaThreads?.[unit.id]?.length ?? 0) > 0;
        if (status !== "fuzzy" && status !== "confused" && !(isReviewMode && hasQaThreads)) {
          continue;
        }
      }
      let group = groups.find((g) => g.sectionId === unit.sectionId);
      if (!group) {
        const secMeta = activeDoc.sections.find((s) => s.id === unit.sectionId);
        group = {
          sectionId: unit.sectionId,
          title: secMeta?.title ?? unit.sectionTitle,
          taskBadge: secMeta?.taskBadge ?? unit.sectionTask,
          summary: secMeta?.summary,
          units: [],
        };
        groups.push(group);
      }
      group.units.push(unit);
    }
    return groups;
  }, [
    activeDoc,
    paretoMode,
    firstPassMode,
    fuzzyOnlyMode,
    isReviewMode,
    activeAnnotations?.unitUnderstanding,
    activeAnnotations?.unitQaThreads,
  ]);

  const proximitySections = useMemo<ProximitySection[]>(() => {
    const items: ProximitySection[] = isPureMode
      ? [{ id: "pure-doc-header", label: activeDoc.title, kind: "title" }]
      : [
          {
            id: "mental-model",
            label: `00 · ${activeDoc.labels.mentalNavLabel.replace(/^\[|\]$/g, "")}`,
            kind: "title",
          },
        ];

    const totalUnits = groupedSections.reduce((sum, g) => sum + g.units.length, 0);
    const compactBodies = totalUnits > 26;

    for (const group of groupedSections) {
      items.push({
        id: group.sectionId,
        label: group.title,
        kind: "subtitle",
      });
      for (const unit of group.units) {
        if (compactBodies && unit.weight !== "core") continue;
        items.push({
          id: unit.id,
          label: `${unit.unitCode} · ${unit.tldr}`,
          kind: "body",
        });
      }
    }

    if (!isPureMode) {
      items.push({
        id: "bottom-arsenal",
        label: activeDoc.labels.bottomNavLabel.replace(/^\[|\]$/g, ""),
        kind: "title",
      });
    }
    return items;
  }, [activeDoc, groupedSections, isPureMode]);

  const handleExportMarkdown = () => {
    const md = exportDocumentToMarkdown(activeDoc, activeAnnotations);
    triggerFileDownload(toSafeFilename(activeDoc.title, "md"), md, "text/markdown;charset=utf-8");
  };

  const handleExportAnkiCsv = () => {
    const csv = exportDocumentToAnkiCsv(activeDoc, activeAnnotations);
    triggerFileDownload(toSafeFilename(activeDoc.title, "csv"), csv, "text/csv;charset=utf-8");
  };

  const handleExportHtml = () => {
    const html = compileDocumentToStandaloneHtml(activeDoc, activeAnnotations);
    triggerFileDownload(toSafeFilename(activeDoc.title, "html"), html, "text/html;charset=utf-8");
  };

  return (
    <div data-theme={themeMode} className="prism-shell min-h-screen">
      {viewMode === "home" ? (
        <WorkspaceHome
          documents={documents}
          activeDocumentId={activeDoc.id}
          annotationsByDoc={annotationsByDocId}
          llmConfig={llmConfig}
          themeMode={themeMode}
          startOnHome={startOnHome}
          tasksDockOpen={tasksDockOpen}
          hasAppUpdate={appUpdater.state.hasUpdate}
          onThemeChange={setThemeMode}
          onToggleStartOnHome={toggleStartOnHome}
          onToggleTasksDock={() => setTasksDockOpen((p) => !p)}
          onTasksEnqueued={() => setTasksDockOpen(true)}
          onOpenDocument={(docId) => setActiveDocument(docId)}
          onOpenReview={(docId) => openDocumentForReview(docId)}
          onOpenLibrary={(originEl) => openLibraryFrom(originEl)}
          onOpenStudio={() => setStudioOpen(true)}
          onOpenSettings={() => {
            setSettingsFocusSection(null);
            setSettingsOpen(true);
          }}
          onOpenApiSettings={() => {
            setSettingsFocusSection("llm");
            setSettingsOpen(true);
          }}
          onOpenOnboarding={openOnboarding}
        />
      ) : (
        <>
          {isPureMode && (isMacDesktop || isWinDesktop) && (
            <div
              aria-hidden="true"
              className={`sticky top-0 z-30 w-full electron-drag bg-transparent ${
                isWinDesktop ? "h-12" : "h-9"
              }`}
            />
          )}
          {!isPureMode && (
            <>
              <HeaderConsole
                doc={activeDoc}
                activeDimFilter={activeDimFilter}
                paretoMode={paretoMode}
                firstPassMode={firstPassMode}
                fuzzyOnlyMode={fuzzyOnlyMode}
                fuzzyOrConfusedCount={fuzzyOrConfusedCount}
                autoHideHeader={autoHideHeader}
                hideSecondary={hideSecondary}
                hideNotes={hideNotes}
                themeMode={themeMode}
                readingDepthMode={readingDepthMode}
                hasAppUpdate={appUpdater.state.hasUpdate}
                tasksPill={
                  <TasksTopbarPill
                    tasks={analysisTasks}
                    themeMode={themeMode}
                    open={tasksDockOpen}
                    onToggle={() => setTasksDockOpen((p) => !p)}
                  />
                }
                onThemeChange={setThemeMode}
                onReadingDepthChange={setReadingDepthMode}
                onToggleDim={toggleDimFilter}
                onTogglePareto={toggleParetoMode}
                onToggleFirstPass={toggleFirstPassMode}
                onToggleFuzzyOnly={toggleFuzzyOnlyMode}
                onOpenHome={() => {
                  setSelectionPill(null);
                  setSelectionQaPayload(null);
                  setViewMode("home");
                }}
                onOpenLibrary={(originEl) => openLibraryFrom(originEl)}
                onOpenStudio={() => setStudioOpen(true)}
                onOpenSettings={() => {
                  setSettingsFocusSection(null);
                  setSettingsOpen(true);
                }}
              />

              <SubNavBar doc={activeDoc} />
            </>
          )}

      <main
        onMouseUp={handleMainMouseUp}
        className={
          isPureMode
            ? "max-w-[760px] mx-auto px-5 sm:px-8 pt-10 pb-28"
            : "max-w-[1460px] mx-auto px-4 sm:px-6 xl:pr-14 py-6 pb-20"
        }
      >
        {isPureMode ? (
          <header id="pure-doc-header" className="mb-8 pb-6 border-b border-[#ddd6c7]/70">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                {`${activeDoc.modeName} · 通读纯净模式 (${activeDoc.units.length} 节)`}
              </span>
              <div className="flex items-center gap-2">
                <div
                  data-testid="pure-lang-switcher"
                  role="group"
                  aria-label="通读中英文稿切换"
                  className="inline-flex items-center rounded-full border border-[#ddd6c7] bg-[#fcfaf6] p-0.5"
                >
                  <button
                    type="button"
                    onClick={() => setPureLangMode("original")}
                    className={`font-mono text-[10.5px] px-2.5 py-0.5 rounded-full cursor-pointer transition-colors ${
                      pureLangMode === "original"
                        ? "prism-on-dark bg-[#1a2744] text-white font-semibold"
                        : "text-slate-600 hover:text-[#1a2744]"
                    }`}
                  >
                    英文/原稿
                  </button>
                  <button
                    type="button"
                    onClick={() => setPureLangMode("chinese")}
                    className={`font-mono text-[10.5px] px-2.5 py-0.5 rounded-full cursor-pointer transition-colors ${
                      pureLangMode === "chinese"
                        ? "prism-on-dark bg-[#1a2744] text-white font-semibold"
                        : "text-slate-600 hover:text-[#1a2744]"
                    }`}
                  >
                    中文稿
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setReadingDepthMode("workbench")}
                  className="font-mono text-[11px] px-2.5 py-0.5 rounded-full border border-[#ddd6c7] text-slate-600 hover:text-[#1a2744] cursor-pointer transition-colors"
                >
                  切换精读工作台
                </button>
              </div>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight leading-snug text-[#1a2744]">
              {activeDoc.title}
            </h1>
            {activeDoc.subtitle && (
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{activeDoc.subtitle}</p>
            )}
          </header>
        ) : (
          <TopMentalPanel
            model={activeDoc.topMentalModel}
            pretestAnswers={activeAnnotations?.pretestAnswers}
            onPretestChange={(itemId, patch) => setPretestAnswer(activeDoc.id, itemId, patch)}
            onJumpToUnit={(targetId) => jumpToUnit(targetId)}
            onToggleFirstPass={toggleFirstPassMode}
          />
        )}

        {groupedSections.length === 0 ? (
          <div className="prism-editorial-card border border-[#ddd6c7] rounded-2xl p-8 text-center text-sm text-slate-600 space-y-3">
            <p>
              {isReviewMode
                ? "当前文档暂无标记为「模糊 / 不懂」或发起过 AI 追问的单元。"
                : "当前筛选条件（80/20 核心聚焦 / 第一遍路径 / 只看模糊与不懂）未匹配到对应单元，请点击顶部对应开关恢复全部视图。"}
            </p>
            {isReviewMode && (
              <button
                type="button"
                onClick={() => setReadingDepthMode("workbench")}
                className="prism-on-dark font-mono text-xs px-4 py-1.5 rounded-full bg-[#1a2744] text-white cursor-pointer"
              >
                返回精读模式
              </button>
            )}
          </div>
        ) : (
          groupedSections.map((group) => {
            const sectionBlurred = blurredSectionId === group.sectionId;
            return (
              <div key={group.sectionId} id={group.sectionId} className="mb-8 scroll-mt-28">
                {isPureMode ? (
                  <div className="mt-10 mb-4 pb-2 border-b border-[#ddd6c7]/60 flex items-baseline justify-between gap-2">
                    <h2 className="font-serif text-lg sm:text-xl font-semibold text-[#1a2744]">
                      {group.title}
                    </h2>
                    {group.taskBadge && (
                      <span className="font-mono text-[11px] text-slate-500">{group.taskBadge}</span>
                    )}
                  </div>
                ) : (
                  <div className="prism-section-banner my-4 px-4 py-3 rounded-r-xl flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-serif text-base sm:text-lg font-semibold text-[#1a2744]">
                      {group.title}
                    </h2>
                    {group.taskBadge && (
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white/60 text-slate-600">
                        {group.taskBadge}
                      </span>
                    )}
                  </div>
                )}

                {group.units.map((unit) => (
                  <DualColumnRow
                    key={unit.id}
                    unit={unit}
                    layoutRatio={activeDoc.layoutRatio}
                    dimensions={activeDoc.dimensions}
                    labels={activeDoc.labels}
                    activeDimFilter={activeDimFilter}
                    hideSecondary={hideSecondary}
                    hideNotes={hideNotes}
                    pureMode={isPureMode}
                    pureLang={pureLangMode}
                    isFlashed={flashUnitId === unit.id}
                    isBlurred={sectionBlurred}
                    understandingStatus={activeAnnotations?.unitUnderstanding?.[unit.id] ?? "unmarked"}
                    predictionAnswer={activeAnnotations?.unitPredictionAnswers?.[unit.id] ?? ""}
                    notesUnlocked={Boolean(activeAnnotations?.unitNotesUnlocked?.[unit.id])}
                    userNote={activeAnnotations?.unitNotes?.[unit.id] ?? ""}
                    onUserNoteChange={(note) => setUnitNote(activeDoc.id, unit.id, note)}
                    onUnderstandingChange={(status) =>
                      setUnitUnderstanding(activeDoc.id, unit.id, status)
                    }
                    onPredictionChange={(text) => setUnitPrediction(activeDoc.id, unit.id, text)}
                    onUnlockNotes={() => unlockUnitNotes(activeDoc.id, unit.id)}
                    onJumpToUnit={(targetId, originId) => jumpToUnit(targetId, originId)}
                    onHoverTooltip={showTooltip}
                    onLeaveTooltip={hideTooltip}
                    qaThreads={activeAnnotations?.unitQaThreads?.[unit.id] ?? []}
                    onOpenSelectionQa={(payload) => setSelectionQaPayload(payload)}
                    onDeleteQaThread={(threadId) =>
                      deleteUnitQaThread(activeDoc.id, unit.id, threadId)
                    }
                    isRetryingUnit={Boolean(retryingUnitIds[unit.id])}
                    failedUnitsCount={failedUnits.length}
                    isRetryingAllFailed={retryingAllFailed}
                    retryError={retryErrorsByUnitId[unit.id] ?? null}
                    onRetryUnit={() => void handleRetryUnits([unit], false)}
                    onRetryAllFailed={() => void handleRetryUnits(failedUnits, true)}
                  />
                ))}

                {!isPureMode && (
                  <SectionSummaryCard
                    sectionId={group.sectionId}
                    sectionTitle={group.title}
                    summary={group.summary}
                    recallState={activeAnnotations?.sectionRecallAnswers?.[group.sectionId]}
                    isRecallBlurActive={sectionBlurred}
                    onToggleRecallBlur={() =>
                      setBlurredSectionId((prev) =>
                        prev === group.sectionId ? null : group.sectionId
                      )
                    }
                    onRecallTextChange={(text) =>
                      setSectionRecall(activeDoc.id, group.sectionId, { text })
                    }
                    onSubmitRecall={() => {
                      setSectionRecall(activeDoc.id, group.sectionId, { submitted: true });
                      setBlurredSectionId(null);
                    }}
                  />
                )}
              </div>
            );
          })
        )}

        {!isPureMode && (
          <BottomArsenalRenderer
            title={activeDoc.bottomTitle}
            subtitle={activeDoc.bottomSubtitle}
            blocks={activeDoc.bottomBlocks}
            pretestItems={activeDoc.topMentalModel.pretestItems}
            annotations={activeAnnotations}
            onJournalChange={(promptId, val) => setJournalAnswer(activeDoc.id, promptId, val)}
            onChecklistToggle={(itemId) => toggleChecklistItem(activeDoc.id, itemId)}
            onDiffChange={(patch) => setBeforeAfterDiff(activeDoc.id, patch)}
            onSocraticChange={(itemId, patch) => setSocraticAnswer(activeDoc.id, itemId, patch)}
            onFeynmanChange={(text) => setFeynmanEssay(activeDoc.id, text)}
          />
        )}
      </main>

      <aside
        aria-label="文章侧边进度指示"
        className={`fixed top-1/2 -translate-y-1/2 right-1.5 z-30 pointer-events-none ${
          isPureMode ? "hidden lg:flex" : "hidden xl:flex"
        }`}
      >
        <ProximitySidebar
          sections={proximitySections}
          side="right"
          activeOffset={0.32}
          scrollOffsetPx={isPureMode ? 48 : 84}
        />
      </aside>

      {isPureMode && (
        <div
          data-testid="pure-mode-dock"
          className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2"
        >
          {pureTocOpen && (
            <div
              className="w-72 max-h-[58vh] overflow-y-auto rounded-2xl border shadow-2xl p-3.5"
              style={{
                background: "var(--prism-surface, #fcf9f2)",
                borderColor: "var(--prism-border, #ddd6c7)",
              }}
            >
              <RailToc
                title="快速跳章"
                offset={64}
                items={[
                  { id: "__top__", label: "回到顶部", depth: 0 },
                  ...groupedSections.map((group) => ({
                    id: group.sectionId,
                    label: group.title,
                    depth: 1,
                    badge: group.taskBadge || undefined,
                  })),
                ]}
                onItemSelect={() => {
                  window.setTimeout(() => setPureTocOpen(false), 380);
                }}
              />
            </div>
          )}

          <div className="prism-glass-bar text-white rounded-full px-2 py-1.5 shadow-xl flex items-center gap-1.5 border border-white/15">
            <button
              type="button"
              onClick={() => setPureLangMode(pureLangMode === "original" ? "chinese" : "original")}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer transition-colors"
              title="切换英文/原稿与中文稿"
            >
              {pureLangMode === "original" ? "原稿" : "中文"}
            </button>
            <button
              type="button"
              onClick={() => setPureTocOpen((prev) => !prev)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full hover:bg-white/15 cursor-pointer transition-colors"
            >
              目录
            </button>
            <button
              type="button"
              onClick={() =>
                setThemeMode(
                  themeMode === "paper" ? "aurora" : themeMode === "aurora" ? "studio" : "paper"
                )
              }
              className="text-[11px] font-medium px-2.5 py-1 rounded-full hover:bg-white/15 cursor-pointer transition-colors"
              title="切换阅读主题"
            >
              {themeMode === "paper" ? "稿纸" : themeMode === "aurora" ? "夜空" : "纯白"}
            </button>
            <span className="h-3.5 w-px bg-white/20" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                setPureTocOpen(false);
                setReadingDepthMode("workbench");
              }}
              className="text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-300 text-[#1a2744] hover:bg-amber-200 cursor-pointer transition-colors"
            >
              退出纯净 (Esc)
            </button>
          </div>
        </div>
      )}
        </>
      )}

      <GlobalTooltip />
      <BackJumpFloater />

      <LibraryDrawer
        open={libraryOpen}
        documents={documents}
        activeDocumentId={activeDoc.id}
        annotationsByDocId={annotationsByDocId}
        llmConfig={llmConfig}
        themeMode={themeMode}
        originRect={libraryOriginRect}
        onClose={() => setLibraryOpen(false)}
        onSelect={setActiveDocument}
        onDelete={deleteDocument}
        onAutoOrganize={autoOrganizeLibrary}
        onUpdateDocMeta={updateDocumentLibraryMeta}
      />

      <OnboardingTour
        open={onboardingOpen}
        documents={documents}
        activeDocumentId={activeDoc.id}
        paretoMode={paretoMode}
        themeMode={themeMode}
        onSelectDocument={setActiveDocument}
        onTogglePareto={toggleParetoMode}
        onThemeChange={setThemeMode}
        onOpenSettingsForApi={() => {
          setSettingsFocusSection("llm");
          setSettingsOpen(true);
        }}
        onOpenStudio={() => setStudioOpen(true)}
        onComplete={completeOnboarding}
      />

      <IngestionStudioModal
        open={studioOpen}
        llmConfig={llmConfig}
        themeMode={themeMode}
        onClose={() => setStudioOpen(false)}
        onCreated={(doc) => upsertDocument(doc)}
        onTaskEnqueued={() => setTasksDockOpen(true)}
      />

      <SettingsModal
        open={settingsOpen}
        doc={activeDoc}
        config={llmConfig}
        hideSecondary={hideSecondary}
        hideNotes={hideNotes}
        autoHideHeader={autoHideHeader}
        themeMode={themeMode}
        startOnHome={startOnHome}
        initialFocusSection={settingsFocusSection}
        updateState={appUpdater.state}
        isDesktopRuntime={appUpdater.isDesktopRuntime}
        onCheckForUpdates={() => void appUpdater.checkForUpdates()}
        onDownloadUpdate={() => void appUpdater.downloadUpdate()}
        onCancelDownload={() => void appUpdater.cancelDownload()}
        onInstallUpdate={() => void appUpdater.installUpdate()}
        onOpenReleasePage={(url) => void appUpdater.openReleasePage(url)}
        onRevealDownloadedFile={() => void appUpdater.revealDownloadedFile()}
        onThemeChange={setThemeMode}
        onToggleStartOnHome={toggleStartOnHome}
        onToggleSecondary={toggleHideSecondary}
        onToggleNotes={toggleHideNotes}
        onToggleAutoHideHeader={toggleAutoHideHeader}
        onExportMarkdown={handleExportMarkdown}
        onExportAnkiCsv={handleExportAnkiCsv}
        onExportHtml={handleExportHtml}
        onSave={setLlmConfig}
        onOpenOnboarding={() => {
          setSettingsOpen(false);
          setSettingsFocusSection(null);
          openOnboarding();
        }}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsFocusSection(null);
        }}
      />

      {selectionPill && !selectionQaPayload && (
        <div
          data-testid="selection-ask-pill"
          style={{ left: `${selectionPill.x}px`, top: `${selectionPill.y}px` }}
          onMouseDown={(e) => e.preventDefault()}
          className="prism-on-dark fixed -translate-x-1/2 z-40 inline-flex items-center gap-0.5 rounded-full bg-[#0f172a] text-white px-1.5 py-1 shadow-2xl border border-white/15"
        >
          <button
            type="button"
            data-testid="selection-ask-ai-btn"
            onClick={() => {
              setSelectionQaPayload({
                unitId: selectionPill.unitId,
                unitCode: selectionPill.unitCode,
                selectedText: selectionPill.selectedText,
                x: selectionPill.anchorX,
                y: selectionPill.anchorY,
              });
              setSelectionPill(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-300 hover:bg-amber-200 text-[#0f172a] cursor-pointer transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            <span>问 AI</span>
          </button>
          <button
            type="button"
            data-testid="selection-copy-btn"
            onClick={() => {
              void navigator.clipboard?.writeText(selectionPill.selectedText);
              setSelectionCopied(true);
              setTimeout(() => {
                setSelectionCopied(false);
                setSelectionPill(null);
              }, 700);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full text-slate-200 hover:text-white hover:bg-white/12 cursor-pointer transition-colors"
          >
            <span>{selectionCopied ? "已复制" : "复制"}</span>
          </button>
        </div>
      )}

      <SelectionQaModal
        open={Boolean(selectionQaPayload)}
        doc={activeDoc}
        unit={
          selectionQaPayload
            ? activeDoc.units.find((u) => u.id === selectionQaPayload.unitId) ?? null
            : null
        }
        selectedText={selectionQaPayload?.selectedText ?? ""}
        anchorPos={
          selectionQaPayload
            ? { x: selectionQaPayload.x, y: selectionQaPayload.y }
            : null
        }
        activeThread={
          selectionQaPayload?.activeThreadId
            ? (activeAnnotations?.unitQaThreads?.[selectionQaPayload.unitId] ?? []).find(
                (t) => t.id === selectionQaPayload.activeThreadId
              ) ?? null
            : null
        }
        llmConfig={llmConfig}
        themeMode={themeMode}
        onSaveThread={(thread) => {
          addUnitQaThread(activeDoc.id, thread.unitId, thread);
          setSelectionQaPayload((prev) =>
            prev ? { ...prev, activeThreadId: thread.id } : prev
          );
        }}
        onAppendFollowUp={(threadId, turn) => {
          if (!selectionQaPayload) return;
          appendUnitQaFollowUp(activeDoc.id, selectionQaPayload.unitId, threadId, turn);
        }}
        onJumpToUnit={(targetId, originId) => jumpToUnit(targetId, originId)}
        onClose={() => setSelectionQaPayload(null)}
      />

      <BackgroundTasksDock
        tasks={analysisTasks}
        themeMode={themeMode}
        open={tasksDockOpen}
        isPureMode={viewMode === "reader" && isPureMode}
        onToggleOpen={() => setTasksDockOpen((p) => !p)}
        onOpenDocument={(docId) => setActiveDocument(docId)}
        onCancelTask={(taskId) => cancelBackgroundAnalysis(taskId)}
        onRetryTask={(taskId) => {
          retryBackgroundAnalysis(taskId);
        }}
        onRemoveTask={(taskId) => removeAnalysisTask(taskId)}
        onClearFinished={() => clearFinishedAnalysisTasks()}
      />

      <UpdateBanner
        state={appUpdater.state}
        isDesktopRuntime={appUpdater.isDesktopRuntime}
        dismissed={appUpdater.isBannerDismissed}
        hidden={settingsOpen || (viewMode === "reader" && isPureMode)}
        themeMode={themeMode}
        onDownload={() => void appUpdater.downloadUpdate()}
        onCancelDownload={() => void appUpdater.cancelDownload()}
        onInstall={() => void appUpdater.installUpdate()}
        onOpenSettings={() => {
          setSettingsFocusSection("update");
          setSettingsOpen(true);
        }}
        onDismiss={() => appUpdater.dismissBanner()}
      />
    </div>
  );
}
