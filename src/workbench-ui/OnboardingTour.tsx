"use client";

import React, { useEffect, useState } from "react";
import type { WorkbenchDocument } from "@/core/contracts/document-ast";
import type { WorkbenchThemeMode } from "@/store/workbench-store";
import {
  getPanelGlassTextClasses,
  PanelGlassHeader,
} from "@/components/ui/fluid-orb";

interface OnboardingTourProps {
  open: boolean;
  documents: WorkbenchDocument[];
  activeDocumentId: string;
  paretoMode: boolean;
  themeMode: WorkbenchThemeMode;
  onSelectDocument: (id: string) => void;
  onTogglePareto: () => void;
  onThemeChange: (theme: WorkbenchThemeMode) => void;
  onOpenSettingsForApi: () => void;
  onOpenStudio: () => void;
  onComplete: () => void;
}

const TOTAL_STEPS = 4;

const STARTER_MODE_HINTS: Record<
  string,
  { badge: string; summary: string }
> = {
  "academic-paper": {
    badge: "模块 01 · 学术论文精读",
    summary: "顶会论文原图 + KaTeX 公式白话推导 + 四维拆解，快速吃透 Attention 核心机制。",
  },
  "cognitive-essay": {
    badge: "模块 02 · 认知长文 / 视频内化",
    summary: "剥离情绪渲染，将长文与视频口播压成心智模型、纠偏反思和可勾选行动清单。",
  },
  "repo-deconstruct": {
    badge: "模块 03 · 源码架构拆解",
    summary: "滤除外围胶水脚手架，聚焦 RCD P2 遮挡与 Numba 早停核心链路，附 L1-L3 面试追问。",
  },
};

export function OnboardingTour({
  open,
  documents,
  activeDocumentId,
  paretoMode,
  themeMode,
  onSelectDocument,
  onTogglePareto,
  onThemeChange,
  onOpenSettingsForApi,
  onOpenStudio,
  onComplete,
}: OnboardingTourProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onComplete]);

  if (!open) return null;

  const starterDocs = ["academic-paper", "cognitive-essay", "repo-deconstruct"]
    .map((modeId) => documents.find((d) => d.modeId === modeId))
    .filter((d): d is WorkbenchDocument => Boolean(d));

  const headerCls = getPanelGlassTextClasses(themeMode);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-dialog-title"
      data-testid="onboarding-tour"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onComplete();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-colors"
        style={{
          backgroundColor: "var(--prism-surface)",
          borderColor: "var(--prism-border-strong)",
          color: "var(--prism-ink)",
        }}
      >
        {/* Top bar: Frosted Liquid Glass + FluidOrb dynamic mist */}
        <PanelGlassHeader
          testId="onboarding-tour-header"
          themeMode={themeMode}
          className="px-6 py-4"
          left={
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full ${headerCls.primaryBadge}`}>
                {`第 ${step + 1} / ${TOTAL_STEPS} 步`}
              </span>
              <span className={`text-xs font-medium ${headerCls.subtitle}`}>
                PurrParse 初次使用向导 · 约 30 秒上手
              </span>
            </div>
          }
          right={
            <button
              type="button"
              onClick={onComplete}
              data-testid="onboarding-skip"
              className={`font-mono text-xs font-medium px-3 py-1 rounded-full cursor-pointer transition-colors whitespace-nowrap ${headerCls.ghostBtn}`}
            >
              跳过指引 (Esc)
            </button>
          }
        />

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {step === 0 && (
            <>
              <div>
                <h2
                  id="onboarding-dialog-title"
                  className="font-serif text-xl font-semibold leading-snug"
                  style={{ color: "var(--prism-heading)" }}
                >
                  开箱即配 3 份现成精读范例，三大模块直接点击切换
                </h2>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                  无需先填任何 API Key，下方三份已生成完备的资料各对应一个核心工作台模式，点选卡片即可在背后实时打开浏览：
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {starterDocs.map((doc) => {
                  const hint = STARTER_MODE_HINTS[doc.modeId] ?? {
                    badge: doc.modeName,
                    summary: doc.subtitle,
                  };
                  const isActive = doc.id === activeDocumentId;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      data-testid={`onboarding-starter-${doc.modeId}`}
                      onClick={() => onSelectDocument(doc.id)}
                      className="text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
                      style={{
                        backgroundColor: isActive
                          ? "var(--prism-surface-muted)"
                          : "var(--prism-surface-subtle)",
                        borderColor: isActive ? "#2563eb" : "var(--prism-border)",
                        boxShadow: isActive ? "0 0 0 1px #2563eb" : undefined,
                      }}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border"
                            style={{
                              borderColor: "var(--prism-border-strong)",
                              color: "var(--prism-heading)",
                              backgroundColor: "var(--prism-surface)",
                            }}
                          >
                            {hint.badge}
                          </span>
                          <span
                            className="font-mono text-[11px]"
                            style={{ color: "var(--prism-ink-muted)" }}
                          >
                            {`${doc.units.length} 精读单元`}
                          </span>
                        </div>
                        <div
                          className="text-sm font-semibold truncate"
                          style={{ color: "var(--prism-heading)" }}
                        >
                          {doc.title}
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                          {hint.summary}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 font-mono text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${
                          isActive ? "bg-blue-600 text-white" : "border"
                        }`}
                        style={
                          isActive
                            ? undefined
                            : {
                                borderColor: "var(--prism-border-strong)",
                                color: "var(--prism-heading)",
                                backgroundColor: "var(--prism-surface)",
                              }
                        }
                      >
                        {isActive ? "正在浏览" : "点此预览"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2
                  id="onboarding-dialog-title"
                  className="font-serif text-xl font-semibold leading-snug"
                  style={{ color: "var(--prism-heading)" }}
                >
                  先抓 20/80 骨架与五维高亮，告别从头硬啃
                </h2>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                  工作台顶部栏把整篇文章和源码按重要性分好层，你可以随时在工作台试用这些核心过滤能力：
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  className="p-3.5 rounded-xl border space-y-2"
                  style={{
                    backgroundColor: "var(--prism-surface-subtle)",
                    borderColor: "var(--prism-border)",
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: "var(--prism-heading)" }}>
                    20/80 核心聚焦 &amp; 五维语义色条
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                    点击顶栏的五色高亮胶囊只看「核心论点 / 核心判据」，或开启 20/80 核心聚焦与「第一遍路径」过滤外围胶水段落。
                  </p>
                  <button
                    type="button"
                    data-testid="onboarding-try-pareto"
                    onClick={onTogglePareto}
                    className={`font-mono text-[11px] font-semibold px-3 py-1 rounded-full cursor-pointer transition-colors ${
                      paretoMode ? "bg-amber-400 text-[#1a2744]" : "bg-blue-600 text-white"
                    }`}
                  >
                    {paretoMode ? "已开启 20/80 核心聚焦（点此还原）" : "点此试一下：开启 20/80 核心聚焦"}
                  </button>
                </div>

                <div
                  className="p-3.5 rounded-xl border space-y-2"
                  style={{
                    backgroundColor: "var(--prism-surface-subtle)",
                    borderColor: "var(--prism-border)",
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: "var(--prism-heading)" }}>
                    通读 / 精读 / 复习 &amp; 三态护眼主题
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                    右上角支持切换「通读」纯正文（按 Esc 退出）、双栏「精读」以及「复习」错题追踪，并随时切换稿纸 / 夜空 / 纯白皮肤。
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(
                      [
                        { key: "paper", label: "暖黄稿纸" },
                        { key: "aurora", label: "深夜夜空" },
                        { key: "studio", label: "高对比纯白" },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onThemeChange(item.key)}
                        className={`font-mono text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                          themeMode === item.key ? "bg-blue-600 text-white border-blue-600 font-semibold" : ""
                        }`}
                        style={
                          themeMode === item.key
                            ? undefined
                            : {
                                borderColor: "var(--prism-border-strong)",
                                color: "var(--prism-heading)",
                                backgroundColor: "var(--prism-surface)",
                              }
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2
                  id="onboarding-dialog-title"
                  className="font-serif text-xl font-semibold leading-snug"
                  style={{ color: "var(--prism-heading)" }}
                >
                  如何接入你自己的大模型 API（3 步配好 + 自动检索模型）
                </h2>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                  仅阅读 3 份内置范例免配置 Key；如果想解析自己导入的新论文、长视频或 GitHub 仓库并开启划词 AI 追问，按下面 3 步配置即可（Key 仅保存在你本机浏览器）：
                </p>
              </div>

              <div className="space-y-2.5">
                <div
                  className="p-3.5 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: "var(--prism-surface-subtle)",
                    borderColor: "var(--prism-border)",
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: "var(--prism-heading)" }}>
                    1. 选 Provider 并填 Base URL 与 API Key
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                    打开右上角「设置与导出」，展开第 3 栏「AI 模型引擎配置与模型检索」，选择 Google Gemini / OpenAI / Anthropic / DeepSeek 或 Custom 兼容网关（支持 Ollama、OneAPI 等中转地址）并填入 Key。
                  </p>
                </div>

                <div
                  className="p-3.5 rounded-xl border space-y-2"
                  style={{
                    backgroundColor: "var(--prism-surface-subtle)",
                    borderColor: "var(--prism-border)",
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: "var(--prism-heading)" }}>
                    2. 点「拉取线上可用模型」-&gt; 输入关键词检索并选中模型 -&gt; 保存
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                    不用死记模型 ID：填好 Key 后点击检索即可拉回你账户当下真正可用的模型列表，再用关键字过滤挑选（如 flash、gpt-4o、deepseek、qwen）并点保存。
                  </p>
                  <button
                    type="button"
                    data-testid="onboarding-open-settings"
                    onClick={() => {
                      onComplete();
                      onOpenSettingsForApi();
                    }}
                    className="font-mono text-[11px] font-semibold px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
                  >
                    立即打开 API 设置并检索模型
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2
                  id="onboarding-dialog-title"
                  className="font-serif text-xl font-semibold leading-snug"
                  style={{ color: "var(--prism-heading)" }}
                >
                  划词原位 AI 追问、多源导入与离线带走
                </h2>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                  读到卡壳之处不必切窗另开聊天框，从解析新资料到复习归档都在同一条链路里：
                </p>
              </div>

              <div className="space-y-2.5">
                <div
                  className="p-3.5 rounded-xl border"
                  style={{
                    backgroundColor: "var(--prism-surface-subtle)",
                    borderColor: "var(--prism-border)",
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: "var(--prism-heading)" }}>
                    1. 鼠标拖选左栏原文 / 代码 -&gt; 触发「AI 追问」
                  </div>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                    提问会基于全文与上下文严格标明【原文明示 / 分析推断 / 原文未说明】，问答记录自动落定到当前卡片并显示「已追问 N 次」。
                  </p>
                </div>

                <div
                  className="p-3.5 rounded-xl border"
                  style={{
                    backgroundColor: "var(--prism-surface-subtle)",
                    borderColor: "var(--prism-border)",
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: "var(--prism-heading)" }}>
                    2. 左上角「+ 新建」导入任意 PDF / 视频 / GitHub，支持多格式导出
                  </div>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--prism-ink-muted)" }}>
                    拆解完的资料与随手笔记可随时在「设置与导出」打包导出为 Markdown、Anki 记忆卡片 CSV 或离线独立 .html 文件。
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer controls */}
        <div
          className="px-6 py-3.5 border-t flex flex-wrap items-center justify-between gap-2.5"
          style={{
            backgroundColor: "var(--prism-surface-subtle)",
            borderColor: "var(--prism-border)",
          }}
        >
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3].map((idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === step ? "w-5 bg-blue-600" : "w-1.5 bg-slate-400/50"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="text-xs font-medium px-3.5 py-1.5 rounded-full border cursor-pointer transition-colors"
                style={{
                  borderColor: "var(--prism-border-strong)",
                  color: "var(--prism-heading)",
                  backgroundColor: "var(--prism-surface)",
                }}
              >
                上一步
              </button>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                data-testid="onboarding-next"
                onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
                className="text-xs font-semibold px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
              >
                下一步
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onComplete();
                    onOpenStudio();
                  }}
                  className="text-xs font-medium px-3.5 py-1.5 rounded-full border cursor-pointer transition-colors"
                  style={{
                    borderColor: "var(--prism-border-strong)",
                    color: "var(--prism-heading)",
                    backgroundColor: "var(--prism-surface)",
                  }}
                >
                  完成并打开「+ 新建导入」
                </button>
                <button
                  type="button"
                  data-testid="onboarding-finish"
                  onClick={onComplete}
                  className="text-xs font-semibold px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
                >
                  开始精读体验
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
