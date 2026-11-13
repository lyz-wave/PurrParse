"use client";

import React, { useEffect, useState } from "react";
import type {
  QaEvidenceItem,
  QaFollowUpTurn,
  QaScope,
  UnitQaThread,
  WorkbenchDocument,
  WorkbenchUnit,
} from "@/core/contracts/document-ast";
import type { LLMConfig } from "@/core/engine/llm-adapters";
import { MathText } from "@/workbench-ui/math-text";

export interface SelectionQaOpenPayload {
  unitId: string;
  unitCode: string;
  selectedText: string;
  x: number;
  y: number;
  activeThreadId?: string;
}

interface SelectionQaModalProps {
  open: boolean;
  doc: WorkbenchDocument;
  unit: WorkbenchUnit | null;
  selectedText: string;
  anchorPos: { x: number; y: number } | null;
  activeThread: UnitQaThread | null;
  llmConfig: LLMConfig;
  onSaveThread: (thread: UnitQaThread) => void;
  onAppendFollowUp: (threadId: string, turn: QaFollowUpTurn) => void;
  onJumpToUnit: (targetUnitId: string, originUnitId?: string) => void;
  onClose: () => void;
}

const QUICK_QUESTION_CHIPS = [
  "这段话的核心逻辑或推导过程是什么？",
  "这个概念/机制在全文论证中起什么作用？",
  "能结合上下文给出直观类比或具体数值例子吗？",
  "这个结论或设计有哪些前置假设与适用边界？",
];

function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const SelectionQaModal: React.FC<SelectionQaModalProps> = ({
  open,
  doc,
  unit,
  selectedText,
  anchorPos,
  activeThread,
  llmConfig,
  onSaveThread,
  onAppendFollowUp,
  onJumpToUnit,
  onClose,
}) => {
  const [scope, setScope] = useState<QaScope>("document");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [localThread, setLocalThread] = useState<UnitQaThread | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setQuestion("");
    setCopied(false);
    setSuggestedFollowUps([]);
    setLocalThread(activeThread);
    if (activeThread) {
      setScope(activeThread.scope);
    } else {
      setScope("document");
    }
  }, [open, activeThread, selectedText, unit?.id]);

  if (!open || !unit) return null;

  const currentThread = localThread;
  const totalTurns = currentThread ? 1 + (currentThread.followUps?.length ?? 0) : 0;

  const sectionTitle =
    doc.sections.find((s) => s.id === unit.sectionId)?.title ?? unit.sectionId;

  const handleSubmitQuestion = async (overrideQuestion?: string) => {
    const q = (overrideQuestion ?? question).trim();
    if (!q || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const previousTurns = currentThread
        ? [
            { question: currentThread.question, answer: currentThread.answer },
            ...(currentThread.followUps ?? []).map((f) => ({
              question: f.question,
              answer: f.answer,
            })),
          ]
        : [];

      const contextUnits = doc.units.map((u) => ({
        unitId: u.id,
        unitCode: u.unitCode,
        sectionTitle: doc.sections.find((s) => s.id === u.sectionId)?.title ?? u.sectionId,
        tldr: u.tldr,
        primaryText: u.primaryText,
        secondaryText: u.secondaryBlockText,
      }));

      const res = await fetch("/api/ask-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docTitle: doc.title,
          modeName: doc.modeName,
          unitId: unit.id,
          unitCode: unit.unitCode,
          sectionTitle,
          selectedText: currentThread?.selectedText || selectedText,
          unitPrimaryText: unit.primaryText,
          unitSecondaryText: unit.secondaryBlockText ?? "",
          unitTldr: unit.tldr,
          scope,
          question: q,
          previousTurns,
          contextUnits,
          llmConfig,
        }),
      });

      const data = (await res.json()) as {
        answer?: string;
        scopeUsed?: QaScope;
        evidences?: QaEvidenceItem[];
        suggestedFollowUps?: string[];
        error?: string;
      };

      if (!res.ok || !data.answer) {
        throw new Error(data.error || `请求失败 (${res.status})`);
      }

      const nowIso = new Date().toISOString();
      const evidences = Array.isArray(data.evidences) ? data.evidences : [];

      if (currentThread) {
        const turn: QaFollowUpTurn = {
          id: createLocalId("turn"),
          question: q,
          scope: data.scopeUsed ?? scope,
          answer: data.answer,
          evidences,
          createdAt: nowIso,
        };
        onAppendFollowUp(currentThread.id, turn);
        setLocalThread({
          ...currentThread,
          followUps: [...(currentThread.followUps ?? []), turn],
        });
      } else {
        const newThread: UnitQaThread = {
          id: createLocalId("qa"),
          unitId: unit.id,
          unitCode: unit.unitCode,
          selectedText: selectedText || unit.primaryText.slice(0, 140),
          question: q,
          scope: data.scopeUsed ?? scope,
          answer: data.answer,
          evidences,
          followUps: [],
          createdAt: nowIso,
        };
        onSaveThread(newThread);
        setLocalThread(newThread);
      }

      setSuggestedFollowUps(
        Array.isArray(data.suggestedFollowUps) ? data.suggestedFollowUps : []
      );
      setQuestion("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "AI 追问请求失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1a2744]/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI 划词追问与证据溯源"
        className="w-full max-w-2xl max-h-[88vh] bg-[#fffdf8] border-2 border-[#1a2744] rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#1a2744] text-amber-100 px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-300 text-[#1a2744]">
              {unit.unitCode}
            </span>
            <h2 className="text-sm font-bold tracking-wide">
              [AI 划词追问 · 段落/全文证据溯源]
            </h2>
            {totalTurns > 0 && (
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/15 text-amber-200 border border-amber-300/40">
                本线索已追问 {totalTurns} 次
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs px-2.5 py-1 rounded border border-amber-200/40 text-amber-100 hover:bg-white/10 cursor-pointer"
          >
            [关闭]
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-[#1c1a17]">
          {/* Selected snippet preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[11px] font-semibold text-[#6b655c]">
                [虚线定锚片段] ({sectionTitle})
              </span>
              <div className="flex items-center gap-2">
                {anchorPos && (
                  <span className="font-mono text-[10px] text-[#8a8275]">
                    坐标 ({Math.round(anchorPos.x)}, {Math.round(anchorPos.y)})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const text = currentThread?.selectedText || selectedText || unit.primaryText;
                    void navigator.clipboard?.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="font-mono text-[10px] px-2 py-0.5 rounded border border-[#ddd6c7] bg-white hover:bg-amber-50 text-[#1a2744] cursor-pointer"
                >
                  {copied ? "[已复制]" : "[复制片段]"}
                </button>
              </div>
            </div>
            <div className="border-2 border-dashed border-[#1a2744]/75 bg-amber-50/75 rounded-lg p-3 text-[13px] leading-relaxed font-serif text-[#1a2744]">
              <MathText text={currentThread?.selectedText || selectedText || unit.primaryText} />
            </div>
          </div>

          {/* Scope selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[#5d574e] font-semibold">
              回答依据范围:
            </span>
            <button
              type="button"
              onClick={() => setScope("paragraph")}
              className={`font-mono text-xs px-3 py-1 rounded border cursor-pointer transition-colors ${
                scope === "paragraph"
                  ? "bg-[#1a2744] text-amber-200 border-[#1a2744]"
                  : "bg-white text-[#4b453d] border-[#ddd6c7] hover:bg-[#f6f1e7]"
              }`}
            >
              [基于本段与上下文精讲]
            </button>
            <button
              type="button"
              onClick={() => setScope("document")}
              className={`font-mono text-xs px-3 py-1 rounded border cursor-pointer transition-colors ${
                scope === "document"
                  ? "bg-[#1a2744] text-amber-200 border-[#1a2744]"
                  : "bg-white text-[#4b453d] border-[#ddd6c7] hover:bg-[#f6f1e7]"
              }`}
            >
              [基于全文跨节证据解答]
            </button>
          </div>

          {/* Existing Conversation Thread */}
          {currentThread && (
            <div className="space-y-3 border-t border-[#e5dec9] pt-3">
              <div className="bg-white border border-[#ddd6c7] rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#1a2744]">
                    [追问 #1 · {currentThread.scope === "document" ? "全文证据" : "本段精讲"}]
                  </span>
                  <span className="font-mono text-[10px] text-[#7c7468]">
                    {currentThread.question}
                  </span>
                </div>
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#22201d] bg-[#faf7f0] rounded p-3 border border-[#ede6d8]">
                  <MathText text={currentThread.answer} />
                </div>
                {currentThread.evidences.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="font-mono text-[11px] font-semibold text-[#4b453d]">
                      [回答证据锚点] ({currentThread.evidences.length} 条):
                    </div>
                    {currentThread.evidences.map((ev, idx) => (
                      <div
                        key={`${ev.unitCode}-${idx}`}
                        className="text-xs bg-white border border-dashed border-[#c7bea9] rounded p-2.5 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-bold text-[#1a2744]">
                            [证据 · {ev.unitCode}] {ev.rationale}
                          </span>
                          {ev.unitId && (
                            <button
                              type="button"
                              onClick={() => {
                                onJumpToUnit(ev.unitId!, unit.id);
                                onClose();
                              }}
                              className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#1a2744] text-amber-200 hover:bg-[#24365c] cursor-pointer shrink-0"
                            >
                              [-&gt; 跳转证据段落]
                            </button>
                          )}
                        </div>
                        <blockquote className="text-[12px] text-[#565047] border-l-2 border-[#1a2744]/40 pl-2 italic">
                          <MathText text={ev.quote} />
                        </blockquote>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(currentThread.followUps ?? []).map((turn, idx) => (
                <div
                  key={turn.id}
                  className="bg-white border border-[#ddd6c7] rounded-lg p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#1a2744]">
                      [继续追问 #{idx + 2} ·{" "}
                      {turn.scope === "document" ? "全文证据" : "本段精讲"}]
                    </span>
                    <span className="font-mono text-[10px] text-[#7c7468]">
                      {turn.question}
                    </span>
                  </div>
                  <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#22201d] bg-[#faf7f0] rounded p-3 border border-[#ede6d8]">
                    <MathText text={turn.answer} />
                  </div>
                  {turn.evidences.length > 0 && (
                    <div className="space-y-1.5">
                      {turn.evidences.map((ev, eIdx) => (
                        <div
                          key={`${turn.id}-ev-${eIdx}`}
                          className="text-xs bg-white border border-dashed border-[#c7bea9] rounded p-2 flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-bold text-[#1a2744]">
                              [证据 · {ev.unitCode}] {ev.rationale}
                            </span>
                            {ev.unitId && (
                              <button
                                type="button"
                                onClick={() => {
                                  onJumpToUnit(ev.unitId!, unit.id);
                                  onClose();
                                }}
                                className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#1a2744] text-amber-200 hover:bg-[#24365c] cursor-pointer shrink-0"
                              >
                                [-&gt; 跳转证据段落]
                              </button>
                            )}
                          </div>
                          <blockquote className="text-[12px] text-[#565047] border-l-2 border-[#1a2744]/40 pl-2 italic">
                            <MathText text={ev.quote} />
                          </blockquote>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Suggested follow-up chips or initial quick chips */}
          <div className="space-y-1.5">
            <div className="font-mono text-[11px] font-semibold text-[#6b655c]">
              {currentThread ? "[推荐继续追问]" : "[快捷提问模板]"}:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(suggestedFollowUps.length > 0 ? suggestedFollowUps : QUICK_QUESTION_CHIPS).map(
                (chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmitQuestion(chip)}
                    className="font-mono text-[11px] text-left px-2.5 py-1 rounded border border-[#d6cebc] bg-white hover:bg-amber-50 hover:border-[#1a2744] text-[#2c2823] cursor-pointer disabled:opacity-50"
                  >
                    + {chip}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Question Input */}
          <div className="space-y-2">
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmitQuestion();
                }
              }}
              placeholder={
                currentThread
                  ? "针对以上回答继续追问（支持 Cmd/Ctrl + Enter 提交）..."
                  : "输入你对选中片段的疑问，例如：这里的复杂度推导为什么能降到 O(1)？（支持 Cmd/Ctrl + Enter）"
              }
              className="w-full rounded-lg border border-[#cfc6b4] bg-white p-3 text-sm text-[#1c1a17] focus:outline-none focus:border-[#1a2744]"
            />

            {errorMsg && (
              <div className="font-mono text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-[#7c7468]">
                {llmConfig.apiKey
                  ? `[在线模型] ${llmConfig.model}（附带原文证据校验）`
                  : "[本地证据引擎] 未配置 API Key 时自动启用全文证据检索引擎"}
              </span>
              <button
                type="button"
                disabled={submitting || !question.trim()}
                onClick={() => void handleSubmitQuestion()}
                className="font-mono text-xs font-bold px-4 py-2 rounded-lg bg-[#1a2744] text-amber-200 hover:bg-[#24365c] disabled:opacity-50 cursor-pointer"
              >
                {submitting
                  ? "[正在检索证据并生成解析...]"
                  : currentThread
                    ? "[发送继续追问]"
                    : "[发送 AI 提问]"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
