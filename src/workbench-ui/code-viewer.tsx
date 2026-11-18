"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  CodeBlock,
  PURRPARSE_CODE_ACCENTS,
  type CodeBlockLineContext,
  usePurrParseTheme,
} from "@/components/ui/code-block";
import type {
  ColorSlot,
  DimensionSpec,
  HighlightDimensionKey,
  HighlightSpan,
} from "@/core/contracts/document-ast";
import { cn } from "@/lib/utils";

const LIGHT_HIGHLIGHT_CLASSES: Record<ColorSlot, string> = {
  yellow: "bg-amber-300/35 text-inherit border-b border-amber-500/80",
  red: "bg-rose-400/25 text-inherit border-b-2 border-dashed border-rose-500 cursor-help",
  blue: "bg-sky-300/35 text-inherit border-b border-sky-500/75",
  green: "bg-emerald-300/35 text-inherit border-b border-emerald-500/75",
  purple: "bg-purple-300/35 text-inherit border-b border-purple-500/75",
};

const DARK_HIGHLIGHT_CLASSES: Record<ColorSlot, string> = {
  yellow: "bg-amber-400/22 text-inherit border-b border-amber-400/80",
  red: "bg-rose-500/25 text-inherit border-b-2 border-dashed border-rose-400 cursor-help",
  blue: "bg-sky-400/22 text-inherit border-b border-sky-400/80",
  green: "bg-emerald-400/22 text-inherit border-b border-emerald-400/80",
  purple: "bg-purple-400/25 text-inherit border-b border-purple-400/80",
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

interface MatchPos {
  start: number;
  end: number;
  span: HighlightSpan;
}

function findHighlightMatches(text: string, highlights: HighlightSpan[]): MatchPos[] {
  if (!highlights || highlights.length === 0) return [];

  const matches: MatchPos[] = [];
  for (const span of highlights) {
    if (!span.text) continue;
    const idx = text.indexOf(span.text);
    if (idx === -1) continue;
    const end = idx + span.text.length;
    const overlaps = matches.some((m) => !(end <= m.start || idx >= m.end));
    if (!overlaps) {
      matches.push({ start: idx, end, span });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

interface LineBound {
  start: number;
  end: number;
}

function computeLineBounds(text: string): LineBound[] {
  const lines = text.split("\n");
  const bounds: LineBound[] = [];
  let cursor = 0;
  for (const line of lines) {
    const start = cursor;
    const end = start + line.length;
    bounds.push({ start, end });
    cursor = end + 1;
  }
  return bounds;
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
  const [showDimHighlights, setShowDimHighlights] = useState(highlights.length > 0);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageTheme = usePurrParseTheme(viewerRef);
  const isDark = pageTheme === "aurora";

  const trimmedCode = useMemo(() => {
    const source = typeof code === "string" ? code : String(code ?? "");
    return source.replace(/^\n+/, "").trimEnd();
  }, [code]);

  const dimSlotMap = useMemo(() => {
    const map: Record<string, ColorSlot> = {};
    dimensions.forEach((d) => {
      map[d.key] = d.colorSlot;
    });
    return map;
  }, [dimensions]);

  const matches = useMemo(
    () => findHighlightMatches(trimmedCode, highlights),
    [trimmedCode, highlights]
  );

  const lineBounds = useMemo(() => computeLineBounds(trimmedCode), [trimmedCode]);

  const highlightLines = useMemo(() => {
    if (!showDimHighlights || matches.length === 0) return undefined;
    const lineSet = new Set<number>();
    for (let i = 0; i < lineBounds.length; i++) {
      const bound = lineBounds[i];
      const hasMatch = matches.some(
        (m) =>
          (activeDimFilter === null || m.span.dim === activeDimFilter) &&
          m.end > bound.start &&
          m.start < bound.end
      );
      if (hasMatch) {
        lineSet.add(i + 1);
      }
    }
    return lineSet.size > 0 ? Array.from(lineSet) : undefined;
  }, [showDimHighlights, matches, lineBounds, activeDimFilter]);

  const highlightPalette = isDark ? DARK_HIGHLIGHT_CLASSES : LIGHT_HIGHLIGHT_CLASSES;

  const renderLineContent = useMemo(() => {
    if (!showDimHighlights || matches.length === 0) return undefined;

    return ({ line, lineIndex, getTokenProps }: CodeBlockLineContext) => {
      const bound = lineBounds[lineIndex];
      if (!bound) {
        return line.map((token, key) => <span key={key} {...getTokenProps({ token })} />);
      }

      const lineMatches = matches.filter(
        (m) => m.end > bound.start && m.start < bound.end
      );
      if (lineMatches.length === 0) {
        return line.map((token, key) => <span key={key} {...getTokenProps({ token })} />);
      }

      interface TokenPiece {
        key: string;
        node: React.ReactNode;
        match: MatchPos | null;
      }

      const pieces: TokenPiece[] = [];
      let tokOffset = bound.start;

      line.forEach((token, key) => {
        const tokText = token.content;
        const tokenProps = getTokenProps({ token });
        if (!tokText) {
          pieces.push({
            key: `empty-${key}`,
            node: <span key={`empty-${key}`} {...tokenProps} />,
            match: null,
          });
          return;
        }

        const tokStart = tokOffset;
        const tokEnd = tokStart + tokText.length;
        tokOffset = tokEnd;

        const overlaps = lineMatches.filter((m) => m.end > tokStart && m.start < tokEnd);
        if (overlaps.length === 0) {
          pieces.push({
            key: `tok-${key}`,
            node: <span key={`tok-${key}`} {...tokenProps} />,
            match: null,
          });
          return;
        }

        let sliceCursor = tokStart;
        const { children: _ignoredChildren, className: tokenCls, ...restTokenProps } = tokenProps;

        overlaps.forEach((match, mIdx) => {
          const ovStart = Math.max(tokStart, match.start);
          const ovEnd = Math.min(tokEnd, match.end);

          if (ovStart > sliceCursor) {
            const plainPart = tokText.slice(sliceCursor - tokStart, ovStart - tokStart);
            const pieceKey = `tok-${key}-p-${mIdx}`;
            pieces.push({
              key: pieceKey,
              node: (
                <span key={pieceKey} className={tokenCls} {...restTokenProps}>
                  {plainPart}
                </span>
              ),
              match: null,
            });
          }

          if (ovEnd > ovStart) {
            const hlPart = tokText.slice(ovStart - tokStart, ovEnd - tokStart);
            const pieceKey = `tok-${key}-h-${mIdx}`;
            pieces.push({
              key: pieceKey,
              node: (
                <span key={pieceKey} className={tokenCls} {...restTokenProps}>
                  {hlPart}
                </span>
              ),
              match,
            });
          }

          sliceCursor = Math.max(sliceCursor, ovEnd);
        });

        if (sliceCursor < tokEnd) {
          const tailPart = tokText.slice(sliceCursor - tokStart);
          const pieceKey = `tok-${key}-tail`;
          pieces.push({
            key: pieceKey,
            node: (
              <span key={pieceKey} className={tokenCls} {...restTokenProps}>
                {tailPart}
              </span>
            ),
            match: null,
          });
        }
      });

      const grouped: React.ReactNode[] = [];
      let idx = 0;
      while (idx < pieces.length) {
        const current = pieces[idx];
        if (!current.match) {
          grouped.push(current.node);
          idx += 1;
          continue;
        }

        const activeMatch = current.match;
        const groupNodes: React.ReactNode[] = [current.node];
        let nextIdx = idx + 1;
        while (nextIdx < pieces.length && pieces[nextIdx].match === activeMatch) {
          groupNodes.push(pieces[nextIdx].node);
          nextIdx += 1;
        }

        const dim = activeMatch.span.dim;
        const isDimmedOut = activeDimFilter !== null && activeDimFilter !== dim;
        const slot = dimSlotMap[dim] ?? "yellow";
        const hlClass = isDimmedOut ? "opacity-55" : highlightPalette[slot];

        grouped.push(
          <span
            key={`hl-group-${idx}`}
            data-highlight-dim={dim}
            className={cn("rounded-[3px] py-[1px] transition-opacity", hlClass)}
            onMouseMove={(e) => {
              if (activeMatch.span.tooltip) {
                onHoverTooltip(activeMatch.span.tooltip, e.clientX, e.clientY);
              }
            }}
            onMouseLeave={onLeaveTooltip}
          >
            {groupNodes}
          </span>
        );

        idx = nextIdx;
      }

      return grouped;
    };
  }, [
    showDimHighlights,
    matches,
    lineBounds,
    activeDimFilter,
    dimSlotMap,
    highlightPalette,
    onHoverTooltip,
    onLeaveTooltip,
  ]);

  const langBadge = (language || "code").toUpperCase();

  return (
    <CodeBlock
      ref={viewerRef}
      data-testid="code-viewer-block"
      code={trimmedCode}
      language={language}
      filename={filePath || `source.${language}`}
      accent={PURRPARSE_CODE_ACCENTS[pageTheme]}
      mode={isDark ? "dark" : "light"}
      showLineNumbers={true}
      showCopyButton={true}
      highlightLines={highlightLines}
      renderLineContent={renderLineContent}
      className="rounded-xl shadow-xs"
      headerActions={
        <>
          <span className="uppercase font-mono text-[10px] px-1.5 py-0.5 rounded bg-(--cb-hover-wash) text-(--cb-muted)">
            {langBadge}
          </span>
          {highlights.length > 0 && (
            <button
              type="button"
              data-testid="code-viewer-highlight-toggle"
              onClick={() => setShowDimHighlights((v) => !v)}
              className={cn(
                "px-2 py-0.5 rounded-md border font-mono text-[10px] transition-colors cursor-pointer",
                showDimHighlights
                  ? "border-(--cb-accent)/45 bg-(--cb-accent)/12 text-(--cb-accent)"
                  : "border-(--cb-border) bg-(--cb-hover-wash) text-(--cb-muted) hover:text-(--cb-plain)"
              )}
              title="切换是否在代码语法高亮之上叠加 5 维精读批注"
            >
              {showDimHighlights ? "5维批注 · 开" : "纯净语法 · 开"}
            </button>
          )}
        </>
      }
    />
  );
}
