"use client";

import React, { useState } from "react";
import type { SectionSummaryData } from "@/core/contracts/document-ast";
import { MathText } from "./math-text";

interface SectionSummaryCardProps {
  sectionId: string;
  sectionTitle: string;
  summary?: SectionSummaryData;
  recallState?: { text: string; submitted: boolean };
  isRecallBlurActive: boolean;
  onToggleRecallBlur: () => void;
  onRecallTextChange: (text: string) => void;
  onSubmitRecall: () => void;
}

export function SectionSummaryCard({
  sectionId,
  sectionTitle,
  summary,
  recallState,
  isRecallBlurActive,
  onToggleRecallBlur,
  onRecallTextChange,
  onSubmitRecall,
}: SectionSummaryCardProps) {
  const [expandedDetails, setExpandedDetails] = useState(Boolean(recallState?.submitted));
  const recallText = recallState?.text ?? "";

  return (
    <div
      id={`${sectionId}-summary`}
      className="mt-4 mb-8 bg-[#fcfaf6] border border-[#ddd6c7] rounded-xl p-4 sm:p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-dashed border-[#ddd6c7]">
        <div>
          <span className="font-mono text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#1a2744] text-white mr-2">
            SECTION RECALL · 节末闭卷与审稿小结
          </span>
          <span className="font-serif text-sm font-semibold text-[#1a2744]">{sectionTitle}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleRecallBlur}
            className={`font-mono text-xs px-3 py-1 rounded border cursor-pointer ${
              isRecallBlurActive
                ? "bg-amber-300 text-[#1a2744] border-amber-400 font-semibold"
                : "bg-white hover:bg-[#f0ece2] text-[#1a2744] border-[#ddd6c7]"
            }`}
          >
            {isRecallBlurActive ? "[正在遮挡本节：写完提交或取消遮挡]" : "[开始闭卷复述]"}
          </button>
          <button
            type="button"
            onClick={() => setExpandedDetails((p) => !p)}
            className="font-mono text-xs px-2.5 py-1 rounded border border-[#ddd6c7] bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
          >
            {expandedDetails ? "[收起参考复述与追问]" : "[查看参考复述与追问]"}
          </button>
        </div>
      </div>

      {/* Closed-book Recall Input */}
      <div className="mt-3">
        <label className="block font-mono text-[11px] font-semibold text-[#1a2744] mb-1">
          闭卷提取区（先不看上面正文，凭记忆写出「{sectionTitle}」的核心主张、关键机制与保留问题）
        </label>
        <textarea
          value={recallText}
          onChange={(e) => onRecallTextChange(e.target.value)}
          rows={3}
          placeholder="例如：本节主要提出了...，相比前人方案解决了...问题，但依赖的前提是..."
          className="w-full rounded-lg border border-[#ddd6c7] bg-white px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1a2744]/25"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-slate-500">
            {recallState?.submitted
              ? "[已完成本节闭卷提交 · 本地已保存]"
              : "提示：点击上方 [开始闭卷复述] 可把本节原文与批注自动高斯模糊遮挡"}
          </span>
          <button
            type="button"
            onClick={() => {
              onSubmitRecall();
              setExpandedDetails(true);
            }}
            className="font-mono text-xs px-3 py-1 rounded bg-[#1a2744] hover:bg-[#24365c] text-white cursor-pointer"
          >
            [提交复述并核对参考答案]
          </button>
        </div>
      </div>

      {expandedDetails && summary && (
        <div className="mt-4 pt-4 border-t border-[#ddd6c7] space-y-3 text-xs sm:text-sm">
          <div className="bg-white border border-[#ddd6c7] rounded-lg p-3">
            <div className="font-mono text-[11px] font-semibold text-emerald-800 mb-1">
              [参考复述 / 本节确立了什么]
            </div>
            <p className="text-slate-800 leading-relaxed">
              <MathText text={summary.referenceRecall} />
            </p>
            <p className="text-slate-600 mt-1.5 text-xs">
              <span className="font-semibold">确立结论：</span>
              <MathText text={summary.established} />
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-[#ddd6c7] rounded-lg p-3">
              <div className="font-mono text-[11px] font-semibold text-[#1a2744] mb-1">
                [待证明或解释的缺口]
              </div>
              <p className="text-slate-700 text-xs leading-relaxed">
                <MathText text={summary.openQuestions} />
              </p>
            </div>
            <div className="bg-white border border-[#ddd6c7] rounded-lg p-3">
              <div className="font-mono text-[11px] font-semibold text-[#1a2744] mb-1">
                [作者论证与写作策略]
              </div>
              <p className="text-slate-700 text-xs leading-relaxed">
                <MathText text={summary.rhetoricStrategy} />
              </p>
            </div>
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3">
              <div className="font-mono text-[11px] font-semibold text-amber-900 mb-1">
                [审稿人追问与证据评估]
              </div>
              <p className="text-amber-950 text-xs leading-relaxed">
                <MathText text={summary.reviewerCritique} />
              </p>
            </div>
          </div>

          {summary.socraticQuestions.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono text-[11px] font-semibold text-[#1a2744]">
                [本节苏格拉底追问（六类助产提问）]
              </div>
              {summary.socraticQuestions.map((sq, idx) => (
                <details
                  key={idx}
                  className="bg-white border border-[#ddd6c7] rounded-lg px-3.5 py-2.5"
                >
                  <summary className="cursor-pointer font-medium text-xs sm:text-sm text-[#1a2744]">
                    <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-[#f0ece2] text-[#1a2744] mr-2">
                      {sq.category}
                    </span>
                    <MathText text={sq.question} />
                  </summary>
                  <div className="mt-2 pt-2 border-t border-dashed border-[#ddd6c7] text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <MathText text={sq.answer} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
