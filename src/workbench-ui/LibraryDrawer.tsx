"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import type { WorkbenchThemeMode } from "@/store/workbench-store";
import {
  getPanelGlassTextClasses,
  PanelGlassHeader,
} from "@/components/ui/fluid-orb";

type GroupMode = "domain" | "stage" | "paradigm" | "flat";
type SortMode = "urgency" | "mastery_asc" | "recent";

interface ContextMenuState {
  docId: string;
  pinned: boolean;
  x: number;
  y: number;
}

export interface LibraryOriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface LibraryDrawerProps {
  open: boolean;
  documents: WorkbenchDocument[];
  activeDocumentId: string;
  annotationsByDocId?: Record<string, UserAnnotationsState>;
  llmConfig?: LLMConfig;
  themeMode?: WorkbenchThemeMode;
  originRect?: LibraryOriginRect | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
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
  struggling: "bg-rose-50 text-rose-700",
  review_due: "bg-amber-50 text-amber-800",
  unread: "bg-slate-100 text-slate-600",
  mastered: "bg-emerald-50 text-emerald-700",
};

export function LibraryDrawer({
  open,
  documents,
  activeDocumentId,
  annotationsByDocId = {},
  llmConfig,
  themeMode = "paper",
  originRect = null,
  onClose,
  onSelect,
  onDelete,
  onAutoOrganize,
  onUpdateDocMeta,
}: LibraryDrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("domain");
  const [sortMode, setSortMode] = useState<SortMode>("urgency");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [organizing, setOrganizing] = useState(false);
  const [organizeStatus, setOrganizeStatus] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    setContextMenu(null);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) {
      setContextMenu(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, contextMenu, onClose]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [contextMenu]);

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

  const drawerMotionStyle = useMemo<React.CSSProperties>(() => {
    if (!originRect) return {};
    const drawerW = 540;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const originCenterX = originRect.left + originRect.width / 2;
    const originCenterY = originRect.top + originRect.height / 2;
    const clampedDx = Math.max(-120, Math.min(240, Math.round(originCenterX - drawerW * 0.5)));
    const clampedDy = Math.max(-140, Math.min(260, Math.round(originCenterY - vh * 0.45)));
    return {
      transformOrigin: `${Math.max(16, Math.min(drawerW - 16, Math.round(originCenterX)))}px ${Math.max(
        16,
        Math.min(vh - 16, Math.round(originCenterY))
      )}px`,
      ["--prism-origin-dx" as string]: `${clampedDx}px`,
      ["--prism-origin-dy" as string]: `${clampedDy}px`,
      ["--prism-origin-scale" as string]: "0.72",
    };
  }, [originRect]);

  if (!mounted) return null;

  const handleAutoOrganize = async () => {
    if (organizing) return;
    setOrganizing(true);
    setOrganizeStatus(null);

    try {
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

  const openContextMenuAt = (
    e: React.MouseEvent,
    docId: string,
    pinned: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const maxW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const maxH = typeof window !== "undefined" ? window.innerHeight : 800;
    const menuWidth = 176;
    const menuHeight = 160;
    setContextMenu({
      docId,
      pinned,
      x: Math.min(Math.max(12, e.clientX), Math.max(12, maxW - menuWidth - 12)),
      y: Math.min(Math.max(12, e.clientY), Math.max(12, maxH - menuHeight - 12)),
    });
  };

  const activeContextDoc = contextMenu
    ? documents.find((d) => d.id === contextMenu.docId)
    : undefined;
  const headerCls = getPanelGlassTextClasses(themeMode);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className={`fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] ${
          closing ? "prism-backdrop-exit pointer-events-none" : "prism-backdrop-enter"
        }`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="个人精读文库"
        style={drawerMotionStyle}
        className={`relative z-10 w-full max-w-[540px] h-full md:rounded-r-2xl bg-[#faf8f5] shadow-2xl border-r border-[#ddd6c7] flex flex-col overflow-hidden origin-top-left ${
          closing ? "prism-library-exit pointer-events-none" : "prism-library-enter"
        }`}
      >
        {/* Frosted Liquid Glass + FluidOrb Dynamic Fog Header */}
        <PanelGlassHeader
          testId="library-drawer-header"
          themeMode={themeMode}
          className="py-4"
          left={
            <div>
              <h2 className={`font-serif text-lg font-semibold tracking-tight ${headerCls.heading}`}>
                个人精读文库
              </h2>
              <p className={`text-xs mt-0.5 ${headerCls.subtitle}`}>
                共 {documents.length} 份工作台文档 · 右键卡片可置顶或删除
              </p>
            </div>
          }
          right={
            <>
              <button
                type="button"
                disabled={organizing}
                onClick={() => void handleAutoOrganize()}
                className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap ${headerCls.primaryActionBtn}`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
                <span>{organizing ? "正在整理..." : "一键智能整理"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`font-mono text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${headerCls.ghostBtn}`}
              >
                关闭
              </button>
            </>
          }
        />

        {/* Clean Controls Area */}
        <div className="px-4 py-3 border-b border-[#ddd6c7] space-y-2.5 bg-[#f3efe6] shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <svg
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索标题、主题领域或标签..."
                className="w-full rounded-full border border-[#ddd6c7] bg-white pl-8 pr-3.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20"
              />
            </div>

            <select
              aria-label="排序规则"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="text-xs rounded-full border border-[#ddd6c7] bg-white px-3 py-1.5 text-[#1a2744] cursor-pointer focus:outline-none"
            >
              <option value="urgency">疑点优先</option>
              <option value="mastery_asc">掌握度从低到高</option>
              <option value="recent">最近更新</option>
            </select>
          </div>

          {/* Segmented Rounded-Full Group Switcher */}
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-[#e6dfd1]/80 p-1 w-full sm:w-auto">
            {(
              [
                { key: "domain", label: "按主题领域" },
                { key: "stage", label: "按消化进度" },
                { key: "paradigm", label: "按研究范式" },
                { key: "flat", label: "全部" },
              ] as const
            ).map((tab) => {
              const active = groupMode === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setGroupMode(tab.key)}
                  className={`flex-1 sm:flex-initial text-xs px-3 py-1 rounded-full cursor-pointer transition-all ${
                    active
                      ? "prism-on-dark bg-[#1a2744] text-white font-medium shadow-xs"
                      : "text-slate-600 hover:text-[#1a2744]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Slim Single-Row Horizontal Scrollable Tags (no multi-line clutter) */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full cursor-pointer whitespace-nowrap transition-colors ${
                  activeTag === null
                    ? "prism-on-dark bg-[#1a2744] text-white font-medium"
                    : "bg-white/80 text-slate-600 hover:bg-white"
                }`}
              >
                全部标签
              </button>
              {allTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full cursor-pointer whitespace-nowrap transition-colors ${
                    activeTag === tag
                      ? "bg-amber-200 text-[#1a2744] font-semibold"
                      : "bg-white/80 text-slate-600 hover:bg-white"
                  }`}
                >
                  {`#${tag} ${count}`}
                </button>
              ))}
            </div>
          )}

          {organizeStatus && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              {organizeStatus}
            </div>
          )}
        </div>

        {/* Grouped Soft-Rounded Document Cards */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-5"
          onScroll={() => {
            if (contextMenu) setContextMenu(null);
          }}
        >
          {groupedSections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#c7bea9] bg-white p-8 text-center text-xs text-slate-500">
              当前筛选条件未匹配到文库文档，请清除关键词或标签筛选。
            </div>
          ) : (
            groupedSections.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.key]);
              return (
                <section key={group.key} className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                    className="w-full flex items-center justify-between px-1.5 py-1 rounded-lg text-left cursor-pointer hover:bg-[#efeae0]/70 transition-colors"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a2744]">
                      <svg
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                          isCollapsed ? "-rotate-90" : ""
                        }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                      <span>{group.key}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
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
                            data-testid={`library-card-${doc.id}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setContextMenu(null);
                              onSelect(doc.id);
                              onClose();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setContextMenu(null);
                                onSelect(doc.id);
                                onClose();
                              }
                            }}
                            onContextMenu={(e) => openContextMenuAt(e, doc.id, Boolean(meta.pinned))}
                            className={`rounded-2xl p-4 cursor-pointer transition-all select-none ${
                              isActive
                                ? "bg-white border border-[#1a2744]/35 ring-2 ring-[#1a2744]/12 shadow-sm"
                                : "bg-white border border-[#e8e1d3] hover:border-[#ddd6c7] hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                  {meta.pinned && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-200/80 text-[#1a2744] font-semibold">
                                      已置顶
                                    </span>
                                  )}
                                  {isActive && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2744]/10 text-[#1a2744] font-semibold">
                                      当前阅读
                                    </span>
                                  )}
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0ece2] text-[#1a2744] font-medium">
                                    {doc.modeName}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                    {meta.paradigmType}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE_CLS[stats.stage]}`}
                                  >
                                    {stats.stageLabel}
                                  </span>
                                </div>

                                <h3 className="font-serif font-semibold text-sm text-[#1a2744] leading-snug truncate">
                                  {doc.title}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                  {doc.subtitle}
                                </p>
                              </div>
                            </div>

                            {/* Soft Tags + Mastery Bar */}
                            <div className="mt-3 pt-2.5 border-t border-[#e8e1d3] space-y-2">
                              {meta.tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {meta.tags.map((tag) => (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveTag((prev) => (prev === tag ? null : tag));
                                      }}
                                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#f3efe6] text-slate-600 hover:bg-[#efeae0] hover:text-[#1a2744] cursor-pointer transition-colors"
                                    >
                                      #{tag}
                                    </button>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
                                <span>
                                  {`掌握 ${stats.masteryPercent}% · 懂 ${stats.understoodCount}/${stats.totalUnits} 段${
                                    stats.fuzzyOrConfusedCount > 0
                                      ? ` · 待攻克 ${stats.fuzzyOrConfusedCount} 处`
                                      : ""
                                  }${stats.qaCount > 0 ? ` · 追问 ${stats.qaCount}` : ""}`}
                                </span>
                                <span className="text-[#1a2744]/80 font-medium truncate">
                                  {meta.domainCategory}
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[#e6dfd1] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#1a2744] transition-all"
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

      {/* Right-Click Context Menu */}
      {contextMenu && activeContextDoc && (
        <div
          ref={menuRef}
          data-testid="library-context-menu"
          role="menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          className="fixed z-60 w-44 rounded-xl bg-white border border-[#ddd6c7] shadow-2xl p-1.5 text-xs text-[#1a2744] space-y-0.5"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onSelect(activeContextDoc.id);
              setContextMenu(null);
              onClose();
            }}
            className="w-full px-3 py-2 rounded-lg text-left hover:bg-[#efeae0] cursor-pointer flex items-center gap-2 transition-colors"
          >
            打开阅读
          </button>

          {onUpdateDocMeta && (
            <button
              type="button"
              role="menuitem"
              data-testid={`library-pin-${activeContextDoc.id}`}
              onClick={() => {
                onUpdateDocMeta(activeContextDoc.id, { pinned: !contextMenu.pinned });
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 rounded-lg text-left hover:bg-[#efeae0] cursor-pointer flex items-center gap-2 transition-colors"
            >
              {contextMenu.pinned ? "取消置顶" : "置顶文档"}
            </button>
          )}

          {documents.length > 1 && (
            <>
              <div className="my-1 border-t border-[#e8e1d3]" />
              <button
                type="button"
                role="menuitem"
                data-testid={`library-delete-${activeContextDoc.id}`}
                onClick={() => {
                  onDelete(activeContextDoc.id);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 rounded-lg text-left text-rose-600 hover:bg-rose-50 font-medium cursor-pointer flex items-center gap-2 transition-colors"
              >
                删除文档
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
