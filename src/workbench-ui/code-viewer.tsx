"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  ColorSlot,
  DimensionSpec,
  HighlightDimensionKey,
  HighlightSpan,
} from "@/core/contracts/document-ast";

const HIGHLIGHT_CLASSES: Record<ColorSlot, string> = {
  yellow: "bg-amber-300/35 text-inherit border-b border-amber-500/70",
  red: "bg-rose-400/25 text-inherit border-b-2 border-dashed border-rose-500 cursor-help",
  blue: "bg-blue-400/25 text-inherit border-b border-blue-500/70",
  green: "bg-emerald-400/25 text-inherit border-b border-emerald-500/70",
  purple: "bg-purple-400/25 text-inherit border-b border-purple-500/70",
};

interface CodeViewerProps {
  code: string;
  language?: string;
  filePath?: string;
  highlights: HighlightSpan[];
  dimensions: DimensionSpec[];
  activeDimFilter: HighlightDimensionKey | null;
  onHoverTooltip: (text: string, x: number, y: number) => void;
  onLeaveTooltip: () => void;
}

interface HighlightSegment {
  text: string;
  span?: HighlightSpan;
}

function segmentTextByHighlights(text: string, highlights: HighlightSpan[]): HighlightSegment[] {
  if (!highlights || highlights.length === 0) return [{ text }];

  interface MatchPos {
    start: number;
    end: number;
    span: HighlightSpan;
  }

  const matches: MatchPos[] = [];
  for (const span of highlights) {
    if (!span.text) continue;
    const idx = text.indexOf(span.text);
    if (idx === -1) continue;
    const overlaps = matches.some((m) => !(idx + span.text.length <= m.start || idx >= m.end));
    if (!overlaps) {
      matches.push({ start: idx, end: idx + span.text.length, span });
    }
  }

  matches.sort((a, b) => a.start - b.start);
  const out: HighlightSegment[] = [];
  let cursor = 0;

  for (const m of matches) {
    if (m.start > cursor) {
      out.push({ text: text.slice(cursor, m.start) });
    }
    out.push({ text: text.slice(m.start, m.end), span: m.span });
    cursor = m.end;
  }

  if (cursor < text.length) {
    out.push({ text: text.slice(cursor) });
  }
  return out;
}

export function CodeViewer({
  code,
  language = "typescript",
  filePath,
  highlights,
  dimensions,
  activeDimFilter,
  onHoverTooltip,
  onLeaveTooltip,
}: CodeViewerProps) {
  const [shikiHtml, setShikiHtml] = useState<string | null>(null);
  const [showPlainHighlighted, setShowPlainHighlighted] = useState(highlights.length > 0);

  const dimSlotMap = useMemo(() => {
    const map: Record<string, ColorSlot> = {};
    dimensions.forEach((d) => {
      map[d.key] = d.colorSlot;
    });
    return map;
  }, [dimensions]);

  useEffect(() => {
    let cancelled = false;
    async function highlightWithShiki() {
      try {
        const { codeToHtml } = await import("shiki");
        const safeLang =
          ["go", "typescript", "tsx", "javascript", "jsx", "python", "rust", "lua", "sql", "bash", "yaml", "json"].includes(
            language.toLowerCase()
          )
            ? language.toLowerCase()
            : "typescript";
        const html = await codeToHtml(code, {
          lang: safeLang,
          theme: "github-dark",
        });
        if (!cancelled) setShikiHtml(html);
      } catch {
        if (!cancelled) setShikiHtml(null);
      }
    }
    void highlightWithShiki();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const segments = useMemo(() => segmentTextByHighlights(code, highlights), [code, highlights]);

  return (
    <div className="rounded-lg border border-slate-700/80 bg-[#0d1117] overflow-hidden text-slate-100">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-slate-700/80 text-[11px] font-mono text-slate-300">
        <span className="truncate">{filePath || `source.${language}`}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="uppercase text-slate-400">{language}</span>
          {shikiHtml && highlights.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPlainHighlighted((v) => !v)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] text-slate-200 cursor-pointer"
            >
              {showPlainHighlighted ? "[切换语法着色视图]" : "[切换 5维批注高亮视图]"}
            </button>
          )}
        </div>
      </div>

      {!showPlainHighlighted && shikiHtml ? (
        <div
          className="p-3.5 overflow-x-auto text-[12.5px] leading-relaxed font-mono [&>pre]:!bg-transparent [&>pre]:!m-0"
          dangerouslySetInnerHTML={{ __html: shikiHtml }}
        />
      ) : (
        <pre className="p-3.5 overflow-x-auto text-[12.5px] leading-relaxed font-mono m-0 whitespace-pre">
          <code>
            {segments.map((seg, i) => {
              if (!seg.span) return <React.Fragment key={i}>{seg.text}</React.Fragment>;
              const dim = seg.span.dim;
              const isDimmedOut = activeDimFilter !== null && activeDimFilter !== dim;
              const slot = dimSlotMap[dim] ?? "yellow";
              const hlClass = isDimmedOut ? "opacity-55" : HIGHLIGHT_CLASSES[slot];

              return (
                <span
                  key={i}
                  className={`rounded px-0.5 transition-opacity ${hlClass}`}
                  onMouseMove={(e) => {
                    if (seg.span?.tooltip) {
                      onHoverTooltip(seg.span.tooltip, e.clientX, e.clientY);
                    }
                  }}
                  onMouseLeave={onLeaveTooltip}
                >
                  {seg.text}
                </span>
              );
            })}
          </code>
        </pre>
      )}
    </div>
  );
}
