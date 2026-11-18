"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type {
  QaEvidenceItem,
  QaFollowUpTurn,
  QaScope,
  UnitQaThread,
  WorkbenchDocument,
  WorkbenchUnit,
} from "@/core/contracts/document-ast";
import type { LLMConfig } from "@/core/engine/llm-adapters";
import type { WorkbenchThemeMode } from "@/store/workbench-store";
import { AiStatus, type AiStatusState } from "@/components/ui/ai-status";
import {
  getPanelGlassTextClasses,
  PanelGlassHeader,
} from "@/components/ui/fluid-orb";
import { PromptBox, type PromptEffort } from "@/components/ui/prompt-box";
import {
  StreamingResponse,
  type StreamingResponseStatus,
} from "@/components/ui/streaming-response";
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
  themeMode?: WorkbenchThemeMode;
  onSaveThread: (thread: UnitQaThread) => void;
  onAppendFollowUp: (threadId: string, turn: QaFollowUpTurn) => void;
  onJumpToUnit: (targetUnitId: string, originUnitId?: string) => void;
  onClose: () => void;
}

interface ActiveStreamState {
  key: string;
  question: string;
  scope: QaScope;
  effortLabel?: string;
  text: string;
  evidences: QaEvidenceItem[];
  status: StreamingResponseStatus;
  aiStage: AiStatusState;
  startedAt: number;
}

const QA_EFFORTS: PromptEffort[] = [
  { id: "quick", label: "快速精讲" },
  { id: "think", label: "深度剖析", color: "#F5A524" },
  { id: "deep", label: "跨节推演", color: "#F2552C" },
];

const QUICK_QUESTION_CHIPS = [
  "这段话的核心逻辑或推导过程是什么？",
  "这个概念在全文论证中起什么作用？",
  "能给出直观类比或具体数值例子吗？",
  "这个结论有哪些前置假设与边界？",
];

const ROTATING_PLACEHOLDERS = [
  "对这段内容有什么疑问？输入后按 Enter 发送，长按切换深度...",
  "试试追问：作者提出这个设计的核心代价是什么？",
  "长按发送键可在「快速精讲 / 深度剖析 / 跨节推演」间充能切换",
];

function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface QaTurnCardProps {
  index: number;
  question: string;
  scope: QaScope;
  effortLabel?: string;
  answer: string;
  streamStatus?: StreamingResponseStatus;
  aiStage?: AiStatusState;
  elapsedSeconds?: number;
  evidences: QaEvidenceItem[];
  sourceUnitId: string;
  onRetry?: () => void;
  onJumpToUnit: (targetUnitId: string, originUnitId?: string) => void;
  onCloseDrawer: () => void;
}

function QaTurnCard({
  index,
  question,
  scope,
  effortLabel,
  answer,
  streamStatus = "done",
  aiStage,
  elapsedSeconds,
  evidences,
  sourceUnitId,
  onRetry,
  onJumpToUnit,
  onCloseDrawer,
}: QaTurnCardProps) {
  const isStreaming = streamStatus === "streaming";
  const hasAnswerText = answer.trim().length > 0;
  const aiDetail =
    aiStage === "thinking"
      ? effortLabel
        ? `${effortLabel} · 理解语义中`
        : "理解选段语义中"
      : aiStage === "researching"
        ? evidences.length > 0
          ? `命中 ${evidences.length} 处原文依据`
          : "检索跨节上下文"
        : aiStage === "writing"
          ? scope === "document"
            ? "结合跨节证据组织作答"
            : "结合本段脉络作答"
          : undefined;

  return (
    <div className="space-y-2.5">
      {/* User Question Bubble */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="flex justify-end"
      >
        <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-[#1a2744] prism-on-dark text-white border border-white/10 px-3.5 py-2.5 shadow-xs space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-amber-200/90">
            <span>{`追问 #${index}`}</span>
            <span>
              {effortLabel
                ? `${effortLabel} · ${scope === "document" ? "全文" : "本段"}`
                : scope === "document"
                  ? "全文证据"
                  : "本段精讲"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-white">{question}</p>
        </div>
      </motion.div>

      {/* AI Streaming Response Card */}
      <div className="rounded-2xl rounded-tl-sm bg-white border border-[var(--prism-border)] p-3.5 shadow-2xs space-y-3">
        {aiStage && (
          <div
            className={
              hasAnswerText || (!isStreaming && evidences.length > 0)
                ? "pb-2 border-b border-[var(--prism-border)]"
                : undefined
            }
          >
            <AiStatus
              state={aiStage}
              detail={aiDetail}
              elapsed={!isStreaming ? elapsedSeconds : undefined}
              className="h-6 text-[12.5px]"
            />
          </div>
        )}

        {(hasAnswerText || !isStreaming) && (
          <StreamingResponse
            text={answer}
            status={streamStatus}
            speed={18}
            ink="#d97706"
            actions={!isStreaming}
            onRetry={isStreaming ? undefined : onRetry}
          />
        )}

        <AnimatePresence>
          {!isStreaming && evidences.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-1.5 pt-2 border-t border-[var(--prism-border)]"
            >
              <div className="text-[11px] font-mono text-[var(--prism-ink-muted)]">
                {`引用证据 (${evidences.length})`}
              </div>
              {evidences.map((ev, eIdx) => (
                <div
                  key={`${ev.unitCode}-${eIdx}`}
                  className="rounded-xl bg-[var(--prism-surface-muted)] px-3 py-2 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[var(--prism-heading)] truncate">
                      {`${ev.unitCode} · ${ev.rationale}`}
                    </span>
                    {ev.unitId && (
                      <button
                        type="button"
                        onClick={() => {
                          onJumpToUnit(ev.unitId!, sourceUnitId);
                          onCloseDrawer();
                        }}
                        className="prism-on-dark shrink-0 text-[10.5px] font-medium px-2.5 py-0.5 rounded-full bg-[#1a2744] text-amber-200 hover:bg-[#24365c] cursor-pointer transition-colors"
                      >
                        跳转原处 →
                      </button>
                    )}
                  </div>
                  <blockquote className="text-[11.5px] text-[var(--prism-ink-muted)] border-l-2 border-[var(--prism-border-strong)] pl-2 italic">
                    <MathText text={ev.quote} />
                  </blockquote>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const SelectionQaModal: React.FC<SelectionQaModalProps> = ({
  open,
  doc,
  unit,
  selectedText,
  activeThread,
  llmConfig,
  themeMode = "paper",
  onSaveThread,
  onAppendFollowUp,
  onJumpToUnit,
  onClose,
}) => {
  const [scope, setScope] = useState<QaScope>("document");
  const [question, setQuestion] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [localThread, setLocalThread] = useState<UnitQaThread | null>(null);
  const [activeStream, setActiveStream] = useState<ActiveStreamState | null>(null);
  const [liveStatusByTurnId, setLiveStatusByTurnId] = useState<
    Record<string, StreamingResponseStatus>
  >({});
  const [liveMetaByTurnId, setLiveMetaByTurnId] = useState<
    Record<string, { stage: AiStatusState; elapsedSeconds?: number }>
  >({});
  const [copied, setCopied] = useState(false);
  const [excerptExpanded, setExcerptExpanded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollFeedRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const prevSessionKeyRef = useRef<string>("");
  const committedThreadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const sessionKey = open ? `${unit?.id ?? ""}::${selectedText}::${activeThread?.id ?? ""}` : "";

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setActiveStream(null);
      prevSessionKeyRef.current = "";
      committedThreadIdsRef.current.clear();
      return;
    }

    setLocalThread(activeThread);

    const prevKey = prevSessionKeyRef.current;
    const isCommittedThreadUpdate =
      Boolean(activeThread?.id) && committedThreadIdsRef.current.has(activeThread!.id);

    if (sessionKey !== prevKey && !isCommittedThreadUpdate) {
      prevSessionKeyRef.current = sessionKey;
      setErrorMsg(null);
      setQuestion("");
      setCopied(false);
      setExcerptExpanded(false);
      setSuggestedFollowUps([]);
      setActiveStream(null);
      setLiveStatusByTurnId({});
      setLiveMetaByTurnId({});
      setScope(activeThread ? activeThread.scope : "document");
    } else {
      prevSessionKeyRef.current = sessionKey;
    }
  }, [open, activeThread, sessionKey]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const scrollToLatest = useCallback(() => {
    const el = scrollFeedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (activeStream) {
      scrollToLatest();
    }
  }, [activeStream?.text, activeStream?.status, scrollToLatest]);

  if (!open || !unit) return null;

  const currentThread = localThread;
  const isStreaming = activeStream?.status === "streaming";
  const savedTurnsCount = currentThread ? 1 + (currentThread.followUps?.length ?? 0) : 0;
  const totalTurns = savedTurnsCount + (activeStream ? 1 : 0);
  const displaySnippet = currentThread?.selectedText || selectedText || unit.primaryText;
  const isLongSnippet = displaySnippet.length > 150;
  const sectionTitle =
    doc.sections.find((s) => s.id === unit.sectionId)?.title ?? unit.sectionId;

  const commitFinishedTurn = (params: {
    turnKey: string;
    q: string;
    usedScope: QaScope;
    answer: string;
    evidences: QaEvidenceItem[];
    status: StreamingResponseStatus;
    startedAt?: number;
  }) => {
    const nowIso = new Date().toISOString();
    const elapsedSeconds = params.startedAt
      ? Math.max(1, Math.round((Date.now() - params.startedAt) / 1000))
      : undefined;
    setLiveStatusByTurnId((prev) => ({ ...prev, [params.turnKey]: params.status }));
    setLiveMetaByTurnId((prev) => ({
      ...prev,
      [params.turnKey]: {
        stage: params.status === "stopped" ? "error" : "done",
        elapsedSeconds,
      },
    }));

    if (currentThread) {
      committedThreadIdsRef.current.add(currentThread.id);
      const turn: QaFollowUpTurn = {
        id: params.turnKey,
        question: params.q,
        scope: params.usedScope,
        answer: params.answer,
        evidences: params.evidences,
        createdAt: nowIso,
      };
      onAppendFollowUp(currentThread.id, turn);
      setLocalThread({
        ...currentThread,
        followUps: [...(currentThread.followUps ?? []), turn],
      });
    } else {
      const newThread: UnitQaThread = {
        id: params.turnKey,
        unitId: unit.id,
        unitCode: unit.unitCode,
        selectedText: selectedText || unit.primaryText.slice(0, 140),
        question: params.q,
        scope: params.usedScope,
        answer: params.answer,
        evidences: params.evidences,
        followUps: [],
        createdAt: nowIso,
      };
      committedThreadIdsRef.current.add(newThread.id);
      onSaveThread(newThread);
      setLocalThread(newThread);
    }
    setActiveStream(null);
  };

  const handleStopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (!activeStream) return;

    const partial = activeStream.text.trim();
    if (partial) {
      commitFinishedTurn({
        turnKey: activeStream.key,
        q: activeStream.question,
        usedScope: activeStream.scope,
        answer: `${partial}\n\n[已手动停止生成]`,
        evidences: activeStream.evidences,
        status: "stopped",
        startedAt: activeStream.startedAt,
      });
    } else {
      setQuestion(activeStream.question);
      setActiveStream(null);
    }
  };

  const handleSubmitQuestion = async (
    overrideQuestion?: string,
    effort: PromptEffort = QA_EFFORTS[0]
  ) => {
    const q = (overrideQuestion ?? question).trim();
    if (!q || isStreaming) return;

    const effectiveScope: QaScope = effort.id === "deep" ? "document" : scope;
    const turnKey = createLocalId(currentThread ? "turn" : "qa");
    const startedAt = Date.now();

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErrorMsg(null);
    setQuestion("");
    setActiveStream({
      key: turnKey,
      question: q,
      scope: effectiveScope,
      effortLabel: effort.label,
      text: "",
      evidences: [],
      status: "streaming",
      aiStage: "thinking",
      startedAt,
    });

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
        signal: controller.signal,
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
          scope: effectiveScope,
          effort: (effort.id === "quick" || effort.id === "deep" ? effort.id : "think") as
            | "quick"
            | "think"
            | "deep",
          stream: true,
          question: q,
          previousTurns,
          contextUnits,
          llmConfig,
        }),
      });

      if (!res.ok) {
        const errPayload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errPayload.error || `请求失败 (${res.status})`);
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/x-ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";
        let latestEvidences: QaEvidenceItem[] = [];
        let latestScope: QaScope = effectiveScope;
        let receivedDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            const ev = JSON.parse(line) as
              | { type: "meta"; scopeUsed?: QaScope; evidences?: QaEvidenceItem[] }
              | { type: "delta"; text: string }
              | {
                  type: "done";
                  answer: string;
                  scopeUsed?: QaScope;
                  evidences?: QaEvidenceItem[];
                  suggestedFollowUps?: string[];
                }
              | { type: "error"; message: string };

            if (!mountedRef.current || controller.signal.aborted) return;

            if (ev.type === "meta") {
              latestScope = ev.scopeUsed ?? effectiveScope;
              latestEvidences = Array.isArray(ev.evidences) ? ev.evidences : [];
              setActiveStream((prev) =>
                prev
                  ? {
                      ...prev,
                      scope: latestScope,
                      evidences: latestEvidences,
                      aiStage: latestEvidences.length > 0 ? "researching" : "thinking",
                    }
                  : prev
              );
            } else if (ev.type === "delta") {
              accumulatedText += ev.text;
              const nextText = accumulatedText;
              setActiveStream((prev) =>
                prev ? { ...prev, text: nextText, aiStage: "writing" } : prev
              );
            } else if (ev.type === "done") {
              receivedDone = true;
              const finalEvidences = Array.isArray(ev.evidences)
                ? ev.evidences
                : latestEvidences;
              setSuggestedFollowUps(
                Array.isArray(ev.suggestedFollowUps) ? ev.suggestedFollowUps : []
              );
              commitFinishedTurn({
                turnKey,
                q,
                usedScope: ev.scopeUsed ?? latestScope,
                answer: ev.answer || accumulatedText,
                evidences: finalEvidences,
                status: "done",
                startedAt,
              });
            } else if (ev.type === "error") {
              throw new Error(ev.message);
            }
          }
        }

        if (!receivedDone && !controller.signal.aborted && accumulatedText.trim()) {
          commitFinishedTurn({
            turnKey,
            q,
            usedScope: latestScope,
            answer: accumulatedText,
            evidences: latestEvidences,
            status: "done",
            startedAt,
          });
        }
      } else {
        const data = (await res.json()) as {
          answer?: string;
          scopeUsed?: QaScope;
          evidences?: QaEvidenceItem[];
          suggestedFollowUps?: string[];
          error?: string;
        };
        if (!data.answer) {
          throw new Error(data.error || "未返回有效回答");
        }
        if (!mountedRef.current || controller.signal.aborted) return;

        setSuggestedFollowUps(
          Array.isArray(data.suggestedFollowUps) ? data.suggestedFollowUps : []
        );
        commitFinishedTurn({
          turnKey,
          q,
          usedScope: data.scopeUsed ?? effectiveScope,
          answer: data.answer,
          evidences: Array.isArray(data.evidences) ? data.evidences : [],
          status: "done",
          startedAt,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (!mountedRef.current) return;
      setActiveStream(null);
      setQuestion(q);
      setErrorMsg(err instanceof Error ? err.message : "AI 追问请求失败");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const quickChips = suggestedFollowUps.length > 0 ? suggestedFollowUps : QUICK_QUESTION_CHIPS;
  const headerCls = getPanelGlassTextClasses(themeMode);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Light subtle backdrop so source reading context remains visible on the left */}
      <div
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-[1px] prism-backdrop-enter"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="AI 划词追问与证据溯源"
        data-testid="ai-qa-drawer"
        className="relative z-10 w-full max-w-[476px] h-full md:rounded-l-2xl bg-[#faf8f5] shadow-2xl border-l border-[#ddd6c7] flex flex-col overflow-hidden prism-drawer-right-enter"
      >
        {/* Frosted Liquid Glass + FluidOrb Dynamic Fog Header */}
        <PanelGlassHeader
          testId="qa-drawer-header"
          themeMode={themeMode}
          className="py-4"
          left={
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full ${headerCls.primaryBadge}`}>
                  {unit.unitCode}
                </span>
                <h2 className={`font-serif text-base font-semibold tracking-tight ${headerCls.heading}`}>
                  AI 精读助手
                </h2>
                {totalTurns > 0 && (
                  <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${headerCls.subtlePill}`}>
                    {`${totalTurns} 轮`}
                  </span>
                )}
                {isStreaming && (
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded-full animate-pulse ${
                      headerCls.isDark
                        ? "bg-amber-400/20 text-amber-200 border border-amber-300/25"
                        : "bg-amber-500/15 text-amber-900 border border-amber-500/30"
                    }`}
                  >
                    实时流式推演中
                  </span>
                )}
              </div>
              <p className={`text-[11px] truncate mt-1 ${headerCls.subtitle}`}>{sectionTitle}</p>
            </div>
          }
          right={
            <button
              type="button"
              onClick={onClose}
              className={`font-mono text-xs px-3 py-1.5 rounded-full cursor-pointer shrink-0 transition-colors ${headerCls.ghostBtn}`}
            >
              关闭
            </button>
          }
        />

        {/* Clean Collapsible Quoted Excerpt */}
        <div className="px-4 pt-3.5 pb-3 border-b border-[var(--prism-border)] bg-[var(--prism-surface-subtle)] shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-mono text-[var(--prism-ink-muted)]">引用选段</span>
            <div className="flex items-center gap-1.5">
              {isLongSnippet && (
                <button
                  type="button"
                  onClick={() => setExcerptExpanded((p) => !p)}
                  className="text-[11px] px-2 py-0.5 rounded-full text-[var(--prism-ink-muted)] hover:bg-[var(--prism-surface-muted)] cursor-pointer transition-colors"
                >
                  {excerptExpanded ? "收起" : "展开全文"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(displaySnippet);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--prism-surface)] border border-[var(--prism-border)] hover:bg-[var(--prism-surface-muted)] text-[var(--prism-heading)] cursor-pointer transition-colors"
              >
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          </div>

          <div
            data-testid="qa-selected-excerpt"
            className="rounded-xl bg-white border border-[var(--prism-border)] border-l-[3px] border-l-[var(--prism-accent-line)] px-3.5 py-2.5 text-[12.5px] leading-relaxed font-serif text-[var(--prism-ink)]"
          >
            <div className={excerptExpanded ? "" : "line-clamp-3"}>
              <MathText text={displaySnippet} />
            </div>
          </div>

          {/* Rounded Segmented Scope Selector */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] text-[var(--prism-ink-muted)]">解答依据</span>
            <div className="inline-flex items-center gap-1 rounded-full bg-[var(--prism-surface-muted)] p-0.5">
              <button
                type="button"
                onClick={() => setScope("paragraph")}
                className={`text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                  scope === "paragraph"
                    ? "prism-on-dark bg-[#1a2744] text-white font-medium shadow-2xs border border-white/10"
                    : "text-[var(--prism-ink-muted)] hover:text-[var(--prism-heading)]"
                }`}
              >
                本段上下文精讲
              </button>
              <button
                type="button"
                onClick={() => setScope("document")}
                className={`text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                  scope === "document"
                    ? "prism-on-dark bg-[#1a2744] text-white font-medium shadow-2xs border border-white/10"
                    : "text-[var(--prism-ink-muted)] hover:text-[var(--prism-heading)]"
                }`}
              >
                全文跨节证据
              </button>
            </div>
          </div>
        </div>

        {/* Conversation Feed */}
        <div
          ref={scrollFeedRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm scroll-smooth"
        >
          {!currentThread && !activeStream ? (
            <div className="space-y-3 pt-1">
              <div className="text-xs font-medium text-[var(--prism-ink-muted)]">
                可直接点选常见问题，或在下方输入你的疑问：
              </div>
              <div className="space-y-2">
                {QUICK_QUESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => void handleSubmitQuestion(chip, QA_EFFORTS[0])}
                    className="w-full text-left text-xs px-3.5 py-2.5 rounded-xl bg-white border border-[var(--prism-border)] hover:border-[var(--prism-accent-line)] hover:bg-[var(--prism-surface-muted)] text-[var(--prism-ink)] cursor-pointer transition-all disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                ...(currentThread
                  ? [
                      {
                        key: currentThread.id,
                        question: currentThread.question,
                        scope: currentThread.scope,
                        effortLabel: undefined as string | undefined,
                        answer: currentThread.answer,
                        evidences: currentThread.evidences,
                        status: (liveStatusByTurnId[currentThread.id] ?? "done") as StreamingResponseStatus,
                        aiStage: liveMetaByTurnId[currentThread.id]?.stage,
                        elapsedSeconds: liveMetaByTurnId[currentThread.id]?.elapsedSeconds,
                      },
                      ...(currentThread.followUps ?? []).map((t) => ({
                        key: t.id,
                        question: t.question,
                        scope: t.scope,
                        effortLabel: undefined as string | undefined,
                        answer: t.answer,
                        evidences: t.evidences,
                        status: (liveStatusByTurnId[t.id] ?? "done") as StreamingResponseStatus,
                        aiStage: liveMetaByTurnId[t.id]?.stage,
                        elapsedSeconds: liveMetaByTurnId[t.id]?.elapsedSeconds,
                      })),
                    ]
                  : []),
                ...(activeStream
                  ? [
                      {
                        key: activeStream.key,
                        question: activeStream.question,
                        scope: activeStream.scope,
                        effortLabel: activeStream.effortLabel,
                        answer: activeStream.text,
                        evidences: activeStream.evidences,
                        status: activeStream.status,
                        aiStage: activeStream.aiStage,
                        elapsedSeconds: undefined as number | undefined,
                      },
                    ]
                  : []),
              ].map((turn, idx) => (
                <QaTurnCard
                  key={turn.key}
                  index={idx + 1}
                  question={turn.question}
                  scope={turn.scope}
                  effortLabel={turn.effortLabel}
                  answer={turn.answer}
                  streamStatus={turn.status}
                  aiStage={turn.aiStage}
                  elapsedSeconds={turn.elapsedSeconds}
                  evidences={turn.evidences}
                  sourceUnitId={unit.id}
                  onRetry={
                    turn.status === "streaming"
                      ? undefined
                      : () => void handleSubmitQuestion(turn.question, QA_EFFORTS[1])
                  }
                  onJumpToUnit={onJumpToUnit}
                  onCloseDrawer={onClose}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sticky Bottom Rare UI PromptBox Composer */}
        <div className="border-t border-[var(--prism-border)] bg-[var(--prism-surface-subtle)] px-4 py-3 space-y-2.5 shrink-0">
          {currentThread && quickChips.length > 0 && !isStreaming && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {quickChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void handleSubmitQuestion(chip, QA_EFFORTS[0])}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-[var(--prism-border)] hover:border-[var(--prism-accent-line)] hover:bg-[var(--prism-surface-muted)] text-[var(--prism-ink)] whitespace-nowrap cursor-pointer transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {errorMsg && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {errorMsg}
            </div>
          )}

          <PromptBox
            value={question}
            onValueChange={setQuestion}
            status={isStreaming ? "streaming" : "idle"}
            efforts={QA_EFFORTS}
            placeholder={
              currentThread
                ? ["继续针对上文追问...（Enter 发送）", ...ROTATING_PLACEHOLDERS.slice(1)]
                : ROTATING_PLACEHOLDERS
            }
            hint="长按切换深度"
            onSubmit={(prompt, effort) => void handleSubmitQuestion(prompt, effort)}
            onStop={handleStopStreaming}
            actions={
              <span className="font-mono text-[10.5px] text-[var(--prism-ink-muted)] truncate">
                {llmConfig.apiKey ? `流式在线 · ${llmConfig.model}` : "本地证据流式引擎"}
              </span>
            }
          />
        </div>
      </aside>
    </div>
  );
};
