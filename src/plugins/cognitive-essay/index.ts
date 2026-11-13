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
import {
  buildCognitiveBatchPrompt,
  buildCognitiveBottomPrompt,
  buildCognitiveTopModelPrompt,
} from "./prompts";
import { ingestCognitiveEssay } from "./transcript-ingestor";

const DIMENSIONS: WorkbenchDocument["dimensions"] = [
  {
    key: "dim1",
    colorSlot: "yellow",
    label: "颠覆性洞察/金句",
    extractionRule: "打破常识的核心论断与高穿透力金句。",
  },
  {
    key: "dim2",
    colorSlot: "red",
    label: "心智模型 (悬停释义)",
    extractionRule: "作者提出的思维模型或概念造词，附带第一性原理定义。",
    enableTooltip: true,
  },
  {
    key: "dim3",
    colorSlot: "blue",
    label: "痛点诊断/底层机制",
    extractionRule: "心理学、神经科学或控制论视角下的底层成因分析。",
  },
  {
    key: "dim4",
    colorSlot: "green",
    label: "反直觉纠偏",
    extractionRule: "戳破常规误区或自我安慰幻觉的纠偏论述。",
  },
  {
    key: "dim5",
    colorSlot: "purple",
    label: "可执行协议 (Protocol)",
    extractionRule: "具体自我追问、时间节点动作或可落地系统步骤。",
  },
];

const MODULE_LABELS: [string, string, string, string] = [
  "01 / 叙事推进与底层机制（Why It Works）",
  "02 / 去魅滤镜与适用边界（Anti-Hype Reality Check）",
  "03 / 顶级创作者表达解剖（Rhetoric & Structure）",
  "04 / 知行阻抗诊断与个人映射（Execution Trigger）",
];

const DOCUMENT_LABELS: WorkbenchDocument["labels"] = {
  paretoButton: "[80/20 认知核聚焦]",
  toggleSecondaryButton: "[显/隐中文]",
  toggleNotesButton: "[显/隐拆解]",
  exportMdButton: "[导出 Markdown 笔记]",
  exportHtmlButton: "[编译离线单文件 .HTML]",
  userNoteButton: "[+ 添加本段随手笔记]",
  userNotePlaceholder: "在此记录你对本段的思考映射或个人觉察（自动保存至本地）...",
  transitionPrefix: "[BRIDGE / 叙事过渡]",
  mentalNavLabel: "00. 认知鸟瞰与几何模型",
  bottomNavLabel: "06. 交互式个人重启工作台",
};

export const cognitiveEssayPlugin: WorkbenchModePlugin<
  TopModelStepOutput,
  { units: AnnotatedUnitOutput[] },
  BottomStepOutput
> = {
  id: "cognitive-essay",
  name: "认知长文/视频内化",
  shortLabel: "MODE 02 · 认知内化",
  description: "口播字幕清洗与思想簇智能聚合、Old/New OS 对比、去魅边界审查、写作技法偷师与交互式行动工作台。",
  layoutRatio: [56, 44],
  inputConfig: {
    placeholder: "在此粘贴 YouTube 视频字幕（SRT/VTT/无标点口播稿）或 Dan Koe / Naval / Paul Graham 深度博客全文...",
    hint: "支持直接粘贴网页文章 URL、导入字幕/长文文件，或让 AI 联网检索公开专栏与认知概念资料。",
    supportsFileUpload: true,
    acceptedFileTypes: ".txt,.md,.srt,.vtt",
    supportsRepoUrl: false,
    supportsRemoteUrl: true,
    remoteUrlLabel: "文章 / 博客 / 演讲稿网页 URL",
    remoteUrlPlaceholder: "https://paulgraham.com/makersschedule.html",
    supportsAgentSearch: true,
    searchLabel: "AI 工具联网检索文章",
    searchPlaceholder: "输入文章标题、作者或核心话题（例如：Paul Graham Maker's Schedule）",
  },
  dimensions: DIMENSIONS,
  annotationModuleLabels: MODULE_LABELS,
  documentLabels: DOCUMENT_LABELS,

  preprocessSource: ingestCognitiveEssay,

  schemas: {
    topMentalModel: TopModelBaseSchema,
    batchUnits: BatchUnitsBaseSchema,
    bottomWorkbench: BottomStepBaseSchema,
  },

  buildPrompts: {
    topModelPrompt: buildCognitiveTopModelPrompt,
    batchUnitsPrompt: buildCognitiveBatchPrompt,
    bottomWorkbenchPrompt: buildCognitiveBottomPrompt,
  },

  hydrateUnit(source: SourceUnit, annotation: AnnotatedUnitOutput): WorkbenchUnit {
    return buildHydratedUnit(source, annotation, MODULE_LABELS);
  },

  createHeuristicDocument(title: string, units: SourceUnit[]): WorkbenchDocument {
    const sectionMap = new Map<string, { id: string; title: string; count: number }>();
    for (const u of units) {
      const existing = sectionMap.get(u.sectionId);
      if (existing) existing.count += 1;
      else sectionMap.set(u.sectionId, { id: u.sectionId, title: u.sectionTitle, count: 1 });
    }

    const sections = Array.from(sectionMap.values()).map((s) => ({
      id: s.id,
      navLabel: s.title.slice(0, 22),
      navRole: `[${s.count}簇]`,
      title: s.title,
      taskBadge: "THOUGHT CLUSTERS / 清洗与思想簇内化",
      summary: {
        established: `本部分「${s.title}」聚合了 ${s.count} 个完整思想簇，构成作者推进核心论点的一个叙事阶段。`,
        openQuestions: "[分析推断] 该阶段论述是否剥离了情绪修辞、交待了反例边界？",
        rhetoricStrategy: "通过痛点共鸣与反常识对照拉高阅读张力，再收敛到个人行动原则。",
        referenceRecall: `合上页面思考：「${s.title}」最反直觉的那条认知反转是什么？`,
        reviewerCritique: "区分『好听的鸡汤修辞』与『可验证的因果律』，留意以偏概全的绝对化断言。",
        socraticQuestions: [
          {
            category: "换个视角",
            question: `如果一个处境完全相反的人套用本节观点，会在哪里失效？`,
            answer: "检验该认知模型的适用约束条件，避免盲目迁移。",
          },
        ],
      },
    }));

    const nodes = units.slice(0, 5).map((u, idx) => {
      const colors = ["yellow", "blue", "red", "purple", "green"] as const;
      return {
        id: `c-${idx}`,
        label: u.unitCode,
        subLabel: u.rawPrimaryText.slice(0, 26) + "...",
        targetUnitId: u.id,
        colorSlot: colors[idx % colors.length],
      };
    });
    const edges = nodes.slice(0, -1).map((n, idx) => ({
      from: n.id,
      to: nodes[idx + 1].id,
      label: "narrative arc",
    }));

    const hydratedUnits: WorkbenchUnit[] = units.map((u, idx) => {
      const lines = u.rawPrimaryText.split(/\n+/).filter(Boolean);
      const hasQuestion = /\?/.test(u.rawPrimaryText);
      const tldr = (lines[0] ?? u.rawPrimaryText).slice(0, 88);

      return {
        id: u.id,
        unitCode: u.unitCode,
        sectionId: u.sectionId,
        sectionTitle: u.sectionTitle,
        weight: idx === 0 || hasQuestion || idx === units.length - 1 ? "core" : "support",
        tldr: tldr + (tldr.length >= 88 ? "..." : ""),
        primaryKind: "prose",
        primaryText: u.rawPrimaryText,
        figures: u.metadata?.figures,
        highlights: hasQuestion ? [{ text: lines.find((l) => l.includes("?")) ?? lines[0], dim: "dim5" }] : [],
        secondaryBlockText:
          "[本地启发式清洗模式] 已自动剔除字幕时间轴与口水词，并按思想单元聚合保留原始节奏。接入 API Key 后可自动生成专栏级中文意译、心理机制拆解与去魅边界。",
        notes: [
          {
            label: MODULE_LABELS[0],
            body: `思想簇 #${idx + 1}，包含约 ${u.rawPrimaryText.split(/\s+/).length} 词，承接「${u.sectionTitle}」的核心推进。`,
            echoTargetId: idx > 0 ? units[idx - 1].id : undefined,
            echoLabel: idx > 0 ? `[衔接上簇 -> ${units[idx - 1].unitCode}]` : undefined,
          },
          {
            label: MODULE_LABELS[1],
            body: "检查作者是否为了制造冲击力而使用了绝对化表述，明确其适用前提。",
          },
          {
            label: MODULE_LABELS[2],
            body: "观察作者如何通过短句节奏、对比反差或具体场景制造情绪张力。",
          },
          {
            label: MODULE_LABELS[3],
            body: "读懂并不等于改变；识别你看到这段话时第一反应想逃避的现实问题。",
            calloutBox: hasQuestion
              ? "[SELF-REFLECTION]：本段包含了作者的直接灵魂追问，请直接在下方工作台写出你的真实回答。"
              : undefined,
          },
        ],
        predictPrompt:
          idx === 0 || hasQuestion || idx === units.length - 1
            ? `先预测（${u.unitCode}）：作者在这段最想击穿哪种常见误区，背后对应的底层心理机制是什么？`
            : undefined,
        firstPassRecommended: idx === 0 || hasQuestion || idx === units.length - 1,
      };
    });

    const now = new Date().toISOString();
    return {
      id: `essay-${Date.now()}`,
      modeId: this.id,
      modeName: this.name,
      title,
      subtitle: `本地思想簇聚合成型 | 共清洗聚合 ${units.length} 个完整思想单元`,
      badges: ["COGNITIVE ESSAY", "THOUGHT-CLUSTER AGGREGATED"],
      createdAt: now,
      updatedAt: now,
      layoutRatio: this.layoutRatio,
      dimensions: this.dimensions,
      labels: this.documentLabels,
      topMentalModel: {
        title: "TOP MENTAL MAP / 思想簇清洗结果与认知转化蓝图",
        subtitle: "OFFLINE TRANSCRIPT DIGEST | CONFIGURE LLM API KEY FOR FULL COGNITIVE DECONSTRUCTION",
        rawSummaryBanner: {
          tag: "[RAW FIRST-PRINCIPLE / 本地启发式摘要]",
          body: `已完成口播文本/博客的清洗与思想簇聚合（共 ${units.length} 个完整思想单元），可直接对照阅读并在底部工作台写下复盘思考与行动项。`,
        },
        oneSentenceSkeleton: `针对《${title}》聚焦的心智卡点，作者试图用更底层的心智操作模型替换被动惯性反应（接入 API Key 可提取完整反转路径）。`,
        pretestItems: [
          {
            id: "cog-pre-1",
            question: "读前预检：在你看来，阻碍大多数人长期执行这类原则的真正心理阻力是什么？",
            answer: "请阅读正文高权重思想簇中的心理机制诊断与知行阻抗自问。",
            targetUnitId: hydratedUnits[0]?.id,
          },
        ],
        cards: [],
        diagram: {
          title: "NARRATIVE ARC TOPOLOGY / 叙事推进链路图（点击节点跳转）",
          hint: "[点击节点跳转到对应思想单元]",
          rankdir: "LR",
          nodes,
          edges,
        },
        glossaryTitle: "EXTRACTED KEY UNITS / 核心思想单元索引",
        glossary: hydratedUnits.slice(0, 4).map((u) => ({
          term: u.unitCode,
          definition: u.tldr,
        })),
        readingPath: {
          pass1Summary: "第一遍：通读带 [PASS 1] 标记的暴击核心簇，抓清作者到底想颠覆什么认知。",
          pass2Summary: "第二遍：核对作者每条观点的适用边界，警惕修辞渲染下的以偏概全。",
          pass3Summary: "第三遍：填写底部复盘卡片、200字费曼检验，并勾选今日最小物理行动。",
          recommendedUnitIds: hydratedUnits.filter((u) => u.weight === "core").map((u) => u.id),
        },
      },
      sections,
      units: hydratedUnits,
      bottomTitle: "ACTIONABLE PROTOCOL WORKBENCH / 交互式认知内化与行动工作台",
      bottomBlocks: [
        {
          type: "journal-prompts",
          title: "INTERACTIVE JOURNALING PROMPTS / 核心复盘书写框（实时保存）",
          items: [
            {
              id: "j-insight",
              label: "[PROMPT 01] 剥离情绪后的核心一条规律",
              hint: "如果去掉所有渲染，这篇文章最值得你记住的一条底层机制是什么？",
              placeholder: "写下你的核心提炼...",
            },
            {
              id: "j-action",
              label: "[PROMPT 02] 未来 24 小时的最小物理动作",
              hint: "不要写宏大口号，写明天上午 10 点前就能完成的一件具体小事。",
              placeholder: "明天早晨第一件事...",
            },
          ],
        },
        {
          type: "feynman-challenge",
          title: "费曼检验：200字以内讲清全文底层心智模型",
          prompt: "不看原文，用自己的话向一个正在犹豫行动的朋友说清：本文指出了哪条反常识规律？它为什么让人卡住？最小可执行动作是什么？",
          referenceExplanation: "建议结构：1. 旧心智误区（50字）；2. 新机制/反转逻辑（80字）；3. 24小时最小行动验证（70字）。",
          laypersonQuestions: [
            "如果只保留一条今天就能验证的反常识动作，你会怎么向外行描述？",
            "这套心智模型在什么现实压力下最容易失效或退回旧习惯？",
          ],
        },
        {
          type: "review-schedule",
          title: "认知内化与行动追踪计划（第 1 / 3 / 7 / 21 天）",
          startDate: new Date().toISOString().slice(0, 10),
          tasks: [
            "回想核心底层规律并执行今日 24 小时最小物理动作",
            "复查标记为「模糊/不懂」的思想单元，检验反例是否成立",
            "合上文章用 200 字重新复述关键机制，记录行为变化",
            "评估该心智模型是否沉淀为稳定习惯或需要修正边界",
          ],
        },
      ],
    };
  },
};
