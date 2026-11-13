import type { UserAnnotationsState, WorkbenchDocument } from "@/core/contracts/document-ast";

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

/**
 * Generates an Anki-ready UTF-8 CSV (with BOM for Excel / Anki desktop compatibility).
 * Columns: 正面,背面,标签
 */
export function exportDocumentToAnkiCsv(
  doc: WorkbenchDocument,
  annotations?: UserAnnotationsState
): string {
  const slugTag =
    doc.title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 28) || doc.modeId;

  const rows: string[][] = [["正面", "背面", "标签"]];

  // 1. Glossary Cards
  for (const term of doc.topMentalModel.glossary) {
    rows.push([
      `[术语/概念] ${term.term}${term.badge ? ` (${term.badge})` : ""}`,
      term.definition,
      `${slugTag} ${doc.modeId} glossary`,
    ]);
  }

  // 2. Pretest Cards
  for (const pre of doc.topMentalModel.pretestItems ?? []) {
    rows.push([
      `[读前预测试] ${pre.question}`,
      pre.answer,
      `${slugTag} ${doc.modeId} pretest`,
    ]);
  }

  // 3. Unit Self-Explanation & Fuzzy Focus Cards
  for (const unit of doc.units) {
    const status = annotations?.unitUnderstanding?.[unit.id];
    const priorityTag = status === "fuzzy" || status === "confused" ? ` ${status}` : "";
    if (unit.selfExplainPrompt) {
      rows.push([
        `[${unit.unitCode} · 为什么] ${unit.selfExplainPrompt.question}`,
        unit.selfExplainPrompt.answer,
        `${slugTag} ${unit.sectionId}${priorityTag}`,
      ]);
    } else if (status === "fuzzy" || status === "confused") {
      rows.push([
        `[${unit.unitCode} · 待攻克复习] ${unit.tldr}`,
        unit.secondaryBlockText || unit.notes.map((n) => `${n.label}: ${n.body}`).join("\n"),
        `${slugTag} ${unit.sectionId}${priorityTag}`,
      ]);
    }
  }

  // 4. Bottom Socratic QA & Review Cards
  for (const block of doc.bottomBlocks) {
    if (block.type === "socratic-qa") {
      for (const item of block.items) {
        const levelTag = item.cognitiveLevel ? `_${item.cognitiveLevel}` : "";
        rows.push([
          item.question,
          item.answer,
          `${slugTag} ${doc.modeId} socratic${levelTag}`,
        ]);
      }
    }
  }

  return "\uFEFF" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n") + "\n";
}
