"use client";

import React, { useEffect, useRef, useState } from "react";
import type {
  ColorSlot,
  HighlightDimensionKey,
  WorkbenchDocument,
} from "@/core/contracts/document-ast";

const PILL_ACCENT: Record<ColorSlot, string> = {
  yellow: "border-l-4 border-l-amber-400",
  red: "border-l-4 border-l-rose-400",
  blue: "border-l-4 border-l-blue-400",
  green: "border-l-4 border-l-emerald-400",
  purple: "border-l-4 border-l-purple-400",
};

interface HeaderConsoleProps {
  doc: WorkbenchDocument;
  activeDimFilter: HighlightDimensionKey | null;
  paretoMode: boolean;
  firstPassMode?: boolean;
  fuzzyOnlyMode?: boolean;
  fuzzyOrConfusedCount?: number;
  autoHideHeader?: boolean;
  hideSecondary?: boolean;
  hideNotes?: boolean;
  onToggleDim: (dim: HighlightDimensionKey) => void;
  onTogglePareto: () => void;
  onToggleFirstPass?: () => void;
  onToggleFuzzyOnly?: () => void;
  onOpenLibrary: () => void;
  onOpenStudio: () => void;
  onOpenSettings: () => void;
}

export function HeaderConsole({
  doc,
  activeDimFilter,
  paretoMode,
  firstPassMode = false,
  fuzzyOnlyMode = false,
  fuzzyOrConfusedCount = 0,
  autoHideHeader = true,
  hideSecondary = false,
  hideNotes = false,
  onToggleDim,
  onTogglePareto,
  onToggleFirstPass,
  onToggleFuzzyOnly,
  onOpenLibrary,
  onOpenStudio,
  onOpenSettings,
}: HeaderConsoleProps) {
  const [barVisible, setBarVisible] = useState(true);
  const [tocOpen, setTocOpen] = useState(false);
  const lastScrollYRef = useRef(0);
  const tocRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!autoHideHeader) {
      setBarVisible(true);
      return;
    }

    const onScroll = () => {
      const currentY = window.scrollY || 0;
      const delta = currentY - lastScrollYRef.current;

      if (currentY < 80) {
        setBarVisible(true);
      } else if (delta > 8 && currentY > 120) {
        setBarVisible(false);
        setTocOpen(false);
      } else if (delta < -6) {
        setBarVisible(true);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoHideHeader]);

  useEffect(() => {
    if (!tocOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (tocRef.current && !tocRef.current.contains(e.target as Node)) {
        setTocOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [tocOpen]);

  const scrollToAnchor = (id: string) => {
    setTocOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hiddenViewCount = (hideSecondary ? 1 : 0) + (hideNotes ? 1 : 0);

  return (
    <>
      {/* Top-edge hover reveal zone when sticky bar is auto-hidden */}
      {autoHideHeader && !barVisible && (
        <div
          aria-hidden="true"
          onMouseEnter={() => setBarVisible(true)}
          className="fixed top-0 left-0 right-0 h-3 z-40 cursor-pointer"
          title="悬停显示顶部工具栏"
        />
      )}

      {/* Scheme A: Single-Line ~42px Smart Auto-Hiding Sticky Toolbar */}
      <header
        data-testid="sticky-toolbar"
        data-hidden={autoHideHeader && !barVisible ? "true" : "false"}
        className={`sticky top-0 z-30 bg-[#1a2744]/95 backdrop-blur-xs text-white border-b border-slate-700/70 shadow-sm transition-all duration-200 ${
          autoHideHeader && !barVisible
            ? "-translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        }`}
      >
        <div className="max-w-[1460px] mx-auto px-4 py-1.5 flex items-center justify-between gap-2 min-h-[42px]">
          {/* Left: Global Actions & Quick Section Jump */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="font-mono text-[11px] px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/15 cursor-pointer"
            >
              [文库]
            </button>
            <button
              type="button"
              onClick={onOpenStudio}
              className="font-mono text-[11px] px-2.5 py-1 rounded bg-blue-500 hover:bg-blue-400 text-white font-semibold cursor-pointer"
            >
              [+ 新建]
            </button>

            <div className="relative" ref={tocRef}>
              <button
                type="button"
                onClick={() => setTocOpen((p) => !p)}
                className="font-mono text-[11px] px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/15 cursor-pointer"
              >
                [章节目录 v]
              </button>
              {tocOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 max-h-[70vh] overflow-y-auto rounded-lg bg-[#fffdf8] text-[#1a2744] border border-[#ddd6c7] shadow-xl p-1.5 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setTocOpen(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full text-left font-mono text-[11px] px-2.5 py-1.5 rounded hover:bg-[#efeae0] font-semibold cursor-pointer"
                  >
                    [回到顶部 · 文档标题区]
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor("mental-model")}
                    className="w-full text-left font-mono text-[11px] px-2.5 py-1.5 rounded hover:bg-[#efeae0] cursor-pointer"
                  >
                    {doc.labels.mentalNavLabel}
                  </button>
                  <div className="my-1 border-t border-[#e8e1d3]" />
                  {doc.sections.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => scrollToAnchor(sec.id)}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-[#efeae0] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="truncate">{sec.navLabel}</span>
                      {sec.navRole && (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#e6dfd1] text-slate-700 shrink-0">
                          {sec.navRole}
                        </span>
                      )}
                    </button>
                  ))}
                  <div className="my-1 border-t border-[#e8e1d3]" />
                  <button
                    type="button"
                    onClick={() => scrollToAnchor("bottom-arsenal")}
                    className="w-full text-left font-mono text-[11px] px-2.5 py-1.5 rounded hover:bg-[#efeae0] font-semibold cursor-pointer"
                  >
                    {doc.labels.bottomNavLabel}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Center: High-Frequency Dimensions & Reading Scope Filters */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 min-w-0">
            {doc.dimensions.map((dim) => {
              const active = activeDimFilter === dim.key;
              return (
                <button
                  key={dim.key}
                  type="button"
                  onClick={() => onToggleDim(dim.key)}
                  title={dim.extractionRule}
                  className={`font-mono text-[11px] px-2 py-0.5 rounded border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    PILL_ACCENT[dim.colorSlot]
                  } ${
                    active
                      ? "bg-white text-[#1a2744] border-white font-semibold"
                      : "bg-white/8 text-slate-100 border-white/20 hover:bg-white/15"
                  }`}
                >
                  {dim.label}
                </button>
              );
            })}

            <span className="h-4 w-px bg-white/20 mx-1 shrink-0" aria-hidden="true" />

            <button
              type="button"
              onClick={onTogglePareto}
              className={`font-mono text-[11px] px-2 py-0.5 rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                paretoMode
                  ? "bg-amber-300 text-[#1a2744] border-amber-200 font-semibold"
                  : "bg-white/8 text-slate-100 border-white/20 hover:bg-white/15"
              }`}
            >
              {doc.labels.paretoButton}
            </button>
            {onToggleFirstPass && (
              <button
                type="button"
                onClick={onToggleFirstPass}
                className={`font-mono text-[11px] px-2 py-0.5 rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                  firstPassMode
                    ? "bg-sky-300 text-[#1a2744] border-sky-200 font-semibold"
                    : "bg-white/8 text-slate-100 border-white/20 hover:bg-white/15"
                }`}
              >
                [第一遍路径]
              </button>
            )}
            {onToggleFuzzyOnly && (
              <button
                type="button"
                onClick={onToggleFuzzyOnly}
                className={`font-mono text-[11px] px-2 py-0.5 rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                  fuzzyOnlyMode
                    ? "bg-rose-300 text-[#1a2744] border-rose-200 font-semibold"
                    : "bg-white/8 text-slate-100 border-white/20 hover:bg-white/15"
                }`}
              >
                {`[只看模糊与不懂${fuzzyOrConfusedCount > 0 ? ` (${fuzzyOrConfusedCount})` : ""}]`}
              </button>
            )}
          </div>

          {/* Right: Unified Settings & Export Modal Trigger */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenSettings}
              className="font-mono text-[11px] px-2.5 py-1 rounded bg-white/12 hover:bg-white/22 border border-white/20 cursor-pointer whitespace-nowrap"
            >
              {`[设置与导出${hiddenViewCount > 0 ? ` · ${hiddenViewCount}隐藏` : ""}]`}
            </button>
          </div>
        </div>
      </header>

      {/* Non-Sticky Document Hero: Scrolls away naturally to maximize reading space */}
      <div
        data-testid="document-hero"
        className="bg-[#1a2744] text-white border-b border-slate-700/60 px-5 py-4"
      >
        <div className="max-w-[1460px] mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-blue-200 border border-white/15">
              {doc.modeName}
            </span>
            {doc.badges.map((badge, idx) => (
              <span
                key={idx}
                className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900/40 text-slate-200 border border-white/10"
              >
                {badge}
              </span>
            ))}
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/8 text-amber-200 border border-white/10">
              {`${doc.units.length} 精读单元 | ${doc.sections.length} 章节`}
            </span>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-white">
            {doc.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">{doc.subtitle}</p>
        </div>
      </div>
    </>
  );
}
