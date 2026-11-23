"use client";

import React from "react";
import katex from "katex";
import {
  formatFlowTextForMath,
  normalizeLatexSyntax,
  normalizeUnicodeMathDiacritics,
} from "@/core/engine/flow-math";

interface MathTextProps {
  text: string;
  className?: string;
}

export function renderKatexSafe(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      strict: "ignore",
    });
  } catch {
    return latex;
  }
}

const EPISTEMIC_TAG_STYLES: Record<string, string> = {
  "[原文明示]": "bg-emerald-100 text-emerald-900 border-emerald-300",
  "[分析推断]": "bg-blue-100 text-blue-900 border-blue-300",
  "[原文未说明]": "bg-slate-200 text-slate-800 border-slate-300",
  "[原文不一致]": "bg-rose-100 text-rose-900 border-rose-300",
  "[易误解]": "bg-amber-100 text-amber-950 border-amber-300",
};

const EPISTEMIC_WITH_DETAIL_RE =
  /(\[(?:原文明示|分析推断|原文未说明|原文不一致|易误解)(?:[，,:：\s][^\]]{1,80})?\])/g;

function renderPlainSegmentWithTags(segment: string, keyPrefix: string): React.ReactNode {
  EPISTEMIC_WITH_DETAIL_RE.lastIndex = 0;
  if (!EPISTEMIC_WITH_DETAIL_RE.test(segment)) {
    return segment;
  }
  const tokens = segment.split(
    /(\[(?:原文明示|分析推断|原文未说明|原文不一致|易误解)(?:[，,:：\s][^\]]{1,80})?\])/g
  );
  return tokens.map((tok, i) => {
    if (!tok) return null;
    const exactCls = EPISTEMIC_TAG_STYLES[tok];
    if (exactCls) {
      return (
        <span
          key={`${keyPrefix}-tag-${i}`}
          className={`inline-block font-mono text-[10.5px] font-semibold px-1.5 py-0.2 rounded border mx-0.5 align-baseline ${exactCls}`}
        >
          {tok}
        </span>
      );
    }
    const detailMatch = tok.match(
      /^\[(原文明示|分析推断|原文未说明|原文不一致|易误解)[，,:：\s]+([^\]]+)\]$/
    );
    if (detailMatch) {
      const [, prefix, detail] = detailMatch;
      const prefixCls = EPISTEMIC_TAG_STYLES[`[${prefix}]`];
      if (prefixCls) {
        return (
          <React.Fragment key={`${keyPrefix}-tagd-${i}`}>
            <span
              className={`inline-block font-mono text-[10.5px] font-semibold px-1.5 py-0.2 rounded border mr-1.5 align-baseline ${prefixCls}`}
            >
              [{prefix}]
            </span>
            <span className="text-[11.5px] opacity-75 mr-1.5">({detail.trim()})</span>
          </React.Fragment>
        );
      }
    }
    return tok;
  });
}

/**
 * Splits prose containing inline `$...$` expressions into plain text (with epistemic badges) and KaTeX HTML spans.
 */
export function MathText({ text, className }: MathTextProps) {
  if (!text.includes("$")) {
    return <span className={className}>{renderPlainSegmentWithTags(text, "plain")}</span>;
  }

  const parts: React.ReactNode[] = [];
  const regex = /\$([^$\n]{1,600})\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderPlainSegmentWithTags(text.slice(lastIndex, match.index), `seg-${keyCounter}`));
    }
    const normalizedTex = normalizeLatexSyntax(match[1]);
    const html = renderKatexSafe(normalizedTex, false);
    parts.push(
      <span
        key={`math-${keyCounter++}`}
        data-tex={normalizedTex}
        className="inline-math align-baseline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(renderPlainSegmentWithTags(text.slice(lastIndex), "tail"));
  }

  return <span className={className}>{parts}</span>;
}

/**
 * Renders `TENSOR / STATE FLOW` descriptions, automatically converting bare ASCII/Unicode
 * tensor expressions (`x_t[H,W,3]`, `L_distill = ||P(F_t) - G_t||^2`, `ẑ_{t+1:t+H}`) into crisp KaTeX.
 */
export function FlowMathText({ text, className }: MathTextProps) {
  const formatted = React.useMemo(() => formatFlowTextForMath(text), [text]);
  return <MathText text={formatted} className={className} />;
}

interface DisplayFormulaProps {
  latex: string;
}

export function DisplayFormula({ latex }: DisplayFormulaProps) {
  if (!latex.trim()) return null;
  const normalized = normalizeUnicodeMathDiacritics(latex);
  const html = renderKatexSafe(normalized, true);
  return (
    <div
      data-tex={normalized}
      className="prism-display-formula overflow-x-auto py-1 text-slate-900"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
