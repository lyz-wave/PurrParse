"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AiStatus, resolveAnalyzeAiState } from "@/components/ui/ai-status";
import {
  getPanelGlassTextClasses,
  getTopbarGlassStyle,
  PanelGlassHeader,
  TopbarGlassBackdrop,
} from "@/components/ui/fluid-orb";
import type { AnalysisTaskItem, WorkbenchThemeMode } from "@/store/workbench-store";

function formatElapsedSeconds(startedAt: number, finishedAt: number | undefined, now: number): string {
  const end = finishedAt ?? now;
  const totalSec = Math.max(0, Math.floor((end - startedAt) / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export interface TasksTopbarPillProps {
  tasks: AnalysisTaskItem[];
  themeMode: WorkbenchThemeMode;
  open: boolean;
  onToggle: () => void;
}

export function TasksTopbarPill({
  tasks,
  themeMode,
  open,
  onToggle,
}: TasksTopbarPillProps) {
  if (tasks.length === 0) return null;

  const isDark = themeMode === "aurora";
  const runningCount = tasks.filter(
    (t) => t.status === "running" || t.status === "queued"
  ).length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const errorCount = tasks.filter((t) => t.status === "error").length;

  return (
    <button
      type="button"
      data-testid="topbar-tasks-pill"
      onClick={onToggle}
      aria-expanded={open}
      title={open ? "收起后台解析队列面板" : "展开后台解析队列面板"}
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
        runningCount > 0
          ? isDark
            ? "bg-amber-400/18 text-amber-200 border-amber-300/45 hover:bg-amber-400/25"
            : "bg-amber-500/12 text-amber-800 border-amber-500/35 hover:bg-amber-500/20"
          : errorCount > 0
            ? isDark
              ? "bg-rose-400/18 text-rose-200 border-rose-300/45 hover:bg-rose-400/25"
              : "bg-rose-500/12 text-rose-700 border-rose-500/35 hover:bg-rose-500/20"
            : isDark
              ? "bg-emerald-400/18 text-emerald-200 border-emerald-300/45 hover:bg-emerald-400/25"
              : "bg-emerald-500/12 text-emerald-700 border-emerald-500/35 hover:bg-emerald-500/20"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          runningCount > 0
            ? "bg-amber-500 animate-pulse"
            : errorCount > 0
              ? "bg-rose-500"
              : "bg-emerald-500"
        }`}
      />
      <span>
        {runningCount > 0
          ? `后台解析 ${runningCount}`
          : errorCount > 0
            ? `任务异常 ${errorCount}`
            : `解析完成 ${completedCount}`}
      </span>
    </button>
  );
}

export interface BackgroundTasksDockProps {
  tasks: AnalysisTaskItem[];
  themeMode: WorkbenchThemeMode;
  open: boolean;
  isPureMode?: boolean;
  onToggleOpen: () => void;
  onOpenDocument: (docId: string) => void;
  onCancelTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onRemoveTask: (taskId: string) => void;
  onClearFinished: () => void;
}

export function BackgroundTasksDock({
  tasks,
  themeMode,
  open,
  isPureMode = false,
  onToggleOpen,
  onOpenDocument,
  onCancelTask,
  onRetryTask,
  onRemoveTask,
  onClearFinished,
}: BackgroundTasksDockProps) {
  const [now, setNow] = useState(() => Date.now());

  const hasActiveTasks = useMemo(
    () => tasks.some((t) => t.status === "running" || t.status === "queued"),
    [tasks]
  );

  useEffect(() => {
    if (!hasActiveTasks) return;
    setNow(Date.now());
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [hasActiveTasks]);

  if (tasks.length === 0) return null;

  const isDark = themeMode === "aurora";
  const headerCls = getPanelGlassTextClasses(themeMode);

  const runningTasks = tasks.filter((t) => t.status === "running");
  const queuedTasks = tasks.filter((t) => t.status === "queued");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const finishedCount = tasks.length - runningTasks.length - queuedTasks.length;

  const avgActiveProgress =
    runningTasks.length > 0
      ? Math.round(runningTasks.reduce((sum, t) => sum + t.progress, 0) / runningTasks.length)
      : completedTasks.length > 0
        ? 100
        : 0;

  const bottomCls = isPureMode ? "bottom-16" : "bottom-4";

  return (
    <div className={`fixed right-4 ${bottomCls} z-40 pointer-events-none`}>
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.button
            key="tasks-pill"
            type="button"
            data-testid="background-tasks-pill"
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={onToggleOpen}
            style={getTopbarGlassStyle(themeMode)}
            className={`pointer-events-auto relative overflow-hidden flex items-center gap-2.5 rounded-full border px-3.5 py-2 shadow-2xl cursor-pointer transition-colors ${
              isDark
                ? "border-sky-400/30 text-slate-100 hover:border-sky-300/50"
                : "border-[#c6b79c]/70 text-[#1a2744] hover:border-amber-500/60"
            }`}
          >
            <TopbarGlassBackdrop themeMode={themeMode} />
            <div className="relative z-10 flex items-center gap-2 font-mono text-xs">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  hasActiveTasks ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
              <span className="font-semibold">
                {runningTasks.length > 0
                  ? `并行解析中 · ${runningTasks.length} 运行 / ${queuedTasks.length} 排队`
                  : queuedTasks.length > 0
                    ? `排队中 · ${queuedTasks.length}`
                    : `已完成 · ${completedTasks.length} 篇`}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isDark ? "bg-white/12 text-slate-200" : "bg-[#1a2744]/10 text-[#1a2744]"
                }`}
              >
                {avgActiveProgress}%
              </span>
            </div>
          </motion.button>
        ) : (
          <motion.section
            key="tasks-dock"
            data-testid="background-tasks-dock"
            aria-label="后台并行解析任务队列"
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="pointer-events-auto prism-editorial-card w-[368px] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
            style={{
              background: "var(--prism-surface)",
              borderColor: "var(--prism-border)",
              color: "var(--prism-ink)",
            }}
          >
            <PanelGlassHeader
              testId="background-tasks-dock-header"
              themeMode={themeMode}
              className="px-4 py-2.5"
              left={
                <div className="min-w-0">
                  <h3 className={`font-serif text-sm font-semibold leading-tight truncate ${headerCls.heading}`}>
                    后台并行解析队列
                  </h3>
                  <p className={`font-mono text-[10.5px] mt-0.5 whitespace-nowrap ${headerCls.subtitle}`}>
                    {`进行 ${runningTasks.length} · 排队 ${queuedTasks.length} · 完成 ${completedTasks.length}`}
                  </p>
                </div>
              }
              right={
                <div className="flex items-center gap-1">
                  {finishedCount > 0 && (
                    <button
                      type="button"
                      data-testid="tasks-clear-finished-btn"
                      onClick={onClearFinished}
                      className={`font-mono text-[10.5px] px-2 py-0.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${headerCls.subtlePill}`}
                    >
                      清空已结束
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="tasks-collapse-btn"
                    onClick={onToggleOpen}
                    className={`font-mono text-[10.5px] px-2 py-0.5 rounded-full cursor-pointer transition-colors whitespace-nowrap ${headerCls.ghostBtn}`}
                  >
                    收起
                  </button>
                </div>
              }
            />

            <div className="max-h-[340px] overflow-y-auto p-3 space-y-2.5">
              {tasks.map((task) => {
                const isRunning = task.status === "running";
                const isQueued = task.status === "queued";
                const isCompleted = task.status === "completed";
                const isError = task.status === "error";
                const isCancelled = task.status === "cancelled";
                const elapsed = formatElapsedSeconds(task.startedAt, task.finishedAt, now);

                return (
                  <div
                    key={task.id}
                    data-testid={`analysis-task-${task.id}`}
                    className="rounded-xl border p-3 space-y-2 transition-colors"
                    style={{
                      background: "var(--prism-surface-subtle)",
                      borderColor: "var(--prism-border)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span
                            className="font-mono text-[10px] px-1.5 py-0.2 rounded-full border"
                            style={{
                              background: "var(--prism-surface)",
                              borderColor: "var(--prism-border)",
                              color: "var(--prism-ink-muted)",
                            }}
                          >
                            {task.sourceLabel}
                          </span>
                          {task.speedMode === "fast" && (
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full border ${
                                isDark
                                  ? "border-amber-300/40 bg-amber-400/15 text-amber-200"
                                  : "border-amber-500/35 bg-amber-500/12 text-amber-800"
                              }`}
                            >
                              极速
                            </span>
                          )}
                          <span
                            className="font-mono text-[10px]"
                            style={{ color: "var(--prism-ink-muted)" }}
                          >
                            {elapsed}
                          </span>
                        </div>
                        <p
                          className="text-xs font-semibold leading-snug line-clamp-1"
                          style={{ color: "var(--prism-heading)" }}
                          title={task.title}
                        >
                          {task.title}
                        </p>
                      </div>

                      <span
                        className={`font-mono text-[11px] font-semibold shrink-0 ${
                          isCompleted
                            ? isDark
                              ? "text-emerald-300"
                              : "text-emerald-700"
                            : isError
                              ? isDark
                                ? "text-rose-300"
                                : "text-rose-600"
                              : isCancelled
                                ? "opacity-60"
                                : isDark
                                  ? "text-amber-300"
                                  : "text-amber-700"
                        }`}
                      >
                        {isCompleted
                          ? "已完成"
                          : isError
                            ? "失败"
                            : isCancelled
                              ? "已取消"
                              : `${task.progress}%`}
                      </span>
                    </div>

                    {isRunning && (
                      <AiStatus
                        state={resolveAnalyzeAiState(task.progress)}
                        detail={task.message}
                        className="h-6 text-[11.5px]"
                      />
                    )}

                    {!isRunning && (
                      <p
                        className={`text-[11px] leading-snug line-clamp-2 ${
                          isError
                            ? isDark
                              ? "text-rose-300"
                              : "text-rose-600"
                            : ""
                        }`}
                        style={
                          isError ? undefined : { color: "var(--prism-ink-muted)" }
                        }
                      >
                        {isError ? task.error || task.message : task.message}
                      </p>
                    )}

                    {(isRunning || isQueued) && (
                      <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-500/15">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${Math.max(4, task.progress)}%` }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                      {(isRunning || isQueued) && task.hasPartialDoc && task.documentId && (
                        <button
                          type="button"
                          data-testid={`task-open-${task.id}`}
                          onClick={() => onOpenDocument(task.documentId!)}
                          className={`font-mono text-[11px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                            isDark
                              ? "bg-amber-300 text-[#0f172a] hover:bg-amber-200"
                              : "prism-on-dark bg-[#1a2744] text-amber-200 hover:bg-[#24365c]"
                          }`}
                        >
                          边看边生成 →
                        </button>
                      )}

                      {isCompleted && task.documentId && (
                        <button
                          type="button"
                          data-testid={`task-open-${task.id}`}
                          onClick={() => onOpenDocument(task.documentId!)}
                          className={`font-mono text-[11px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                            isDark
                              ? "bg-emerald-400 text-[#0f172a] hover:bg-emerald-300"
                              : "prism-on-dark bg-emerald-700 text-white hover:bg-emerald-600"
                          }`}
                        >
                          立即阅读 →
                        </button>
                      )}

                      {(isRunning || isQueued) && (
                        <button
                          type="button"
                          data-testid={`task-cancel-${task.id}`}
                          onClick={() => onCancelTask(task.id)}
                          className="font-mono text-[11px] px-2 py-1 rounded-lg border cursor-pointer hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                          style={{
                            borderColor: "var(--prism-border)",
                            color: "var(--prism-ink-muted)",
                          }}
                        >
                          取消
                        </button>
                      )}

                      {(isError || isCancelled) && (
                        <button
                          type="button"
                          data-testid={`task-retry-${task.id}`}
                          onClick={() => onRetryTask(task.id)}
                          className="font-mono text-[11px] px-2.5 py-1 rounded-lg border cursor-pointer hover:border-amber-500/60 transition-colors"
                          style={{
                            background: "var(--prism-surface)",
                            borderColor: "var(--prism-border)",
                            color: "var(--prism-heading)",
                          }}
                        >
                          重试
                        </button>
                      )}

                      {(isCompleted || isError || isCancelled) && (
                        <button
                          type="button"
                          data-testid={`task-remove-${task.id}`}
                          onClick={() => onRemoveTask(task.id)}
                          className="font-mono text-[11px] px-2 py-1 rounded-lg cursor-pointer hover:bg-slate-500/10 transition-colors"
                          style={{ color: "var(--prism-ink-muted)" }}
                        >
                          移除
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
