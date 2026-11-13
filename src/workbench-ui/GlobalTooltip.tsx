"use client";

import React from "react";
import { useWorkbenchStore } from "@/store/workbench-store";

export function GlobalTooltip() {
  const tooltip = useWorkbenchStore((s) => s.tooltip);
  if (!tooltip.visible || !tooltip.text) return null;

  const winW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const winH = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.max(12, Math.min(winW - 340, tooltip.x + 14));
  const top = Math.max(12, Math.min(winH - 130, tooltip.y + 14));

  return (
    <div
      role="tooltip"
      style={{ left, top }}
      className="fixed z-50 max-w-[320px] rounded-lg bg-[#111827] text-white text-xs leading-relaxed px-3 py-2 shadow-xl border border-slate-700 pointer-events-none"
    >
      {tooltip.text}
    </div>
  );
}
