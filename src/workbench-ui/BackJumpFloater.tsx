"use client";

import React from "react";
import { useWorkbenchStore } from "@/store/workbench-store";

export function BackJumpFloater() {
  const originId = useWorkbenchStore((s) => s.backJumpOriginId);
  const returnToOrigin = useWorkbenchStore((s) => s.returnToOrigin);

  if (!originId) return null;

  return (
    <button
      type="button"
      onClick={returnToOrigin}
      className="fixed right-6 bottom-6 z-40 rounded-full bg-[#1a2744] hover:bg-[#24365c] text-white font-mono text-xs px-4 py-2.5 shadow-xl border border-slate-400/30 cursor-pointer transition-transform active:scale-95"
    >
      [&lt;- 返回原阅读位置]
    </button>
  );
}
