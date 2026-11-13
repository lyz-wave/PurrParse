"use client";

import React, { useMemo, useState } from "react";
import type {
  LibraryTaxonomyMeta,
  UserAnnotationsState,
  WorkbenchDocument,
} from "@/core/contracts/document-ast";
import {
  computeDocumentLearningStats,
  inferDocumentTaxonomy,
  type DocumentLearningStats,
} from "@/core/engine/library-organizer";
import type { LLMConfig } from "@/core/engine/llm-adapters";

type GroupMode = "domain" | "stage" | "paradigm" | "flat";
type SortMode = "urgency" | "mastery_asc" | "recent";

interface LibraryDrawerProps {
  open: boolean;
  documents: WorkbenchDocument[];
  activeDocumentId: string;
  annotationsByDocId?: Record<string, UserAnnotationsState>;
  llmConfig?: LLMConfig;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onResetDemos: () => void;
  onAutoOrganize?: (
    overridesByDocId?: Record<string, Partial<LibraryTaxonomyMeta>>
  ) => void;
  onUpdateDocMeta?: (docId: string, patch: Partial<LibraryTaxonomyMeta>) => void;
}

interface EnrichedDocItem {
  doc: WorkbenchDocument;
  meta: LibraryTaxonomyMeta;
  stats: DocumentLearningStats;
}

const STAGE_ORDER: Record<DocumentLearningStats["stage"], number> = {
  struggling: 0,
  review_due: 1,
  unread: 2,
  mastered: 3,
};

const STAGE_BADGE_CLS: Record<DocumentLearningStats["stage"], string> = {
  struggling: "bg-rose-50 text-rose-800 border-rose-200",
  review_due: "bg-amber-50 text-amber-900 border-amber-200",
  unread: "bg-slate-100 text-slate-700 border-slate-200",
  mastered: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export function LibraryDrawer({
  open,
  documents,
  activeDocumentId,
  annotationsByDocId = {},
  llmConfig,
  onClose,
  onSelect,
  onDelete,
  onResetDemos,
  onAutoOrganize,
  onUpdateDocMeta,
}: LibraryDrawerProps) {
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("domain");
  const [sortMode, setSortMode] = useState<SortMode>("urgency");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [organizing, setOrganizing] = useState(false);
  const [organizeStatus, setOrganizeStatus] = useState<string | null>(null);

  const enrichedDocs = useMemo<EnrichedDocItem[]>(() => {
    return documents.map((doc) => ({
      doc,
      meta: doc.libraryMeta ?? inferDocumentTaxonomy(doc),
      stats: computeDocumentLearningStats(doc, annotationsByDocId[doc.id]),
    }));
  }, [documents, annotationsByDocId]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of enrichedDocs) {
      for (const tag of item.meta.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [enrichedDocs]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = enrichedDocs.filter(({ doc, meta }) => {
      if (activeTag && !meta.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.modeName.toLowerCase().includes(q) ||
        doc.subtitle.toLowerCase().includes(q) ||
        meta.domainCategory.toLowerCase().includes(q) ||
        meta.paradigmType.toLowerCase().includes(q) ||
        meta.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => {
      const pinDiff = (b.meta.pinned ? 1 : 0) - (a.meta.pinned ? 1 : 0);
      if (pinDiff !== 0) return pinDiff;

      if (sortMode === "urgency") {
        const scoreA = a.stats.fuzzyOrConfusedCount * 10 + a.stats.qaCount * 3;
        const scoreB = b.stats.fuzzyOrConfusedCount * 10 + b.stats.qaCount * 3;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return STAGE_ORDER[a.stats.stage] - STAGE_ORDER[b.stats.stage];
      }
      if (sortMode === "mastery_asc") {
        return a.stats.masteryPercent - b.stats.masteryPercent;
      }
      return (b.doc.updatedAt || "").localeCompare(a.doc.updatedAt || "");
    });
  }, [enrichedDocs, query, activeTag, sortMode]);

  const groupedSections = useMemo(() => {
    if (groupMode === "flat") {
      return [{ key: "全部工作台文档", items: filteredAndSorted }];
    }

    const groupsMap = new Map<string, EnrichedDocItem[]>();
    for (const item of filteredAndSorted) {
      const key =
        groupMode === "domain"
          ? item.meta.domainCategory
          : groupMode === "stage"
            ? item.stats.stageLabel
            : item.meta.paradigmType;
      const bucket = groupsMap.get(key) ?? [];
      bucket.push(item);
      groupsMap.set(key, bucket);
    }

    return Array.from(groupsMap.entries()).map(([key, items]) => ({ key, items }));
  }, [filteredAndSorted, groupMode]);

  if (!open) return null;

  const handleAutoOrganize = async () => {
    if (organizing) return;
    setOrganizing(true);
    setOrganizeStatus(null);

    try {
      // Immediate local deterministic organize so UI updates in 0ms
      onAutoOrganize?.();

      if (llmConfig?.apiKey?.trim()) {
        const res = await fetch("/api/organize-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documents, llmConfig }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            taxonomies?: Record<string, LibraryTaxonomyMeta>;
            engine?: "llm" | "heuristic";
          };
          if (data.taxonomies) {
            onAutoOrganize?.(data.taxonomies);
            setOrganizeStatus(
              data.engine === "llm"
                ? `已完成全库 ${documents.length} 篇文档的 AI 语义聚类与标签归档`
                : `已完成全库 ${documents.length} 篇文档的本地特征整理`
            );
            return;
          }
        }
      }

      setOrganizeStatus(
        `已完成全库 ${documents.length} 篇文档的主题领域、研究范式、标签与掌握度归档`
      );
    } finally {
      setOrganizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-slate-900/45" onClick={onClose} />
      <aside className="relative z-10 w-full max-w-xl bg-[#faf8f5] h-full shadow-2xl border-r border-[#ddd6c7] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#1a2744] text-white flex items-center justify-between gap-2 shrink-0">
          <div>
            <h2 className="font-serif text-lg font-semibold">个人精读文库</h2>
            <p className="text-xs text-slate-300">
              共 {documents.length} 份工作台文档 · 支持四维视图自动分类与掌握度追踪
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={organizing}
              onClick={() => void handleAutoOrganize()}
              className="font-mono text-xs px-3 py-1.5 rounded bg-amber-300 hover:bg-amber-200 text-[#1a2744] font-bold cursor-pointer disabled:opacity-60"
            >
              {organizing ? "[正在整理...]" : "[一键智能整理]"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-xs px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              [关闭]
            </button>
          </div>
        </div>

        {/* Search & Organize Status */}
        <div className="p-3.5 border-b border-[#ddd6c7] space-y-2.5 bg-[#f4efe5] shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题、主题类别、研究范式或 #标签..."
              className="flex-1 rounded-md border border-[#ddd6c7] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30"
            />
            <select
              aria-label="排序规则"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="font-mono text-[11px] rounded-md border border-[#ddd6c7] bg-white px-2 py-1.5 text-[#1a2744] cursor-pointer"
            >
              <option value="urgency">排序: 疑点与追问优先</option>
              <option value="mastery_asc">排序: 掌握度从低到高</option>
              <option value="recent">排序: 最近更新</option>
            </select>
            <button
              type="button"
              onClick={onResetDemos}
              className="font-mono text-[11px] px-2.5 py-1.5 rounded border border-[#ddd6c7] bg-white hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
            >
              [恢复演示]
            </button>
          </div>

          {/* 4-Dimension Group Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: "domain", label: "[按主题领域]" },
                { key: "stage", label: "[按消化进度]" },
                { key: "paradigm", label: "[按研究范式]" },
                { key: "flat", label: "[全部平铺]" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setGroupMode(tab.key)}
                className={`font-mono text-[11px] px-2.5 py-1 rounded border cursor-pointer transition-colors ${
                  groupMode === tab.key
                    ? "bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold"
                    : "bg-white text-slate-700 border-[#ddd6c7] hover:bg-[#faf8f5]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Clickable Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                className={`font-mono text-[10px] px-2 py-0.5 rounded border cursor-pointer ${
                  activeTag === null
                    ? "bg-[#1a2744] text-white border-[#1a2744]"
                    : "bg-white text-slate-600 border-[#ddd6c7] hover:bg-amber-50"
                }`}
              >
                #全部标签
              </button>
              {allTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
                  className={`font-mono text-[10px] px-2 py-0.5 rounded border cursor-pointer ${
                    activeTag === tag
                      ? "bg-amber-200 text-[#1a2744] border-[#1a2744] font-semibold"
                      : "bg-white text-slate-700 border-[#ddd6c7] hover:bg-amber-50"
                  }`}
                >
                  {`#${tag} (${count})`}
                </button>
              ))}
            </div>
          )}

          {organizeStatus && (
            <div className="font-mono text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
              {organizeStatus}
            </div>
          )}
        </div>

        {/* Grouped Document List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {groupedSections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#c7bea9] bg-white p-6 text-center text-xs text-slate-500">
              当前筛选条件未匹配到文库文档，请清除关键词或标签筛选。
            </div>
          ) : (
            groupedSections.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.key]);
              return (
                <section key={group.key} className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-md bg-[#efeae0] border border-[#ddd6c7] text-left cursor-pointer hover:bg-[#e7e0d2]"
                  >
                    <span className="font-mono text-xs font-bold text-[#1a2744]">
                      {`${isCollapsed ? "[+]" : "[-]"} ${group.key}`}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600">
                      {`${group.items.length} 篇`}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-2.5">
                      {group.items.map(({ doc, meta, stats }) => {
                        const isActive = doc.id === activeDocumentId;
                        return (
                          <div
                            key={doc.id}
                            className={`rounded-lg border p-3.5 transition-colors ${
                              isActive
                                ? "bg-white border-[#1a2744] ring-1 ring-[#1a2744]"
                                : "bg-white/90 border-[#ddd6c7] hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelect(doc.id);
                                  onClose();
                                }}
                                className="text-left flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                  {meta.pinned && (
                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-300 text-[#1a2744] font-bold">
                                      [置顶]
                                    </span>
                                  )}
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#f0ece2] text-[#1a2744] font-semibold">
                                    {doc.modeName}
                                  </span>
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                    {meta.paradigmType}
                                  </span>
                                  <span
                                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${STAGE_BADGE_CLS[stats.stage]}`}
                                  >
                                    {stats.stageLabel}
                                  </span>
                                </div>

                                <div className="font-serif font-semibold text-sm text-[#1a2744] truncate">
                                  {doc.title}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                  {doc.subtitle}
                                </div>
                              </button>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {onUpdateDocMeta && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateDocMeta(doc.id, { pinned: !meta.pinned })
                                    }
                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#ddd6c7] bg-[#fcfbf8] hover:bg-amber-50 text-[#1a2744] cursor-pointer"
                                  >
                                    {meta.pinned ? "[取消置顶]" : "[置顶]"}
                                  </button>
                                )}
                                {documents.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => onDelete(doc.id)}
                                    className="font-mono text-[11px] text-rose-600 hover:underline cursor-pointer"
                                  >
                                    [删除]
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Tags + Mastery Progress Telemetry */}
                            <div className="mt-2.5 pt-2 border-t border-[#ede6d8] space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1">
                                {meta.tags.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() =>
                                      setActiveTag((prev) => (prev === tag ? null : tag))
                                    }
                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#faf7f0] border border-[#ddd6c7] text-[#4b453d] hover:border-[#1a2744] cursor-pointer"
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-slate-600">
                                <span>
                                  {`掌握 ${stats.masteryPercent}% | 懂 ${stats.understoodCount}/${stats.totalUnits} 段${
                                    stats.fuzzyOrConfusedCount > 0
                                      ? ` | 待攻克 ${stats.fuzzyOrConfusedCount} 处`
                                      : ""
                                  }${stats.qaCount > 0 ? ` | AI追问 ${stats.qaCount} 次` : ""}`}
                                </span>
                                <span className="text-[#1a2744] font-semibold">
                                  {meta.domainCategory}
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[#ebe4d6] overflow-hidden">
                                <div
                                  className="h-full bg-[#1a2744] transition-all"
                                  style={{ width: `${Math.max(4, stats.masteryPercent)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
