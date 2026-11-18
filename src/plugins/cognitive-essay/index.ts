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

function extractUnitSentences(raw: string): string[] {
  return raw
    .split(/\n+|[。！？!?]+/)
    .map((s) => s.replace(/^\[[^\]]+\]\s*/, "").trim())
    .filter((s) => s.length >= 12);
}

function buildDynamicUnitSummary(unit: SourceUnit, sentences: string[]): string {
  const lead = sentences[0] ?? unit.rawPrimaryText.slice(0, 120);
  const second = sentences[1];
  const isEnglishHeavy =
    (unit.rawPrimaryText.match(/[A-Za-z]{4,}/g)?.length ?? 0) > 12 &&
    (unit.rawPrimaryText.match(/[\u4e00-\u9fff]/g)?.length ?? 0) < 25;

  if (isEnglishHeavy) {
    return `[核心句提炼] ${lead.slice(0, 130)}${lead.length > 130 ? "..." : ""}${
      second ? `\n[逻辑延续] ${second.slice(0, 110)}${second.length > 110 ? "..." : ""}` : ""
    }`;
  }
  return `[结构化要点] ${lead.slice(0, 130)}${lead.length > 130 ? "..." : ""}${
    second ? `\n[延展视角] ${second.slice(0, 110)}${second.length > 110 ? "..." : ""}` : ""
  }`;
}

function buildDynamicHighlights(
  rawText: string,
  sentences: string[]
): WorkbenchUnit["highlights"] {
  const highlights: WorkbenchUnit["highlights"] = [];
  const used = new Set<string>();
  const pushUnique = (text: string, dim: WorkbenchUnit["highlights"][number]["dim"], tooltip?: string) => {
    const clean = text.trim();
    if (clean.length < 8 || used.has(clean) || !rawText.includes(clean)) return;
    used.add(clean);
    highlights.push(tooltip ? { text: clean, dim, tooltip } : { text: clean, dim });
  };

  const conceptMatch = rawText.match(/(?:「[^」]{2,20}」|课题分离|心力系统|（\d+）[^\n；;]{6,48})/);
  if (conceptMatch) {
    pushUnique(
      conceptMatch[0],
      "dim2",
      "核心概念/结构化心智锚点：建议结合反例检查其适用条件。"
    );
  }
  const qLine = rawText.split(/\n+/).find((l) => /[?？]/.test(l) && l.trim().length >= 8);
  if (qLine) {
    pushUnique(qLine.trim().slice(0, 90), "dim5");
  }
  if (sentences[0]) {
    pushUnique(sentences[0].slice(0, 80), "dim1");
  }
  return highlights;
}

function detectRhetoricPattern(rawText: string): string {
  if (/（\d+）/.test(rawText)) {
    return "使用编号清单将抽象经验压缩为可检索的心智框架，降低观众认知负荷。";
  }
  if ((rawText.match(/[A-Za-z]{4,}/g)?.length ?? 0) >= 8) {
    return "借原声英文金句或高密度短句制造节奏反差，适合提炼成可直接复述的观念锚点。";
  }
  if (/[?？]/.test(rawText)) {
    return "采用设问刺穿常规预设，先制造心理缺口，再顺势植入新的解释框架。";
  }
  return "通过具体叙事切片与经验对照拉近距离，把抽象态度转化为可感知的场景画面。";
}

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
    placeholder:
      "在此直接粘贴 B站 / 抖音 / X 分享链接（支持手机端分享口令），或粘贴视频字幕（SRT/VTT/口播稿）与深度长文全文...",
    hint: "支持直接粘贴 B站 (bilibili.com / b23.tv / BV号)、抖音 (v.douyin.com / 分享口令)、X (x.com / twitter.com) 链接自动提取字幕/正文/高赞课代表总结，也可上传字幕文件或 AI 联网检索。",
    supportsFileUpload: true,
    acceptedFileTypes: ".txt,.md,.srt,.vtt",
    supportsRepoUrl: false,
    supportsRemoteUrl: true,
    remoteUrlLabel: "B站 / 抖音 / X(Twitter) / 博客网页链接（支持分享口令）",
    remoteUrlPlaceholder:
      "https://www.bilibili.com/video/BV... 或 https://v.douyin.com/... 或 https://x.com/.../status/...",
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
      const sentences = extractUnitSentences(u.rawPrimaryText);
      const hasQuestion = /[?？]/.test(u.rawPrimaryText);
      const leadSentence = sentences[0] ?? lines[0] ?? u.rawPrimaryText;
      const tldr = leadSentence.slice(0, 88);
      const anchorPhrase = leadSentence.slice(0, 32);

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
        highlights: buildDynamicHighlights(u.rawPrimaryText, sentences),
        secondaryBlockText: buildDynamicUnitSummary(u, sentences),
        notes: [
          {
            label: MODULE_LABELS[0],
            body: `围绕「${anchorPhrase}...」推进（约 ${u.rawPrimaryText.length} 字），在「${u.sectionTitle}」中承担认知锚定或观点展开作用。`,
            echoTargetId: idx > 0 ? units[idx - 1].id : undefined,
            echoLabel: idx > 0 ? `[衔接上簇 -> ${units[idx - 1].unitCode}]` : undefined,
          },
          {
            label: MODULE_LABELS[1],
            body: `去魅追问：针对「${anchorPhrase}...」，该结论依赖什么前提条件？若换成时间高压或资源受限情境是否依然成立？`,
          },
          {
            label: MODULE_LABELS[2],
            body: detectRhetoricPattern(u.rawPrimaryText),
          },
          {
            label: MODULE_LABELS[3],
            body: `知行对照：你在最近一周的真实决策中，是否在类似「${anchorPhrase.slice(0, 18)}...」的场景里退回过被动惯性？`,
            calloutBox: hasQuestion
              ? "[SELF-REFLECTION]：本段包含了直接自我审视线索，请在底部书写框记录你的第一反应。"
              : `[5 分钟微测试]：针对「${u.sectionTitle}」，选一个今天就能落地的最小反常识反应并写进底部行动清单。`,
          },
        ],
        predictPrompt:
          idx === 0 || hasQuestion || idx === units.length - 1
            ? `先预测（${u.unitCode}）：作者围绕「${anchorPhrase.slice(0, 22)}...」想击穿哪种常见惯性？`
            : undefined,
        firstPassRecommended: idx === 0 || hasQuestion || idx === units.length - 1,
      };
    });

    const coreSamples = hydratedUnits
      .filter((u) => u.weight === "core")
      .slice(0, 3)
      .map((u) => u.tldr.slice(0, 44));
    const now = new Date().toISOString();
    return {
      id: `essay-${Date.now()}`,
      modeId: this.id,
      modeName: this.name,
      title,
      subtitle: `视频与认知长文内化视图 | 已聚合 ${units.length} 个思想簇（含心智对比与 24h 行动协议）`,
      badges: ["VIDEO & COGNITIVE OS", "NO-HYPE DECONSTRUCTION"],
      createdAt: now,
      updatedAt: now,
      layoutRatio: this.layoutRatio,
      dimensions: this.dimensions,
      labels: this.documentLabels,
      topMentalModel: {
        title: "TOP MENTAL MAP / 认知重塑鸟瞰与新旧心智对比",
        subtitle: "COGNITIVE INTERNALIZATION WORKBENCH | OLD OS vs UPGRADED OS & ACTION PROTOCOL",
        rawSummaryBanner: {
          tag: "[RAW FIRST-PRINCIPLE / 去鸡汤化认知骨架]",
          body: `已从《${title}》提炼 ${units.length} 个思想单元。重点不在于记住金句本身，而在于识别其中的心理边界、对比旧惯性反应，并在 24 小时内完成一次微小行为验证。`,
        },
        oneSentenceSkeleton: `针对《${title}》拆解的心智卡点，核心在于用主动觉察与课题分离取代自动化情绪内耗，并在真实边界内持续行动。`,
        pretestItems: [
          {
            id: "cog-pre-1",
            question: "读前预检：在你看来，听懂无数道理却仍无法稳定执行的真正阻力通常是什么？",
            answer: "往往源于认知过载、缺乏边界界定，以及没有把抽象概念压缩成 24 小时可执行的触发动作。",
            targetUnitId: hydratedUnits[0]?.id,
          },
        ],
        cards: [
          {
            tag: "核心议题 / CORE FOCUS",
            body: hydratedUnits[0]?.tldr ?? title,
          },
          {
            tag: "去魅提示 / ANTI-HYPE",
            body: "区分叙事感染力与可迁移的因果机制，警惕幸存者偏差，保留具体适用条件。",
          },
          {
            tag: "内化抓手 / PROTOCOL",
            body: `优先通读 ${hydratedUnits.filter((u) => u.weight === "core").length} 个核心思想簇，再完成底部 24 小时行动 Checklist。`,
          },
        ],
        comparisonPair: {
          leftTitle: "OLD DEFAULT OS / 旧惯性自动化反应",
          leftTone: "danger",
          leftItems: [
            "只刷不拆：被金句情绪短暂激励后直接划走，24 小时后遗忘殆尽",
            "边界模糊：把他人期待或外部噪音当成自己的心理课题，持续消耗精力",
            "全有或全无：试图一次性大改造，遇到阻力就迅速退回旧习惯",
          ],
          rightTitle: "UPGRADED OS / 主动内化操作原则",
          rightTone: "success",
          rightItems:
            coreSamples.length >= 2
              ? [
                  `锚定洞见：${coreSamples[0]}...`,
                  `追踪核心：${coreSamples[1]}...`,
                  "微行动验证：把概念压缩成明天上午前能完成的一个最小物理动作",
                ]
              : [
                  "清晰划分可控与不可控边界，把注意力收回到当下动作",
                  "给每条高共鸣观点补全适用前提与反例边界，去魅吸收",
                  "把启发转译成底部 24 小时可执行清单并打卡复盘",
                ],
        },
        diagram: {
          title: "NARRATIVE ARC TOPOLOGY / 思想推进链路图（点击节点跳转）",
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
          pass1Summary: "第一遍：通读带 [PASS 1] 标记的暴击核心簇，抓清本视频/文章到底想颠覆什么认知。",
          pass2Summary: "第二遍：结合右侧 02 去魅边界与 03 表达解剖，识别观点前提并避开鸡汤盲区。",
          pass3Summary: "第三遍：勾选底部 24h 最小行动清单，并用 200 字费曼检验写下你自己的话。",
          recommendedUnitIds: hydratedUnits.filter((u) => u.weight === "core").map((u) => u.id),
        },
      },
      sections,
      units: hydratedUnits,
      bottomTitle: "ACTIONABLE PROTOCOL WORKBENCH / 交互式认知内化与行动工作台",
      bottomBlocks: [
        {
          type: "checklist",
          title: "24H MINIMUM VIABLE PROTOCOL / 24 小时最小行动协议 Checklist",
          items: [
            {
              id: "cog-chk-1",
              tag: "ACT 01 · 去魅重述",
              text: `用 1 句不带形容词的大白话写出《${title.slice(0, 26)}》最反常识的底层机制`,
            },
            {
              id: "cog-chk-2",
              tag: "ACT 02 · 边界检查",
              text: "挑出 1 条让你最有共鸣的观点，写出它绝对不能硬套的 1 个反例场景",
            },
            {
              id: "cog-chk-3",
              tag: "ACT 03 · 最小物理动作",
              text: "在底部书写框定下明天上午 10 点前耗时不超过 5 分钟的 1 个实际改变动作",
            },
          ],
        },
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
