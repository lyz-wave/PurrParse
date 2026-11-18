"use client";

import React from "react";
import type { WorkbenchDocument } from "@/core/contracts/document-ast";

interface SubNavBarProps {
  doc: WorkbenchDocument;
}

export function SubNavBar({ doc }: SubNavBarProps) {
  const scrollToAnchor = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="prism-glass-subnav px-5 py-2 overflow-x-auto no-scrollbar">
      <div className="max-w-[1460px] mx-auto flex items-center gap-2 text-xs whitespace-nowrap">
        <button
          type="button"
          onClick={() => scrollToAnchor("mental-model")}
          className="font-mono font-semibold text-[#1a2744] px-2.5 py-1 rounded-full hover:bg-black/5 cursor-pointer transition-colors"
        >
          {doc.labels.mentalNavLabel.replace(/^\[|\]$/g, "")}
        </button>

        <span className="h-3.5 w-px bg-[#d4cab7]/70 shrink-0" aria-hidden="true" />

        {doc.sections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => scrollToAnchor(sec.id)}
            className="text-slate-700 hover:text-[#1a2744] px-2.5 py-1 rounded-full hover:bg-black/5 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <span>{sec.navLabel}</span>
            {sec.navRole && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-[#e6dfd1]/80 text-slate-700">
                {sec.navRole}
              </span>
            )}
          </button>
        ))}

        <span className="h-3.5 w-px bg-[#d4cab7]/70 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={() => scrollToAnchor("bottom-arsenal")}
          className="font-mono font-semibold text-[#1a2744] px-2.5 py-1 rounded-full hover:bg-black/5 cursor-pointer transition-colors"
        >
          {doc.labels.bottomNavLabel.replace(/^\[|\]$/g, "")}
        </button>
      </div>
    </nav>
  );
}
