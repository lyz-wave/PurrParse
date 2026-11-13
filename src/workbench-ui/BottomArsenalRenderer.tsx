"use client";

import React, { useState } from "react";
import type {
  BottomArsenalBlock,
  ConfidenceLevel,
  PretestItem,
  UserAnnotationsState,
} from "@/core/contracts/document-ast";
import { MathText } from "./math-text";

interface BottomArsenalRendererProps {
  title: string;
  subtitle?: string;
  blocks: BottomArsenalBlock[];
  pretestItems?: PretestItem[];
  annotations?: UserAnnotationsState;
  onJournalChange: (promptId: string, value: string) => void;
  onChecklistToggle: (itemId: string) => void;
  onDiffChange: (patch: Partial<NonNullable<UserAnnotationsState["beforeAfterDiff"]>>) => void;
  onSocraticChange?: (
    itemId: string,
    patch: { answer?: string; confidence?: ConfidenceLevel }
  ) => void;
  onFeynmanChange?: (text: string) => void;
}

function addDaysFormatted(baseIso: string | undefined, days: number): string {
  const base = baseIso ? new Date(baseIso) : new Date();
  const valid = Number.isNaN(base.getTime()) ? new Date() : base;
  const target = new Date(valid.getTime() + days * 86400_000);
  return target.toISOString().slice(0, 10);
}

export function BottomArsenalRenderer({
  title,
  subtitle,
  blocks,
  pretestItems,
  annotations,
  onJournalChange,
  onChecklistToggle,
  onDiffChange,
  onSocraticChange,
  onFeynmanChange,
}: BottomArsenalRendererProps) {
  const [feynmanSubmitted, setFeynmanSubmitted] = useState(Boolean(annotations?.feynmanEssay?.trim()));
  const [pretestRevealed, setPretestRevealed] = useState(false);
  const renderBlock = (block: BottomArsenalBlock, idx: number) => {
    switch (block.type) {
      case "flow-skeleton":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            {block.title && (
              <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
                {block.title}
              </h3>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {block.steps.map((step, sIdx) => (
                <div
                  key={sIdx}
                  className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-lg p-3.5 text-sm"
                >
                  <div className="font-mono text-[11px] font-semibold text-[#1a2744] mb-1">
                    {step.tag}
                  </div>
                  <div className="text-slate-700 leading-relaxed">
                    <MathText text={step.body} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "statement-banner":
        return (
          <div key={idx} className="bg-[#1a2744] text-white rounded-xl p-5 shadow-xs">
            <div className="font-mono text-[11px] uppercase tracking-wider text-blue-200 mb-1.5">
              {block.tag}
            </div>
            <div className="text-sm sm:text-base leading-relaxed">
              <MathText text={block.body} />
            </div>
          </div>
        );

      case "comparison-pair":
        return (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[block.left, block.right].map((side, sideIdx) => (
              <div
                key={sideIdx}
                className={`rounded-xl border p-4 text-sm ${
                  side.tone === "success"
                    ? "bg-emerald-50/75 border-emerald-200"
                    : "bg-rose-50/75 border-rose-200"
                }`}
              >
                <div className="font-mono text-xs font-semibold mb-1.5 text-slate-900">
                  {side.tag}
                </div>
                <div className="text-slate-700 leading-relaxed">
                  <MathText text={side.body} />
                </div>
              </div>
            ))}
          </div>
        );

      case "socratic-qa":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="space-y-3">
              {block.items.map((item, i) => {
                const qKey = item.id ?? `sq-${idx}-${i}`;
                const saved = annotations?.socraticAnswers?.[qKey] ?? {
                  answer: "",
                  confidence: "medium" as const,
                };
                return (
                  <div
                    key={i}
                    className="border border-[#ddd6c7] rounded-lg bg-[#fcfbf8] px-4 py-3 space-y-2"
                  >
                    <div className="font-medium text-sm text-[#1a2744]">
                      {item.cognitiveLevel && (
                        <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-[#1a2744] text-white mr-2">
                          {item.cognitiveLevel}
                        </span>
                      )}
                      <MathText text={item.question} />
                    </div>
                    {onSocraticChange && (
                      <div className="space-y-1.5">
                        <textarea
                          value={saved.answer}
                          onChange={(e) => onSocraticChange(qKey, { answer: e.target.value })}
                          rows={2}
                          placeholder="先写出你的推理判断，再展开对照参考解析..."
                          className="w-full rounded border border-[#ddd6c7] bg-white px-2.5 py-1.5 text-xs text-slate-800"
                        />
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                          <span>作答信心：</span>
                          {(
                            [
                              ["low", "低"],
                              ["medium", "中"],
                              ["high", "高"],
                            ] as const
                          ).map(([lvl, label]) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => onSocraticChange(qKey, { confidence: lvl })}
                              className={`px-2 py-0.5 rounded border cursor-pointer ${
                                saved.confidence === lvl
                                  ? "bg-[#1a2744] text-white border-[#1a2744]"
                                  : "bg-white text-slate-600 border-[#ddd6c7]"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <details className="pt-1">
                      <summary className="cursor-pointer font-mono text-xs text-blue-800 hover:underline">
                        [展开参考解析]
                      </summary>
                      <div className="mt-2 pt-2 border-t border-dashed border-[#ddd6c7] text-sm text-slate-700 leading-relaxed">
                        <MathText text={item.answer} />
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "claim-evidence-table":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="overflow-x-auto border border-[#ddd6c7] rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#f3efe6] text-[#1a2744] font-mono">
                  <tr>
                    <th className="px-3 py-2 border-b border-[#ddd6c7]">编号</th>
                    <th className="px-3 py-2 border-b border-[#ddd6c7]">核心主张</th>
                    <th className="px-3 py-2 border-b border-[#ddd6c7]">支撑证据及锚点</th>
                    <th className="px-3 py-2 border-b border-[#ddd6c7]">证据类型与局限</th>
                    <th className="px-3 py-2 border-b border-[#ddd6c7]">未覆盖边界</th>
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((r, rIdx) => (
                    <tr key={rIdx} className="border-b last:border-b-0 border-[#ebe5d8]">
                      <td className="px-3 py-2 font-mono font-semibold text-[#1a2744]">{r.claimId}</td>
                      <td className="px-3 py-2 text-slate-800"><MathText text={r.claim} /></td>
                      <td className="px-3 py-2 text-slate-700"><MathText text={r.evidenceAnchor} /></td>
                      <td className="px-3 py-2 text-slate-700"><MathText text={r.limitation} /></td>
                      <td className="px-3 py-2 text-rose-800"><MathText text={r.unverifiedGap} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "prior-work-table":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="overflow-x-auto border border-[#ddd6c7] rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#f3efe6] text-[#1a2744] font-mono">
                  <tr>
                    <th className="px-3 py-2 border-b border-[#ddd6c7]">关键前作</th>
                    <th className="px-3 py-2 border-b border-[#ddd6c7]">本文声称的差异</th>
                    <th className="px-3 py-2 border-b border-[#ddd6c7]">原文锚点</th>
                    <th className="px-3 py-2 border-b border-[#ddd6c7]">信息缺口</th>
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((r, rIdx) => (
                    <tr key={rIdx} className="border-b last:border-b-0 border-[#ebe5d8]">
                      <td className="px-3 py-2 font-semibold text-[#1a2744]">{r.priorWork}</td>
                      <td className="px-3 py-2 text-slate-700"><MathText text={r.claimedDifference} /></td>
                      <td className="px-3 py-2 font-mono text-slate-600">{r.anchor}</td>
                      <td className="px-3 py-2 text-amber-900">{r.infoGap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "first-principles-list":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="space-y-2.5 text-xs sm:text-sm">
              {block.items.map((item, i) => (
                <div key={i} className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-lg p-3.5">
                  <div className="font-semibold text-[#1a2744] mb-1">
                    {`前提 ${i + 1}：`}
                    <MathText text={item.premise} />
                  </div>
                  <div className="text-rose-900 text-xs mb-1">
                    <span className="font-mono font-semibold mr-1">[如果前提不成立]</span>
                    <MathText text={item.ifViolated} />
                  </div>
                  <div className="text-slate-600 text-xs">
                    <span className="font-mono font-semibold mr-1">[判断依据]</span>
                    <MathText text={item.basis} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "feynman-challenge": {
        const essay = annotations?.feynmanEssay ?? "";
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-1">
              {block.title}
            </h3>
            <p className="text-xs text-slate-600 mb-3">{block.prompt}</p>
            <textarea
              value={essay}
              onChange={(e) => onFeynmanChange?.(e.target.value)}
              rows={4}
              placeholder="用不超过 200 字向非本专业朋友或面试官口述核心原理（禁止堆砌术语）..."
              className="w-full rounded-lg border border-[#ddd6c7] bg-[#fcfbf8] px-3 py-2 text-xs sm:text-sm text-slate-800"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-500">
                {`当前字数：${essay.trim().length} 字`}
              </span>
              <button
                type="button"
                onClick={() => setFeynmanSubmitted((p) => !p)}
                className="font-mono text-xs px-3 py-1 rounded bg-[#1a2744] text-white hover:bg-[#24365c] cursor-pointer"
              >
                {feynmanSubmitted ? "[收起参考费曼讲解]" : "[提交并查看参考讲解与外行三连问]"}
              </button>
            </div>
            {feynmanSubmitted && (
              <div className="mt-3 pt-3 border-t border-dashed border-[#ddd6c7] space-y-2.5 text-xs sm:text-sm">
                <div className="bg-[#f0ece2] border-l-3 border-[#8c7a6b] p-3 rounded-r text-slate-800">
                  <div className="font-mono text-[11px] font-semibold text-[#1a2744] mb-1">
                    [参考大白话讲解]
                  </div>
                  <MathText text={block.referenceExplanation} />
                </div>
                {block.laypersonQuestions.length > 0 && (
                  <div className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-lg p-3">
                    <div className="font-mono text-[11px] font-semibold text-[#1a2744] mb-1.5">
                      [外行最可能追问的 3 个灵魂问题]
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-xs">
                      {block.laypersonQuestions.map((q, qIdx) => (
                        <li key={qIdx}>
                          <MathText text={q} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case "purpose-tailored":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-serif text-base font-semibold text-[#1a2744]">{block.title}</h3>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#1a2744] text-white">
                {block.purposeLabel}
              </span>
            </div>
            <div className="space-y-2 text-xs sm:text-sm">
              {block.items.map((item, i) => (
                <div key={i} className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-lg p-3">
                  <span className="font-mono text-[11px] font-semibold text-[#1a2744] mr-2">
                    [{item.tag}]
                  </span>
                  <span className="text-slate-700">
                    <MathText text={item.body} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case "review-schedule": {
        const offsets = [
          { day: "Day 1（即时检索）", date: addDaysFormatted(block.startDate, 1) },
          { day: "Day 3（间隔回忆）", date: addDaysFormatted(block.startDate, 3) },
          { day: "Day 7（结构重构）", date: addDaysFormatted(block.startDate, 7) },
          { day: "Day 21（长期固化）", date: addDaysFormatted(block.startDate, 21) },
        ];
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {offsets.map((slot, sIdx) => (
                <div key={sIdx} className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-lg p-3">
                  <div className="font-mono font-semibold text-[#1a2744]">{slot.day}</div>
                  <div className="font-mono text-[11px] text-blue-800 mb-1.5">{slot.date}</div>
                  <p className="text-slate-700 leading-relaxed">
                    {block.tasks[sIdx] ?? "闭卷默画架构图 + 重做 3 道交错自测题 + 复查模糊单元。"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "aphorism-list":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="divide-y divide-dashed divide-[#ddd6c7]">
              {block.items.map((item, i) => (
                <div key={i} className="py-2.5">
                  <div className="font-serif italic text-slate-900 text-sm">&ldquo;{item.en}&rdquo;</div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-1">{item.zh}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case "journal-prompts":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="space-y-4">
              {block.items.map((item) => {
                const value = annotations?.journalAnswers?.[item.id] ?? "";
                return (
                  <div key={item.id}>
                    <label className="block font-medium text-sm text-[#1a2744]">
                      {item.label}
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5 mb-1.5">{item.hint}</p>
                    <textarea
                      value={value}
                      onChange={(e) => onJournalChange(item.id, e.target.value)}
                      placeholder={item.placeholder}
                      rows={3}
                      className="w-full rounded-lg border border-[#ddd6c7] bg-[#fcfbf8] px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "checklist":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="space-y-2">
              {block.items.map((item) => {
                const checked = Boolean(annotations?.checklistStates?.[item.id]);
                return (
                  <label
                    key={item.id}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-[#fcfaf6] cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onChecklistToggle(item.id)}
                      className="mt-1 accent-[#1a2744]"
                    />
                    <span>
                      <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#f0ece2] text-[#1a2744] mr-2">
                        {item.tag}
                      </span>
                      <span className={checked ? "line-through text-slate-400" : "text-slate-700"}>
                        <MathText text={item.text} />
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );

      case "star-bullets":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {block.versions.map((ver, i) => (
                <div
                  key={i}
                  className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-lg p-4 text-sm"
                >
                  <div className="font-mono text-xs font-semibold text-[#1a2744] mb-1">
                    {ver.versionLabel}
                  </div>
                  <p className="text-xs text-slate-600 mb-2.5">{ver.summary}</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-800">
                    {ver.bullets.map((b, bIdx) => (
                      <li key={bIdx}>
                        <MathText text={b} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );

      case "ownership-blueprints":
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744] mb-3">
              {block.title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {block.plans.map((plan, pIdx) => (
                <div
                  key={pIdx}
                  className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-lg p-4 text-xs sm:text-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-[#1a2744]">{plan.title}</h4>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-800 shrink-0">
                      {plan.timeEstimate}
                    </span>
                  </div>
                  <p className="text-slate-700">
                    <span className="font-semibold">目标文件：</span>
                    <span className="font-mono text-xs">{plan.targetFiles}</span>
                  </p>
                  <p className="text-slate-700">
                    <span className="font-semibold">改造步骤：</span>
                    {plan.changeSteps}
                  </p>
                  <p className="text-slate-700">
                    <span className="font-semibold">压测指标：</span>
                    {plan.benchmarkMetric}
                  </p>
                  <p className="bg-[#f0ece2] p-2 rounded text-slate-800 text-xs">
                    <span className="font-semibold">面试话术：</span>
                    {plan.interviewPitch}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );

      case "before-after-diff": {
        const beforeVal = annotations?.beforeAfterDiff?.beforeCode ?? block.defaultBeforeCode;
        const afterVal = annotations?.beforeAfterDiff?.afterCode ?? block.defaultAfterCode;
        const benchVal = annotations?.beforeAfterDiff?.benchmarkNote ?? block.defaultBenchmarkNote;
        return (
          <div key={idx} className="bg-white border border-[#ddd6c7] rounded-xl p-5">
            <h3 className="font-serif text-base font-semibold text-[#1a2744]">{block.title}</h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 mb-4">{block.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <div className="font-mono text-[11px] font-semibold text-rose-700 mb-1">
                  BEFORE (原库瓶颈 / 原始写法)
                </div>
                <textarea
                  value={beforeVal}
                  onChange={(e) => onDiffChange({ beforeCode: e.target.value })}
                  rows={8}
                  className="w-full rounded-lg border border-rose-200 bg-rose-50/30 p-3 font-mono text-xs text-slate-800"
                />
              </div>
              <div>
                <div className="font-mono text-[11px] font-semibold text-emerald-700 mb-1">
                  AFTER (你的 Ownership 二次改造)
                </div>
                <textarea
                  value={afterVal}
                  onChange={(e) => onDiffChange({ afterCode: e.target.value })}
                  rows={8}
                  className="w-full rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 font-mono text-xs text-slate-800"
                />
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] font-semibold text-[#1a2744] mb-1">
                BENCHMARK & VERIFICATION LOG
              </div>
              <textarea
                value={benchVal}
                onChange={(e) => onDiffChange({ benchmarkNote: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-[#ddd6c7] bg-[#fcfbf8] p-3 font-mono text-xs text-slate-800"
              />
            </div>
          </div>
        );
      }
    }
  };

  return (
    <section id="bottom-arsenal" className="mt-8 space-y-4">
      <div className="border-l-4 border-[#1a2744] bg-[#efeae0] rounded-r-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold text-[#1a2744]">{title}</h2>
        {subtitle && <span className="font-mono text-xs text-slate-600">{subtitle}</span>}
      </div>

      {pretestItems && pretestItems.length > 0 && (
        <div className="bg-white border border-[#ddd6c7] rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-serif text-base font-semibold text-[#1a2744]">
              读前预测试揭晓与元认知校准
            </h3>
            <button
              type="button"
              onClick={() => setPretestRevealed((p) => !p)}
              className="font-mono text-xs px-3 py-1 rounded bg-[#1a2744] text-white hover:bg-[#24365c] cursor-pointer"
            >
              {pretestRevealed ? "[收起参考答案]" : "[揭晓全部预测试答案]"}
            </button>
          </div>
          {pretestRevealed && (
            <div className="space-y-2.5 text-xs sm:text-sm">
              {pretestItems.map((item, idx) => {
                const saved = annotations?.pretestAnswers?.[item.id];
                const isHighConfidence = saved?.confidence === "high";
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 ${
                      isHighConfidence
                        ? "bg-amber-50/70 border-amber-300"
                        : "bg-[#fcfaf6] border-[#ddd6c7]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-medium text-[#1a2744] mb-1">
                      <span>
                        <span className="font-mono mr-1.5">Q{idx + 1}.</span>
                        <MathText text={item.question} />
                      </span>
                      {saved && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-[#ddd6c7]">
                          {`你的信心：${
                            saved.confidence === "high"
                              ? "高信心（重点核对是否过拟合直觉）"
                              : saved.confidence === "low"
                                ? "低"
                                : "中"
                          }`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mb-1">
                      <span className="font-semibold">你的读前预测：</span>
                      {saved?.answer?.trim() || "（未作答）"}
                    </div>
                    <div className="text-xs sm:text-sm text-emerald-950 bg-emerald-50/80 border border-emerald-200 rounded p-2">
                      <span className="font-mono font-semibold mr-1">[参考答案]</span>
                      <MathText text={item.answer} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {blocks.map((block, idx) => renderBlock(block, idx))}
    </section>
  );
}
