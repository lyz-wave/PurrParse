"use client";

import React, { useMemo, useState } from "react";
import type {
  ColorSlot,
  DimensionSpec,
  HighlightDimensionKey,
  HighlightSpan,
  UnderstandingStatus,
  UnitQaThread,
  WorkbenchDocument,
  WorkbenchUnit,
} from "@/core/contracts/document-ast";
import type { PureLangMode } from "@/store/workbench-store";
import { StreamingResponse } from "@/components/ui/streaming-response";
import { CodeViewer } from "./code-viewer";
import { DisplayFormula, MathText } from "./math-text";

const PROSE_HIGHLIGHT_MAP: Record<ColorSlot, string> = {
  yellow: "bg-amber-200/70 rounded px-0.5",
  red: "bg-rose-200/70 border-b-2 border-dashed border-rose-500 rounded px-0.5 cursor-help",
  blue: "bg-sky-200/70 rounded px-0.5",
  green: "bg-emerald-200/70 rounded px-0.5",
  purple: "bg-purple-200/70 rounded px-0.5",
};

interface HighlightSegment {
  text: string;
  span?: HighlightSpan;
  qaThreadId?: string;
}

function splitProseByHighlights(
  text: string,
  highlights: HighlightSpan[],
  qaThreads: UnitQaThread[] = []
): HighlightSegment[] {
  interface Hit {
    start: number;
    end: number;
    span?: HighlightSpan;
    qaThreadId?: string;
  }
  const hits: Hit[] = [];

  for (const thread of qaThreads) {
    const snippet = thread.selectedText?.trim();
    if (!snippet || snippet.length < 3) continue;
    const idx = text.indexOf(snippet);
    if (idx === -1) continue;
    const overlaps = hits.some((h) => !(idx + snippet.length <= h.start || idx >= h.end));
    if (!overlaps) {
      hits.push({ start: idx, end: idx + snippet.length, qaThreadId: thread.id });
    }
  }

  for (const span of highlights ?? []) {
    if (!span.text) continue;
    const idx = text.indexOf(span.text);
    if (idx === -1) continue;
    const overlaps = hits.some((h) => !(idx + span.text.length <= h.start || idx >= h.end));
    if (!overlaps) hits.push({ start: idx, end: idx + span.text.length, span });
  }

  if (hits.length === 0) return [{ text }];
  hits.sort((a, b) => a.start - b.start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) segments.push({ text: text.slice(cursor, hit.start) });
    segments.push({
      text: text.slice(hit.start, hit.end),
      span: hit.span,
      qaThreadId: hit.qaThreadId,
    });
    cursor = hit.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

export function isFailedTranslationUnit(unit: WorkbenchUnit): boolean {
  const txt = unit.secondaryBlockText || "";
  return /(?:该批次翻译生成失败|该批次请求异常|该批次未返回对应译文)/.test(txt);
}

interface DualColumnRowProps {
  unit: WorkbenchUnit;
  layoutRatio: [number, number];
  dimensions: DimensionSpec[];
  labels: WorkbenchDocument["labels"];
  activeDimFilter: HighlightDimensionKey | null;
  hideSecondary: boolean;
  hideNotes: boolean;
  pureMode?: boolean;
  pureLang?: PureLangMode;
  isFlashed: boolean;
  isBlurred?: boolean;
  understandingStatus?: UnderstandingStatus;
  predictionAnswer?: string;
  notesUnlocked?: boolean;
  userNote: string;
  onUserNoteChange: (note: string) => void;
  onUnderstandingChange?: (status: UnderstandingStatus) => void;
  onPredictionChange?: (text: string) => void;
  onUnlockNotes?: () => void;
  onJumpToUnit: (targetId: string, originId: string) => void;
  onHoverTooltip: (text: string, x: number, y: number) => void;
  onLeaveTooltip: () => void;
  qaThreads?: UnitQaThread[];
  onOpenSelectionQa?: (payload: {
    unitId: string;
    unitCode: string;
    selectedText: string;
    x: number;
    y: number;
    activeThreadId?: string;
  }) => void;
  onDeleteQaThread?: (threadId: string) => void;
  isRetryingUnit?: boolean;
  failedUnitsCount?: number;
  isRetryingAllFailed?: boolean;
  retryError?: string | null;
  onRetryUnit?: () => void;
  onRetryAllFailed?: () => void;
}

const UNDERSTANDING_OPTIONS: Array<{
  key: UnderstandingStatus;
  label: string;
  activeCls: string;
}> = [
  { key: "understood", label: "懂了", activeCls: "bg-emerald-600 text-white border-emerald-600" },
  { key: "fuzzy", label: "模糊", activeCls: "bg-amber-500 text-white border-amber-500" },
  { key: "confused", label: "不懂", activeCls: "bg-rose-600 text-white border-rose-600" },
  { key: "unmarked", label: "未标", activeCls: "bg-slate-200 text-slate-800 border-slate-300" },
];

export function DualColumnRow({
  unit,
  layoutRatio,
  dimensions,
  labels,
  activeDimFilter,
  hideSecondary,
  hideNotes,
  pureMode = false,
  pureLang = "original",
  isFlashed,
  isBlurred = false,
  understandingStatus = "unmarked",
  predictionAnswer = "",
  notesUnlocked,
  userNote,
  onUserNoteChange,
  onUnderstandingChange,
  onPredictionChange,
  onUnlockNotes,
  onJumpToUnit,
  onHoverTooltip,
  onLeaveTooltip,
  qaThreads = [],
  onOpenSelectionQa,
  onDeleteQaThread,
  isRetryingUnit = false,
  failedUnitsCount = 0,
  isRetryingAllFailed = false,
  retryError = null,
  onRetryUnit,
  onRetryAllFailed,
}: DualColumnRowProps) {
  const [noteOpen, setNoteOpen] = useState(Boolean(userNote));
  const [localPrediction, setLocalPrediction] = useState(predictionAnswer);
  const [localUnlocked, setLocalUnlocked] = useState(false);

  const qaCount = qaThreads.reduce(
    (sum, thread) => sum + 1 + (thread.followUps?.length ?? 0),
    0
  );
  const [qaDrawerOpen, setQaDrawerOpen] = useState(qaCount > 0);
  const hasQa = qaCount > 0;

  React.useEffect(() => {
    if (qaCount > 0) {
      setQaDrawerOpen(true);
    }
  }, [qaCount]);

  const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (!onOpenSelectionQa) return;
    const rawSelection =
      typeof window !== "undefined" ? window.getSelection()?.toString().trim() ?? "" : "";
    e.preventDefault();
    onOpenSelectionQa({
      unitId: unit.id,
      unitCode: unit.unitCode,
      selectedText: rawSelection || unit.primaryText.slice(0, 140),
      x: e.clientX,
      y: e.clientY,
    });
  };

  const isCoreGated = Boolean(
    unit.weight === "core" && unit.predictPrompt && unit.notes.length > 0 && !(notesUnlocked || localUnlocked)
  );
  const displayPrediction = onPredictionChange ? predictionAnswer : localPrediction;

  const dimSlotMap = useMemo(() => {
    const map: Record<string, ColorSlot> = {};
    dimensions.forEach((d) => {
      map[d.key] = d.colorSlot;
    });
    return map;
  }, [dimensions]);

  const showNotes = !hideNotes && !pureMode;
  const showSecondary = !hideSecondary && !pureMode;
  const useChinesePure =
    pureMode && pureLang === "chinese" && Boolean(unit.secondaryBlockText?.trim());
  const activePureText = useChinesePure ? unit.secondaryBlockText : unit.primaryText;

  const proseSegments = useMemo(
    () =>
      unit.primaryKind === "prose" || useChinesePure
        ? splitProseByHighlights(activePureText, pureMode ? [] : unit.highlights, qaThreads)
        : [],
    [unit.primaryKind, useChinesePure, activePureText, unit.highlights, qaThreads, pureMode]
  );

  const gridStyle: React.CSSProperties | undefined = !showNotes
    ? undefined
    : { gridTemplateColumns: `minmax(0, ${layoutRatio[0]}fr) minmax(0, ${layoutRatio[1]}fr)` };

  const borderWeightClass = pureMode
    ? ""
    : unit.weight === "core"
      ? "border-l-4 border-l-[#1a2744]"
      : unit.weight === "support"
        ? "border-l-4 border-l-amber-500/80"
        : "border-l-4 border-l-slate-300";

  return (
    <article
      id={unit.id}
      data-weight={unit.weight}
      data-qa-count={qaCount}
      onContextMenu={handleContextMenu}
      style={gridStyle}
      className={`group relative scroll-mt-28 transition-all ${
        pureMode
          ? `rounded-xl px-3 sm:px-5 py-3.5 mb-2 border ${
              isFlashed
                ? "border-2 border-blue-600 ring-2 ring-blue-500/30"
                : hasQa
                  ? "border-dashed border-[#1a2744]/60"
                  : "border-transparent hover:border-[#e5dfd2]/70"
            }`
          : `prism-editorial-card rounded-2xl p-5 sm:p-6 mb-5 grid grid-cols-1 lg:grid-cols-1 gap-6 ${borderWeightClass} ${
              isFlashed
                ? "border-2 border-blue-600 ring-2 ring-blue-500/40"
                : hasQa
                  ? "border-2 border-dashed border-[#1a2744]/80"
                  : "border border-[#ddd6c7]"
            } ${showNotes ? "lg:grid" : ""}`
      } ${isBlurred ? "blur-xs select-none pointer-events-none opacity-65" : ""}`}
    >
      {hasQa && (
        <button
          type="button"
          data-testid={`qa-corner-badge-${unit.id}`}
          onClick={() => setQaDrawerOpen((prev) => !prev)}
          className="prism-on-dark absolute -top-3 right-5 z-10 font-mono text-[11px] font-semibold px-3 py-0.5 rounded-full bg-[#1a2744] text-amber-200 border border-[#ddd6c7] shadow-sm cursor-pointer hover:bg-[#24365c] transition-colors"
          title="点击展开或收起本段 AI 追问与证据记录"
        >
          {`[已追问 ${qaCount} 次]`}
        </button>
      )}
      {/* Left Column: Primary Evidence (Prose or Code) + Formulas + Secondary Translation */}
      <div className="min-w-0">
        <div
          className={`flex flex-wrap items-center justify-between gap-2 ${
            pureMode
              ? "mb-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150"
              : "mb-3.5"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-semibold text-[#1a2744]">{unit.unitCode}</span>
            {!pureMode && (
              <span
                className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full uppercase ${
                  unit.weight === "core"
                    ? "prism-on-dark bg-[#1a2744] text-white font-semibold"
                    : unit.weight === "transition"
                      ? "bg-slate-200/80 text-slate-700"
                      : "bg-amber-100 text-amber-900"
                }`}
              >
                {unit.weight === "core" ? "CORE 20%" : unit.weight}
              </span>
            )}
            {!pureMode && unit.firstPassRecommended && (
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                PASS 1
              </span>
            )}
            {!pureMode && (
              <span className="text-xs sm:text-sm text-slate-600 font-medium">
                <MathText text={unit.tldr} />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0" aria-label="理解度自评">
            {onOpenSelectionQa && (
              <button
                type="button"
                onClick={(e) => {
                  const rawSelection =
                    typeof window !== "undefined"
                      ? window.getSelection()?.toString().trim() ?? ""
                      : "";
                  onOpenSelectionQa({
                    unitId: unit.id,
                    unitCode: unit.unitCode,
                    selectedText: rawSelection || unit.primaryText.slice(0, 140),
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                className="inline-flex items-center gap-1 font-mono text-[10.5px] font-medium px-2.5 py-0.5 rounded-full border border-[#1a2744]/35 bg-amber-50/70 text-[#1a2744] hover:bg-amber-100 cursor-pointer transition-colors mr-1"
                title="左键划选正文或点击此处向 AI 提问"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>AI 追问</span>
              </button>
            )}
            {UNDERSTANDING_OPTIONS.map((opt) => {
              const active = understandingStatus === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onUnderstandingChange?.(opt.key)}
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    active
                      ? opt.activeCls
                      : "bg-[#fcfbf8] text-slate-500 border-[#ddd6c7] hover:border-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {unit.primaryKind === "code" && !useChinesePure ? (
          <CodeViewer
            code={unit.primaryText}
            language={unit.codeLanguage}
            filePath={unit.filePath}
            highlights={pureMode ? [] : unit.highlights}
            dimensions={dimensions}
            activeDimFilter={activeDimFilter}
            onHoverTooltip={onHoverTooltip}
            onLeaveTooltip={onLeaveTooltip}
          />
        ) : (
          <div
            className={`font-serif text-[#1c222d] whitespace-pre-wrap ${
              pureMode ? "text-[17.5px] leading-[1.9]" : "text-[16px] leading-[1.78]"
            }`}
          >
            {proseSegments.map((seg, idx) => {
              if (seg.qaThreadId) {
                const matchedThread = qaThreads.find((t) => t.id === seg.qaThreadId);
                return (
                  <span
                    key={idx}
                    onClick={(e) => {
                      if (matchedThread && onOpenSelectionQa) {
                        onOpenSelectionQa({
                          unitId: unit.id,
                          unitCode: unit.unitCode,
                          selectedText: matchedThread.selectedText,
                          x: e.clientX,
                          y: e.clientY,
                          activeThreadId: matchedThread.id,
                        });
                      } else {
                        setQaDrawerOpen(true);
                      }
                    }}
                    title="已对该片段发起 AI 追问（点击查看/继续追问）"
                    className="border border-dashed border-[#1a2744] bg-amber-50/90 text-[#1a2744] rounded px-1 py-0.5 cursor-pointer hover:bg-amber-100/90"
                  >
                    <MathText text={seg.text} />
                  </span>
                );
              }
              if (!seg.span) return <MathText key={idx} text={seg.text} />;
              const dim = seg.span.dim;
              const isDimmedOut = activeDimFilter !== null && activeDimFilter !== dim;
              const slot = dimSlotMap[dim] ?? "yellow";
              const hlClass = isDimmedOut ? "opacity-55" : PROSE_HIGHLIGHT_MAP[slot];
              return (
                <span
                  key={idx}
                  className={hlClass}
                  onMouseMove={(e) => {
                    if (seg.span?.tooltip) onHoverTooltip(seg.span.tooltip, e.clientX, e.clientY);
                  }}
                  onMouseLeave={onLeaveTooltip}
                >
                  <MathText text={seg.text} />
                </span>
              );
            })}
          </div>
        )}

        {unit.formulas && unit.formulas.length > 0 && (
          <div className="mt-3 space-y-2">
            {unit.formulas.map((f, idx) => (
              <div
                key={idx}
                className="bg-slate-50 border border-blue-200/80 rounded-lg px-3.5 py-2.5"
              >
                {f.latex && <DisplayFormula latex={f.latex} />}
                {f.flowText && (
                  <div className="font-mono text-xs text-[#1a2744] mt-1 break-all">
                    <span className="font-semibold mr-1.5">
                      {f.flowLabel ?? "TENSOR / STATE FLOW"}:
                    </span>
                    {f.flowText}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {unit.figures && unit.figures.length > 0 && (
          <div className="mt-3.5 space-y-3">
            {unit.figures.map((fig, fIdx) => (
              <figure
                key={fIdx}
                className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-lg p-3 shadow-2xs"
              >
                {fig.imageUrls && fig.imageUrls.length > 0 ? (
                  <div
                    className={`grid gap-2.5 items-center ${
                      fig.imageUrls.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    {fig.imageUrls.map((url, uIdx) => (
                      <a
                        key={uIdx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="点击在新标签页查看高清原图"
                        className="block bg-white border border-[#e5dfd2] rounded p-2 hover:border-[#1a2744]/40 transition-colors"
                      >
                        <img
                          src={url}
                          alt={fig.caption || `Figure ${fIdx + 1}`}
                          loading="lazy"
                          className="max-h-[420px] w-auto mx-auto object-contain"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="font-mono text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200 rounded px-2.5 py-1.5 mb-2">
                    [原图锚点 · 当前输入源为纯文本/PDF提取，可对照原文献查看图像]
                  </div>
                )}
                {fig.caption && (
                  <figcaption className="mt-2 text-xs text-slate-700 font-serif leading-relaxed text-center">
                    <MathText text={fig.caption} />
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        {unit.dataTable && (
          <div className="mt-3 overflow-x-auto border border-[#ddd6c7] rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f3efe6] text-[#1a2744] font-mono">
                <tr>
                  {unit.dataTable.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 border-b border-[#ddd6c7]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unit.dataTable.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="border-b last:border-b-0 border-[#ebe5d8]">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 text-slate-700">
                        <MathText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unit.calloutList && (
          <div className="mt-3 bg-[#fcfaf6] border border-[#ddd6c7] rounded-lg p-3 text-sm">
            <div className="font-mono text-xs font-semibold text-[#1a2744] mb-1.5">
              {unit.calloutList.title}
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              {unit.calloutList.items.map((item, idx) => (
                <li key={idx}>
                  <MathText text={item} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {showSecondary && unit.secondaryBlockText && (() => {
          const isFailedTranslation = isFailedTranslationUnit(unit);
          const busy = isRetryingUnit || isRetryingAllFailed;
          return (
            <div
              className={`prism-quote-block mt-4 rounded-r-xl px-4 py-3 text-sm leading-relaxed italic font-serif ${
                isFailedTranslation ? "border-l-rose-400 bg-rose-50/70" : ""
              }`}
            >
              <MathText text={unit.secondaryBlockText} />
              {isFailedTranslation && onRetryUnit && (
                <div className="mt-2.5 not-italic font-sans flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onRetryUnit}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-white px-3 py-1 font-mono text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-55 cursor-pointer disabled:cursor-wait transition-colors shadow-xs"
                  >
                    {isRetryingUnit ? "正在重译本段..." : "↻ 重试本段翻译"}
                  </button>
                  {failedUnitsCount > 1 && onRetryAllFailed && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onRetryAllFailed}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#1a2744]/20 bg-[#1a2744] px-3 py-1 font-mono text-xs font-medium text-white hover:bg-[#24365c] disabled:opacity-55 cursor-pointer disabled:cursor-wait transition-colors"
                    >
                      {isRetryingAllFailed
                        ? "正在批量重试..."
                        : `一键重试全部失败段 (${failedUnitsCount})`}
                    </button>
                  )}
                </div>
              )}
              {isFailedTranslation && retryError && (
                <p className="mt-1.5 not-italic font-sans text-xs text-rose-600">{retryError}</p>
              )}
            </div>
          );
        })()}

        {!pureMode && unit.transitionSummary && (
          <div className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <span className="font-mono font-semibold text-[#1a2744] mr-1.5">
              {labels.transitionPrefix}
            </span>
            <MathText text={unit.transitionSummary} />
          </div>
        )}
      </div>

      {/* Right Column: Prediction Gate / Compact Transition / Analysis Modules + Self-Explain + Personal Note */}
      {showNotes && (
        <div className="min-w-0 lg:border-l border-t lg:border-t-0 border-[#ddd6c7] lg:pl-6 pt-4 lg:pt-0 flex flex-col gap-3.5">
          {isCoreGated ? (
            <div className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-xl p-4 space-y-2.5">
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#1a2744]/10 text-[#1a2744]">
                核心段先猜后看 · 主动预测
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                <MathText text={unit.predictPrompt!} />
              </p>
              <textarea
                value={displayPrediction}
                onChange={(e) => {
                  if (onPredictionChange) onPredictionChange(e.target.value);
                  else setLocalPrediction(e.target.value);
                }}
                rows={2}
                placeholder="先写下你的判断或直觉推测（1-2句话），再核对右侧完整批注..."
                className="w-full rounded-lg border border-[#ddd6c7] bg-white px-3 py-2 text-xs text-slate-800"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLocalUnlocked(true);
                    onUnlockNotes?.();
                  }}
                  className="prism-on-dark font-mono text-xs px-3.5 py-1.5 rounded-full bg-[#1a2744] hover:bg-[#24365c] text-white font-medium cursor-pointer transition-colors"
                >
                  提交思考并展开批注
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalUnlocked(true);
                    onUnlockNotes?.();
                  }}
                  className="font-mono text-[11px] px-3 py-1.5 rounded-full border border-[#ddd6c7] bg-white hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
                >
                  直接展开批注
                </button>
              </div>
            </div>
          ) : unit.weight === "transition" && unit.transitionSummary ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed">
              <span className="font-mono font-semibold text-[#1a2744] mr-1.5 px-2 py-0.5 rounded-full bg-white border border-slate-200">
                TRANSITION
              </span>
              <MathText text={unit.transitionSummary} />
            </div>
          ) : (
            unit.notes.map((note, idx) => {
              const splitMatch = note.label.match(/^(\d{2})\s*\/\s*(.+)$/);
              const badgeNum = splitMatch?.[1];
              const cleanLabel = splitMatch?.[2] ?? note.label;
              return (
                <div key={idx} className="pb-3 border-b border-dashed border-[#e5dfd2] last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {badgeNum && (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#1a2744]/10 text-[#1a2744] shrink-0">
                          {badgeNum}
                        </span>
                      )}
                      <span className="font-mono text-[11.5px] font-semibold text-[#1a2744] truncate">
                        {cleanLabel}
                      </span>
                    </div>
                    {note.echoTargetId && (
                      <button
                        type="button"
                        onClick={() => onJumpToUnit(note.echoTargetId!, unit.id)}
                        className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 cursor-pointer transition-colors"
                      >
                        {note.echoLabel ?? "跳转关联锚点"}
                      </button>
                    )}
                  </div>
                  <div className="text-[13.5px] leading-relaxed text-slate-700">
                    <MathText text={note.body} />
                  </div>
                  {note.calloutBox && (
                    <div className="mt-2.5 bg-amber-50/90 border-l-3 border-amber-600 px-3 py-2 text-xs text-amber-950 rounded-r-lg">
                      <MathText text={note.calloutBox} />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {!isCoreGated && unit.weight !== "transition" && unit.misconceptionCallout && (
            <div className="bg-rose-50/85 border-l-3 border-rose-500 px-3 py-2 text-xs text-rose-950 rounded-r-lg">
              <span className="font-mono font-semibold mr-1.5">[易误解]</span>
              <MathText text={unit.misconceptionCallout.replace(/^\s*\[易误解\]\s*:?\s*/, "")} />
            </div>
          )}

          {!isCoreGated && unit.weight !== "transition" && unit.selfExplainPrompt && (
            <details className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-xl px-3.5 py-2.5 text-xs">
              <summary className="cursor-pointer font-medium text-[#1a2744]">
                <span className="font-mono text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 mr-2">
                  为什么 · 自我解释
                </span>
                <MathText text={unit.selfExplainPrompt.question} />
              </summary>
              <div className="mt-2 pt-2 border-t border-dashed border-[#ddd6c7] text-slate-700 leading-relaxed">
                <MathText text={unit.selfExplainPrompt.answer} />
              </div>
            </details>
          )}

          <div className="pt-1">
            {!noteOpen ? (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="font-mono text-xs text-slate-600 hover:text-[#1a2744] underline cursor-pointer"
              >
                {labels.userNoteButton.replace(/^\[|\]$/g, "")}
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[11px] font-semibold text-[#1a2744]">
                    个人批注（自动保存）
                  </label>
                  <button
                    type="button"
                    onClick={() => setNoteOpen(false)}
                    className="font-mono text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    收起
                  </button>
                </div>
                <textarea
                  value={userNote}
                  onChange={(e) => onUserNoteChange(e.target.value)}
                  placeholder={labels.userNotePlaceholder}
                  rows={3}
                  className="w-full rounded-lg border border-[#ddd6c7] bg-[#fcfbf8] px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {hasQa && qaDrawerOpen && (
        <div
          data-testid={`qa-drawer-${unit.id}`}
          className="lg:col-span-2 border-t border-dashed border-[#1a2744]/40 pt-3.5 mt-1 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-[#1a2744]">
              [本段 AI 追问与原文证据链]（累计追问 {qaCount} 次）
            </span>
            <button
              type="button"
              onClick={() => setQaDrawerOpen(false)}
              className="font-mono text-[11px] text-slate-500 hover:text-[#1a2744] cursor-pointer"
            >
              [收起追问记录]
            </button>
          </div>

          <div className="space-y-3">
            {qaThreads.map((thread) => {
              const turnCount = 1 + (thread.followUps?.length ?? 0);
              return (
                <div
                  key={thread.id}
                  className="bg-white border border-dashed border-[#1a2744]/55 rounded-lg p-3.5 space-y-2.5 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#1a2744] text-amber-200">
                        [{thread.scope === "document" ? "全文跨节证据" : "本段上下文精讲"}]
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-950">
                        [追问 {turnCount} 次]
                      </span>
                      <span className="font-mono text-[11px] text-slate-600 truncate max-w-md">
                        片段: “{thread.selectedText}”
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {onOpenSelectionQa && (
                        <button
                          type="button"
                          onClick={(e) =>
                            onOpenSelectionQa({
                              unitId: unit.id,
                              unitCode: unit.unitCode,
                              selectedText: thread.selectedText,
                              x: e.clientX,
                              y: e.clientY,
                              activeThreadId: thread.id,
                            })
                          }
                          className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-950 border border-[#1a2744]/40 cursor-pointer"
                        >
                          [+ 继续追问]
                        </button>
                      )}
                      {onDeleteQaThread && (
                        <button
                          type="button"
                          onClick={() => onDeleteQaThread(thread.id)}
                          className="font-mono text-[11px] text-rose-700 hover:text-rose-900 cursor-pointer"
                        >
                          [删除]
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-[var(--prism-heading)]">
                    Q1: {thread.question}
                  </div>
                  <div className="text-[13px] leading-relaxed text-[var(--prism-ink)] bg-[var(--prism-surface-subtle)] rounded p-3 border border-[var(--prism-border)]">
                    <StreamingResponse
                      text={thread.answer}
                      status="done"
                      actions={false}
                      className="text-[13px] leading-relaxed"
                    />
                  </div>

                  {thread.evidences.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {thread.evidences.map((ev, eIdx) => (
                        <div
                          key={`${thread.id}-ev-${eIdx}`}
                          className="text-xs bg-[var(--prism-surface)] border border-dashed border-[var(--prism-border-strong)] rounded p-2 flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-bold text-[#1a2744]">
                              [证据 · {ev.unitCode}] {ev.rationale}
                            </span>
                            {ev.unitId && (
                              <button
                                type="button"
                                onClick={() => onJumpToUnit(ev.unitId!, unit.id)}
                                className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#1a2744] text-amber-200 hover:bg-[#24365c] cursor-pointer shrink-0"
                              >
                                [-&gt; 跳转]
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--prism-ink-muted)] italic">
                            <MathText text={ev.quote} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(thread.followUps ?? []).map((turn, tIdx) => (
                    <div
                      key={turn.id}
                      className="border-t border-dashed border-[var(--prism-border-strong)] pt-2.5 space-y-1.5"
                    >
                      <div className="text-xs font-semibold text-[var(--prism-heading)]">
                        Q{tIdx + 2}: {turn.question}
                      </div>
                      <div className="text-[13px] leading-relaxed text-[var(--prism-ink)] bg-[var(--prism-surface-subtle)] rounded p-2.5 border border-[var(--prism-border)]">
                        <StreamingResponse
                          text={turn.answer}
                          status="done"
                          actions={false}
                          className="text-[13px] leading-relaxed"
                        />
                      </div>
                      {turn.evidences.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {turn.evidences.map((ev, eIdx) => (
                            <div
                              key={`${turn.id}-ev-${eIdx}`}
                              className="text-xs bg-[var(--prism-surface)] border border-dashed border-[var(--prism-border-strong)] rounded p-2 flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[10px] font-bold text-[#1a2744]">
                                  [证据 · {ev.unitCode}] {ev.rationale}
                                </span>
                                {ev.unitId && (
                                  <button
                                    type="button"
                                    onClick={() => onJumpToUnit(ev.unitId!, unit.id)}
                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#1a2744] text-amber-200 hover:bg-[#24365c] cursor-pointer shrink-0"
                                  >
                                    [-&gt; 跳转]
                                  </button>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--prism-ink-muted)] italic">
                                <MathText text={ev.quote} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
