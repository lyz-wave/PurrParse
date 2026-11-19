"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatBytes, type AppUpdateState } from "@/core/engine/app-updater";
import type { WorkbenchThemeMode } from "@/store/workbench-store";

export interface UpdateBannerProps {
  state: AppUpdateState;
  isDesktopRuntime: boolean;
  dismissed: boolean;
  hidden?: boolean;
  themeMode?: WorkbenchThemeMode;
  onDownload: () => void;
  onCancelDownload: () => void;
  onInstall: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
}

const VISIBLE_STATUSES = new Set(["available", "downloading", "downloaded", "installing"]);

export function UpdateBanner({
  state,
  isDesktopRuntime,
  dismissed,
  hidden = false,
  themeMode = "paper",
  onDownload,
  onCancelDownload,
  onInstall,
  onOpenSettings,
  onDismiss,
}: UpdateBannerProps) {
  const shouldShow = !hidden && !dismissed && VISIBLE_STATUSES.has(state.status);
  const isDark = themeMode === "aurora";

  const surfaceCls = isDark
    ? "bg-[#11192c]/92 border-white/15 text-slate-100 shadow-[0_20px_50px_rgba(2,6,23,0.65)]"
    : themeMode === "studio"
      ? "bg-white/95 border-slate-200 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
      : "bg-[#fcf9f2]/95 border-[#ddd6c7] text-[#1a2744] shadow-[0_18px_45px_rgba(26,39,68,0.14)]";

  const mutedTextCls = isDark ? "text-slate-300" : "text-slate-600";
  const subtleBtnCls = isDark
    ? "border-white/15 text-slate-200 hover:bg-white/10"
    : "border-[#ddd6c7] text-[#1a2744] hover:bg-[#f2ece0]";

  const installLabel =
    state.installMode === "hot-patch"
      ? "重启并应用补丁"
      : state.installMode === "self-replace"
        ? "重启并更新"
        : state.installMode === "installer" && state.assetName?.endsWith(".dmg")
          ? "打开安装包"
          : "安装并重启";

  const headline =
    state.status === "downloading"
      ? `正在下载 v${state.latestVersion ?? ""}`
      : state.status === "downloaded"
        ? `v${state.latestVersion ?? ""} 已就绪`
        : state.status === "installing"
          ? `正在更新至 v${state.latestVersion ?? ""}…`
          : `发现新版本 v${state.latestVersion ?? ""}`;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.aside
          key="app-update-banner"
          data-testid="app-update-banner"
          aria-live="polite"
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={`fixed top-14 right-4 z-40 w-[328px] max-w-[calc(100vw-2rem)] rounded-2xl border backdrop-blur-xl px-4 py-3 ${surfaceCls}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="font-mono text-xs font-bold tracking-tight truncate">
                  {headline}
                </span>
              </div>
              <p className={`text-[11px] mt-1 leading-snug ${mutedTextCls}`}>
                {state.status === "downloading"
                  ? `${formatBytes(state.transferredBytes)} / ${formatBytes(state.totalBytes || state.assetSize || 0)}${
                      state.bytesPerSecond > 0 ? ` · ${formatBytes(state.bytesPerSecond)}/s` : ""
                    }`
                  : state.status === "downloaded"
                    ? state.installMode === "hot-patch"
                      ? "轻量增量补丁已就绪，点击即可秒级应用并重启。"
                      : state.installMode === "self-replace"
                        ? "已完成本地下载，点击即可自动替换并重启应用。"
                        : state.assetName?.endsWith(".dmg")
                          ? "已完成下载，点击打开 DMG 镜像拖入「应用程序」覆盖即可。"
                          : "安装程序已就绪，点击后将关闭当前窗口并启动向导。"
                    : state.status === "installing"
                      ? "正在退出当前服务并应用新版本，请稍候…"
                      : `当前版本 v${state.currentVersion} -> v${state.latestVersion ?? ""}，点击即可升级。`}
              </p>
            </div>
            {state.status !== "installing" && (
              <button
                type="button"
                data-testid="update-banner-dismiss"
                onClick={onDismiss}
                aria-label="稍后提醒更新"
                className={`shrink-0 rounded-full p-1 text-xs cursor-pointer transition-colors ${
                  isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {state.status === "downloading" && (
            <div className="mt-2.5 space-y-1">
              <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-200/70 dark:bg-white/10">
                <div
                  data-testid="update-banner-progress-bar"
                  className="h-full bg-amber-500 transition-all duration-150"
                  style={{ width: `${Math.max(4, state.progressPercent)}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            {state.status !== "installing" && (
              <button
                type="button"
                data-testid="update-banner-details-btn"
                onClick={onOpenSettings}
                className={`font-mono text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${subtleBtnCls}`}
              >
                版本详情
              </button>
            )}

            {state.status === "available" && (
              <button
                type="button"
                data-testid="update-banner-download-btn"
                onClick={onDownload}
                className="prism-on-dark font-mono text-[11px] font-semibold px-3 py-1 rounded-full bg-[#1a2744] hover:bg-[#24365c] text-white cursor-pointer transition-colors"
              >
                {isDesktopRuntime ? "立即下载更新" : "前往下载"}
              </button>
            )}

            {state.status === "downloading" && (
              <button
                type="button"
                data-testid="update-banner-cancel-btn"
                onClick={onCancelDownload}
                className={`font-mono text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${subtleBtnCls}`}
              >
                取消下载
              </button>
            )}

            {state.status === "downloaded" && (
              <button
                type="button"
                data-testid="update-banner-install-btn"
                onClick={onInstall}
                className="prism-on-dark font-mono text-[11px] font-semibold px-3 py-1 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer transition-colors"
              >
                {installLabel}
              </button>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
