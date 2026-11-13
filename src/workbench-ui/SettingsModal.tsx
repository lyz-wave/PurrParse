"use client";

import React, { useEffect, useState } from "react";
import type { WorkbenchDocument } from "@/core/contracts/document-ast";
import type { LLMConfig, LLMProviderId } from "@/core/engine/llm-adapters";

interface SettingsModalProps {
  open: boolean;
  doc: WorkbenchDocument;
  config: LLMConfig;
  hideSecondary: boolean;
  hideNotes: boolean;
  autoHideHeader: boolean;
  onToggleSecondary: () => void;
  onToggleNotes: () => void;
  onToggleAutoHideHeader: () => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onExportAnkiCsv?: () => void;
  onSave: (config: LLMConfig) => void;
  onClose: () => void;
}

const PROVIDER_DEFAULTS: Record<
  LLMProviderId,
  { label: string; defaultModel: string; hint: string }
> = {
  google: {
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    hint: "推荐 gemini-2.5-flash 或 gemini-2.5-pro",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    hint: "推荐 gpt-4o-mini 或 gpt-4o",
  },
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "claude-3-7-sonnet-latest",
    hint: "推荐 claude-3-7-sonnet-latest",
  },
  deepseek: {
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    hint: "默认请求 https://api.deepseek.com/v1",
  },
  custom: {
    label: "Custom (OpenAI 兼容接口)",
    defaultModel: "qwen-plus",
    hint: "支持本地 Ollama / vLLM / 任何 OpenAI 兼容网关",
  },
};

export function SettingsModal({
  open,
  doc,
  config,
  hideSecondary,
  hideNotes,
  autoHideHeader,
  onToggleSecondary,
  onToggleNotes,
  onToggleAutoHideHeader,
  onExportMarkdown,
  onExportHtml,
  onExportAnkiCsv,
  onSave,
  onClose,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<LLMConfig>(config);

  useEffect(() => {
    if (open) {
      setDraft(config);
    }
  }, [open, config]);

  if (!open) return null;

  const formulaOrTableCount =
    doc.completionChecklist?.formulaOrTableCount ??
    doc.units.filter((u) => (u.formulas && u.formulas.length > 0) || Boolean(u.dataTable)).length;

  const handleProviderChange = (provider: LLMProviderId) => {
    setDraft((prev) => ({
      ...prev,
      provider,
      model: PROVIDER_DEFAULTS[provider].defaultModel,
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="工作台设置与导出中心"
        className="w-full max-w-2xl max-h-[90vh] rounded-xl bg-[#faf8f5] border border-[#ddd6c7] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-5 py-3.5 bg-[#1a2744] text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-serif text-lg font-semibold">工作台设置、视图与导出中心</h2>
            <p className="text-xs text-slate-300">
              低频视图开关、导出归档、全文覆盖清单与 AI 模型配置均集中于此，释放正文阅读视野。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 cursor-pointer"
          >
            [关闭]
          </button>
        </div>

        <div className="p-5 space-y-5 text-sm overflow-y-auto">
          {/* Section 1: View & Topbar Behavior */}
          <section className="rounded-lg border border-[#ddd6c7] bg-white p-4 space-y-3">
            <div className="font-mono text-xs font-bold text-[#1a2744] uppercase tracking-wide">
              [1. 阅读视图与顶栏行为]
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onToggleAutoHideHeader}
                className={`font-mono text-xs px-3 py-2 rounded-md border text-left cursor-pointer transition-colors ${
                  autoHideHeader
                    ? "bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold"
                    : "bg-[#fcfbf8] text-slate-700 border-[#ddd6c7] hover:bg-[#f3efe6]"
                }`}
              >
                {autoHideHeader ? "[开] 滚动自动收起顶栏" : "[关] 始终固定单行顶栏"}
              </button>
              <button
                type="button"
                onClick={onToggleSecondary}
                className={`font-mono text-xs px-3 py-2 rounded-md border text-left cursor-pointer transition-colors ${
                  hideSecondary
                    ? "bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold"
                    : "bg-[#fcfbf8] text-slate-700 border-[#ddd6c7] hover:bg-[#f3efe6]"
                }`}
              >
                {`${hideSecondary ? "[已隐藏]" : "[显示中]"} ${doc.labels.toggleSecondaryButton}`}
              </button>
              <button
                type="button"
                onClick={onToggleNotes}
                className={`font-mono text-xs px-3 py-2 rounded-md border text-left cursor-pointer transition-colors ${
                  hideNotes
                    ? "bg-[#1a2744] text-amber-200 border-[#1a2744] font-semibold"
                    : "bg-[#fcfbf8] text-slate-700 border-[#ddd6c7] hover:bg-[#f3efe6]"
                }`}
              >
                {`${hideNotes ? "[已隐藏]" : "[显示中]"} ${doc.labels.toggleNotesButton}`}
              </button>
            </div>
          </section>

          {/* Section 2: Exports & Completion Checklist */}
          <section className="rounded-lg border border-[#ddd6c7] bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-[#1a2744] uppercase tracking-wide">
                [2. 笔记导出与全文覆盖清单]
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {`单元 ${doc.units.length} 条 | 公式/表 ${formulaOrTableCount} 处 | 章节 ${doc.sections.length} 个`}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onExportMarkdown}
                className="font-mono text-xs px-3 py-1.5 rounded border border-emerald-600/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold cursor-pointer"
              >
                {doc.labels.exportMdButton}
              </button>
              {onExportAnkiCsv && (
                <button
                  type="button"
                  onClick={onExportAnkiCsv}
                  className="font-mono text-xs px-3 py-1.5 rounded border border-purple-600/30 bg-purple-50 hover:bg-purple-100 text-purple-900 font-semibold cursor-pointer"
                >
                  [导出 Anki CSV]
                </button>
              )}
              <button
                type="button"
                onClick={onExportHtml}
                className="font-mono text-xs px-3 py-1.5 rounded border border-blue-600/30 bg-blue-50 hover:bg-blue-100 text-blue-900 font-semibold cursor-pointer"
              >
                {doc.labels.exportHtmlButton}
              </button>
            </div>

            <div className="rounded bg-[#fcfbf8] border border-[#e8e1d3] p-3 text-xs text-slate-600 space-y-1">
              <div className="font-mono text-[11px] text-[#1a2744] font-semibold">
                {doc.completionChecklist?.modeDescription ?? `${doc.modeName}（全量结构化工作台）`}
              </div>
              <div>
                认识论溯源徽章：[原文明示] = 原文直接陈述 | [分析推断] = 逻辑推导与解释 | [原文未说明] = 未提供充分证据 | [原文不一致] = 保留原矛盾
              </div>
              {(doc.completionChecklist?.inconsistencies?.length ?? 0) > 0 && (
                <div className="text-rose-700">
                  原文差异提示：{doc.completionChecklist?.inconsistencies.join("；")}
                </div>
              )}
            </div>
          </section>

          {/* Section 3: LLM Engine Configuration (BYOK) */}
          <section className="rounded-lg border border-[#ddd6c7] bg-white p-4">
            <div className="font-mono text-xs font-bold text-[#1a2744] uppercase tracking-wide mb-3">
              [3. AI 模型引擎配置 (BYOK)]
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSave(draft);
                onClose();
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1">
                    模型提供方 (Provider)
                  </label>
                  <select
                    value={draft.provider}
                    onChange={(e) => handleProviderChange(e.target.value as LLMProviderId)}
                    className="w-full rounded-md border border-[#ddd6c7] bg-white px-3 py-2 text-sm"
                  >
                    {(Object.keys(PROVIDER_DEFAULTS) as LLMProviderId[]).map((key) => (
                      <option key={key} value={key}>
                        {PROVIDER_DEFAULTS[key].label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {PROVIDER_DEFAULTS[draft.provider].hint}
                  </p>
                </div>

                <div>
                  <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1">
                    模型名称 (Model ID)
                  </label>
                  <input
                    type="text"
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                    placeholder={PROVIDER_DEFAULTS[draft.provider].defaultModel}
                    className="w-full rounded-md border border-[#ddd6c7] bg-white px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1">
                  API Key（留空则启用离线启发式分析）
                </label>
                <input
                  type="password"
                  value={draft.apiKey}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  placeholder="sk-... 或 AIza..."
                  className="w-full rounded-md border border-[#ddd6c7] bg-white px-3 py-2 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-semibold text-[#1a2744] mb-1">
                  自定义 Base URL（可选）
                </label>
                <input
                  type="text"
                  value={draft.baseUrl ?? ""}
                  onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="w-full rounded-md border border-[#ddd6c7] bg-white px-3 py-2 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ddd6c7]">
                <button
                  type="button"
                  onClick={onClose}
                  className="font-mono text-xs px-3.5 py-2 rounded border border-[#ddd6c7] bg-white hover:bg-slate-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="font-mono text-xs px-4 py-2 rounded bg-[#1a2744] hover:bg-[#24365c] text-white font-semibold cursor-pointer"
                >
                  保存模型配置
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
