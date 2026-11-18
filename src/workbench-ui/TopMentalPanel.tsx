"use client";

import React, { useMemo, useState } from "react";
import type { ConfidenceLevel, TopMentalModel } from "@/core/contracts/document-ast";
import { computeDiagramLayout } from "./dagre-layout";
import { MathText } from "./math-text";

const NODE_STYLE: Record<string, { fill: string; stroke: string; text: string }> = {
  yellow: { fill: "#fff8cf", stroke: "#d49b00", text: "#1c222d" },
  red: { fill: "#fdecee", stroke: "#d64550", text: "#7f1d1d" },
  blue: { fill: "#eaf3ff", stroke: "#2b6cb0", text: "#1e3a5f" },
  green: { fill: "#eaf7ee", stroke: "#2b7a4b", text: "#14532d" },
  purple: { fill: "#f4edfb", stroke: "#7b4ea3", text: "#4c1d95" },
  navy: { fill: "#1a2744", stroke: "#1a2744", text: "#ffffff" },
};

type SecondaryTabKey = "pretest" | "glossary" | "path" | "examples";

interface TopMentalPanelProps {
  model: TopMentalModel;
  pretestAnswers?: Record<string, { answer: string; confidence: ConfidenceLevel }>;
  onPretestChange?: (
    itemId: string,
    patch: { answer?: string; confidence?: ConfidenceLevel }
  ) => void;
  onJumpToUnit: (targetUnitId: string) => void;
  onToggleFirstPass?: () => void;
}

export function TopMentalPanel({
  model,
  pretestAnswers,
  onPretestChange,
  onJumpToUnit,
  onToggleFirstPass,
}: TopMentalPanelProps) {
  const layout = useMemo(() => computeDiagramLayout(model.diagram), [model.diagram]);

  const hasPretest = Boolean(model.pretestItems && model.pretestItems.length > 0);
  const hasGlossary = model.glossary.length > 0;
  const hasPath = Boolean(model.readingPath || (model.prerequisiteMap && model.prerequisiteMap.length > 0));
  const hasExamples = Boolean(
    (model.fadedExamples && model.fadedExamples.length > 0) ||
      (model.designChoices && model.designChoices.length > 0)
  );

  const tabs: Array<{ key: SecondaryTabKey; label: string }> = [];
  if (hasPretest) {
    tabs.push({ key: "pretest", label: `读前预测试 (${model.pretestItems?.length ?? 0})` });
  }
  if (hasGlossary) {
    tabs.push({ key: "glossary", label: `${model.glossaryTitle.replace(/词典$/g, "") || "核心词典"} (${model.glossary.length})` });
  }
  if (hasPath) {
    tabs.push({ key: "path", label: "阅读路径与先修地图" });
  }
  if (hasExamples) {
    tabs.push({ key: "examples", label: "手算走查与设计权衡" });
  }

  const defaultTab: SecondaryTabKey = tabs[0]?.key ?? "glossary";
  const [activeTab, setActiveTab] = useState<SecondaryTabKey>(defaultTab);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleTabClick = (key: SecondaryTabKey) => {
    if (drawerOpen && activeTab === key) {
      setDrawerOpen(false);
    } else {
      setActiveTab(key);
      setDrawerOpen(true);
    }
  };

  return (
    <section
      id="mental-model"
      className="prism-editorial-card border border-[#ddd6c7] rounded-2xl p-5 sm:p-6 mb-6"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg sm:text-xl font-semibold text-[#1a2744]">
            {model.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{model.subtitle}</p>
        </div>
      </div>

      {model.rawSummaryBanner && (
        <div className="prism-on-dark bg-gradient-to-r from-[#1a2744] to-[#24365c] text-white rounded-xl p-4 mb-4 shadow-xs border border-white/10">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-amber-200/90 mb-1">
            {model.rawSummaryBanner.tag}
          </div>
          <div className="text-sm leading-relaxed text-slate-100">
            <MathText text={model.rawSummaryBanner.body} />
          </div>
        </div>
      )}

      {model.oneSentenceSkeleton && (
        <div className="prism-quote-block rounded-r-xl px-4 py-3 mb-4 text-sm text-[#1a2744]">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider mr-2 px-2 py-0.5 rounded-full bg-white/80 border border-[#ddd6c7]">
            一句话全局骨架
          </span>
          <MathText text={model.oneSentenceSkeleton} />
        </div>
      )}

      {model.cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-4">
          {model.cards.map((card, idx) => (
            <div
              key={idx}
              className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-xl p-3.5 text-sm leading-relaxed"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#1a2744]/10 text-[#1a2744]">
                  {`0${idx + 1}`}
                </span>
                <span className="font-mono text-[11px] font-semibold uppercase text-[#1a2744] truncate">
                  {card.tag}
                </span>
              </div>
              <div className="text-slate-700 text-[13.5px]">
                <MathText text={card.body} />
              </div>
            </div>
          ))}
        </div>
      )}

      {model.comparisonPair && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
          <div
            className={`rounded-xl border p-4 text-sm ${
              model.comparisonPair.leftTone === "danger"
                ? "bg-rose-50/70 border-rose-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="font-mono text-xs font-semibold text-rose-900 mb-2">
              {model.comparisonPair.leftTitle}
            </div>
            <ul className="space-y-1.5 text-slate-700 list-disc pl-4 text-[13px]">
              {model.comparisonPair.leftItems.map((item, i) => (
                <li key={i}>
                  <MathText text={item} />
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`rounded-xl border p-4 text-sm ${
              model.comparisonPair.rightTone === "success"
                ? "bg-emerald-50/70 border-emerald-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="font-mono text-xs font-semibold text-emerald-900 mb-2">
              {model.comparisonPair.rightTitle}
            </div>
            <ul className="space-y-1.5 text-slate-700 list-disc pl-4 text-[13px]">
              {model.comparisonPair.rightItems.map((item, i) => (
                <li key={i}>
                  <MathText text={item} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {model.diagram.nodes.length > 0 && (
        <div className="border border-[#ddd6c7] rounded-xl p-4 bg-[#fcfbf8] mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h3 className="font-serif text-sm sm:text-base font-semibold text-[#1a2744]">
              {model.diagram.title}
            </h3>
            <span className="text-xs text-slate-500">{model.diagram.hint}</span>
          </div>

          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              style={{ maxWidth: `${layout.width}px`, width: "100%", height: "auto" }}
              className="mx-auto block"
              role="img"
              aria-label={model.diagram.title}
            >
              <defs>
                <marker
                  id="workbench-dagre-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
                </marker>
              </defs>

              {layout.edges.map((edge, idx) => (
                <g key={`${edge.from}-${edge.to}-${idx}`}>
                  <path
                    d={edge.pathD}
                    fill="none"
                    stroke="#3b82f6"
                    strokeOpacity={0.75}
                    strokeWidth={1.8}
                    markerEnd="url(#workbench-dagre-arrow)"
                  />
                  {edge.label && (
                    <text
                      x={edge.labelX}
                      y={edge.labelY}
                      textAnchor="middle"
                      fontSize={11}
                      fontFamily="var(--font-ibm-mono), monospace"
                      fill="var(--prism-ink-muted, #525b6c)"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              ))}

              {layout.nodes.map((node) => {
                const style = NODE_STYLE[node.colorSlot ?? "blue"] ?? NODE_STYLE.blue;
                const clickable = Boolean(node.targetUnitId);
                return (
                  <g
                    key={node.id}
                    onClick={() => {
                      if (node.targetUnitId) onJumpToUnit(node.targetUnitId);
                    }}
                    className={clickable ? "cursor-pointer group" : undefined}
                  >
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      rx={10}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={1.6}
                    />
                    <text
                      x={node.x + node.width / 2}
                      y={node.y + (node.subLabel ? 26 : 31)}
                      textAnchor="middle"
                      fontSize={12.5}
                      fontWeight={600}
                      fill={style.text}
                    >
                      {node.label}
                    </text>
                    {node.subLabel && (
                      <text
                        x={node.x + node.width / 2}
                        y={node.y + 45}
                        textAnchor="middle"
                        fontSize={10.5}
                        fontFamily="var(--font-ibm-mono), monospace"
                        fill={node.colorSlot === "navy" ? "#cbd5e1" : "#525b6c"}
                      >
                        {node.subLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Segmented Drawer for Deep Study Scaffolds (keeps initial viewport compact for fast reading) */}
      {tabs.length > 0 && (
        <div className="border-t border-[#e5dfd2] pt-3.5">
          <div
            data-testid="top-mental-tabs"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {tabs.map((tab) => {
                const isSelected = drawerOpen && activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabClick(tab.key)}
                    className={`font-mono text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#1a2744] text-white border-[#1a2744] font-semibold shadow-xs"
                        : "bg-[#fcfaf6] text-slate-700 border-[#ddd6c7] hover:bg-[#f3efe6]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className="font-mono text-[11px] text-slate-600 hover:text-[#1a2744] px-2.5 py-1 rounded-full hover:bg-[#f3efe6] cursor-pointer transition-colors"
            >
              {drawerOpen ? "收起辅助脚手架" : "展开阅读脚手架"}
            </button>
          </div>

          {hasPretest && (
            <div className={drawerOpen && activeTab === "pretest" ? "block pt-4" : "hidden"}>
              <div className="border border-[#ddd6c7] rounded-xl p-4 bg-[#fcfaf6]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <h3 className="font-serif text-base font-semibold text-[#1a2744]">
                    读前预测试（先预测 + 选信心等级，答案在底部复盘区揭晓）
                  </h3>
                  <span className="font-mono text-[11px] text-slate-500">
                    {model.pretestItems?.length ?? 0} 题 · 防流利度错觉
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {model.pretestItems?.map((item, idx) => {
                    const saved = pretestAnswers?.[item.id] ?? { answer: "", confidence: "medium" as const };
                    return (
                      <div key={item.id} className="bg-white border border-[#ddd6c7] rounded-lg p-3 text-xs space-y-2">
                        <div className="font-medium text-slate-900">
                          <span className="font-mono text-[#1a2744] mr-1.5">Q{idx + 1}.</span>
                          <MathText text={item.question} />
                        </div>
                        <textarea
                          value={saved.answer}
                          onChange={(e) => onPretestChange?.(item.id, { answer: e.target.value })}
                          rows={2}
                          placeholder="先凭已有直觉写下你的预测（1-2句话）..."
                          className="w-full rounded-md border border-[#ddd6c7] bg-[#fcfbf8] px-2.5 py-1.5 text-xs text-slate-800"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-slate-500">信心：</span>
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
                                onClick={() => onPretestChange?.(item.id, { confidence: lvl })}
                                className={`px-2 py-0.5 rounded-full border cursor-pointer ${
                                  saved.confidence === lvl
                                    ? "bg-[#1a2744] text-white border-[#1a2744]"
                                    : "bg-white text-slate-600 border-[#ddd6c7]"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {item.targetUnitId && (
                            <button
                              type="button"
                              onClick={() => onJumpToUnit(item.targetUnitId!)}
                              className="font-mono text-[10.5px] text-blue-700 hover:underline cursor-pointer"
                            >
                              定位验证段落
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {hasGlossary && (
            <div className={drawerOpen && activeTab === "glossary" ? "block pt-4" : "hidden"}>
              <div>
                <h3 className="font-serif text-sm font-semibold text-[#1a2744] mb-2">
                  {model.glossaryTitle}
                </h3>
                <div className="divide-y divide-dashed divide-[#ddd6c7] border-t border-b border-[#ddd6c7]">
                  {model.glossary.map((g, i) => (
                    <div key={i} className="py-2.5 flex flex-wrap sm:flex-nowrap items-baseline gap-2.5 text-sm">
                      <span className="font-semibold text-[#1a2744] min-w-[180px] shrink-0">
                        {g.term}
                      </span>
                      {g.badge && (
                        <span className="font-mono text-[10.5px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 shrink-0">
                          {g.badge}
                        </span>
                      )}
                      <span className="text-slate-700">
                        <MathText text={g.definition} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasPath && (
            <div className={drawerOpen && activeTab === "path" ? "block pt-4 space-y-4" : "hidden"}>
              {model.readingPath && (
                <div className="border border-[#ddd6c7] rounded-xl p-4 bg-[#fcfaf6]">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <h3 className="font-serif text-sm font-semibold text-[#1a2744]">
                      三遍阅读路径导航（先骨架 → 后细节 → 闭卷验收）
                    </h3>
                    {onToggleFirstPass && (
                      <button
                        type="button"
                        onClick={onToggleFirstPass}
                        className="font-mono text-xs px-3 py-1 rounded-full bg-[#1a2744] hover:bg-[#24365c] text-white cursor-pointer"
                      >
                        开启第一遍聚焦路径
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white border border-[#ddd6c7] rounded-lg p-3">
                      <div className="font-mono font-semibold text-[#1a2744] mb-1">PASS 1 · 建立全局</div>
                      <p className="text-slate-700 leading-relaxed">{model.readingPath.pass1Summary}</p>
                    </div>
                    <div className="bg-white border border-[#ddd6c7] rounded-lg p-3">
                      <div className="font-mono font-semibold text-[#1a2744] mb-1">PASS 2 · 吃透论证</div>
                      <p className="text-slate-700 leading-relaxed">{model.readingPath.pass2Summary}</p>
                    </div>
                    <div className="bg-white border border-[#ddd6c7] rounded-lg p-3">
                      <div className="font-mono font-semibold text-[#1a2744] mb-1">PASS 3 · 主动检验</div>
                      <p className="text-slate-700 leading-relaxed">{model.readingPath.pass3Summary}</p>
                    </div>
                  </div>
                </div>
              )}

              {model.prerequisiteMap && model.prerequisiteMap.length > 0 && (
                <div>
                  <h3 className="font-serif text-sm font-semibold text-[#1a2744] mb-2">
                    前置知识地图（按当前背景暂定所需前置知识）
                  </h3>
                  <div className="overflow-x-auto border border-[#ddd6c7] rounded-xl">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#f3efe6] text-[#1a2744] font-mono">
                        <tr>
                          <th className="px-3 py-2 border-b border-[#ddd6c7]">概念</th>
                          <th className="px-3 py-2 border-b border-[#ddd6c7]">为何需要</th>
                          <th className="px-3 py-2 border-b border-[#ddd6c7]">补充建议</th>
                          <th className="px-3 py-2 border-b border-[#ddd6c7]">三行速成解释</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.prerequisiteMap.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-b-0 border-[#ebe5d8] bg-white">
                            <td className="px-3 py-2 font-semibold text-[#1a2744]">{item.concept}</td>
                            <td className="px-3 py-2 text-slate-700">{item.whyNeeded}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-amber-800">{item.level}</td>
                            <td className="px-3 py-2 text-slate-700">
                              <MathText text={item.quickPrimer} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {hasExamples && (
            <div className={drawerOpen && activeTab === "examples" ? "block pt-4 space-y-4" : "hidden"}>
              {model.fadedExamples && model.fadedExamples.length > 0 && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="font-serif text-sm font-semibold text-[#1a2744]">
                      三级渐隐手算 / 案例走查（逐步撤除脚手架）
                    </h3>
                    <span className="font-mono text-[10.5px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      [教学示例，非论文原始数据]
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {model.fadedExamples.map((ex, idx) => (
                      <div key={idx} className="bg-[#fcfaf6] border border-[#ddd6c7] rounded-xl p-3.5 space-y-2">
                        <div className="font-mono text-[11px] font-semibold text-[#1a2744]">
                          {`LEVEL ${ex.level} · ${ex.label}`}
                        </div>
                        <div className="text-slate-800 leading-relaxed">
                          <MathText text={ex.prompt} />
                        </div>
                        <div className="bg-white border border-[#ddd6c7] rounded-lg p-2 text-slate-700 font-mono text-[11px] whitespace-pre-wrap">
                          <MathText text={ex.walkthrough} />
                        </div>
                        {ex.answer && (
                          <details className="bg-white border border-[#ddd6c7] rounded-lg px-2.5 py-1.5">
                            <summary className="cursor-pointer font-mono text-[11px] font-semibold text-[#1a2744]">
                              展开参考推演结果
                            </summary>
                            <div className="mt-1.5 pt-1.5 border-t border-dashed border-[#ddd6c7] text-slate-700 font-mono text-[11px] whitespace-pre-wrap">
                              <MathText text={ex.answer} />
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {model.designChoices && model.designChoices.length > 0 && (
                <div>
                  <h3 className="font-serif text-sm font-semibold text-[#1a2744] mb-2">
                    核心设计选择表（关键权衡与替代方案对照）
                  </h3>
                  <div className="overflow-x-auto border border-[#ddd6c7] rounded-xl">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#f3efe6] text-[#1a2744] font-mono">
                        <tr>
                          <th className="px-3 py-2 border-b border-[#ddd6c7]">关键决策</th>
                          <th className="px-3 py-2 border-b border-[#ddd6c7]">替代方案</th>
                          <th className="px-3 py-2 border-b border-[#ddd6c7]">选择理由</th>
                          <th className="px-3 py-2 border-b border-[#ddd6c7]">消融/证明与证据锚点</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.designChoices.map((row, idx) => (
                          <tr key={idx} className="border-b last:border-b-0 border-[#ebe5d8] bg-white">
                            <td className="px-3 py-2 font-semibold text-[#1a2744]">{row.decision}</td>
                            <td className="px-3 py-2 text-slate-700">{row.alternatives}</td>
                            <td className="px-3 py-2 text-slate-700">
                              <MathText text={row.rationale} />
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              <MathText text={`${row.ablationOrProof}（${row.anchor}）`} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
