import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as askSelectionPost } from "@/app/api/ask-selection/route";
import { AiStatus, resolveAnalyzeAiState } from "@/components/ui/ai-status";
import { FluidOrb, getTopbarGlassStyle } from "@/components/ui/fluid-orb";
import { MatrixOrb } from "@/components/ui/matrix-orb";
import { CodeBlock } from "@/components/ui/code-block";
import { PromptBox } from "@/components/ui/prompt-box";
import { ProximitySidebar } from "@/components/ui/proximity-sidebar";
import { RailToc } from "@/components/ui/rail-toc";
import { StreamingResponse } from "@/components/ui/streaming-response";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { CodeViewer } from "./code-viewer";
import { fetchProviderModels } from "@/core/engine/model-discovery";
import { DEMO_DOCUMENTS, defaultPluginRegistry } from "@/plugins";
import { BottomArsenalRenderer } from "./BottomArsenalRenderer";
import { DualColumnRow } from "./DualColumnRow";
import { HeaderConsole } from "./HeaderConsole";
import { IngestionStudioModal } from "./IngestionStudioModal";
import { LibraryDrawer } from "./LibraryDrawer";
import { OnboardingTour } from "./OnboardingTour";
import { SectionSummaryCard } from "./SectionSummaryCard";
import { SelectionQaModal } from "./SelectionQaModal";
import { SettingsModal } from "./SettingsModal";
import { TopMentalPanel } from "./TopMentalPanel";
import { WorkbenchShell } from "./WorkbenchShell";
import { WorkspaceHome } from "./WorkspaceHome";
import { detectOmniSource } from "./analyze-client";
import { useWorkbenchStore } from "@/store/workbench-store";
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
    const onThemeChange = vi.fn();
    const onReadingDepthChange = vi.fn();

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
        themeMode="paper"
        readingDepthMode="workbench"
        onThemeChange={onThemeChange}
        onReadingDepthChange={onReadingDepthChange}
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
    const themeCycleBtn = headerDom.querySelector(
      '[data-testid="theme-switcher"]'
    ) as HTMLButtonElement | null;
    const pureBtn = Array.from(
      headerDom.querySelectorAll('[data-testid="reading-depth-switcher"] button')
    ).find((b) => b.textContent?.includes("通读"));
    expect(pass1Btn).toBeDefined();
    expect(fuzzyOnlyBtn).toBeDefined();
    expect(settingsBtn).toBeDefined();
    expect(themeCycleBtn).not.toBeNull();
    expect(pureBtn).toBeDefined();
    expect(headerDom.querySelector('[data-testid="document-hero"]')?.textContent).toContain(
      headerDoc.title
    );
    if (pass1Btn) fireEvent.click(pass1Btn);
    if (fuzzyOnlyBtn) fireEvent.click(fuzzyOnlyBtn);
    if (settingsBtn) fireEvent.click(settingsBtn);
    if (themeCycleBtn) fireEvent.click(themeCycleBtn);
    if (pureBtn) fireEvent.click(pureBtn);
    expect(onToggleFirstPass).toHaveBeenCalledTimes(1);
    expect(onToggleFuzzyOnly).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onThemeChange).toHaveBeenCalledWith("aurora");
    expect(onReadingDepthChange).toHaveBeenCalledWith("pure");

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
    const tabBar = topDom.querySelector('[data-testid="top-mental-tabs"]');
    expect(tabBar).not.toBeNull();
    const examplesTab = Array.from(tabBar?.querySelectorAll("button") ?? []).find((b) =>
      b.textContent?.includes("手算走查与设计权衡")
    );
    expect(examplesTab).toBeDefined();
    if (examplesTab) {
      fireEvent.click(examplesTab);
      expect(examplesTab.className).toContain("bg-[#1a2744]");
    }

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
    const onDelete = vi.fn();
    const onUpdateDocMeta = vi.fn();
    const { container, getByTestId, queryByTestId } = render(
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
        onDelete={onDelete}
        onAutoOrganize={onAutoOrganize}
        onUpdateDocMeta={onUpdateDocMeta}
      />
    );

    expect(container.textContent).toContain("一键智能整理");
    expect(container.textContent).toContain("按主题领域");
    expect(container.textContent).toContain("按消化进度");
    expect(container.textContent).toContain("按研究范式");
    expect(container.textContent).toContain("待攻克 1 处");
    expect(container.textContent).not.toContain("恢复演示");
    expect(container.querySelector("aside[role='dialog']")?.className).toContain("prism-library-enter");

    // Delete & pin actions must NOT clutter cards by default; appear on right-click context menu
    expect(queryByTestId(`library-delete-${paperDoc.id}`)).toBeNull();
    expect(container.textContent).not.toContain("[删除]");

    fireEvent.contextMenu(getByTestId(`library-card-${paperDoc.id}`), {
      clientX: 200,
      clientY: 220,
    });
    expect(queryByTestId("library-context-menu")).not.toBeNull();
    fireEvent.click(getByTestId(`library-pin-${paperDoc.id}`));
    expect(onUpdateDocMeta).toHaveBeenCalledWith(paperDoc.id, { pinned: true });

    fireEvent.contextMenu(getByTestId(`library-card-${paperDoc.id}`), {
      clientX: 200,
      clientY: 220,
    });
    fireEvent.click(getByTestId(`library-delete-${paperDoc.id}`));
    expect(onDelete).toHaveBeenCalledWith(paperDoc.id);

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

    // Transitioning LibraryDrawer from closed -> open with custom originRect must preserve hook order
    const drawerTransition = render(
      <LibraryDrawer
        open={false}
        documents={[paperDoc, essayDoc, repoDoc]}
        activeDocumentId={paperDoc.id}
        originRect={{ left: 160, top: 480, width: 240, height: 190 }}
        onClose={() => {}}
        onSelect={() => {}}
        onDelete={() => {}}
      />
    );
    expect(drawerTransition.container.querySelector("aside[role='dialog']")).toBeNull();
    drawerTransition.rerender(
      <LibraryDrawer
        open={true}
        documents={[paperDoc, essayDoc, repoDoc]}
        activeDocumentId={paperDoc.id}
        originRect={{ left: 160, top: 480, width: 240, height: 190 }}
        onClose={() => {}}
        onSelect={() => {}}
        onDelete={() => {}}
      />
    );
    const dialogEl = drawerTransition.container.querySelector("aside[role='dialog']") as HTMLElement | null;
    expect(dialogEl).not.toBeNull();
    expect(dialogEl!.style.transformOrigin).toContain("280px");
  });

  it("auto-switches to video internalization mode on Douyin share text and builds distinct video OS view", async () => {
    const { container } = render(
      <IngestionStudioModal
        open={true}
        llmConfig={{ provider: "openai", apiKey: "", model: "gpt-4o-mini" }}
        onClose={() => {}}
        onCreated={() => {}}
      />
    );

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    if (textarea) {
      fireEvent.change(textarea, {
        target: {
          value:
            "8.20 复制打开抖音，看看【Vicky\u2764\uFE0FEileen的作品】谷爱凌播客 https://v.douyin.com/t-_pDJCeWfI/",
        },
      });
    }
    expect(container.textContent).toContain("已识别抖音链接，已自动切换为");

    const videoPlugin = defaultPluginRegistry
      .list()
      .find((p) => p.inputConfig.acceptedFileTypes?.includes(".srt"));
    expect(videoPlugin).toBeDefined();
    if (!videoPlugin) return;

    const sampleStructured = [
      "# 1. 抖音视频概览与核心议题",
      "创作者：@Vicky | 时长：59分25秒",
      "作品主题与文案：谷爱凌做客Jay Shetty播客完整版，探讨如何克服自我怀疑并在高压下建立专注边界与独立评价体系，不被短期外界噪声干扰。",
      "",
      "# 2. 高赞核心拆解与观点精华",
      "[高赞笔记 186赞 @课代表A]",
      "以课题分离为核心的心力管理体系，强调区分自己真正可控的训练投入与外界不可控的舆论期待，并将大目标拆解成每日可复现的具体专注步骤与复盘仪式。",
    ].join("\n\n");

    const units = await videoPlugin.preprocessSource({ kind: "text", content: sampleStructured });
    expect(units.length).toBeGreaterThanOrEqual(2);

    const videoDoc = videoPlugin.createHeuristicDocument("谷爱凌播客内化测试", units);
    expect(videoDoc.topMentalModel.cards.length).toBeGreaterThanOrEqual(3);
    expect(videoDoc.topMentalModel.comparisonPair?.leftTitle).toContain("OLD DEFAULT OS");
    expect(videoDoc.topMentalModel.comparisonPair?.rightTitle).toContain("UPGRADED OS");
    expect(videoDoc.bottomBlocks.some((b) => b.type === "checklist")).toBe(true);
    expect(videoDoc.units[0]?.secondaryBlockText).not.toContain("接入 API Key 后可自动生成专栏级");

    const { container: summaryDom } = render(
      <SectionSummaryCard
        sectionId={videoDoc.sections[0].id}
        sectionTitle={videoDoc.sections[0].title}
        summary={videoDoc.sections[0].summary}
        isRecallBlurActive={false}
        onToggleRecallBlur={() => {}}
        onRecallTextChange={() => {}}
        onSubmitRecall={() => {}}
      />
    );
    const toggleBtn = Array.from(summaryDom.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("查看参考复述与追问")
    );
    if (toggleBtn) fireEvent.click(toggleBtn);
    expect(summaryDom.textContent).toContain("[深度批判与盲点审视]");
    expect(summaryDom.textContent).not.toContain("审稿人追问");
  });

  it("hides 5-color highlights, notes, and secondary blocks in DualColumnRow pureMode", () => {
    const paperDoc = DEMO_DOCUMENTS[0];
    const unitWithHighlights = {
      ...paperDoc.units[0],
      primaryKind: "prose" as const,
      primaryText: "Attention is a core mechanism for sequence modeling.",
      secondaryBlockText: "PURE_HIDDEN_SECONDARY",
      highlights: [
        { text: "core mechanism", dim: "dim1" as const, tooltip: "核心机制" },
      ],
      notes: [
        { label: "01 / 机制", body: "PURE_HIDDEN_NOTE" },
      ],
    };

    const { container } = render(
      <DualColumnRow
        unit={unitWithHighlights}
        layoutRatio={paperDoc.layoutRatio}
        dimensions={paperDoc.dimensions}
        labels={paperDoc.labels}
        activeDimFilter={null}
        hideSecondary={false}
        hideNotes={false}
        pureMode={true}
        isFlashed={false}
        userNote=""
        onUserNoteChange={() => {}}
        onJumpToUnit={() => {}}
        onHoverTooltip={() => {}}
        onLeaveTooltip={() => {}}
      />
    );

    expect(container.textContent).toContain("Attention is a core mechanism for sequence modeling.");
    expect(container.textContent).not.toContain("PURE_HIDDEN_SECONDARY");
    expect(container.textContent).not.toContain("PURE_HIDDEN_NOTE");
    expect(container.querySelector(".bg-amber-200\\/70")).toBeNull();

    // Switching pureLang to "chinese" shows secondaryBlockText as main clean prose
    const { container: zhDom } = render(
      <DualColumnRow
        unit={unitWithHighlights}
        layoutRatio={paperDoc.layoutRatio}
        dimensions={paperDoc.dimensions}
        labels={paperDoc.labels}
        activeDimFilter={null}
        hideSecondary={false}
        hideNotes={false}
        pureMode={true}
        pureLang="chinese"
        isFlashed={false}
        userNote=""
        onUserNoteChange={() => {}}
        onJumpToUnit={() => {}}
        onHoverTooltip={() => {}}
        onLeaveTooltip={() => {}}
      />
    );
    expect(zhDom.textContent).toContain("PURE_HIDDEN_SECONDARY");
    expect(zhDom.textContent).not.toContain("Attention is a core mechanism for sequence modeling.");
    expect(zhDom.textContent).not.toContain("PURE_HIDDEN_NOTE");
  });

  it("provides 3 mode-matched starter docs (Attention, Dan Koe, JiaxinTrans/RCD_CEDI) and 4-step OnboardingTour with API guide", () => {
    expect(DEMO_DOCUMENTS.map((d) => d.modeId)).toEqual([
      "academic-paper",
      "cognitive-essay",
      "repo-deconstruct",
    ]);
    expect(DEMO_DOCUMENTS[0].title).toContain("Attention Is All You Need");
    expect(DEMO_DOCUMENTS[1].title).toContain("How to Fix Your Entire Life in 1 Day");
    expect(DEMO_DOCUMENTS[2].title).toContain("JiaxinTrans/RCD_CEDI");

    const onSelectDoc = vi.fn();
    const onTogglePareto = vi.fn();
    const onThemeChange = vi.fn();
    const onOpenSettingsForApi = vi.fn();
    const onOpenStudio = vi.fn();
    const onComplete = vi.fn();

    const { container, getByTestId } = render(
      <OnboardingTour
        open={true}
        documents={DEMO_DOCUMENTS}
        activeDocumentId={DEMO_DOCUMENTS[0].id}
        paretoMode={false}
        themeMode="paper"
        onSelectDocument={onSelectDoc}
        onTogglePareto={onTogglePareto}
        onThemeChange={onThemeChange}
        onOpenSettingsForApi={onOpenSettingsForApi}
        onOpenStudio={onOpenStudio}
        onComplete={onComplete}
      />
    );

    expect(container.textContent).toContain("第 1 / 4 步");
    fireEvent.click(getByTestId("onboarding-starter-repo-deconstruct"));
    expect(onSelectDoc).toHaveBeenCalledWith(DEMO_DOCUMENTS[2].id);

    fireEvent.click(getByTestId("onboarding-next"));
    expect(container.textContent).toContain("第 2 / 4 步");
    fireEvent.click(getByTestId("onboarding-try-pareto"));
    expect(onTogglePareto).toHaveBeenCalledTimes(1);

    fireEvent.click(getByTestId("onboarding-next"));
    expect(container.textContent).toContain("第 3 / 4 步");
    fireEvent.click(getByTestId("onboarding-open-settings"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onOpenSettingsForApi).toHaveBeenCalledTimes(1);

    fireEvent.click(getByTestId("onboarding-next"));
    expect(container.textContent).toContain("第 4 / 4 步");
    fireEvent.click(getByTestId("onboarding-finish"));
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it("supports collapsible sections, initialFocusSection, live model retrieval and search in SettingsModal", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const onThemeChange = vi.fn();
    const headerDoc = DEMO_DOCUMENTS[0];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          models: [
            {
              id: "gemini-2.5-flash-preview",
              label: "Gemini 2.5 Flash Preview",
              source: "remote",
            },
            {
              id: "gemini-2.5-pro-exp",
              label: "Gemini 2.5 Pro Exp",
              source: "remote",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    try {
      const { container, getByTestId, queryByTestId } = render(
        <SettingsModal
          open={true}
          doc={headerDoc}
          config={{
            provider: "google",
            apiKey: "AIza-test-key",
            model: "gemini-2.5-flash",
            baseUrl: "",
          }}
          initialFocusSection="llm"
          themeMode="paper"
          onThemeChange={onThemeChange}
          hideSecondary={false}
          hideNotes={false}
          autoHideHeader={true}
          onToggleSecondary={() => {}}
          onToggleNotes={() => {}}
          onToggleAutoHideHeader={() => {}}
          onExportMarkdown={() => {}}
          onExportHtml={() => {}}
          onExportAnkiCsv={() => {}}
          onSave={onSave}
          onClose={onClose}
        />
      );

      // Focus mode starts with view/export folded and llm expanded
      expect(getByTestId("settings-toggle-view").getAttribute("aria-expanded")).toBe("false");
      expect(getByTestId("settings-toggle-export").getAttribute("aria-expanded")).toBe("false");
      expect(getByTestId("settings-toggle-llm").getAttribute("aria-expanded")).toBe("true");

      // Expand view accordion individually and verify Rare UI ThemeSelector
      fireEvent.click(getByTestId("settings-toggle-view"));
      expect(getByTestId("settings-toggle-view").getAttribute("aria-expanded")).toBe("true");
      expect(container.querySelector('[data-slot="theme-selector"]')).not.toBeNull();
      expect(getByTestId("theme-selector-item-paper").getAttribute("aria-checked")).toBe("true");
      expect(getByTestId("theme-selector-item-aurora").getAttribute("aria-checked")).toBe("false");

      fireEvent.click(getByTestId("theme-selector-item-aurora"));
      expect(onThemeChange).toHaveBeenCalledWith("aurora");

      // Toggle all expands every section when not all expanded, then folds all
      fireEvent.click(getByTestId("settings-toggle-all"));
      expect(getByTestId("settings-toggle-view").getAttribute("aria-expanded")).toBe("true");
      expect(getByTestId("settings-toggle-export").getAttribute("aria-expanded")).toBe("true");
      expect(getByTestId("settings-toggle-llm").getAttribute("aria-expanded")).toBe("true");

      fireEvent.click(getByTestId("settings-toggle-all"));
      expect(getByTestId("settings-toggle-view").getAttribute("aria-expanded")).toBe("false");
      expect(getByTestId("settings-toggle-export").getAttribute("aria-expanded")).toBe("false");
      expect(getByTestId("settings-toggle-llm").getAttribute("aria-expanded")).toBe("false");

      // Re-open llm section and retrieve models
      fireEvent.click(getByTestId("settings-toggle-llm"));
      fireEvent.click(getByTestId("fetch-models-btn"));

      await waitFor(() => {
        expect(queryByTestId("model-option-gemini-2.5-flash-preview")).not.toBeNull();
      });

      // Filter by keyword and select retrieved model
      fireEvent.change(getByTestId("model-search-input"), { target: { value: "preview" } });
      expect(queryByTestId("model-option-gemini-2.5-flash-preview")).not.toBeNull();
      expect(queryByTestId("model-option-gemini-2.5-pro-exp")).toBeNull();

      fireEvent.click(getByTestId("model-option-gemini-2.5-flash-preview"));
      expect((getByTestId("model-id-input") as HTMLInputElement).value).toBe(
        "gemini-2.5-flash-preview"
      );

      const form = container.querySelector("form");
      expect(form).not.toBeNull();
      fireEvent.submit(form!);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          apiKey: "AIza-test-key",
          model: "gemini-2.5-flash-preview",
        })
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("fetches and normalizes provider models across google, openai-compatible and anthropic", async () => {
    await expect(
      fetchProviderModels({ provider: "openai", apiKey: "", baseUrl: "" })
    ).rejects.toThrow();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              {
                name: "models/gemini-2.5-flash",
                displayName: "Gemini 2.5 Flash",
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/embedding-001",
                displayName: "Embedding",
                supportedGenerationMethods: ["embedContent"],
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "gpt-4.1" }, { id: "o4-mini" }],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "claude-3-7-sonnet-latest", display_name: "Claude 3.7 Sonnet" }],
          }),
          { status: 200 }
        )
      );

    try {
      const googleModels = await fetchProviderModels({
        provider: "google",
        apiKey: "AIza-fake",
      });
      expect(googleModels.map((m) => m.id)).toEqual(["gemini-2.5-flash"]);

      const openaiModels = await fetchProviderModels({
        provider: "openai",
        apiKey: "sk-fake",
      });
      expect(openaiModels.map((m) => m.id)).toEqual(["gpt-4.1", "o4-mini"]);

      const anthropicModels = await fetchProviderModels({
        provider: "anthropic",
        apiKey: "sk-ant-fake",
      });
      expect(anthropicModels[0]).toMatchObject({
        id: "claude-3-7-sonnet-latest",
        label: "Claude 3.7 Sonnet",
        source: "remote",
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("opens onboarding automatically on clean first run and persists completion in store", async () => {
    window.localStorage.clear();
    useWorkbenchStore.setState({ hydrated: false, onboardingOpen: false, onboardingCompleted: true });
    await useWorkbenchStore.getState().hydrateFromStorage();

    const firstState = useWorkbenchStore.getState();
    expect(firstState.documents.map((d) => d.id)).toContain("demo-repo-rcd-cedi");
    expect(firstState.onboardingOpen).toBe(true);
    expect(firstState.onboardingCompleted).toBe(false);

    firstState.completeOnboarding();
    expect(useWorkbenchStore.getState().onboardingOpen).toBe(false);
    expect(useWorkbenchStore.getState().onboardingCompleted).toBe(true);
  });

  it("uses minimalist unified top chrome with Hero filter ribbon and houses onboarding inside SettingsModal", async () => {
    const win = window as unknown as {
      purrparseDesktop?: { isDesktop?: boolean; platform?: string };
    };
    const prevBridge = win.purrparseDesktop;
    win.purrparseDesktop = { isDesktop: true, platform: "darwin" };

    try {
      const cognitiveDoc = DEMO_DOCUMENTS[1]; // How to Fix Your Entire Life in 1 Day
      const { getByTestId, queryByTestId } = render(
        <HeaderConsole
          doc={cognitiveDoc}
          activeDimFilter={null}
          paretoMode={false}
          firstPassMode={false}
          fuzzyOnlyMode={false}
          autoHideHeader={true}
          themeMode="paper"
          readingDepthMode="workbench"
          onThemeChange={() => {}}
          onReadingDepthChange={() => {}}
          onToggleDim={() => {}}
          onTogglePareto={() => {}}
          onToggleFirstPass={() => {}}
          onToggleFuzzyOnly={() => {}}
          onOpenLibrary={() => {}}
          onOpenStudio={() => {}}
          onOpenSettings={() => {}}
        />
      );

      await waitFor(() => {
        expect(getByTestId("sticky-toolbar").getAttribute("data-mac-desktop")).toBe("true");
      });

      const toolbar = getByTestId("sticky-toolbar");
      expect(toolbar.style.backdropFilter).toContain("blur(24px)");
      expect(toolbar.querySelector('[data-testid="topbar-glass-fog"]')).not.toBeNull();
      expect(toolbar.querySelector('[data-slot="fluid-orb"][data-variant="banner"]')).not.toBeNull();
      expect(toolbar.className).toContain("electron-drag");

      // Onboarding guide moved out of top bar into SettingsModal
      expect(queryByTestId("onboarding-trigger")).toBeNull();

      // Quick filter popover works for scrolled reading without crowding top bar
      expect(queryByTestId("quick-filter-popover")).toBeNull();
      fireEvent.click(getByTestId("quick-filter-trigger"));
      expect(queryByTestId("quick-filter-popover")).not.toBeNull();
      expect(getByTestId("scope-help-pareto").textContent).toContain("核心");
      expect(getByTestId("scope-help-firstpass").textContent).toContain("第一遍");
      expect(getByTestId("scope-help-fuzzy").textContent).toContain("模糊");

      // Hero hosts wrapping short-label filter ribbon (zero horizontal clipping)
      const filterStrip = getByTestId("header-filter-strip");
      expect(filterStrip.className).toContain("flex-wrap");
      expect(filterStrip.textContent).toContain("心智模型");
      expect(filterStrip.textContent).not.toContain("（悬停释义）");

      // Reading depth buttons show individual explanations on hover without extra '?' button
      expect(queryByTestId("depth-help-trigger")).toBeNull();
      expect(queryByTestId("reading-depth-tooltip")).toBeNull();
      const depthButtons = Array.from(
        getByTestId("reading-depth-switcher").querySelectorAll("button")
      );
      const pureModeBtn = depthButtons.find((b) => b.textContent === "通读");
      const workbenchBtn = depthButtons.find((b) => b.textContent === "精读");
      const reviewBtn = depthButtons.find((b) => b.textContent === "复习");
      expect(pureModeBtn).toBeDefined();
      expect(workbenchBtn).toBeDefined();
      expect(reviewBtn).toBeDefined();

      fireEvent.mouseEnter(pureModeBtn!);
      expect(getByTestId("reading-depth-tooltip").textContent).toContain("通读 · 纯净书页长卷");
      fireEvent.mouseEnter(workbenchBtn!);
      expect(getByTestId("reading-depth-tooltip").textContent).toContain("精读 · 双栏结构化工作台");
      fireEvent.mouseEnter(reviewBtn!);
      expect(getByTestId("reading-depth-tooltip").textContent).toContain("模糊 / 不懂");
      expect(getByTestId("reading-depth-tooltip").textContent).toContain("划词 AI 追问");

      const onOpenOnboarding = vi.fn();
      const onSettingsClose = vi.fn();
      const settingsView = render(
        <SettingsModal
          open={true}
          doc={cognitiveDoc}
          config={{ provider: "google", apiKey: "", model: "gemini-2.5-flash", baseUrl: "" }}
          hideSecondary={false}
          hideNotes={false}
          autoHideHeader={true}
          onToggleSecondary={() => {}}
          onToggleNotes={() => {}}
          onToggleAutoHideHeader={() => {}}
          onExportMarkdown={() => {}}
          onExportHtml={() => {}}
          onSave={() => {}}
          onClose={onSettingsClose}
          onOpenOnboarding={onOpenOnboarding}
        />
      );

      fireEvent.click(settingsView.getByTestId("onboarding-trigger"));
      expect(onSettingsClose).toHaveBeenCalledTimes(1);
      expect(onOpenOnboarding).toHaveBeenCalledTimes(1);
    } finally {
      if (prevBridge === undefined) {
        delete win.purrparseDesktop;
      } else {
        win.purrparseDesktop = prevBridge;
      }
    }
  });

  it("shows floating '问 AI' pill on left-mouse text selection and opens slide-over AI drawer", async () => {
    const paperDoc = DEMO_DOCUMENTS[0];
    const targetUnit = paperDoc.units[0];

    // Seed onboarding completed so drawer backdrop doesn't block selection
    useWorkbenchStore.setState({
      documents: DEMO_DOCUMENTS,
      activeDocumentId: paperDoc.id,
      viewMode: "reader",
      readingDepthMode: "workbench",
      onboardingCompleted: true,
      onboardingOpen: false,
      hydrated: true,
    });

    const { container, getByTestId, queryByTestId } = render(<WorkbenchShell />);

    const articleEl = container.querySelector(`article#${targetUnit.id}`);
    expect(articleEl).not.toBeNull();

    const getSelectionSpy = vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      anchorNode: articleEl!,
      rangeCount: 1,
      toString: () => "Scaled Dot-Product Attention computes the dot products",
      getRangeAt: () => ({
        getBoundingClientRect: () => ({
          left: 240,
          top: 320,
          width: 180,
          height: 22,
          bottom: 342,
        }),
      }),
    } as unknown as Selection);

    try {
      expect(queryByTestId("selection-ask-pill")).toBeNull();
      fireEvent.mouseUp(articleEl!, { button: 0, clientX: 330, clientY: 330 });

      expect(queryByTestId("selection-ask-pill")).not.toBeNull();
      expect(getByTestId("selection-ask-ai-btn").textContent).toContain("问 AI");

      fireEvent.click(getByTestId("selection-ask-ai-btn"));
      expect(queryByTestId("selection-ask-pill")).toBeNull();

      const drawer = getByTestId("ai-qa-drawer");
      expect(drawer.textContent).toContain("AI 精读助手");
      expect(drawer.textContent).toContain("Scaled Dot-Product Attention computes the dot products");
      expect(drawer.textContent).not.toContain("坐标 (");
      expect(drawer.textContent).not.toContain("[关闭]");
    } finally {
      getSelectionSpy.mockRestore();
    }

    // Standalone SelectionQaModal renders thread turns & evidence jump button cleanly
    const onJumpToUnit = vi.fn();
    const onDrawerClose = vi.fn();
    const drawerView = render(
      <SelectionQaModal
        open={true}
        doc={paperDoc}
        unit={targetUnit}
        selectedText="Scaled Dot-Product Attention"
        anchorPos={{ x: 100, y: 200 }}
        activeThread={{
          id: "qa-drawer-1",
          unitId: targetUnit.id,
          unitCode: targetUnit.unitCode,
          selectedText: "Scaled Dot-Product Attention",
          question: "为什么要除以 sqrt(d_k)？",
          scope: "document",
          answer: "[原文明示] 避免点积方差过大把 softmax 推向极小梯度区。",
          evidences: [
            {
              unitCode: "§3.2.1",
              unitId: paperDoc.units[1]?.id,
              quote: "We suspect that for large values of d_k, the dot products grow large...",
              rationale: "原文机制推导",
            },
          ],
          followUps: [],
          createdAt: "2026-11-18T00:00:00Z",
        }}
        llmConfig={{ provider: "google", apiKey: "", model: "gemini-2.5-flash" }}
        onSaveThread={() => {}}
        onAppendFollowUp={() => {}}
        onJumpToUnit={onJumpToUnit}
        onClose={onDrawerClose}
      />
    );

    const jumpBtn = Array.from(drawerView.container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("跳转原处")
    );
    expect(jumpBtn).toBeDefined();
    fireEvent.click(jumpBtn!);
    expect(onJumpToUnit).toHaveBeenCalled();
    expect(onDrawerClose).toHaveBeenCalled();
  });

  it("infers omni-input source kind & mode cleanly and renders WorkspaceHome launcher + store view transitions", async () => {
    const plugins = defaultPluginRegistry.list();
    expect(detectOmniSource("https://github.com/vercel/next.js", plugins)).toMatchObject({
      suggestedModeId: "repo-deconstruct",
      detectedKind: "repo-url",
    });
    expect(detectOmniSource("4.12 分享抖音视频 https://v.douyin.com/abc123/", plugins)).toMatchObject({
      suggestedModeId: "cognitive-essay",
      detectedKind: "remote-url",
    });
    expect(detectOmniSource("https://arxiv.org/abs/1706.03762", plugins)).toMatchObject({
      suggestedModeId: "academic-paper",
      detectedKind: "remote-url",
    });
    expect(detectOmniSource("Transformer attention mechanism scaling", plugins)).toMatchObject({
      detectedKind: "search-query",
    });

    const onOpenDocument = vi.fn();
    const onOpenReview = vi.fn();
    const onOpenLibrary = vi.fn();
    const onOpenStudio = vi.fn();
    const onOpenSettings = vi.fn();
    const onOpenApiSettings = vi.fn();
    const onOpenOnboarding = vi.fn();
    const onToggleStartOnHome = vi.fn();

    const annotationsByDoc = {
      [DEMO_DOCUMENTS[1].id]: {
        unitNotes: {},
        journalAnswers: {},
        checklistStates: {},
        unitUnderstanding: { [DEMO_DOCUMENTS[1].units[0].id]: "confused" as const },
        pretestAnswers: {},
        sectionRecallAnswers: {},
        socraticAnswers: {},
        feynmanEssay: "",
        unitQaThreads: {
          [DEMO_DOCUMENTS[1].units[0].id]: [
            {
              id: "qa-home-1",
              unitId: DEMO_DOCUMENTS[1].units[0].id,
              unitCode: DEMO_DOCUMENTS[1].units[0].unitCode,
              selectedText: "Anti-Vision",
              question: "这里是什么意思？",
              scope: "document" as const,
              answer: "反向愿景提醒。",
              evidences: [],
              followUps: [],
              createdAt: "2026-11-18T00:00:00Z",
            },
          ],
        },
      },
    };

    const { getByTestId, queryByTestId, container } = render(
      <WorkspaceHome
        documents={DEMO_DOCUMENTS}
        activeDocumentId={DEMO_DOCUMENTS[0].id}
        annotationsByDoc={annotationsByDoc}
        llmConfig={{ provider: "google", apiKey: "", model: "gemini-2.5-flash" }}
        themeMode="paper"
        startOnHome={true}
        onThemeChange={() => {}}
        onToggleStartOnHome={onToggleStartOnHome}
        onOpenDocument={onOpenDocument}
        onOpenReview={onOpenReview}
        onOpenLibrary={onOpenLibrary}
        onOpenStudio={onOpenStudio}
        onOpenSettings={onOpenSettings}
        onOpenApiSettings={onOpenApiSettings}
        onOpenOnboarding={onOpenOnboarding}
        onDocumentReady={() => {}}
      />
    );

    expect(container.textContent).toContain("今天想拆解什么？");

    // Start button embeds Rare UI MatrixOrb shifting from idle -> listening when typing
    const submitBtn = getByTestId("home-omni-submit");
    const submitOrb = submitBtn.querySelector('[data-slot="matrix-orb"]');
    expect(submitOrb).not.toBeNull();
    expect(submitOrb!.getAttribute("data-state")).toBe("idle");
    fireEvent.change(getByTestId("home-omni-input"), { target: { value: "Attention mechanism" } });
    expect(submitOrb!.getAttribute("data-state")).toBe("listening");
    fireEvent.change(getByTestId("home-omni-input"), { target: { value: "" } });

    const standaloneOrb = render(<MatrixOrb state="thinking" showLabel={true} labels={{ thinking: "正在解析" }} />);
    expect(standaloneOrb.container.textContent).toContain("正在解析");
    standaloneOrb.unmount();

    // Utility footer (onboarding tour link, startup preference pill) is removed so home stays a single unscrollable page
    expect(container.textContent).not.toContain("查看 4 步初次向导");
    expect(queryByTestId("home-startup-pref-btn")).toBeNull();

    // Library documents live inside the 3D Folder initially until clicked
    const folderBtn = getByTestId("home-library-folder");
    expect(folderBtn.getAttribute("aria-expanded")).toBe("false");
    expect(queryByTestId("home-folder-expanded-shelf")).toBeNull();
    expect(queryByTestId("home-folder-modal")).toBeNull();
    expect(queryByTestId(`home-doc-card-${DEMO_DOCUMENTS[0].id}`)).toBeNull();

    // Clicking the 3D folder opens the smooth centered spring popup page (never inline below)
    fireEvent.click(folderBtn);
    expect(folderBtn.getAttribute("aria-expanded")).toBe("true");
    expect(queryByTestId("home-folder-expanded-shelf")).toBeNull();
    const folderModal = getByTestId("home-folder-modal");
    expect(folderModal.querySelector('[data-testid="home-folder-modal-header"]')).not.toBeNull();
    expect(folderModal.querySelector('[data-testid="topbar-glass-fog"]')).not.toBeNull();
    expect(getByTestId(`home-doc-card-${DEMO_DOCUMENTS[0].id}`)).toBeDefined();
    expect(getByTestId(`home-doc-card-${DEMO_DOCUMENTS[1].id}`)).toBeDefined();
    expect(getByTestId(`home-doc-card-${DEMO_DOCUMENTS[2].id}`)).toBeDefined();

    // Filter inside popup folder modal works
    fireEvent.change(getByTestId("home-folder-search"), { target: { value: "RCD_CEDI" } });
    expect(queryByTestId(`home-doc-card-${DEMO_DOCUMENTS[0].id}`)).toBeNull();
    expect(queryByTestId(`home-doc-card-${DEMO_DOCUMENTS[2].id}`)).not.toBeNull();
    fireEvent.change(getByTestId("home-folder-search"), { target: { value: "" } });

    // Clicking a doc card inside the folder modal opens that document and closes modal
    fireEvent.click(getByTestId(`home-doc-card-${DEMO_DOCUMENTS[2].id}`));
    expect(onOpenDocument).toHaveBeenCalledWith(DEMO_DOCUMENTS[2].id);

    // Full LibraryDrawer button triggers with folder anchor element
    fireEvent.click(getByTestId("home-view-all-library-btn"));
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);

    // Primary folder launch button re-opens the popup modal, and close button dismisses it
    fireEvent.click(getByTestId("home-folder-toggle-btn"));
    expect(queryByTestId("home-folder-modal")).not.toBeNull();
    fireEvent.click(getByTestId("home-folder-close-btn"));

    // Review summary points to document with confused unit + Q&A thread (DEMO_DOCUMENTS[1])
    expect(getByTestId("home-review-card").textContent).toContain("1 疑点 · 1 追问");
    fireEvent.click(getByTestId("home-review-card"));
    expect(onOpenReview).toHaveBeenCalledWith(DEMO_DOCUMENTS[1].id);

    fireEvent.click(getByTestId("home-resume-card"));
    expect(onOpenDocument).toHaveBeenCalledWith(DEMO_DOCUMENTS[0].id);

    fireEvent.click(getByTestId("home-api-status-btn"));
    expect(onOpenApiSettings).toHaveBeenCalledTimes(1);

    expect(getByTestId("home-brand-logo").getAttribute("src")).toBe("/brand-logo.svg");

    fireEvent.click(getByTestId("home-open-library-btn"));
    expect(onOpenLibrary).toHaveBeenCalledTimes(2);

    fireEvent.click(getByTestId("home-open-studio-btn"));
    expect(onOpenStudio).toHaveBeenCalledTimes(1);

    fireEvent.click(getByTestId("home-open-settings-btn"));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    // HeaderConsole renders home-nav-btn left of 文库
    const onOpenHome = vi.fn();
    const headerView = render(
      <HeaderConsole
        doc={DEMO_DOCUMENTS[0]}
        activeDimFilter={null}
        paretoMode={false}
        onToggleDim={() => {}}
        onTogglePareto={() => {}}
        onOpenHome={onOpenHome}
        onOpenLibrary={() => {}}
        onOpenStudio={() => {}}
        onOpenSettings={() => {}}
      />
    );
    fireEvent.click(headerView.getByTestId("home-nav-btn"));
    expect(onOpenHome).toHaveBeenCalledTimes(1);

    // HeaderConsole chapter TOC opens Rare UI RailToc with indented section badges
    expect(headerView.queryByTestId("header-toc-popover")).toBeNull();
    fireEvent.click(headerView.getByTestId("header-toc-trigger"));
    const tocPopover = headerView.getByTestId("header-toc-popover");
    expect(tocPopover.querySelector('[data-slot="rail-toc"]')).not.toBeNull();
    expect(headerView.getByTestId("rail-toc-item-__top__")).toBeDefined();
    expect(headerView.getByTestId("rail-toc-item-mental-model")).toBeDefined();
    expect(headerView.getByTestId("rail-toc-item-bottom-arsenal")).toBeDefined();
    fireEvent.click(headerView.getByTestId("rail-toc-item-mental-model"));
    expect(
      headerView.getByTestId("rail-toc-item-mental-model").getAttribute("aria-current")
    ).toBe("location");

    const onRailSelect = vi.fn();
    const standaloneRail = render(
      <RailToc
        title="独立滑轨"
        items={[
          { id: "sec-a", label: "01 引言", depth: 0 },
          { id: "sec-b", label: "02 核心推导", depth: 1, badge: "重点" },
        ]}
        onItemSelect={onRailSelect}
      />
    );
    fireEvent.click(standaloneRail.getByTestId("rail-toc-item-sec-b"));
    expect(onRailSelect).toHaveBeenCalledTimes(1);
    expect(
      standaloneRail.getByTestId("rail-toc-item-sec-b").getAttribute("aria-current")
    ).toBe("location");
    standaloneRail.unmount();

    // SettingsModal startOnHome toggle
    const onSettingsStartToggle = vi.fn();
    const settingsView = render(
      <SettingsModal
        open={true}
        doc={DEMO_DOCUMENTS[0]}
        config={{ provider: "google", apiKey: "", model: "gemini-2.5-flash" }}
        hideSecondary={false}
        hideNotes={false}
        autoHideHeader={true}
        startOnHome={true}
        onToggleStartOnHome={onSettingsStartToggle}
        onToggleSecondary={() => {}}
        onToggleNotes={() => {}}
        onToggleAutoHideHeader={() => {}}
        onExportMarkdown={() => {}}
        onExportHtml={() => {}}
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    fireEvent.click(settingsView.getByTestId("settings-start-on-home-toggle"));
    expect(onSettingsStartToggle).toHaveBeenCalledTimes(1);

    // Store hydrateFromStorage defaults to home & transitions cleanly
    window.localStorage.clear();
    useWorkbenchStore.setState({ hydrated: false, viewMode: "reader", startOnHome: true });
    await useWorkbenchStore.getState().hydrateFromStorage();
    expect(useWorkbenchStore.getState().viewMode).toBe("home");
    expect(useWorkbenchStore.getState().startOnHome).toBe(true);

    useWorkbenchStore.getState().setActiveDocument(DEMO_DOCUMENTS[0].id);
    expect(useWorkbenchStore.getState().viewMode).toBe("reader");

    useWorkbenchStore.getState().setViewMode("home");
    useWorkbenchStore.getState().openDocumentForReview(DEMO_DOCUMENTS[1].id);
    expect(useWorkbenchStore.getState().viewMode).toBe("reader");
    expect(useWorkbenchStore.getState().activeDocumentId).toBe(DEMO_DOCUMENTS[1].id);
    expect(useWorkbenchStore.getState().readingDepthMode).toBe("review");

    useWorkbenchStore.getState().toggleStartOnHome();
    expect(useWorkbenchStore.getState().startOnHome).toBe(false);
    useWorkbenchStore.getState().toggleStartOnHome();
    expect(useWorkbenchStore.getState().startOnHome).toBe(true);
  });

  it("streams AI Q&A over NDJSON and renders Rare UI PromptBox & StreamingResponse with math/CJK safety", async () => {
    // 1. PromptBox send + stop states
    const onPromptSubmit = vi.fn();
    const onPromptStop = vi.fn();
    const promptView = render(
      <PromptBox
        placeholder="提问占位提示"
        onSubmit={onPromptSubmit}
        onStop={onPromptStop}
        status="idle"
      />
    );
    const inputEl = promptView.container.querySelector('[data-slot="prompt-box-input"]') as HTMLTextAreaElement;
    fireEvent.change(inputEl, { target: { value: "为什么要缩放 sqrt(d_k)？" } });
    fireEvent.click(promptView.getByTestId("prompt-box-send-btn"));
    expect(onPromptSubmit).toHaveBeenCalledTimes(1);
    expect(onPromptSubmit.mock.calls[0][0]).toBe("为什么要缩放 sqrt(d_k)？");

    promptView.rerender(
      <PromptBox
        placeholder="提问占位提示"
        onSubmit={onPromptSubmit}
        onStop={onPromptStop}
        status="streaming"
      />
    );
    fireEvent.click(promptView.getByTestId("prompt-box-stop-btn"));
    expect(onPromptStop).toHaveBeenCalledTimes(1);

    // 2. StreamingResponse renders caret when streaming & action bar + CJK/math when done
    const streamView = render(
      <StreamingResponse
        text="**[原文明示]** 注意力分母中存在 $d_k$，用于防止点积方差过大。"
        status="streaming"
      />
    );
    expect(
      streamView.container.querySelector('[data-slot="streaming-response-caret"]')
    ).not.toBeNull();

    const onRetry = vi.fn();
    const doneView = render(
      <StreamingResponse
        text="**[原文明示]** 当维度 $d_k$ 很大时，点积均值和方差增大，导致 softmax 梯度消失。"
        status="done"
        onRetry={onRetry}
      />
    );
    expect(doneView.container.textContent).toContain("原文明示");
    expect(doneView.container.textContent).toContain("d_k");
    const retryBtn = doneView.getByLabelText("重新生成");
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // 3. Backend POST /api/ask-selection streams NDJSON events cleanly in offline mode
    const paperDoc = DEMO_DOCUMENTS[0];
    const targetUnit = paperDoc.units[0];
    const req = new NextRequest("http://localhost:3005/api/ask-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docTitle: paperDoc.title,
        unitId: targetUnit.id,
        unitCode: targetUnit.unitCode,
        selectedText: "Scaled Dot-Product Attention",
        unitPrimaryText: targetUnit.primaryText,
        unitTldr: targetUnit.tldr,
        scope: "document",
        effort: "deep",
        stream: true,
        question: "为什么要做缩放？",
        contextUnits: paperDoc.units.map((u) => ({
          unitId: u.id,
          unitCode: u.unitCode,
          tldr: u.tldr,
          primaryText: u.primaryText,
        })),
      }),
    });
    const res = await askSelectionPost(req);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const rawNdjson = await res.text();
    const events = rawNdjson
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { type: string; text?: string; answer?: string; evidences?: unknown[] });
    expect(events[0]?.type).toBe("meta");
    expect(events.some((e) => e.type === "delta" && Boolean(e.text))).toBe(true);
    const doneEv = events.find((e) => e.type === "done");
    expect(doneEv).toBeDefined();
    expect(doneEv!.answer).toContain("原文明示");
    expect((doneEv!.evidences?.length ?? 0) > 0).toBe(true);

    // 4. SelectionQaModal consumes streamed NDJSON via PromptBox & saves thread
    const enc = new TextEncoder();
    const mockStream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(enc.encode(`${JSON.stringify({ type: "meta", scopeUsed: "document", evidences: [] })}\n`));
        ctrl.enqueue(enc.encode(`${JSON.stringify({ type: "delta", text: "流式分段解析：**防止** " })}\n`));
        ctrl.enqueue(enc.encode(`${JSON.stringify({ type: "delta", text: "方差过大致使梯度接近零。" })}\n`));
        ctrl.enqueue(
          enc.encode(
            `${JSON.stringify({
              type: "done",
              answer: "流式分段解析：**防止** 方差过大致使梯度接近零。",
              scopeUsed: "document",
              evidences: [
                {
                  unitCode: targetUnit.unitCode,
                  unitId: targetUnit.id,
                  quote: "dot products grow large",
                  rationale: "原段说明",
                },
              ],
              suggestedFollowUps: ["多头机制如何扩展表达能力？"],
            })}\n`
          )
        );
        ctrl.close();
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(mockStream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      })
    );
    const onSaveThread = vi.fn();
    try {
      const qaModal = render(
        <SelectionQaModal
          open={true}
          doc={paperDoc}
          unit={targetUnit}
          selectedText="Scaled Dot-Product Attention"
          anchorPos={{ x: 100, y: 200 }}
          activeThread={null}
          llmConfig={{ provider: "google", apiKey: "", model: "gemini-2.5-flash" }}
          onSaveThread={onSaveThread}
          onAppendFollowUp={() => {}}
          onJumpToUnit={() => {}}
          onClose={() => {}}
        />
      );
      const modalInput = qaModal.container.querySelector('[data-slot="prompt-box-input"]') as HTMLTextAreaElement;
      fireEvent.change(modalInput, { target: { value: "流式回答效果如何？" } });
      fireEvent.click(qaModal.getByTestId("prompt-box-send-btn"));

      await waitFor(() => {
        expect(onSaveThread).toHaveBeenCalledTimes(1);
      });
      expect(onSaveThread.mock.calls[0][0].answer).toContain("方差过大致使梯度接近零");
      expect(qaModal.container.textContent).toContain("多头机制如何扩展表达能力？");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("renders Rare UI ProximitySidebar with hover label, scroll progress %, and click navigation inside WorkbenchShell", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    try {
      const targetDiv = document.createElement("div");
      targetDiv.id = "prox-sec-2";
      document.body.appendChild(targetDiv);

      const sidebarView = render(
        <ProximitySidebar
          sections={[
            { id: "prox-top", label: "00 · 顶层心智", kind: "title" },
            { id: "prox-sec-2", label: "02 · 核心机制推导", kind: "subtitle" },
            { id: "prox-unit-1", label: "§3.2.1 Attention 公式", kind: "body" },
          ]}
          side="right"
        />
      );

      expect(sidebarView.getByTestId("proximity-sidebar")).toBeDefined();
      expect(sidebarView.getByTestId("proximity-sidebar-percent").textContent).toContain("%");

      const virtualDashes = sidebarView.container.querySelectorAll(
        '[data-slot="proximity-virtual-dash"]'
      );
      expect(virtualDashes.length).toBeGreaterThanOrEqual(2);

      const secDash = sidebarView.getByTestId("proximity-dash-prox-sec-2");
      fireEvent.mouseEnter(secDash);
      expect(sidebarView.container.textContent).toContain("02 · 核心机制推导");

      fireEvent.click(secDash);
      expect(secDash.getAttribute("aria-current")).toBe("location");
      expect(scrollToSpy).toHaveBeenCalled();

      fireEvent.click(virtualDashes[0]);
      expect(scrollToSpy).toHaveBeenCalledTimes(2);

      targetDiv.remove();
      sidebarView.unmount();

      // Verify WorkbenchShell mounts ProximitySidebar in reader mode
      useWorkbenchStore.setState({
        documents: DEMO_DOCUMENTS,
        activeDocumentId: DEMO_DOCUMENTS[0].id,
        viewMode: "reader",
        readingDepthMode: "workbench",
        onboardingCompleted: true,
        onboardingOpen: false,
        hydrated: true,
      });
      const shellView = render(<WorkbenchShell />);
      expect(shellView.getByTestId("proximity-sidebar")).toBeDefined();
      expect(shellView.getByTestId("proximity-dash-mental-model")).toBeDefined();
      expect(shellView.getByTestId("proximity-dash-bottom-arsenal")).toBeDefined();
    } finally {
      scrollToSpy.mockRestore();
    }
  });

  it("ThemeSelector renders PurrParse theme previews and supports ArrowRight keyboard navigation", () => {
    const onChange = vi.fn();
    const view = render(<ThemeSelector defaultValue="paper" onChange={onChange} />);

    const paperCard = view.getByTestId("theme-selector-item-paper");
    const auroraCard = view.getByTestId("theme-selector-item-aurora");
    const studioCard = view.getByTestId("theme-selector-item-studio");

    expect(paperCard.getAttribute("aria-checked")).toBe("true");
    expect(paperCard.getAttribute("data-state")).toBe("checked");
    expect(auroraCard.getAttribute("aria-checked")).toBe("false");
    expect(studioCard.getAttribute("aria-checked")).toBe("false");
    expect(view.container.querySelectorAll('[data-slot="theme-selector-preview"]').length).toBe(3);

    fireEvent.keyDown(paperCard, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("aurora");
    expect(auroraCard.getAttribute("aria-checked")).toBe("true");
    expect(auroraCard.getAttribute("data-state")).toBe("checked");
    expect(paperCard.getAttribute("aria-checked")).toBe("false");
  });

  it("renders Rare UI CodeBlock in CodeViewer with Prism syntax highlighting, 5-dim overlays, and StreamingResponse fenced code blocks", () => {
    const repoDoc = DEMO_DOCUMENTS[2];
    const unit = repoDoc.units[0];
    const onHoverTooltip = vi.fn();
    const onLeaveTooltip = vi.fn();

    const viewer = render(
      <div data-theme="paper" className="prism-shell">
        <CodeViewer
          code={unit.primaryText}
          language={unit.codeLanguage}
          filePath={unit.filePath}
          highlights={unit.highlights}
          dimensions={repoDoc.dimensions}
          activeDimFilter={null}
          onHoverTooltip={onHoverTooltip}
          onLeaveTooltip={onLeaveTooltip}
        />
      </div>
    );

    const codeBlock = viewer.container.querySelector('[data-slot="code-block"]');
    expect(codeBlock).not.toBeNull();
    expect(codeBlock?.getAttribute("data-mode")).toBe("light");
    expect(viewer.container.querySelector('[data-slot="code-block-header"]')?.textContent).toContain(
      "src/rcd_cedi/api.py"
    );
    expect(viewer.container.querySelector('[data-slot="code-block-copy"]')).not.toBeNull();
    expect(viewer.container.querySelectorAll(".token.keyword").length).toBeGreaterThan(0);

    // Overlaid 5-color semantic highlights + tooltip trigger on syntax tokens
    const dim3Highlights = viewer.container.querySelectorAll('[data-highlight-dim="dim3"]');
    expect(dim3Highlights.length).toBeGreaterThan(0);
    fireEvent.mouseMove(dim3Highlights[0], { clientX: 120, clientY: 80 });
    expect(onHoverTooltip).toHaveBeenCalled();
    fireEvent.mouseLeave(dim3Highlights[0]);
    expect(onLeaveTooltip).toHaveBeenCalled();

    // Toggle to pure syntax view cleanly removes 5-dim overlays while retaining Prism tokens
    fireEvent.click(viewer.getByTestId("code-viewer-highlight-toggle"));
    expect(viewer.container.querySelectorAll('[data-highlight-dim="dim3"]').length).toBe(0);
    expect(viewer.container.querySelectorAll(".token.keyword").length).toBeGreaterThan(0);

    // Direct CodeBlock respects Aurora dark theme attribute & line highlighting
    const standalone = render(
      <div data-theme="aurora" className="prism-shell">
        <CodeBlock
          code={"const x = 1;\nreturn x + 2;"}
          language="ts"
          filename="demo.ts"
          highlightLines={[2]}
        />
      </div>
    );
    expect(standalone.container.querySelector('[data-slot="code-block"]')?.getAttribute("data-mode")).toBe(
      "dark"
    );
    expect(standalone.container.querySelector('[data-slot="code-block-pre"]')?.textContent).toContain("const");

    // Fenced code inside StreamingResponse uses Rare UI CodeBlock as well
    const streamCode = render(
      <StreamingResponse
        text={"示例实现：\n\n```python\ndef check(x: int) -> bool:\n    return x > 0\n```"}
        status="done"
      />
    );
    expect(streamCode.container.querySelector('[data-slot="code-block"]')).not.toBeNull();
    expect(streamCode.container.querySelectorAll(".token.keyword").length).toBeGreaterThan(0);
  });

  it("uses theme-aware CSS variables in StreamingResponse, PromptBox, and SelectionQaModal excerpt for Aurora dark legibility", () => {
    const view = render(
      <div data-theme="aurora" className="prism-shell">
        <StreamingResponse text="普通正文段落与 **加粗标题** 和 `inline()`" status="done" />
        <PromptBox value="" onValueChange={() => {}} onSubmit={() => {}} status="idle" />
      </div>
    );

    const streamEl = view.container.querySelector('[data-slot="streaming-response"]');
    expect(streamEl?.className).toContain("text-[var(--prism-ink)]");
    expect(streamEl?.className).not.toContain("text-[#1f242d]");

    const promptRoot = view.container.querySelector('[data-slot="prompt-box"]');
    const promptInput = view.container.querySelector('[data-slot="prompt-box-input"]');
    const promptBtn = view.getByTestId("prompt-box-send-btn");
    expect(promptRoot?.className).toContain("text-[var(--prism-ink)]");
    expect(promptInput?.className).toContain("text-[var(--prism-ink)]");
    expect(promptBtn.className).not.toContain("bg-[#ede7da]");

    const doc = DEMO_DOCUMENTS[0];
    const qaView = render(
      <div data-theme="aurora" className="prism-shell">
        <SelectionQaModal
          open={true}
          doc={doc}
          unit={doc.units[0]}
          selectedText="Scaled Dot-Product Attention"
          anchorPos={{ x: 100, y: 100 }}
          activeThread={null}
          llmConfig={{ provider: "google", apiKey: "", model: "gemini-2.5-flash", baseUrl: "" }}
          onSaveThread={() => {}}
          onAppendFollowUp={() => {}}
          onJumpToUnit={() => {}}
          onClose={() => {}}
        />
      </div>
    );

    const excerpt = qaView.getByTestId("qa-selected-excerpt");
    expect(excerpt.className).not.toContain("bg-white/90");
    expect(excerpt.className).toContain("text-[var(--prism-ink)]");
  });

  it("renders Rare UI AiStatus across thinking/researching/analyzing/writing/done and SelectionQaModal NDJSON phases", async () => {
    expect(resolveAnalyzeAiState(10)).toBe("thinking");
    expect(resolveAnalyzeAiState(30)).toBe("researching");
    expect(resolveAnalyzeAiState(65)).toBe("analyzing");
    expect(resolveAnalyzeAiState(90)).toBe("writing");

    const statusView = render(
      <AiStatus state="thinking" detail="分析上下文" />
    );
    expect(statusView.container.querySelector('[data-slot="ai-status"]')?.getAttribute("data-state")).toBe(
      "thinking"
    );
    expect(statusView.container.textContent).toContain("AI 正在思考");
    expect(statusView.container.textContent).toContain("分析上下文");

    statusView.rerender(<AiStatus state="done" elapsed={3} />);
    expect(statusView.container.querySelector('[data-slot="ai-status"]')?.getAttribute("data-state")).toBe(
      "done"
    );
    expect(statusView.container.textContent).toContain("推演完成 · 3s");

    // Controlled ReadableStream to assert thinking -> researching -> writing -> done inside SelectionQaModal
    const enc = new TextEncoder();
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    const controlledStream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        controllerRef = ctrl;
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(controlledStream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      })
    );
    const onSaveThread = vi.fn();

    try {
      const doc = DEMO_DOCUMENTS[0];
      const qaModal = render(
        <SelectionQaModal
          open={true}
          doc={doc}
          unit={doc.units[0]}
          selectedText="Scaled Dot-Product Attention"
          anchorPos={{ x: 100, y: 120 }}
          activeThread={null}
          llmConfig={{ provider: "google", apiKey: "", model: "gemini-2.5-flash" }}
          onSaveThread={onSaveThread}
          onAppendFollowUp={() => {}}
          onJumpToUnit={() => {}}
          onClose={() => {}}
        />
      );

      const input = qaModal.container.querySelector('[data-slot="prompt-box-input"]') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: "AI 正在分阶段思考吗？" } });
      fireEvent.click(qaModal.getByTestId("prompt-box-send-btn"));

      await waitFor(() => {
        const node = qaModal.container.querySelector('[data-slot="ai-status"]');
        expect(node?.getAttribute("data-state")).toBe("thinking");
      });

      controllerRef!.enqueue(
        enc.encode(
          `${JSON.stringify({
            type: "meta",
            scopeUsed: "document",
            evidences: [
              {
                unitId: doc.units[0].id,
                unitCode: doc.units[0].unitCode,
                rationale: "定位核心段落",
                quote: "Scaled Dot-Product Attention",
              },
            ],
          })}\n`
        )
      );

      await waitFor(() => {
        const node = qaModal.container.querySelector('[data-slot="ai-status"]');
        expect(node?.getAttribute("data-state")).toBe("researching");
      });
      expect(qaModal.container.textContent).toContain("命中 1 处原文依据");

      controllerRef!.enqueue(
        enc.encode(`${JSON.stringify({ type: "delta", text: "分阶段实时推演中。" })}\n`)
      );

      await waitFor(() => {
        const node = qaModal.container.querySelector('[data-slot="ai-status"]');
        expect(node?.getAttribute("data-state")).toBe("writing");
      });

      controllerRef!.enqueue(
        enc.encode(
          `${JSON.stringify({
            type: "done",
            answer: "分阶段实时推演中。",
            scopeUsed: "document",
            evidences: [
              {
                unitId: doc.units[0].id,
                unitCode: doc.units[0].unitCode,
                rationale: "定位核心段落",
                quote: "Scaled Dot-Product Attention",
              },
            ],
            suggestedFollowUps: [],
          })}\n`
        )
      );
      controllerRef!.close();

      await waitFor(() => {
        expect(onSaveThread).toHaveBeenCalledTimes(1);
        const node = qaModal.container.querySelector('[data-slot="ai-status"]');
        expect(node?.getAttribute("data-state")).toBe("done");
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("renders frosted Liquid Glass header + Rare UI FluidOrb dynamic fog across Paper, Studio, and Aurora themes", () => {
    const paperStyle = getTopbarGlassStyle("paper");
    const auroraStyle = getTopbarGlassStyle("aurora");
    expect(String(paperStyle.backdropFilter)).toContain("blur(24px)");
    expect(String(auroraStyle.backgroundColor)).toContain("rgba(11, 17, 30");

    const orbView = render(<FluidOrb size={120} color="#1A73F2" />);
    const orbEl = orbView.container.querySelector('[data-slot="fluid-orb"]');
    expect(orbEl?.getAttribute("data-variant")).toBe("orb");
    expect(orbEl?.querySelector("canvas")).not.toBeNull();
    orbView.unmount();

    // Mock WebGL context to ensure live color/opacity theme switches preserve u_resolution without tearing down WebGL program
    const uniform2fSpy = vi.fn();
    const uniform3fSpy = vi.fn();
    const createProgramSpy = vi.fn(() => ({}));
    const mockGl = {
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: 35713,
      LINK_STATUS: 35714,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      COLOR_BUFFER_BIT: 16384,
      TRIANGLES: 4,
      createProgram: createProgramSpy,
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      deleteShader: () => {},
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      deleteProgram: () => {},
      useProgram: () => {},
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      deleteBuffer: () => {},
      getAttribLocation: () => 0,
      enableVertexAttribArray: () => {},
      vertexAttribPointer: () => {},
      getUniformLocation: (_prog: unknown, name: string) => name,
      uniform1f: () => {},
      uniform2f: uniform2fSpy,
      uniform3f: uniform3fSpy,
      viewport: () => {},
      clearColor: () => {},
      clear: () => {},
      drawArrays: () => {},
    };
    const ctxSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((kind: string) => (kind === "webgl" ? (mockGl as unknown as RenderingContext) : null));

    try {
      const bannerView = render(
        <FluidOrb variant="banner" color="#d97706" secondaryColor="#4b79a1" opacity={0.34} />
      );
      expect(createProgramSpy).toHaveBeenCalledTimes(1);
      expect(uniform2fSpy).toHaveBeenCalledWith("u_resolution", expect.any(Number), expect.any(Number));
      uniform2fSpy.mockClear();

      bannerView.rerender(
        <FluidOrb variant="banner" color="#60a5fa" secondaryColor="#a855f7" opacity={0.44} />
      );
      expect(createProgramSpy).toHaveBeenCalledTimes(1);
      expect(uniform2fSpy).toHaveBeenCalledWith("u_resolution", expect.any(Number), expect.any(Number));
      expect(uniform3fSpy).toHaveBeenCalled();
    } finally {
      ctxSpy.mockRestore();
    }
  });

  it("unifies LibraryDrawer, SelectionQaModal, SettingsModal, IngestionStudioModal, and OnboardingTour headers with frosted Liquid Glass + FluidOrb fog", () => {
    const doc = DEMO_DOCUMENTS[0];
    const llmConfig = { provider: "openai" as const, apiKey: "", model: "gpt-4o-mini" };

    const assertHeaderHasFog = (container: HTMLElement, headerTestId: string, theme: "paper" | "aurora") => {
      const header = container.querySelector(`[data-testid="${headerTestId}"]`) as HTMLElement | null;
      expect(header).not.toBeNull();
      expect(header?.style.backdropFilter).toContain("blur(24px)");
      expect(header?.querySelector('[data-testid="topbar-glass-fog"]')).not.toBeNull();
      const orb = header?.querySelector('[data-slot="fluid-orb"]');
      expect(orb?.getAttribute("data-variant")).toBe("banner");
      if (theme === "aurora") {
        expect(header?.style.backgroundColor).toContain("rgba(11, 17, 30");
      } else {
        expect(header?.style.backgroundColor).toContain("rgba(252, 249, 242");
      }
    };

    const lib = render(
      <LibraryDrawer
        open={true}
        documents={DEMO_DOCUMENTS}
        activeDocumentId={doc.id}
        themeMode="paper"
        onClose={() => {}}
        onSelect={() => {}}
        onDelete={() => {}}
      />
    );
    assertHeaderHasFog(lib.container, "library-drawer-header", "paper");
    lib.rerender(
      <LibraryDrawer
        open={true}
        documents={DEMO_DOCUMENTS}
        activeDocumentId={doc.id}
        themeMode="aurora"
        onClose={() => {}}
        onSelect={() => {}}
        onDelete={() => {}}
      />
    );
    assertHeaderHasFog(lib.container, "library-drawer-header", "aurora");
    lib.unmount();

    const qa = render(
      <SelectionQaModal
        open={true}
        doc={doc}
        unit={doc.units[0]}
        selectedText="Attention"
        anchorPos={null}
        activeThread={null}
        llmConfig={llmConfig}
        themeMode="paper"
        onSaveThread={() => {}}
        onAppendFollowUp={() => {}}
        onJumpToUnit={() => {}}
        onClose={() => {}}
      />
    );
    assertHeaderHasFog(qa.container, "qa-drawer-header", "paper");
    qa.unmount();

    const settings = render(
      <SettingsModal
        open={true}
        doc={doc}
        config={llmConfig}
        hideSecondary={false}
        hideNotes={false}
        autoHideHeader={true}
        themeMode="aurora"
        onThemeChange={() => {}}
        onToggleSecondary={() => {}}
        onToggleNotes={() => {}}
        onToggleAutoHideHeader={() => {}}
        onExportMarkdown={() => {}}
        onExportHtml={() => {}}
        onSave={() => {}}
        onClose={() => {}}
      />
    );
    assertHeaderHasFog(settings.container, "settings-modal-header", "aurora");
    settings.unmount();

    const studio = render(
      <IngestionStudioModal
        open={true}
        llmConfig={llmConfig}
        themeMode="paper"
        onClose={() => {}}
        onCreated={() => {}}
      />
    );
    assertHeaderHasFog(studio.container, "studio-modal-header", "paper");
    studio.unmount();

    const tour = render(
      <OnboardingTour
        open={true}
        documents={DEMO_DOCUMENTS}
        activeDocumentId={doc.id}
        paretoMode={false}
        themeMode="aurora"
        onSelectDocument={() => {}}
        onTogglePareto={() => {}}
        onThemeChange={() => {}}
        onOpenSettingsForApi={() => {}}
        onOpenStudio={() => {}}
        onComplete={() => {}}
      />
    );
    assertHeaderHasFog(tour.container, "onboarding-tour-header", "aurora");
    tour.unmount();
  });
});
