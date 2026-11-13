import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEMO_DOCUMENTS } from "@/plugins";
import { BottomArsenalRenderer } from "./BottomArsenalRenderer";
import { DualColumnRow } from "./DualColumnRow";
import { HeaderConsole } from "./HeaderConsole";
import { LibraryDrawer } from "./LibraryDrawer";
import { SectionSummaryCard } from "./SectionSummaryCard";
import { SettingsModal } from "./SettingsModal";
import { TopMentalPanel } from "./TopMentalPanel";
import {
  computeDocumentLearningStats,
  inferDocumentTaxonomy,
} from "@/core/engine/library-organizer";

describe("Active-Learning UI Components (Blind & Mode-Agnostic)", () => {
  it("gates CORE unit notes behind prediction prompt until unlocked and emits understanding clicks", () => {
    const paperDoc = DEMO_DOCUMENTS[0];
    const gatedUnit = {
      ...paperDoc.units[0],
      weight: "core" as const,
      predictPrompt: "在看右侧精读之前，你认为传统序列架构最卡脖子的原因是什么？",
      notes: [
        {
          label: "核心论证",
          body: "这里是被门控隐藏的深度拆解内容 SECRET_NOTE_BODY",
        },
      ],
    };

    const onUnderstandingChange = vi.fn();
    const onPredictionChange = vi.fn();
    const onUnlockNotes = vi.fn();

    const { container, rerender } = render(
      <DualColumnRow
        unit={gatedUnit}
        layoutRatio={paperDoc.layoutRatio}
        dimensions={paperDoc.dimensions}
        labels={paperDoc.labels}
        activeDimFilter={null}
        hideSecondary={false}
        hideNotes={false}
        isFlashed={false}
        userNote=""
        understandingStatus="unmarked"
        predictionAnswer=""
        notesUnlocked={false}
        onUserNoteChange={() => {}}
        onUnderstandingChange={onUnderstandingChange}
        onPredictionChange={onPredictionChange}
        onUnlockNotes={onUnlockNotes}
        onJumpToUnit={() => {}}
        onHoverTooltip={() => {}}
        onLeaveTooltip={() => {}}
      />
    );

    expect(container.textContent).toContain("在看右侧精读之前");
    expect(container.textContent).not.toContain("SECRET_NOTE_BODY");

    const fuzzyBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("模糊")
    );
    expect(fuzzyBtn).toBeDefined();
    if (fuzzyBtn) fireEvent.click(fuzzyBtn);
    expect(onUnderstandingChange).toHaveBeenCalledWith("fuzzy");

    const unlockBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("提交思考并展开批注")
    );
    expect(unlockBtn).toBeDefined();
    if (unlockBtn) fireEvent.click(unlockBtn);
    expect(onUnlockNotes).toHaveBeenCalledTimes(1);

    rerender(
      <DualColumnRow
        unit={gatedUnit}
        layoutRatio={paperDoc.layoutRatio}
        dimensions={paperDoc.dimensions}
        labels={paperDoc.labels}
        activeDimFilter={null}
        hideSecondary={false}
        hideNotes={false}
        isFlashed={false}
        userNote=""
        understandingStatus="fuzzy"
        predictionAnswer="因为无法并行计算"
        notesUnlocked={true}
        onUserNoteChange={() => {}}
        onUnderstandingChange={onUnderstandingChange}
        onPredictionChange={onPredictionChange}
        onUnlockNotes={onUnlockNotes}
        onJumpToUnit={() => {}}
        onHoverTooltip={() => {}}
        onLeaveTooltip={() => {}}
      />
    );

    expect(container.textContent).toContain("SECRET_NOTE_BODY");
  });

  it("toggles closed-book blur and reveals section summary recall upon submit", () => {
    const onToggleBlur = vi.fn();
    const onSubmit = vi.fn();

    const { container } = render(
      <SectionSummaryCard
        sectionId="sec-1"
        sectionTitle="1. Introduction"
        summary={{
          established: "确立了并行化与注意力权重的关系",
          openQuestions: "二次复杂度在超长上下文中的内存极限",
          rhetoricStrategy: "先对比循环架构痛点，再直接抛出极简结构",
          referenceRecall: "REF_RECALL_ANSWER: 用自注意力替代循环以释放时间步并行度",
          reviewerCritique: "缺少超长文本外推验证",
          socraticQuestions: [
            {
              category: "假设质疑",
              question: "若序列长度远超显存阈值会怎样？",
              answer: "O(N^2) 矩阵会率先 OOM",
            },
          ],
        }}
        recallState={{ text: "这是我的闭卷复述", submitted: false }}
        isRecallBlurActive={false}
        onToggleRecallBlur={onToggleBlur}
        onRecallTextChange={() => {}}
        onSubmitRecall={onSubmit}
      />
    );

    expect(container.textContent).not.toContain("REF_RECALL_ANSWER");
    const blurBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("开始闭卷复述")
    );
    expect(blurBtn).toBeDefined();
    if (blurBtn) fireEvent.click(blurBtn);
    expect(onToggleBlur).toHaveBeenCalledTimes(1);

    const submitBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("提交复述并核对参考答案")
    );
    expect(submitBtn).toBeDefined();
    if (submitBtn) fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("REF_RECALL_ANSWER");
  });

  it("renders TopMentalPanel active-learning scaffolds, HeaderConsole filters, and BottomArsenalRenderer new blocks", () => {
    const paperDoc = DEMO_DOCUMENTS[0];
    const onToggleFirstPass = vi.fn();
    const onToggleFuzzyOnly = vi.fn();
    const onExportAnki = vi.fn();

    const headerDoc = {
      ...paperDoc,
      completionChecklist: {
        modeDescription: "模式 C（逐段精读）",
        unitCount: paperDoc.units.length,
        formulaOrTableCount: 2,
        sectionCount: 4,
        inconsistencies: [],
        manualVerifyHints: [],
      },
    };
    const onOpenSettings = vi.fn();
    const onToggleAutoHide = vi.fn();

    const { container: headerDom } = render(
      <HeaderConsole
        doc={headerDoc}
        activeDimFilter={null}
        paretoMode={false}
        firstPassMode={false}
        fuzzyOnlyMode={false}
        fuzzyOrConfusedCount={1}
        autoHideHeader={true}
        hideSecondary={false}
        hideNotes={false}
        onToggleDim={() => {}}
        onTogglePareto={() => {}}
        onToggleFirstPass={onToggleFirstPass}
        onToggleFuzzyOnly={onToggleFuzzyOnly}
        onOpenLibrary={() => {}}
        onOpenStudio={() => {}}
        onOpenSettings={onOpenSettings}
      />
    );

    const pass1Btn = Array.from(headerDom.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("第一遍路径")
    );
    const fuzzyOnlyBtn = Array.from(headerDom.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("只看模糊与不懂")
    );
    const settingsBtn = Array.from(headerDom.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("设置与导出")
    );
    expect(pass1Btn).toBeDefined();
    expect(fuzzyOnlyBtn).toBeDefined();
    expect(settingsBtn).toBeDefined();
    expect(headerDom.querySelector('[data-testid="document-hero"]')?.textContent).toContain(
      headerDoc.title
    );
    if (pass1Btn) fireEvent.click(pass1Btn);
    if (fuzzyOnlyBtn) fireEvent.click(fuzzyOnlyBtn);
    if (settingsBtn) fireEvent.click(settingsBtn);
    expect(onToggleFirstPass).toHaveBeenCalledTimes(1);
    expect(onToggleFuzzyOnly).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    const { container: settingsDom } = render(
      <SettingsModal
        open={true}
        doc={headerDoc}
        config={{ provider: "google", apiKey: "", model: "gemini-2.5-flash", baseUrl: "" }}
        hideSecondary={false}
        hideNotes={false}
        autoHideHeader={true}
        onToggleSecondary={() => {}}
        onToggleNotes={() => {}}
        onToggleAutoHideHeader={onToggleAutoHide}
        onExportMarkdown={() => {}}
        onExportHtml={() => {}}
        onExportAnkiCsv={onExportAnki}
        onSave={() => {}}
        onClose={() => {}}
      />
    );

    const ankiBtn = Array.from(settingsDom.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("导出 Anki CSV")
    );
    const autoHideBtn = Array.from(settingsDom.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("滚动自动收起顶栏")
    );
    expect(ankiBtn).toBeDefined();
    expect(autoHideBtn).toBeDefined();
    if (ankiBtn) fireEvent.click(ankiBtn);
    if (autoHideBtn) fireEvent.click(autoHideBtn);
    expect(onExportAnki).toHaveBeenCalledTimes(1);
    expect(onToggleAutoHide).toHaveBeenCalledTimes(1);

    const { container: topDom } = render(
      <TopMentalPanel
        model={{
          ...paperDoc.topMentalModel,
          oneSentenceSkeleton: "SKELETON_LINE_ONE",
          pretestItems: [
            { id: "p1", question: "PRETEST_Q1", answer: "PRETEST_A1", targetUnitId: paperDoc.units[0]?.id },
          ],
          fadedExamples: [
            {
              level: 1,
              label: "Level 1 · 完整示范",
              prompt: "计算 2x2 注意力得分",
              walkthrough: "WALKTHROUGH_STEP_1",
              answer: "0.73",
            },
          ],
          designChoices: [
            {
              decision: "使用缩放点积",
              alternatives: "加性注意力",
              rationale: "矩阵乘法吞吐更高",
              ablationOrProof: "Table 3",
              anchor: "§3.2",
            },
          ],
          readingPath: {
            pass1Summary: "先读核心架构与主结果",
            pass2Summary: "复核公式细节",
            pass3Summary: "写费曼自测",
            recommendedUnitIds: [paperDoc.units[0]?.id ?? "u-1"],
          },
        }}
        pretestAnswers={{}}
        onPretestChange={() => {}}
        onJumpToUnit={() => {}}
      />
    );
    expect(topDom.textContent).toContain("SKELETON_LINE_ONE");
    expect(topDom.textContent).toContain("PRETEST_Q1");
    expect(topDom.textContent).toContain("教学示例，非论文原始数据");
    expect(topDom.textContent).toContain("使用缩放点积");

    const { container: bottomDom } = render(
      <BottomArsenalRenderer
        title="复盘与迁移区"
        blocks={[
          {
            type: "claim-evidence-table",
            title: "核心主张-证据矩阵",
            rows: [
              {
                claimId: "C1",
                claim: "并行速度显著快于 RNN",
                evidenceAnchor: "Table 2",
                limitation: "显存随 N^2 增长",
                unverifiedGap: "超长序列外推未验证",
              },
            ],
          },
          {
            type: "feynman-challenge",
            title: "200 字费曼挑战",
            prompt: "向外行解释 Attention",
            referenceExplanation: "REF_FEYNMAN_EXPLANATION",
            laypersonQuestions: ["为什么需要缩放？"],
          },
          {
            type: "review-schedule",
            title: "间隔复习计划",
            startDate: "2026-11-13",
            tasks: ["第1天复述", "第3天重做错题", "第7天费曼检查", "第21天迁移实战"],
          },
        ]}
        pretestItems={[{ id: "p1", question: "PRETEST_Q1", answer: "PRETEST_A1" }]}
        annotations={{
          unitNotes: {},
          journalAnswers: {},
          checklistStates: {},
          pretestAnswers: { p1: { answer: "我的高自信误猜", confidence: "high" } },
        }}
        onJournalChange={() => {}}
        onChecklistToggle={() => {}}
        onDiffChange={() => {}}
      />
    );
    expect(bottomDom.textContent).toContain("核心主张-证据矩阵");
    expect(bottomDom.textContent).not.toContain("PRETEST_A1");
    const revealPretestBtn = Array.from(bottomDom.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("揭晓全部预测试答案")
    );
    expect(revealPretestBtn).toBeDefined();
    if (revealPretestBtn) fireEvent.click(revealPretestBtn);
    expect(bottomDom.textContent).toContain("PRETEST_A1");
    expect(bottomDom.textContent).toContain("高自信");
    expect(bottomDom.textContent).toContain("200 字费曼挑战");
    expect(bottomDom.textContent).toContain("间隔复习计划");
  });

  it("renders unit figures with image tags and deduplicates leading [易误解] prefixes", () => {
    const paperDoc = DEMO_DOCUMENTS[0];
    const unitWithFig = {
      ...paperDoc.units[0],
      weight: "support" as const,
      misconceptionCallout: "[易误解] 不要混淆自注意力与交叉注意力。",
      figures: [
        {
          label: "Figure 1",
          caption: "Figure 1: Architecture",
          imageUrls: ["https://arxiv.org/html/1706.03762v7/Figures/ModalNet-21.png"],
        },
      ],
    };

    const { container } = render(
      <DualColumnRow
        unit={unitWithFig}
        layoutRatio={paperDoc.layoutRatio}
        dimensions={paperDoc.dimensions}
        labels={paperDoc.labels}
        activeDimFilter={null}
        hideSecondary={false}
        hideNotes={false}
        isFlashed={false}
        userNote=""
        onUserNoteChange={() => {}}
        onJumpToUnit={() => {}}
        onHoverTooltip={() => {}}
        onLeaveTooltip={() => {}}
      />
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("ModalNet-21.png");
    expect(container.querySelector("figcaption")?.textContent).toContain("Figure 1: Architecture");
    const badges = container.textContent?.match(/\[易误解\]/g) ?? [];
    expect(badges.length).toBe(1);
  });

  it("captures right-click text selection and renders dashed border + follow-up corner badge + evidence anchors", () => {
    const paperDoc = DEMO_DOCUMENTS[0];
    const targetUnit = {
      ...paperDoc.units[0],
      primaryKind: "prose" as const,
      primaryText:
        "Self-attention connects all positions with a constant number of sequentially executed operations.",
      highlights: [],
    };
    const onOpenSelectionQa = vi.fn();
    const onJumpToUnit = vi.fn();

    const getSelectionSpy = vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "constant number of sequentially executed operations",
    } as unknown as Selection);

    const qaThread = {
      id: "qa-1",
      unitId: targetUnit.id,
      unitCode: targetUnit.unitCode,
      selectedText: "constant number of sequentially executed operations",
      question: "为什么自注意力能用常数步连接任意位置？",
      scope: "document" as const,
      answer: "[原文明示] 自注意力通过矩阵乘法在一步内计算所有位置两两相关性。",
      evidences: [
        {
          unitCode: "§3.2.P2",
          unitId: "unit-sec3-2",
          quote: "Self-Attention is O(1) sequential operations.",
          rationale: "全文 §3.2 复杂度表直接对比了 O(1) 与 RNN 的 O(n)。",
        },
      ],
      followUps: [
        {
          id: "turn-2",
          question: "代价是什么？",
          scope: "document" as const,
          answer: "[分析推断] 代价是序列长度方向的内存开销变为 O(n^2)。",
          evidences: [],
          createdAt: "2026-11-13T10:00:00Z",
        },
      ],
      createdAt: "2026-11-13T09:59:00Z",
    };

    const { container } = render(
      <DualColumnRow
        unit={targetUnit}
        layoutRatio={paperDoc.layoutRatio}
        dimensions={paperDoc.dimensions}
        labels={paperDoc.labels}
        activeDimFilter={null}
        hideSecondary={false}
        hideNotes={false}
        isFlashed={false}
        userNote=""
        onUserNoteChange={() => {}}
        onJumpToUnit={onJumpToUnit}
        onHoverTooltip={() => {}}
        onLeaveTooltip={() => {}}
        qaThreads={[qaThread]}
        onOpenSelectionQa={onOpenSelectionQa}
      />
    );

    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(article?.className).toContain("border-dashed");
    expect(article?.getAttribute("data-qa-count")).toBe("2");

    const badge = container.querySelector(`[data-testid="qa-corner-badge-${targetUnit.id}"]`);
    expect(badge?.textContent).toContain("[已追问 2 次]");

    // Inline dashed highlight on the asked snippet
    const dashedSnippet = Array.from(container.querySelectorAll("span")).find(
      (el) =>
        el.className.includes("border-dashed") &&
        el.textContent?.includes("constant number of sequentially executed operations")
    );
    expect(dashedSnippet).toBeDefined();

    // Right-click triggers onOpenSelectionQa with captured selection
    if (article) {
      fireEvent.contextMenu(article, { clientX: 120, clientY: 240 });
    }
    expect(onOpenSelectionQa).toHaveBeenCalledWith(
      expect.objectContaining({
        unitId: targetUnit.id,
        unitCode: targetUnit.unitCode,
        selectedText: "constant number of sequentially executed operations",
        x: 120,
        y: 240,
      })
    );

    // Clicking evidence jump button triggers jumpToUnit
    const jumpBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("-> 跳转")
    );
    expect(jumpBtn).toBeDefined();
    if (jumpBtn) fireEvent.click(jumpBtn);
    expect(onJumpToUnit).toHaveBeenCalledWith("unit-sec3-2", targetUnit.id);

    getSelectionSpy.mockRestore();
  });

  it("classifies library documents across 4 dimensions and triggers one-click organization", () => {
    const paperDoc = DEMO_DOCUMENTS[0];
    const essayDoc = DEMO_DOCUMENTS[1];
    const repoDoc = DEMO_DOCUMENTS[2];

    const paperTax = inferDocumentTaxonomy(paperDoc);
    const repoTax = inferDocumentTaxonomy(repoDoc);
    expect(paperTax.domainCategory).toContain("AI");
    expect(repoTax.paradigmType).toContain("源码");

    const stats = computeDocumentLearningStats(paperDoc, {
      unitNotes: {},
      journalAnswers: {},
      checklistStates: {},
      unitUnderstanding: { [paperDoc.units[0].id]: "confused" },
      unitQaThreads: {
        [paperDoc.units[0].id]: [
          {
            id: "qa-lib-1",
            unitId: paperDoc.units[0].id,
            unitCode: paperDoc.units[0].unitCode,
            selectedText: "snippet",
            question: "q",
            scope: "document",
            answer: "a",
            evidences: [],
            createdAt: "2026-11-14T00:00:00Z",
          },
        ],
      },
    });
    expect(stats.stage).toBe("struggling");
    expect(stats.qaCount).toBe(1);

    const onAutoOrganize = vi.fn();
    const { container } = render(
      <LibraryDrawer
        open={true}
        documents={[paperDoc, essayDoc, repoDoc]}
        activeDocumentId={paperDoc.id}
        annotationsByDocId={{
          [paperDoc.id]: {
            unitNotes: {},
            journalAnswers: {},
            checklistStates: {},
            unitUnderstanding: { [paperDoc.units[0].id]: "confused" },
          },
        }}
        onClose={() => {}}
        onSelect={() => {}}
        onDelete={() => {}}
        onResetDemos={() => {}}
        onAutoOrganize={onAutoOrganize}
        onUpdateDocMeta={() => {}}
      />
    );

    expect(container.textContent).toContain("[一键智能整理]");
    expect(container.textContent).toContain("[按主题领域]");
    expect(container.textContent).toContain("[按消化进度]");
    expect(container.textContent).toContain("[按研究范式]");
    expect(container.textContent).toContain("待攻克 1 处");

    const orgBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("一键智能整理")
    );
    expect(orgBtn).toBeDefined();
    if (orgBtn) fireEvent.click(orgBtn);
    expect(onAutoOrganize).toHaveBeenCalled();

    const stageTab = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("按消化进度")
    );
    expect(stageTab).toBeDefined();
    if (stageTab) fireEvent.click(stageTab);
    expect(container.textContent).toContain("攻坚中 · 含待解疑点");
  });
});
