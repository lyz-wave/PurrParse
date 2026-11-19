"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { getTopbarGlassStyle, TopbarGlassBackdrop } from "@/components/ui/fluid-orb";
import { RailToc, type RailTocItem } from "@/components/ui/rail-toc";
import type {
  ColorSlot,
  HighlightDimensionKey,
  WorkbenchDocument,
} from "@/core/contracts/document-ast";
import type { ReadingDepthMode, WorkbenchThemeMode } from "@/store/workbench-store";
import { isMacDesktopRuntime } from "./desktop-runtime";

const COLOR_DOT: Record<ColorSlot, string> = {
  yellow: "bg-amber-400",
  red: "bg-rose-400",
  blue: "bg-blue-400",
  green: "bg-emerald-400",
  purple: "bg-purple-400",
};

const THEME_CYCLE_ORDER: WorkbenchThemeMode[] = ["paper", "aurora", "studio"];
const THEME_LABELS: Record<WorkbenchThemeMode, string> = {
  paper: "稿纸",
  aurora: "夜空",
  studio: "纯白",
};

const DEPTH_OPTIONS: Array<{
  key: ReadingDepthMode;
  label: string;
  headline: string;
  description: string;
}> = [
  {
    key: "pure",
    label: "通读",
    headline: "通读 · 纯净书页长卷",
    description:
      "隐藏双栏拆解、高亮与顶部脚手架，只留单栏居中长卷沉浸阅读（支持中/英切换，按 Esc 退回精读）。",
  },
  {
    key: "workbench",
    label: "精读",
    headline: "精读 · 双栏结构化工作台",
    description:
      "展示原文与 AI 解析双栏、五色高亮、导图与随手记，可随时划词向 AI 追问或标记掌握度。",
  },
  {
    key: "review",
    label: "复习",
    headline: "复习 · 疑点与追问错题本",
    description:
      "自动收起已掌握章节，仅保留你在精读中标为「模糊 / 不懂」或发起过「划词 AI 追问」的段落，集中二刷攻坚。",
  },
];

const SCOPE_FILTER_HINTS = {
  pareto:
    "仅保留权重为「核心（core）」的关键单元，过滤外围铺垫与背景胶水，用 20% 篇幅抓住 80% 主干价值。",
  firstPass:
    "仅显示「第一遍速览推荐路径」与核心骨架单元，适合先用 3~5 分钟搭起全局心智地图，不被细节卡住。",
  fuzzyOnly:
    "只筛选出你在精读中标为「模糊」或「不懂」的疑难段落，方便二刷时集中复习和划词追问攻坚。",
} as const;

function ScopeHelpBadge({ testId, text }: { testId: string; text: string }) {
  return (
    <span
      tabIndex={0}
      role="note"
      aria-label={text}
      data-testid={testId}
      onClick={(e) => e.stopPropagation()}
      className="group/tip shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-slate-400 hover:text-[#1a2744] hover:bg-[#efeae0] focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-help transition-colors"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
      <span
        role="tooltip"
        style={{ backgroundColor: "#0f172a", color: "#f8fafc" }}
        className="prism-on-dark pointer-events-none hidden group-hover/tip:block group-focus/tip:block absolute top-full mt-1.5 right-0 sm:top-1/2 sm:-translate-y-1/2 sm:mt-0 sm:right-full sm:mr-4 w-60 rounded-xl text-[11px] font-sans leading-relaxed px-3 py-2.5 shadow-2xl border border-white/15 z-60 text-left whitespace-normal"
      >
        {text}
      </span>
    </span>
  );
}

function formatShortDimLabel(label: string): string {
  return label.replace(/\s*[（(][^）)]*[）)]\s*$/u, "").trim() || label;
}

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
  themeMode?: WorkbenchThemeMode;
  readingDepthMode?: ReadingDepthMode;
  tasksPill?: React.ReactNode;
  hasAppUpdate?: boolean;
  onThemeChange?: (theme: WorkbenchThemeMode) => void;
  onReadingDepthChange?: (mode: ReadingDepthMode) => void;
  onToggleDim: (dim: HighlightDimensionKey) => void;
  onTogglePareto: () => void;
  onToggleFirstPass?: () => void;
  onToggleFuzzyOnly?: () => void;
  onOpenHome?: () => void;
  onOpenLibrary: (originEl?: HTMLElement | null) => void;
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
  themeMode = "paper",
  readingDepthMode = "workbench",
  tasksPill,
  hasAppUpdate = false,
  onThemeChange,
  onReadingDepthChange,
  onToggleDim,
  onTogglePareto,
  onToggleFirstPass,
  onToggleFuzzyOnly,
  onOpenHome,
  onOpenLibrary,
  onOpenStudio,
  onOpenSettings,
}: HeaderConsoleProps) {
  const [barVisible, setBarVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isMacDesktop, setIsMacDesktop] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredDepth, setHoveredDepth] = useState<ReadingDepthMode | null>(null);
  const lastScrollYRef = useRef(0);
  const tocRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const tocCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tocCloseTimerRef.current) window.clearTimeout(tocCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setIsMacDesktop(isMacDesktopRuntime());
  }, []);

  useEffect(() => {
    const updateTop = () => {
      setIsAtTop((window.scrollY || 0) < 24);
    };
    updateTop();
    window.addEventListener("scroll", updateTop, { passive: true });
    return () => window.removeEventListener("scroll", updateTop);
  }, []);

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
        setFilterOpen(false);
      } else if (delta < -6) {
        setBarVisible(true);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoHideHeader]);

  useEffect(() => {
    if (!tocOpen && !filterOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (tocOpen && tocRef.current && !tocRef.current.contains(target)) {
        setTocOpen(false);
      }
      if (filterOpen && filterRef.current && !filterRef.current.contains(target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [tocOpen, filterOpen]);

  const tocItems = useMemo<RailTocItem[]>(() => {
    return [
      { id: "__top__", label: "回到顶部 · 文档标题区", depth: 0 },
      {
        id: "mental-model",
        label: doc.labels.mentalNavLabel.replace(/^\[|\]$/g, ""),
        depth: 0,
      },
      ...doc.sections.map((sec) => ({
        id: sec.id,
        label: sec.navLabel,
        depth: 1,
        badge: sec.navRole || undefined,
      })),
      {
        id: "bottom-arsenal",
        label: doc.labels.bottomNavLabel.replace(/^\[|\]$/g, ""),
        depth: 0,
      },
    ];
  }, [doc]);

  const cycleTheme = () => {
    if (!onThemeChange) return;
    const idx = THEME_CYCLE_ORDER.indexOf(themeMode);
    const next = THEME_CYCLE_ORDER[(idx + 1) % THEME_CYCLE_ORDER.length];
    onThemeChange(next);
  };

  const hiddenViewCount = (hideSecondary ? 1 : 0) + (hideNotes ? 1 : 0);
  const activeFilterCount =
    (activeDimFilter ? 1 : 0) +
    (paretoMode ? 1 : 0) +
    (firstPassMode ? 1 : 0) +
    (fuzzyOnlyMode ? 1 : 0);

  // Structural mode accent palette (strictly derived from document properties, zero mode-ID coupling)
  const hasCodeUnits = doc.units.some((u) => u.primaryKind === "code");
  const hasComparisonDialect = !hasCodeUnits && Boolean(doc.topMentalModel.comparisonPair);
  const isDarkGlass = themeMode === "aurora";
  const heroGradientClass = hasCodeUnits
    ? "from-[#0f172a] via-[#132539] to-[#0f292e]"
    : hasComparisonDialect
      ? "from-[#2b1815] via-[#36201c] to-[#231b29]"
      : "from-[#142038] via-[#1a2744] to-[#1e355b]";
  const modePillAccentClass = hasCodeUnits
    ? "bg-teal-400/15 text-teal-200 border-teal-300/25"
    : hasComparisonDialect
      ? "bg-amber-400/15 text-amber-200 border-amber-300/25"
      : "bg-blue-400/15 text-blue-200 border-blue-300/25";

  const ghostBtnCls = isDarkGlass
    ? "text-slate-100 hover:text-white hover:bg-white/12"
    : "text-[#1a2744] hover:bg-[#1a2744]/8";
  const activeGhostBtnCls = isDarkGlass
    ? "bg-white/16 text-white"
    : "bg-[#1a2744]/12 text-[#1a2744]";

  const fogPrimary = hasCodeUnits
    ? "#0ea5e9"
    : hasComparisonDialect
      ? "#d97706"
      : undefined;
  const fogSecondary = hasCodeUnits ? "#14b8a6" : undefined;

  const isAutoHidden = autoHideHeader && !barVisible;

  return (
    <>
      {/* Top-edge hover reveal zone when web sticky bar is auto-hidden */}
      {!isMacDesktop && isAutoHidden && (
        <div
          aria-hidden="true"
          onMouseEnter={() => setBarVisible(true)}
          className="fixed top-0 left-0 right-0 h-3 z-40 cursor-pointer"
          title="悬停显示顶部工具栏"
        />
      )}

      {/* Minimalist Liquid Glass + FluidOrb Dynamic Fog Toolbar */}
      <header
        data-testid="sticky-toolbar"
        data-hidden={isAutoHidden ? "true" : "false"}
        data-mac-desktop={isMacDesktop ? "true" : "false"}
        style={getTopbarGlassStyle(themeMode)}
        onMouseEnter={() => {
          if (isAutoHidden) setBarVisible(true);
        }}
        className={`sticky top-0 z-30 border-b transition-all duration-200 ${
          isDarkGlass ? "text-slate-100" : "text-[#1a2744]"
        } ${
          isMacDesktop ? "electron-drag" : ""
        } ${
          !isMacDesktop && isAutoHidden
            ? "-translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        }`}
      >
        <TopbarGlassBackdrop
          themeMode={themeMode}
          primaryColor={fogPrimary}
          secondaryColor={fogSecondary}
        />
        <div
          className={`relative z-10 w-full max-w-[1640px] mx-auto px-4 py-1.5 flex items-center justify-between gap-4 min-h-[48px] ${
            isMacDesktop ? "pl-[84px]" : ""
          }`}
        >
          {/* Left: Global Library, New Import & Chapter Jump (Ghost minimalist controls) */}
          <div
            className={`flex items-center gap-1.5 shrink-0 electron-no-drag transition-opacity duration-150 ${
              isMacDesktop && isAutoHidden ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            {onOpenHome && (
              <button
                type="button"
                data-testid="home-nav-btn"
                onClick={onOpenHome}
                title="返回工作台主页"
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${ghostBtnCls}`}
              >
                <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5.5v-6h-5v6H4a1 1 0 01-1-1v-9.5z" />
                </svg>
                <span>主页</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => onOpenLibrary(e.currentTarget)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${ghostBtnCls}`}
            >
              <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              <span>文库</span>
            </button>

            <button
              type="button"
              onClick={onOpenStudio}
              className={`prism-on-dark inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-semibold shadow-xs cursor-pointer transition-colors ${
                isDarkGlass
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-[#1a2744] hover:bg-[#24365c] text-white"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>新建</span>
            </button>

            <div className="relative" ref={tocRef}>
              <button
                type="button"
                data-testid="header-toc-trigger"
                onClick={() => {
                  if (tocCloseTimerRef.current) window.clearTimeout(tocCloseTimerRef.current);
                  setTocOpen((p) => !p);
                }}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                  tocOpen ? activeGhostBtnCls : ghostBtnCls
                }`}
              >
                <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
                <span>章节目录</span>
                <svg
                  className={`w-3 h-3 opacity-70 transition-transform duration-150 ${
                    tocOpen ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              <AnimatePresence>
                {tocOpen && (
                  <motion.div
                    data-testid="header-toc-popover"
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    style={{
                      transformOrigin: "top left",
                      background: "var(--prism-surface, #fcf9f2)",
                      borderColor: "var(--prism-border, #ddd6c7)",
                    }}
                    className="prism-editorial-card absolute left-0 top-full mt-2 w-80 max-w-[88vw] max-h-[72vh] overflow-y-auto rounded-2xl border shadow-2xl p-3.5 z-50"
                  >
                    <RailToc
                      title="章节目录"
                      items={tocItems}
                      offset={84}
                      onItemSelect={() => {
                        if (tocCloseTimerRef.current) window.clearTimeout(tocCloseTimerRef.current);
                        tocCloseTimerRef.current = window.setTimeout(() => {
                          setTocOpen(false);
                        }, 420);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center: Spacious Drag Zone & Subtle Scrolled Document Title */}
          <div className="flex-1 min-w-0 flex items-center justify-center px-4 pointer-events-none">
            {(!isAtTop || (isMacDesktop && isAutoHidden)) && (
              <span
                className={`text-xs font-medium truncate max-w-[420px] ${
                  isDarkGlass ? "text-slate-100/90" : "text-[#1a2744]/85"
                }`}
              >
                {doc.title}
              </span>
            )}
          </div>

          {/* Right: Compact Filter Drawer, Reading Depth, Theme Cycle & Settings */}
          <div
            className={`flex items-center gap-1.5 shrink-0 electron-no-drag transition-opacity duration-150 ${
              isMacDesktop && isAutoHidden ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            {/* Compact filter popover so scrolled readers stay 1 click away from filters */}
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                data-testid="quick-filter-trigger"
                onClick={() => setFilterOpen((p) => !p)}
                title="快速切换维度高亮与聚焦筛选"
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                  activeFilterCount > 0 || filterOpen ? activeGhostBtnCls : ghostBtnCls
                }`}
              >
                <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <span>{activeFilterCount > 0 ? `筛选 · ${activeFilterCount}` : "筛选"}</span>
              </button>

              {filterOpen && (
                <div
                  data-testid="quick-filter-popover"
                  className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-[var(--prism-surface)] text-[var(--prism-ink)] border border-[var(--prism-border)] shadow-2xl p-3 z-50 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--prism-ink-muted)]">
                    <span>高亮维度筛选</span>
                    {activeDimFilter && (
                      <button
                        type="button"
                        onClick={() => onToggleDim(activeDimFilter)}
                        className="text-blue-600 hover:underline cursor-pointer"
                      >
                        清除
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {doc.dimensions.map((dim) => {
                      const active = activeDimFilter === dim.key;
                      return (
                        <button
                          key={dim.key}
                          type="button"
                          onClick={() => onToggleDim(dim.key)}
                          title={dim.extractionRule}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            active
                              ? "prism-on-dark bg-[#1a2744] text-white font-semibold"
                              : "hover:bg-[var(--prism-surface-muted)] text-[var(--prism-ink)]"
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_DOT[dim.colorSlot]}`} />
                            <span className="truncate">{dim.label}</span>
                          </span>
                          {active && <span className="font-mono text-[10px]">生效中</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-[var(--prism-border)] pt-2 space-y-1">
                    <div className="relative flex items-center gap-1">
                      <button
                        type="button"
                        onClick={onTogglePareto}
                        className={`flex-1 px-2.5 py-1.5 rounded-lg text-left text-xs font-mono cursor-pointer transition-colors ${
                          paretoMode
                            ? "bg-amber-100 text-amber-950 font-semibold"
                            : "hover:bg-[var(--prism-surface-muted)] text-[var(--prism-ink)]"
                        }`}
                      >
                        {doc.labels.paretoButton.replace(/^\[|\]$/g, "")}
                      </button>
                      <ScopeHelpBadge testId="scope-help-pareto" text={SCOPE_FILTER_HINTS.pareto} />
                    </div>
                    {onToggleFirstPass && (
                      <div className="relative flex items-center gap-1">
                        <button
                          type="button"
                          onClick={onToggleFirstPass}
                          className={`flex-1 px-2.5 py-1.5 rounded-lg text-left text-xs font-mono cursor-pointer transition-colors ${
                            firstPassMode
                              ? "bg-sky-100 text-sky-950 font-semibold"
                              : "hover:bg-[var(--prism-surface-muted)] text-[var(--prism-ink)]"
                          }`}
                        >
                          第一遍路径
                        </button>
                        <ScopeHelpBadge testId="scope-help-firstpass" text={SCOPE_FILTER_HINTS.firstPass} />
                      </div>
                    )}
                    {onToggleFuzzyOnly && (
                      <div className="relative flex items-center gap-1">
                        <button
                          type="button"
                          onClick={onToggleFuzzyOnly}
                          className={`flex-1 px-2.5 py-1.5 rounded-lg text-left text-xs font-mono cursor-pointer transition-colors ${
                            fuzzyOnlyMode
                              ? "bg-rose-100 text-rose-950 font-semibold"
                              : "hover:bg-[var(--prism-surface-muted)] text-[var(--prism-ink)]"
                          }`}
                        >
                          {`只看模糊与不懂${fuzzyOrConfusedCount > 0 ? ` (${fuzzyOrConfusedCount})` : ""}`}
                        </button>
                        <ScopeHelpBadge testId="scope-help-fuzzy" text={SCOPE_FILTER_HINTS.fuzzyOnly} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {onReadingDepthChange && (
              <div
                className="relative inline-flex items-center gap-1"
                onMouseLeave={() => setHoveredDepth(null)}
              >
                <div
                  data-testid="reading-depth-switcher"
                  role="group"
                  aria-label="阅读深度模式切换"
                  className={`inline-flex items-center rounded-full p-0.5 ${
                    isDarkGlass ? "bg-white/10" : "bg-[#1a2744]/8"
                  }`}
                >
                  {DEPTH_OPTIONS.map((opt) => {
                    const active = readingDepthMode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-label={`${opt.headline}：${opt.description}`}
                        onMouseEnter={() => setHoveredDepth(opt.key)}
                        onFocus={() => setHoveredDepth(opt.key)}
                        onBlur={() => setHoveredDepth(null)}
                        onClick={() => onReadingDepthChange(opt.key)}
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full cursor-pointer transition-all ${
                          active
                            ? isDarkGlass
                              ? "bg-amber-300 text-[#0f172a] font-semibold shadow-2xs"
                              : "prism-on-dark bg-[#1a2744] text-amber-200 font-semibold shadow-2xs"
                            : isDarkGlass
                              ? "text-slate-200 hover:text-white"
                              : "text-[#5a5347] hover:text-[#1a2744]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {hoveredDepth && (() => {
                  const targetOpt = DEPTH_OPTIONS.find((o) => o.key === hoveredDepth);
                  if (!targetOpt) return null;
                  return (
                    <div
                      role="tooltip"
                      data-testid="reading-depth-tooltip"
                      style={{ backgroundColor: "#0f172a", color: "#f8fafc" }}
                      className="prism-on-dark pointer-events-none absolute right-0 top-full mt-2.5 w-72 sm:w-80 rounded-xl px-3.5 py-3 shadow-2xl border border-white/15 z-60 text-left space-y-1"
                    >
                      <div className="font-mono text-[11px] font-semibold text-amber-300">
                        {targetOpt.headline}
                      </div>
                      <p className="text-[11px] text-slate-200 leading-relaxed">
                        {targetOpt.description}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {tasksPill}

            {onThemeChange && (
              <button
                type="button"
                data-testid="theme-switcher"
                onClick={cycleTheme}
                aria-label={`切换阅读主题（当前：${THEME_LABELS[themeMode]}）`}
                title={`当前主题：${THEME_LABELS[themeMode]}（点击循环切换 稿纸 / 夜空 / 纯白）`}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full cursor-pointer transition-colors ${ghostBtnCls}`}
              >
                {themeMode === "aurora" ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                ) : themeMode === "studio" ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenSettings}
              className={`relative inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${ghostBtnCls}`}
            >
              <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.25.4-1.51 1Z" />
              </svg>
              <span>{`设置与导出${hiddenViewCount > 0 ? ` · ${hiddenViewCount}隐藏` : ""}`}</span>
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

      {/* Non-Sticky Editorial Document Hero: Vertically continuous from unified top bar, hosting calm reader filters */}
      <div
        data-testid="document-hero"
        className={`prism-on-dark bg-gradient-to-b ${heroGradientClass} text-white border-b border-white/10 px-5 pt-4 pb-4`}
      >
        <div className="max-w-[1460px] mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className={`font-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border font-medium ${modePillAccentClass}`}>
              {doc.modeName}
            </span>
            {doc.badges.map((badge, idx) => (
              <span
                key={idx}
                className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-white/8 text-slate-200 border border-white/12"
              >
                {badge}
              </span>
            ))}
            <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-white/8 text-amber-200 border border-white/12">
              {`${doc.units.length} 精读单元 · ${doc.sections.length} 章节`}
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-[28px] font-semibold tracking-tight leading-snug text-white">
            {doc.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300/90 mt-1.5 max-w-4xl leading-relaxed">
            {doc.subtitle}
          </p>

          {/* Calm integrated filter & focus bar embedded at Hero bottom (wraps cleanly, zero scrollbar collision) */}
          <div
            data-testid="header-filter-strip"
            className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-1.5"
          >
            <span className="font-mono text-[11px] text-white/45 mr-1 select-none">精读筛选</span>
            {doc.dimensions.map((dim) => {
              const active = activeDimFilter === dim.key;
              return (
                <button
                  key={dim.key}
                  type="button"
                  onClick={() => onToggleDim(dim.key)}
                  title={`${dim.label} — ${dim.extractionRule}`}
                  className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-0.5 rounded-full cursor-pointer transition-all whitespace-nowrap ${
                    active
                      ? "bg-white text-[#1a2744] font-semibold shadow-xs"
                      : "bg-white/7 text-slate-200 hover:bg-white/14 hover:text-white"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${COLOR_DOT[dim.colorSlot]}`} />
                  <span>{formatShortDimLabel(dim.label)}</span>
                </button>
              );
            })}

            <span className="h-3.5 w-px bg-white/15 mx-1 shrink-0" aria-hidden="true" />

            <button
              type="button"
              onClick={onTogglePareto}
              title={SCOPE_FILTER_HINTS.pareto}
              className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full cursor-pointer whitespace-nowrap transition-colors ${
                paretoMode
                  ? "bg-amber-300 text-[#1a2744] font-semibold"
                  : "bg-white/7 text-slate-200 hover:bg-white/14 hover:text-white"
              }`}
            >
              {doc.labels.paretoButton.replace(/^\[|\]$/g, "")}
            </button>
            {onToggleFirstPass && (
              <button
                type="button"
                onClick={onToggleFirstPass}
                title={SCOPE_FILTER_HINTS.firstPass}
                className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full cursor-pointer whitespace-nowrap transition-colors ${
                  firstPassMode
                    ? "bg-sky-300 text-[#1a2744] font-semibold"
                    : "bg-white/7 text-slate-200 hover:bg-white/14 hover:text-white"
                }`}
              >
                第一遍路径
              </button>
            )}
            {onToggleFuzzyOnly && (
              <button
                type="button"
                onClick={onToggleFuzzyOnly}
                title={SCOPE_FILTER_HINTS.fuzzyOnly}
                className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full cursor-pointer whitespace-nowrap transition-colors ${
                  fuzzyOnlyMode
                    ? "bg-rose-300 text-[#1a2744] font-semibold"
                    : "bg-white/7 text-slate-200 hover:bg-white/14 hover:text-white"
                }`}
              >
                {`只看模糊与不懂${fuzzyOrConfusedCount > 0 ? ` (${fuzzyOrConfusedCount})` : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
