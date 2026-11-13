import type { WorkbenchDocument, WorkbenchUnit } from "@/core/contracts/document-ast";
import type {
  AnnotatedUnitOutput,
  BottomStepOutput,
  SourceUnit,
  TopModelStepOutput,
  WorkbenchModePlugin,
} from "@/core/contracts/mode-plugin";
import {
  BatchUnitsBaseSchema,
  BottomStepBaseSchema,
  TopModelBaseSchema,
  buildHydratedUnit,
} from "@/core/contracts/shared-schemas";
import { ingestAcademicPaper } from "./pdf-ingestor";
import {
  buildAcademicBatchPrompt,
  buildAcademicBottomPrompt,
  buildAcademicTopModelPrompt,
} from "./prompts";

const DIMENSIONS: WorkbenchDocument["dimensions"] = [
  {
    key: "dim1",
    colorSlot: "yellow",
    label: "核心论点/假说",
    extractionRule: "核心主张、中心论点或理论突破。",
  },
  {
    key: "dim2",
    colorSlot: "red",
    label: "关键概念 (悬停释义)",
    extractionRule: "关键学术术语或符号，附带直觉白话解释。",
    enableTooltip: true,
  },
  {
    key: "dim3",
    colorSlot: "blue",
    label: "实证/数据",
    extractionRule: "实验数据、消融指标或核心文献支撑。",
  },
  {
    key: "dim4",
    colorSlot: "green",
    label: "让步/局限",
    extractionRule: "对前人方案的合理肯定或作者主动承认的局限边界。",
  },
  {
    key: "dim5",
    colorSlot: "purple",
    label: "方法论说明",
    extractionRule: "模型架构、数学推导或实验控制变量设定。",
  },
];

const MODULE_LABELS: [string, string, string, string] = [
  "01 / 逻辑演进与跨节锚点",
  "02 / 段落功能与逻辑角色",
  "03 / 硬核破译（公式与直觉拆解）",
  "04 / 审稿人视角（写作亮点与局限）",
];

const DOCUMENT_LABELS: WorkbenchDocument["labels"] = {
  paretoButton: "[80/20 核心聚焦]",
  toggleSecondaryButton: "[显/隐中文]",
  toggleNotesButton: "[显/隐批注]",
  exportMdButton: "[导出 Markdown 笔记]",
  exportHtmlButton: "[编译离线单文件 .HTML]",
  userNoteButton: "[+ 添加本段随手笔记]",
  userNotePlaceholder: "在此记录你对本段的公式推导疑问或科研灵感（自动保存至本地）...",
  transitionPrefix: "[TRANSITION / 过渡铺垫]",
  mentalNavLabel: "00. 顶层导读与架构图",
  bottomNavLabel: "08. 论证复盘与自测",
};

export const academicPaperPlugin: WorkbenchModePlugin<
  TopModelStepOutput,
  { units: AnnotatedUnitOutput[] },
  BottomStepOutput
> = {
  id: "academic-paper",
  name: "学术论文精读",
  shortLabel: "MODE 01 · 论文精读",
  description: "逐段双语对照、KaTeX 公式与张量维度流破译、跨节双向锚点、审稿人视角漏洞审查与苏格拉底自测。",
  layoutRatio: [58, 42],
  inputConfig: {
    placeholder: "在此粘贴学术论文英文全文、LaTeX 文本，或上传论文 PDF 文件...",
    hint: "支持直接填入 arXiv 编号 / PDF 链接、上传 .pdf / .tex 文件，或让 AI 调用搜索工具检索论文全文。",
    supportsFileUpload: true,
    acceptedFileTypes: ".pdf,.txt,.md,.tex",
    supportsRepoUrl: false,
    supportsRemoteUrl: true,
    remoteUrlLabel: "arXiv 论文号 / 链接 / PDF 直链",
    remoteUrlPlaceholder: "1706.03762 或 https://arxiv.org/abs/2106.09685",
    supportsAgentSearch: true,
    searchLabel: "AI 工具联网搜索论文",
    searchPlaceholder: "输入论文标题、作者或研究主题（例如：Attention Is All You Need / FlashAttention）",
  },
  dimensions: DIMENSIONS,
  annotationModuleLabels: MODULE_LABELS,
  documentLabels: DOCUMENT_LABELS,

  preprocessSource: ingestAcademicPaper,

  schemas: {
    topMentalModel: TopModelBaseSchema,
    batchUnits: BatchUnitsBaseSchema,
    bottomWorkbench: BottomStepBaseSchema,
  },

  buildPrompts: {
    topModelPrompt: buildAcademicTopModelPrompt,
    batchUnitsPrompt: buildAcademicBatchPrompt,
    bottomWorkbenchPrompt: buildAcademicBottomPrompt,
  },

  hydrateUnit(source: SourceUnit, annotation: AnnotatedUnitOutput): WorkbenchUnit {
    return buildHydratedUnit(source, annotation, MODULE_LABELS);
  },

  createHeuristicDocument(title: string, units: SourceUnit[]): WorkbenchDocument {
    const sectionMap = new Map<string, { id: string; title: string; count: number }>();
    for (const u of units) {
      const existing = sectionMap.get(u.sectionId);
      if (existing) {
        existing.count += 1;
      } else {
        sectionMap.set(u.sectionId, { id: u.sectionId, title: u.sectionTitle, count: 1 });
      }
    }

    const sections = Array.from(sectionMap.values()).map((s) => ({
      id: s.id,
      navLabel: s.title.slice(0, 22),
      navRole: `[${s.count}段]`,
      title: s.title,
      taskBadge: "SECTION ANALYSIS / 逐段结构化精读",
      summary: {
        established: `本节「${s.title}」共切分 ${s.count} 个单元，[原文明示] 推进了该部分核心论述与实验/概念铺垫。`,
        openQuestions: "[分析推断] 建议核对作者是否明确交代本节结论所依赖的边界条件与替代解释。",
        rhetoricStrategy: "先界定约束与痛点，再引入结构化机制或数据对比支撑主张。",
        referenceRecall: `「${s.title}」的核心脉络围绕 ${s.count} 个连续自然段展开；请用 2 句话概括作者在本节确立的关键断言及支撑方式。`,
        reviewerCritique: "重点审视是否存在未报告的超参数、消融覆盖缺口或样本分布偏差（接入 API Key 可生成逐段审稿人追问）。",
        socraticQuestions: [
          {
            category: "检查假设",
            question: `如果「${s.title}」中的某个前置条件不成立，作者接下来的结论还成立吗？`,
            answer: "请结合相邻实验/理论单元中的限定条件（绿/蓝高亮）核对边界。",
          },
          {
            category: "追问证据",
            question: `作者在本节给出的证据，能否严格排除其他替代解释？`,
            answer: "对比本节是否有控制变量或反例验证，标注未验证的逻辑跳跃。",
          },
        ],
      },
    }));

    const diagramNodes = sections.slice(0, 6).map((sec, idx) => {
      const firstUnit = units.find((u) => u.sectionId === sec.id);
      const colors = ["purple", "yellow", "blue", "green", "red", "navy"] as const;
      return {
        id: `n-${idx}`,
        label: sec.navLabel,
        subLabel: firstUnit?.unitCode ?? sec.id,
        targetUnitId: firstUnit?.id,
        colorSlot: colors[idx % colors.length],
      };
    });

    const diagramEdges = diagramNodes.slice(0, -1).map((n, idx) => ({
      from: n.id,
      to: diagramNodes[idx + 1].id,
      label: "logical flow",
    }));

    const hydratedUnits: WorkbenchUnit[] = units.map((u, idx) => {
      const hasFormula = (u.metadata?.formulas?.length ?? 0) > 0;
      const isCore =
        idx === 0 ||
        hasFormula ||
        /\b(we propose|our approach|in this work|achieve|outperform|result|conclude)\b/i.test(
          u.rawPrimaryText
        );
      const sentences = u.rawPrimaryText.split(/(?<=[.!?])\s+/).filter(Boolean);
      const firstSentence = sentences[0] ?? u.rawPrimaryText.slice(0, 120);
      const highlights = isCore && firstSentence.length > 20 ? [{ text: firstSentence, dim: "dim1" as const }] : [];

      return {
        id: u.id,
        unitCode: u.unitCode,
        sectionId: u.sectionId,
        sectionTitle: u.sectionTitle,
        weight: isCore ? "core" : idx % 4 === 3 ? "transition" : "support",
        tldr: firstSentence.slice(0, 90) + (firstSentence.length > 90 ? "..." : ""),
        primaryKind: "prose",
        primaryText: u.rawPrimaryText,
        formulas: u.metadata?.formulas?.map((latex) => ({
          latex,
          flowLabel: "EXTRACTED EQUATION",
          flowText: "检测到独立数学公式块（配置 LLM API Key 后将自动生成完整维度流向与推导拆解）",
        })),
        figures: u.metadata?.figures,
        dataTable: u.metadata?.dataTable,
        highlights,
        secondaryBlockText:
          "[本地启发式模式] 已完成章节切分、公式提取与核心句初筛。如需生成顶刊级中文学术意译与审稿人级逐段深度剖析，请在顶部设置面板接入 Gemini / OpenAI / DeepSeek / Claude API Key。",
        notes: [
          {
            label: MODULE_LABELS[0],
            body: `位于章节「${u.sectionTitle}」第 ${idx + 1} 单元，承接上文脉络并推进当前论证环节。`,
            echoTargetId: idx > 0 ? units[idx - 1].id : undefined,
            echoLabel: idx > 0 ? `[回看上段 -> ${units[idx - 1].unitCode}]` : undefined,
          },
          {
            label: MODULE_LABELS[1],
            body: isCore ? "承担核心立论、方法提出或关键实验结果支撑角色。" : "承担背景铺垫或辅助论证角色。",
          },
          {
            label: MODULE_LABELS[2],
            body: hasFormula
              ? `本段包含 ${u.metadata?.formulas?.length} 个数学公式，建议重点关注变量维度与边界假设。`
              : "建议重点核对本段因果推导链条与概念边界。",
          },
          {
            label: MODULE_LABELS[3],
            body: "审视是否存在未说明的前置假设（Hidden Assumptions）或外部效度限制。",
          },
        ],
        transitionSummary: `过渡单元：衔接「${u.sectionTitle}」上下文。`,
        predictPrompt: isCore
          ? `先想一想（${u.unitCode}）：作者在本核心段试图解决什么问题，或给出了哪项关键结论/公式约束？`
          : undefined,
        selfExplainPrompt: isCore
          ? {
              question: `为什么「${u.sectionTitle}」要在这里引入这一核心设计/证据？如果省略会怎样？`,
              answer: "[分析推断] 缺少该环节将导致前后因果或方法约束脱节，接入 LLM API Key 后可生成本段精确因果推演。",
            }
          : undefined,
        firstPassRecommended: isCore,
      };
    });

    const now = new Date().toISOString();
    return {
      id: `paper-${Date.now()}`,
      modeId: this.id,
      modeName: this.name,
      title,
      subtitle: `本地结构化预解析模式 | 共切分 ${sections.length} 个章节 / ${units.length} 个自然段`,
      badges: ["ACADEMIC PAPER", "HEURISTIC LOCAL MODE"],
      createdAt: now,
      updatedAt: now,
      layoutRatio: this.layoutRatio,
      dimensions: this.dimensions,
      labels: this.documentLabels,
      topMentalModel: {
        title: "TOP MENTAL MODEL / 论文全局认知脚手架与结构拓扑图",
        subtitle: "OFFLINE STRUCTURAL DIGEST | CONFIGURE LLM API KEY FOR FULL SEMANTIC REASONING",
        oneSentenceSkeleton: `针对《${title}》提出的核心研究问题，本文通过 ${sections.slice(0, 3).map((s) => s.navLabel).join(" -> ")} 构建方法与论证闭环（详细限定条件可在接入 API Key 后自动提炼）。`,
        pretestItems: [
          {
            id: "pre-1",
            question: "读前预测 01：面对本文试图解决的瓶颈，你认为作者最可能从哪个结构或机制切入破局？",
            answer: "请在正文前 2 节核心段核对作者选择的切入维度，并对比替代方案成本。",
            targetUnitId: hydratedUnits[0]?.id,
          },
          {
            id: "pre-2",
            question: "读前预测 02：这种新机制在显著改善主指标的同时，最可能在哪个资源或假设上付出代价？",
            answer: "关注方法假设与讨论部分的局限性说明（通常表现为算力、数据规模或分布外泛化限制）。",
            targetUnitId: hydratedUnits.find((u) => u.weight === "core")?.id,
          },
        ],
        cards: [
          {
            tag: "[PROBLEM & GAP / 真问题与前人死结]",
            body: units[0]?.rawPrimaryText.slice(0, 260) ?? "请在顶部接入 API Key 以深度提炼论文真问题。",
          },
          {
            tag: "[EUREKA INTUITION / 核心破局直觉]",
            body: `系统已自动识别出 ${units.length} 个自然段及 ${units.reduce((acc, u) => acc + (u.metadata?.formulas?.length ?? 0), 0)} 处独立公式块，按原文逻辑链组织完毕。`,
          },
          {
            tag: "[FUNDAMENTAL TRADE-OFF / 核心交换代价]",
            body: "可先使用 80/20 模式或 [第一遍路径] 快速通读核心段，并在右侧逐段随手记中记录数学推导或审稿质疑，支持导出 .html / .md / Anki CSV。",
          },
        ],
        diagram: {
          title: "SECTION FLOW TOPOLOGY / 论文章节逻辑流向图（点击节点跳转）",
          hint: "[点击图中任意章节节点即可平滑滚动到对应正文位置]",
          rankdir: "LR",
          nodes: diagramNodes,
          edges: diagramEdges,
        },
        glossaryTitle: "EXTRACTED ANCHORS / 提取的段落与公式锚点",
        glossary: hydratedUnits
          .filter((u) => u.weight === "core")
          .slice(0, 4)
          .map((u) => ({
            term: u.unitCode,
            definition: u.tldr,
          })),
        readingPath: {
          pass1Summary: "第一遍：先读摘要、顶栏认知卡及带 [PASS 1] 标记的核心单元，建立全局地图。",
          pass2Summary: "第二遍：按章节顺序逐段核对方法细节、公式流向与图表对照证据。",
          pass3Summary: "第三遍：点击节末 [开始闭卷复述]、完成底部交错自测与 200 字费曼检验。",
          recommendedUnitIds: hydratedUnits.filter((u) => u.weight === "core").map((u) => u.id),
        },
      },
      sections,
      units: hydratedUnits,
      bottomTitle: "SYNTHESIS & SOCRATIC CHECK / 全文论证结构复盘",
      bottomBlocks: [
        {
          type: "flow-skeleton",
          steps: sections.slice(0, 5).map((s, idx) => ({
            tag: `0${idx + 1} / ${s.navLabel}`,
            body: `包含 ${units.filter((u) => u.sectionId === s.id).length} 个论证单元。`,
          })),
        },
        {
          type: "socratic-qa",
          title: "SOCRATIC SELF-TEST / 通用论文精读自测清单",
          items: [
            {
              id: "sq-offline-1",
              cognitiveLevel: "分析",
              question: "追问 01：如果删掉论文的方法核心假设，作者的实验结论还成立吗？",
              answer: "请结合正文中各核心段的隐含假设与消融实验结果进行检验。",
            },
            {
              id: "sq-offline-2",
              cognitiveLevel: "评价",
              question: "追问 02：本文方法最脆弱的边界条件（计算复杂度、数据规模或分布偏移）是什么？",
              answer: "重点排查讨论部分与实验超参数设置中未覆盖的场景。",
            },
          ],
        },
        {
          type: "feynman-challenge",
          title: "FEYNMAN OUTPUT GATE / 200 字费曼检验",
          prompt: `请用不超过 200 字向非本专业同学讲清《${title}》到底解决了什么问题、凭什么有效以及代价是什么。`,
          referenceExplanation: "[提示] 配置在线大模型 API Key 后将自动生成本文定制化费曼标准对照范文与外行三连问。",
          laypersonQuestions: [
            "外行追问 1：为什么以前的方法做不到，非得加这一步设计？",
            "外行追问 2：如果换成真实脏数据或不同规模输入，它还会这么有效吗？",
            "外行追问 3：除了作者自己对比的方法，还有没有更简单的工程替代方案？",
          ],
        },
        {
          type: "review-schedule",
          title: "SPACED RECALL SCHEDULE / 间隔复习计划",
          startDate: now.slice(0, 10),
          tasks: [
            "Day 1：闭卷默画本文架构流转图，复查今日标为「模糊/不懂」的段落。",
            "Day 3：导出或重做底部 2~3 道交错自测题，不看解析口述推导。",
            "Day 7：用 200 字费曼框重写核心机理，核对关键设计选择与边界。",
            "Day 21：结合 Anki CSV 闪卡快速抽查核心术语与适用局限。",
          ],
        },
      ],
    };
  },
};
