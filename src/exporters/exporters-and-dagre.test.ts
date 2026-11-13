import { describe, expect, it } from "vitest";
import { DEMO_DOCUMENTS } from "@/plugins";
import { computeDiagramLayout } from "@/workbench-ui/dagre-layout";
import { exportDocumentToAnkiCsv } from "./anki-exporter";
import { compileDocumentToStandaloneHtml } from "./html-compiler";
import { exportDocumentToMarkdown } from "./markdown-exporter";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

describe("Dagre Diagram Layout & Dual Exporters", () => {
  it("computes non-overlapping dagre coordinates and SVG paths for all 3 demo modes", () => {
    for (const doc of DEMO_DOCUMENTS) {
      const layout = computeDiagramLayout(doc.topMentalModel.diagram);
      expect(layout.width).toBeGreaterThan(200);
      expect(layout.height).toBeGreaterThan(100);
      expect(layout.nodes.length).toBe(doc.topMentalModel.diagram.nodes.length);
      for (const edge of layout.edges) {
        expect(edge.pathD.startsWith("M ")).toBe(true);
      }
    }
  });

  it("compiles zero-emoji standalone HTML & Markdown preserving user annotations", () => {
    const demo = DEMO_DOCUMENTS[2];
    const annotations = {
      unitNotes: { "mod-1-u-1": "My personal Go pipeline benchmark note" },
      journalAnswers: {},
      checklistStates: {},
      beforeAfterDiff: {
        beforeCode: "// custom before",
        afterCode: "// custom after",
        benchmarkNote: "QPS 1200 -> 4800",
      },
    };

    const md = exportDocumentToMarkdown(demo, annotations);
    expect(md).toContain(demo.title);
    expect(md).toContain("My personal Go pipeline benchmark note");
    expect(md).toContain("// custom after");
    expect(EMOJI_RE.test(md)).toBe(false);

    const html = compileDocumentToStandaloneHtml(demo, annotations);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("My personal Go pipeline benchmark note");
    expect(html).toContain("[<- 返回原阅读位置]");
    expect(html).toContain("katex.min.css");
    expect(EMOJI_RE.test(html)).toBe(false);
  });

  it("exports Anki UTF-8 BOM CSV, upgraded Markdown checklist/schedule, and data-tex HTML", () => {
    const paperDemo = DEMO_DOCUMENTS[0];
    const targetUnit = paperDemo.units[0];
    const enrichedDoc = {
      ...paperDemo,
      topMentalModel: {
        ...paperDemo.topMentalModel,
        oneSentenceSkeleton: "针对序列长距离依赖与串行瓶颈问题，Transformer 用纯自注意力并行建模实现高精度翻译。",
        pretestItems: [
          {
            id: "pre-1",
            question: "为什么放弃 RNN？",
            answer: "RNN 无法在时间步之间并行。",
            targetUnitId: targetUnit.id,
          },
        ],
      },
      bottomBlocks: [
        ...paperDemo.bottomBlocks,
        {
          type: "review-schedule" as const,
          title: "间隔复习计划（第 1 / 3 / 7 / 21 天）",
          startDate: "2026-11-13",
          tasks: ["合上论文复述 QKV", "重看模糊公式", "用 200 字讲清全文", "迁入实验原型"],
        },
      ],
    };

    const annotations = {
      unitNotes: { [targetUnit.id]: "重点复查缩放因子" },
      journalAnswers: {},
      checklistStates: {},
      unitUnderstanding: { [targetUnit.id]: "fuzzy" as const },
      unitPredictionAnswers: { [targetUnit.id]: "先猜是为了解决串行慢" },
      pretestAnswers: { "pre-1": { answer: "串行受限", confidence: "high" as const } },
      sectionRecallAnswers: {},
      socraticAnswers: {},
    };

    const csv = exportDocumentToAnkiCsv(enrichedDoc, annotations);
    expect(csv.startsWith("\uFEFF正面,背面,标签")).toBe(true);
    expect(csv).toContain("为什么放弃 RNN");
    expect(csv).toContain("fuzzy");
    expect(EMOJI_RE.test(csv)).toBe(false);

    const md = exportDocumentToMarkdown(enrichedDoc, annotations);
    expect(md).toContain("待攻克清单");
    expect(md).toContain(targetUnit.unitCode);
    expect(md).toContain("间隔复习");
    expect(EMOJI_RE.test(md)).toBe(false);

    const html = compileDocumentToStandaloneHtml(enrichedDoc, annotations);
    expect(html).toContain("data-tex=");
    expect(EMOJI_RE.test(html)).toBe(false);
  });
});
