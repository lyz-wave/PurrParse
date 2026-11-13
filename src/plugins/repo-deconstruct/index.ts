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
import { ingestRepoSource } from "./git-ingestor";
import {
  buildRepoBatchPrompt,
  buildRepoBottomPrompt,
  buildRepoTopModelPrompt,
} from "./prompts";

const DIMENSIONS: WorkbenchDocument["dimensions"] = [
  {
    key: "dim1",
    colorSlot: "yellow",
    label: "系统入口/路由",
    extractionRule: "HTTP/RPC 入口、事件监听与主调度起点。",
  },
  {
    key: "dim2",
    colorSlot: "red",
    label: "核心状态与算法 (悬停释义)",
    extractionRule: "核心算法、并发锁、原子脚本、状态机流转（附通俗原理气泡）。",
    enableTooltip: true,
  },
  {
    key: "dim3",
    colorSlot: "blue",
    label: "边界校验与容错",
    extractionRule: "重试、超时熔断、优雅退出、防重入与幂等防御。",
  },
  {
    key: "dim4",
    colorSlot: "green",
    label: "性能与并发权衡",
    extractionRule: "池化、Pipeline、异步批处理、或牺牲一致性换吞吐的取舍。",
  },
  {
    key: "dim5",
    colorSlot: "purple",
    label: "潜在盲区/追问点",
    extractionRule: "硬编码魔法数、竞态隐患、可扩展性瓶颈、面试官高频追问漏洞。",
  },
];

const MODULE_LABELS: [string, string, string, string] = [
  "01 / 调用链上下文与双向锚点",
  "02 / 核心源码机制拆解",
  "03 / 设计取舍与替代方案",
  "04 / 面试官高频深挖追问",
];

const DOCUMENT_LABELS: WorkbenchDocument["labels"] = {
  paretoButton: "[20/80 核心源码聚焦]",
  toggleSecondaryButton: "[显/隐逻辑白话]",
  toggleNotesButton: "[显/隐面试批注]",
  exportMdButton: "[导出面试手记 Markdown]",
  exportHtmlButton: "[编译离线单文件 .HTML]",
  userNoteButton: "[+ 添加本模块二次开发备忘]",
  userNotePlaceholder: "在此记录该模块在简历上的阐述切入点或准备改造的 Patch 思路...",
  transitionPrefix: "[GLUE CODE / 装配过渡层]",
  mentalNavLabel: "00. 20/80 架构图与调用链",
  bottomNavLabel: "08. 简历武装、压力测试与改造方案",
};

function findCodeAnchors(rawCode: string): Array<{ text: string; dim: "dim1" | "dim2" | "dim3" | "dim4" | "dim5"; tooltip?: string }> {
  const spans: Array<{ text: string; dim: "dim1" | "dim2" | "dim3" | "dim4" | "dim5"; tooltip?: string }> = [];
  const lines = rawCode.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) continue;

    if (spans.length < 1 && /(func\s+|export\s+(async\s+)?function|def\s+|router\.|app\.(get|post))/i.test(trimmed)) {
      spans.push({ text: trimmed.slice(0, 72), dim: "dim1" });
    } else if (/(mutex|lock|lua|redis|atomic|select\s*\{|async|await|channel|queue|worker)/i.test(trimmed)) {
      spans.push({
        text: trimmed.slice(0, 72),
        dim: "dim2",
        tooltip: "核心并发/状态控制逻辑：面试时需要重点解释为什么此处需要同步、锁粒度或异步调度。",
      });
    } else if (/(err\s*!=\s*nil|try|catch|retry|timeout|deadline|recover|validate|guard)/i.test(trimmed)) {
      spans.push({ text: trimmed.slice(0, 72), dim: "dim3" });
    } else if (/(pool|batch|pipeline|cache|buffer|memo|parallel|Promise\.all)/i.test(trimmed)) {
      spans.push({ text: trimmed.slice(0, 72), dim: "dim4" });
    }
    if (spans.length >= 4) break;
  }

  return spans;
}

export const repoDeconstructPlugin: WorkbenchModePlugin<
  TopModelStepOutput,
  { units: AnnotatedUnitOutput[] },
  BottomStepOutput
> = {
  id: "repo-deconstruct",
  name: "源码架构拆解",
  shortLabel: "MODE 03 · 源码拆解",
  description: "20/80 核心文件筛选、Shiki 代码高亮与双向调用链图谱、L1-L3 面试压力测试、STAR 简历话术与二开 Ownership 改造蓝图。",
  layoutRatio: [58, 42],
  inputConfig: {
    placeholder: "输入 GitHub 仓库 URL（如 https://github.com/owner/repo），或直接粘贴多段源码 / 上传代码文件...",
    hint: "支持直接输入 GitHub URL、上传代码文件、或让 AI 调用 GitHub 搜索工具定位项目后自动筛选 20% 核心源码。",
    supportsFileUpload: true,
    acceptedFileTypes: ".ts,.tsx,.js,.jsx,.go,.py,.rs,.java,.lua,.sql,.txt,.md",
    supportsRepoUrl: true,
    supportsRemoteUrl: true,
    remoteUrlLabel: "GitHub 仓库地址 (URL 或 owner/repo)",
    remoteUrlPlaceholder: "https://github.com/owner/repo 或 ai/nanoid",
    supportsAgentSearch: true,
    searchLabel: "AI 工具联网搜索 GitHub 项目",
    searchPlaceholder: "输入开源项目名或关键词（例如：nanoid / bullmq / asynq go redis queue）",
  },
  dimensions: DIMENSIONS,
  annotationModuleLabels: MODULE_LABELS,
  documentLabels: DOCUMENT_LABELS,

  preprocessSource: ingestRepoSource,

  schemas: {
    topMentalModel: TopModelBaseSchema,
    batchUnits: BatchUnitsBaseSchema,
    bottomWorkbench: BottomStepBaseSchema,
  },

  buildPrompts: {
    topModelPrompt: buildRepoTopModelPrompt,
    batchUnitsPrompt: buildRepoBatchPrompt,
    bottomWorkbenchPrompt: buildRepoBottomPrompt,
  },

  hydrateUnit(source: SourceUnit, annotation: AnnotatedUnitOutput): WorkbenchUnit {
    return buildHydratedUnit(source, annotation, MODULE_LABELS);
  },

  createHeuristicDocument(title: string, units: SourceUnit[]): WorkbenchDocument {
    const rawTextPreview = units[0]?.rawPrimaryText ?? "";
    const now = new Date().toISOString();
    const sectionsMap = new Map<string, WorkbenchDocument["sections"][number]>();

    units.forEach((u, idx) => {
      if (!sectionsMap.has(u.sectionId)) {
        sectionsMap.set(u.sectionId, {
          id: u.sectionId,
          navLabel: u.sectionTitle.split("/").pop()?.slice(0, 22) || `模块 ${sectionsMap.size + 1}`,
          navRole: idx === 0 ? "核心入口" : "核心模块",
          title: u.sectionTitle,
          taskBadge: u.sectionTask || "离线代码切片",
          summary: {
            established: `已提取 ${u.sectionTitle} 离线代码切片与主入口脉络`,
            openQuestions: "下游超时、重试与并发竞争下的幂等性是否完备",
            rhetoricStrategy: "先定位接口边界与状态流转，再核对异常返回与资源释放路径。",
            referenceRecall: `本模块聚焦 ${u.sectionTitle} 的控制流与边界保护，需重点确认输入校验、锁/并发边界与错误返回约定。`,
            reviewerCritique: "审视临界区、错误吞没及无界并发风险。",
            socraticQuestions: [
              {
                category: "假设质疑",
                question: `如果 ${u.sectionTitle} 的下游依赖耗时飙升 10 倍，当前代码会如何表现？`,
                answer: "[分析推断] 需核对调用方是否设置了显式 Timeout、队列上限与熔断降级。",
              },
            ],
          },
        });
      }
    });

    const hydratedUnits: WorkbenchUnit[] = units.map((u, idx) => {
      const prev = idx > 0 ? units[idx - 1] : undefined;
      const next = idx + 1 < units.length ? units[idx + 1] : undefined;
      const anchorUnit = next ?? prev;
      const firstNonEmptyLine = u.rawPrimaryText.split("\n").find((l) => l.trim().length > 0)?.trim() ?? u.unitCode;
      const hasConcurrencyOrError = /(async|await|go\s+func|mutex|lock|retry|timeout|err|try|catch)/i.test(
        u.rawPrimaryText
      );

      return buildHydratedUnit(
        u,
        {
          unitId: u.id,
          weight: idx < Math.max(2, Math.ceil(units.length * 0.45)) || hasConcurrencyOrError ? "core" : "support",
          tldr: `模块入口聚焦：${firstNonEmptyLine.slice(0, 88)}`,
          secondaryBlockText: `【离线结构化拆解 · ${u.metadata?.filePath ?? u.sectionTitle}】本代码单元共 ${u.rawPrimaryText.split("\n").length} 行（${(u.codeLanguage ?? "code").toUpperCase()}）。建议配合左侧自动高亮行优先追踪状态修改点、异常返回边界以及对外 I/O 调用；接入在线大模型 API 后可自动生成逐行底层机制破译与定制追问。`,
          tensorOrStateFlow: `${u.unitCode} -> State Guard / Core Transform -> Downstream Call / Return`,
          highlights: findCodeAnchors(u.rawPrimaryText),
          notes: [
            {
              body: prev
                ? `处于整体调用链第 ${idx + 1} 环，承接上一单元 ${prev.unitCode} 传递下来的上下文状态。`
                : "处于代码分析入口链路起点，负责接收入参、校验边界并初始化执行上下文。",
              echoTargetId: anchorUnit?.id,
              echoLabel: anchorUnit ? `[跳转相邻单元 ${anchorUnit.unitCode}]` : undefined,
            },
            {
              body: "底层动作排查清单：1) 是否有无界协程/Promise 并发创建风险；2) I/O 是否设置了明确的 Context Timeout；3) 失败分支是否触发了补偿或幂等保障。",
            },
            {
              body: "设计权衡提示：查看该模块是否通过本地缓存、连接池或批处理来用少许复杂度换取 P99 延迟下降，这正是面试讲清选型理由的核心切口。",
            },
            {
              body: "面试高频追问模拟：「如果这段代码在峰值 QPS 翻 5 倍或下游超时时，最先崩溃的是哪一行？你会怎么改？」",
              calloutBox: "自测要求：先闭眼用 30 秒口述该模块的输入 -> 处理 -> 异常退出路径，再对照左侧源码核对细节。",
            },
          ],
          predictPrompt:
            idx < Math.max(2, Math.ceil(units.length * 0.45)) || hasConcurrencyOrError
              ? `先想一想（${u.unitCode}）：若高并发或下游超时发生在此切片，哪个状态变更或 I/O 调用最先出问题？`
              : undefined,
          selfExplainPrompt:
            idx < Math.max(2, Math.ceil(units.length * 0.45)) || hasConcurrencyOrError
              ? {
                  question: `为什么 ${u.sectionTitle} 要在这里封装这层状态/容错逻辑？如果直接裸写会怎样？`,
                  answer: "缺少该封装会导致错误边界泄露或重复状态竞态（接入 LLM API Key 后可生成逐行机制破译）。",
                }
              : undefined,
          firstPassRecommended: idx < Math.max(2, Math.ceil(units.length * 0.45)) || hasConcurrencyOrError,
        },
        MODULE_LABELS
      );
    });

    const uniqueFiles = Array.from(new Set(units.map((u) => u.metadata?.filePath ?? u.sectionTitle)));
    const diagramNodes = units.slice(0, 6).map((u, idx) => ({
      id: `n_${idx}`,
      label: u.metadata?.filePath?.split("/").pop() ?? u.unitCode,
      subLabel: `Unit ${idx + 1}`,
      targetUnitId: u.id,
      colorSlot: (["yellow", "blue", "red", "green", "purple", "navy"] as const)[idx % 6],
    }));

    const diagramEdges = diagramNodes.slice(0, -1).map((n, idx) => ({
      from: n.id,
      to: diagramNodes[idx + 1].id,
      label: "调用流",
    }));

    return {
      id: `doc-repo-${Date.now()}`,
      modeId: "repo-deconstruct",
      modeName: "源码架构拆解",
      title,
      subtitle: `本地启发式源码拆解 · 共提取 ${uniqueFiles.length} 个核心文件 / ${hydratedUnits.length} 个代码切片`,
      badges: ["离线启发式拆解", `${uniqueFiles.length} 个核心文件`, "Zero-Emoji 规范"],
      createdAt: now,
      updatedAt: now,
      layoutRatio: [58, 42],
      dimensions: DIMENSIONS,
      labels: DOCUMENT_LABELS,
      sections: Array.from(sectionsMap.values()),
      topMentalModel: {
        title: "00. 20/80 架构导读与主调用链路图",
        subtitle: "先锁定 20% 关键代码单元与状态流，再补充 2 小时二开改造筹码",
        oneSentenceSkeleton: `针对大型代码库调用链割裂与边界风险不明的问题，${title}通过核心入口（${uniqueFiles[0] || "main"}）串联关键模块，在离线切片中揭示其并发、幂等与容错骨架。`,
        pretestItems: [
          {
            id: "repo-pre-1",
            question: "在读具体实现前先预测：如果上游请求在临界区超时重入，当前架构最可能在哪个环节丢失幂等性或产生脏状态？",
            answer: "[分析推断] 重点检查并发写入/异步协程与重试路径之间是否存在去重键或状态机校验；具体需对照关键函数源码核验。",
            targetUnitId: hydratedUnits[0]?.id,
          },
        ],
        readingPath: {
          pass1Summary: "第 1 遍先读带 [PASS 1] 标记的核心与入口代码单元，跑通主链路。",
          pass2Summary: "第 2 遍逐段核查锁边界、超时重试、退避策略与异常返回。",
          pass3Summary: "第 3 遍做局部改造 Before/After 对比，并产出可验证的压测指标。",
          recommendedUnitIds: hydratedUnits.filter((u) => u.firstPassRecommended).map((u) => u.id),
        },
        rawSummaryBanner: {
          tag: "离线源码快照摘要",
          body: `已自动筛选并切片 ${uniqueFiles.length} 个核心代码文件（${uniqueFiles.slice(0, 5).join(", ")}）。当前为无 API Key 离线结构化拆解模式；在右上角「模型设置」填入 API Key 后可实时生成深度代码原理解析与定制 STAR 话术。预览片段：${rawTextPreview.slice(0, 120).replace(/\s+/g, " ")}`,
        },
        cards: [
          {
            tag: "20% 必读核心范围",
            body: `系统已自动过滤测试文件、锁文件与静态资源，为你保留了 ${uniqueFiles.length} 个高权重模块作为优先精读路径。`,
          },
          {
            tag: "状态与边界排查法",
            body: "精读每个代码切片时重点盯防 4 类高亮：入口参数校验、异步/并发锁边界、错误补偿路径及性能批处理策略。",
          },
          {
            tag: "面试反客为主公式",
            body: "不要背目录！按「痛点背景 -> 核心机制选型 -> 压测收益指标 -> 我做的改造补充」四步组织任何开源项目介绍。",
          },
        ],
        diagram: {
          title: "核心代码单元调用拓扑图（点击节点直接跳转源码行）",
          hint: "由 Dagre 自动排布，点击任意节点立即滚屏并高亮对应代码块",
          rankdir: "LR",
          nodes: diagramNodes,
          edges: diagramEdges,
        },
        glossaryTitle: "源码拆解核心审查清单",
        glossary: [
          { term: "并发与竞态边界", badge: "必查", definition: "是否存在未受保护的共享状态、无界协程创建或锁粒度过大导致吞吐卡死。" },
          { term: "幂等性与重入", badge: "必查", definition: "上游网络超时重试时，当前函数再次执行是否会产生重复副作用或脏数据。" },
          { term: "优雅降级与退避", badge: "高可用", definition: "下游依赖瘫痪时是否有 Timeout、熔断器或带抖动的指数退避保护。" },
        ],
      },
      units: hydratedUnits,
      bottomTitle: "08. 简历武装、压力测试与二开改造方案",
      bottomSubtitle: "将源码理解沉淀为高含金量面试回答与 Before/After 改造记录",
      bottomBlocks: [
        {
          type: "statement-banner",
          tag: "30-SECOND ELEVATOR PITCH · 口述骨架模板",
          body: `在「${title}」项目中，核心围绕高并发/可维护性场景构建了 ${uniqueFiles.slice(0, 3).join(" / ")} 等核心模块。面对系统吞吐瓶颈与异常一致性挑战，代码通过分层解耦、显式超时防御与批处理策略保障系统稳定性。建议结合上方 20/80 批注补充你自己的压测数据完成定制。`,
        },
        {
          type: "socratic-qa",
          title: "通用 L1-L3 源码压力测试清单（离线自检题）",
          items: [
            {
              question: "L1 · 主链路流转：请脱离代码从请求入口开始，口述一次完整数据是如何穿过各个核心文件的？",
              answer: `结合上方调用链图，依次串讲：${diagramNodes.map((n) => n.label).join(" -> ")}，明确每一跳的输入与状态变更。`,
            },
            {
              question: "L2 · 故障演练：如果核心依赖（DB/Redis/外部RPC）突然响应超时 5 秒，当前代码会出现雪崩吗？",
              answer: "核对左侧每个代码单元中的蓝色（边界校验与容错）高亮，检查是否全部挂了 Timeout 与失败退避策略。",
            },
            {
              question: "L3 · 扩容与瓶颈：若流量再暴涨 10 倍，当前代码里哪个数据结构或单点存储会最先成为瓶颈？",
              answer: "定位紫色（潜在盲区）标记行，提出分片、异步解耦或缓存前置的演进方案。",
            },
          ],
        },
        {
          type: "star-bullets",
          title: "简历 STAR 话术组装框架",
          versions: [
            {
              versionLabel: "模板 A · 稳定性与核心架构拆解版",
              summary: "将动作拆解为「痛点定位 + 机制实施 + 可验证结果」。",
              bullets: [
                `负责「${title}」核心链路（涵盖 ${uniqueFiles.slice(0, 2).join(", ")}）的设计与并发安全治理，通过显式边界校验与超时隔离消除异常重试脏写风险。`,
                "引入模块化解耦与批处理优化，结合自动化回归验证保障核心流程在高并发压力下稳定运行。",
              ],
            },
          ],
        },
        {
          type: "ownership-blueprints",
          title: "2小时 Ownership 二次开发启动蓝图",
          plans: [
            {
              title: "改造方向 01：为无超时外部调用补全 Context Timeout + 指数退避",
              timeEstimate: "约 1.5 小时",
              targetFiles: uniqueFiles[0] ?? "核心入口文件",
              changeSteps: "排查所有未显式设定 Timeout 的网络/I/O 调用，补充超时上下文与可配置重试次数，并编写失败注入单测。",
              benchmarkMetric: "故障模拟测试下故障请求 100% 在设定阈值内快速失败，不拖垮主线程池。",
              interviewPitch: "强调你对线上雪崩隐患的主动防御和全链路超时治理。",
            },
            {
              title: "改造方向 02：增加并发基准测试 (Benchmark) 与热点结构优化",
              timeEstimate: "约 2 小时",
              targetFiles: uniqueFiles.slice(0, 2).join(" & "),
              changeSteps: "针对高频循环中的重复序列化或逐条 I/O，改为批处理/Pipeline，在本地记录改造前后的耗时对比。",
              benchmarkMetric: "记录改造前后 P95/P99 耗时与内存分配（Alloc/op）下降百分比。",
              interviewPitch: "用真实的定量压测数据证明你具备性能剖析与调优能力。",
            },
          ],
        },
        {
          type: "before-after-diff",
          title: "可交互式代码改造对比区与压测记录",
          description: "在此直接记录你的二次开发代码 Diff 与本地 Benchmark 数据，会自动持久化到本地并在导出报告中保留。",
          defaultBeforeCode: "// BEFORE: 在此粘贴你发现的原库性能瓶颈或缺失兜底的原始代码片段",
          defaultAfterCode: "// AFTER: 在此粘贴你改造后的批处理、缓存优化或容错补全代码",
          defaultBenchmarkNote: "测试环境：\n- Before 指标（QPS / P99 耗时）：\n- After 指标（QPS / P99 耗时）：",
        },
        {
          type: "feynman-challenge",
          title: "架构讲清测验：200字以内讲清主链路与改造切入点",
          prompt: "不看源码，向一位新接手该项目的工程师说清：请求从哪个入口进来、经过哪两层抽象、当前最脆弱的并发/容错边界在哪，以及你的 2 小时二开改什么。",
          referenceExplanation: "建议结构：1. 入口与数据流（40字）；2. 核心抽象与状态载体（60字）；3. 并发/幂等脆弱点（50字）；4. 二开补丁与验证指标（50字）。",
          laypersonQuestions: [
            "高并发突刺来临时，哪个队列或锁最先成为系统瓶颈？",
            "如果下游超时，为什么当前重试或降级路径可能放大故障？",
          ],
        },
        {
          type: "review-schedule",
          title: "间隔复盘与改造追踪计划（第 1 / 3 / 7 / 21 天）",
          startDate: new Date().toISOString().slice(0, 10),
          tasks: [
            "合上源码手画主调用链路与核心数据结构，核对关键入口文件",
            "针对标注为「模糊/不懂」的代码单元写最小复现单元测试",
            "完成一处 Before/After 改造并记录真实压测前后对照指标",
            "提炼 1 条 90 秒项目深挖 STAR 话术并迁移容错模式到个人项目",
          ],
        },
      ],
    };
  },
};
