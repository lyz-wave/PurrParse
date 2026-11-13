"use client";

import React, { useEffect, useMemo, useState } from "react";
import { exportDocumentToAnkiCsv } from "@/exporters/anki-exporter";
import { exportDocumentToMarkdown } from "@/exporters/markdown-exporter";
import { compileDocumentToStandaloneHtml } from "@/exporters/html-compiler";
import { useWorkbenchStore } from "@/store/workbench-store";
import { BackJumpFloater } from "./BackJumpFloater";
import { BottomArsenalRenderer } from "./BottomArsenalRenderer";
import { DualColumnRow } from "./DualColumnRow";
import { GlobalTooltip } from "./GlobalTooltip";
import { HeaderConsole } from "./HeaderConsole";
import { IngestionStudioModal } from "./IngestionStudioModal";
import { LibraryDrawer } from "./LibraryDrawer";
import { SectionSummaryCard } from "./SectionSummaryCard";
import { SelectionQaModal, type SelectionQaOpenPayload } from "./SelectionQaModal";
import { SettingsModal } from "./SettingsModal";
import { SubNavBar } from "./SubNavBar";
import { TopMentalPanel } from "./TopMentalPanel";

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
    flashUnitId,
    hydrateFromStorage,
    setActiveDocument,
    upsertDocument,
    deleteDocument,
    resetDemos,
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
    jumpToUnit,
    showTooltip,
    hideTooltip,
  } = useWorkbenchStore();

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blurredSectionId, setBlurredSectionId] = useState<string | null>(null);
  const [selectionQaPayload, setSelectionQaPayload] = useState<SelectionQaOpenPayload | null>(null);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocumentId) ?? documents[0],
    [documents, activeDocumentId]
  );

  const activeAnnotations = annotationsByDocId[activeDoc.id];

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
      if (fuzzyOnlyMode) {
        const status = activeAnnotations?.unitUnderstanding?.[unit.id];
        if (status !== "fuzzy" && status !== "confused") continue;
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
  }, [activeDoc, paretoMode, firstPassMode, fuzzyOnlyMode, activeAnnotations?.unitUnderstanding]);

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
    <div className="min-h-screen bg-[#faf8f5] text-[#1c222d]">
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
        onToggleDim={toggleDimFilter}
        onTogglePareto={toggleParetoMode}
        onToggleFirstPass={toggleFirstPassMode}
        onToggleFuzzyOnly={toggleFuzzyOnlyMode}
        onOpenLibrary={() => setLibraryOpen(true)}
        onOpenStudio={() => setStudioOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SubNavBar doc={activeDoc} />

      <main className="max-w-[1460px] mx-auto px-4 sm:px-6 py-6 pb-20">
        <TopMentalPanel
          model={activeDoc.topMentalModel}
          pretestAnswers={activeAnnotations?.pretestAnswers}
          onPretestChange={(itemId, patch) => setPretestAnswer(activeDoc.id, itemId, patch)}
          onJumpToUnit={(targetId) => jumpToUnit(targetId)}
          onToggleFirstPass={toggleFirstPassMode}
        />

        {groupedSections.length === 0 ? (
          <div className="bg-white border border-[#ddd6c7] rounded-xl p-8 text-center text-sm text-slate-600">
            当前筛选条件（80/20 核心聚焦 / 第一遍路径 / 只看模糊与不懂）未匹配到对应单元，请点击顶部对应开关恢复全部视图。
          </div>
        ) : (
          groupedSections.map((group) => {
            const sectionBlurred = blurredSectionId === group.sectionId;
            return (
              <div key={group.sectionId} id={group.sectionId} className="mb-6 scroll-mt-28">
                <div className="my-4 px-4 py-2.5 border-l-4 border-[#1a2744] bg-[#efeae0] rounded-r-lg flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-serif text-base sm:text-lg font-semibold text-[#1a2744]">
                    {group.title}
                  </h2>
                  {group.taskBadge && (
                    <span className="font-mono text-xs text-slate-600">{group.taskBadge}</span>
                  )}
                </div>

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
                  />
                ))}

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
              </div>
            );
          })
        )}

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
      </main>

      <GlobalTooltip />
      <BackJumpFloater />

      <LibraryDrawer
        open={libraryOpen}
        documents={documents}
        activeDocumentId={activeDoc.id}
        annotationsByDocId={annotationsByDocId}
        llmConfig={llmConfig}
        onClose={() => setLibraryOpen(false)}
        onSelect={setActiveDocument}
        onDelete={deleteDocument}
        onResetDemos={resetDemos}
        onAutoOrganize={autoOrganizeLibrary}
        onUpdateDocMeta={updateDocumentLibraryMeta}
      />

      <IngestionStudioModal
        open={studioOpen}
        llmConfig={llmConfig}
        onClose={() => setStudioOpen(false)}
        onCreated={(doc) => upsertDocument(doc)}
      />

      <SettingsModal
        open={settingsOpen}
        doc={activeDoc}
        config={llmConfig}
        hideSecondary={hideSecondary}
        hideNotes={hideNotes}
        autoHideHeader={autoHideHeader}
        onToggleSecondary={toggleHideSecondary}
        onToggleNotes={toggleHideNotes}
        onToggleAutoHideHeader={toggleAutoHideHeader}
        onExportMarkdown={handleExportMarkdown}
        onExportAnkiCsv={handleExportAnkiCsv}
        onExportHtml={handleExportHtml}
        onSave={setLlmConfig}
        onClose={() => setSettingsOpen(false)}
      />

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
    </div>
  );
}
