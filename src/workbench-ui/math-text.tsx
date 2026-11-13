"use client";

import React from "react";
import katex from "katex";

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

function renderPlainSegmentWithTags(segment: string, keyPrefix: string): React.ReactNode {
  const tagRegex = /(\[(?:原文明示|分析推断|原文未说明|原文不一致|易误解)\])/g;
  if (!tagRegex.test(segment)) {
    return segment;
  }
  const tokens = segment.split(/(\[(?:原文明示|分析推断|原文未说明|原文不一致|易误解)\])/g);
  return tokens.map((tok, i) => {
    const badgeCls = EPISTEMIC_TAG_STYLES[tok];
    if (!badgeCls) return tok;
    return (
      <span
        key={`${keyPrefix}-tag-${i}`}
        className={`inline-block font-mono text-[10.5px] font-semibold px-1.5 py-0.2 rounded border mx-0.5 align-baseline ${badgeCls}`}
      >
        {tok}
      </span>
    );
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
  const regex = /\$([^$\n]{1,180})\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderPlainSegmentWithTags(text.slice(lastIndex, match.index), `seg-${keyCounter}`));
    }
    const html = renderKatexSafe(match[1], false);
    parts.push(
      <span
        key={`math-${keyCounter++}`}
        data-tex={match[1]}
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

interface DisplayFormulaProps {
  latex: string;
}

export function DisplayFormula({ latex }: DisplayFormulaProps) {
  if (!latex.trim()) return null;
  const html = renderKatexSafe(latex, true);
  return (
    <div
      data-tex={latex}
      className="overflow-x-auto py-1 text-slate-900"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
