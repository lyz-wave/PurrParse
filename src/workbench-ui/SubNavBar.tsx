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
    <nav className="bg-[#f3efe6] border-b border-[#ddd6c7] px-5 py-2 overflow-x-auto">
      <div className="max-w-[1460px] mx-auto flex items-center gap-4 text-xs whitespace-nowrap">
        <button
          type="button"
          onClick={() => scrollToAnchor("mental-model")}
          className="font-mono font-semibold text-[#1a2744] hover:underline cursor-pointer"
        >
          {doc.labels.mentalNavLabel}
        </button>

        {doc.sections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => scrollToAnchor(sec.id)}
            className="text-slate-700 hover:text-[#1a2744] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>{sec.navLabel}</span>
            {sec.navRole && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#e6dfd1] text-slate-600">
                {sec.navRole}
              </span>
            )}
          </button>
        ))}

        <button
          type="button"
          onClick={() => scrollToAnchor("bottom-arsenal")}
          className="font-mono font-semibold text-[#1a2744] hover:underline cursor-pointer"
        >
          {doc.labels.bottomNavLabel}
        </button>
      </div>
    </nav>
  );
}
