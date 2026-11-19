import type { SourceUnit, TopModelStepOutput } from "@/core/contracts/mode-plugin";

interface PromptContext {
  readingPurpose?: string;
  userBackground?: string;
  userTopic?: string;
}

function formatCognitiveContext(context?: PromptContext): string {
  if (!context) return "";
  const lines: string[] = [];
  if (context.readingPurpose) lines.push(`- 阅读目的：${context.readingPurpose}`);
  if (context.userBackground) lines.push(`- 读者背景：${context.userBackground}`);
  if (context.userTopic) lines.push(`- 关注方向：${context.userTopic}`);
  return lines.length > 0 ? `\n读者画像：\n${lines.join("\n")}\n` : "";
}

export function buildCognitiveTopModelPrompt(
  title: string,
  units: SourceUnit[],
  context?: PromptContext
): string {
  const sectionList = Array.from(
    units.reduce((acc, u) => {
      if (!acc.has(u.sectionId)) acc.set(u.sectionId, u.sectionTitle);
      return acc;
    }, new Map<string, string>())
  )
    .slice(0, 16)
    .map(([id, secTitle]) => `- ${id}: ${secTitle}`)
    .join("\n");

  const digest = units
    .slice(0, 14)
    .map((u) => `[unitId=${u.id} | sectionId=${u.sectionId} | ${u.sectionTitle}] ${u.rawPrimaryText.slice(0, 260)}`)
    .join("\n");

  return [
    "你是一位精通认知心理学、控制论、第一性原理与深度内容解剖的教练。严禁使用任何 Emoji 表情符号。",
    "请在核心推断前适当标注 `[原文明示]` 或 `[分析推断]`。",
    `请针对认知文章/视频文稿《${title}》生成“去鸡汤化认知鸟瞰面板”、一句话全局骨架、读前预测试、新旧心智对比表、几何心智模型拓扑图、三遍路径和节末小结。`,
    formatCognitiveContext(context),
    "要求：",
    "1. topMentalModel.rawSummaryBanner: tag='[RAW FIRST-PRINCIPLE / 一句话第一性原理]'，剥离情绪修辞写出冷酷客观规律。",
    "2. topMentalModel.oneSentenceSkeleton: `针对 [认知误区/困境]，作者通过 [心智框架]，在 [条件] 下促成 [转变]，代价或边界是 [限制]。`",
    "3. topMentalModel.cards: 提炼 3 张核心认知卡片（每张含 `tag` 英文+中文维度标签与 `body` 冷静机制凝练）。",
    "4. topMentalModel.pretestItems: 3 道挑战常识的读前预测试问题与对照答案。",
    "5. topMentalModel.comparisonPair: 对比 4 组 'Old Default OS' (leftTone='danger') vs 'Upgraded OS' (rightTone='success')。",
    "6. topMentalModel.diagram.nodes: 画出全文核心思想因果环，nodes 绑定 targetUnitId。",
    "7. topMentalModel.glossary: 提取 4 个核心心智模型，在 badge 中注明思想溯源。",
    "8. sections: 仅按下方列出的 sectionId 划分章节（不要把具体段落 unitId 拆成独立 section），并附带凝练 `summary`（referenceRecall, established, openQuestions, rhetoricStrategy, reviewerCritique, socraticQuestions）。",
    "\n可用章节 sectionId：",
    sectionList,
    "\n思想单元摘要：",
    digest,
  ].join("\n");
}

export function buildCognitiveBatchPrompt(
  batch: SourceUnit[],
  globalContextSummary: string,
  allSectionIds: string[]
): string {
  const payload = batch
    .map((u) => `unitId: ${u.id}\nunitCode: ${u.unitCode}\n原文:\n${u.rawPrimaryText}`)
    .join("\n\n---\n\n");

  return [
    "你是一位高维认知教练与顶级专栏译者。严禁使用任何 Emoji 表情符号。",
    `全局认知脉络：${globalContextSummary}`,
    `可用叙事弧线 ID：${allSectionIds.join(", ")}`,
    "请为以下思想单元生成深度内化拆解：",
    "1. weight 严格区分 'core'（认知暴击核）、'support'（逻辑展开块）、'transition'（叙事过渡）。",
    "2. secondaryBlockText 必须是具有顶级思想专栏质感与节奏张力的中文译文，拒绝翻译腔。",
    "3. highlights 严格提取原文连续子串：",
    "   - dim1 (黄): 颠覆性洞察与金句",
    "   - dim2 (红): 核心心智模型/概念造词（必须附带 tooltip 第一性原理释义）",
    "   - dim3 (蓝): 痛点诊断与底层心理机制",
    "   - dim4 (绿): 反直觉纠偏/认知误区",
    "   - dim5 (紫): 可执行协议/自我追问列表",
    "4. notes 固定输出 4 项：",
    "   - notes[0]: 01 / 叙事推进与底层机制（用心理学/神经科学/控制论讲透原因，可填 echoTargetId）",
    "   - notes[1]: 02 / 去魅滤镜与适用边界（剥离夸张修辞，指出成立前提）",
    "   - notes[2]: 03 / 顶级创作者表达解剖（拆解修辞与说服技巧）",
    "   - notes[3]: 04 / 知行阻抗诊断与个人映射（在 calloutBox 中放 1 个尖锐自问或 5 分钟行动指令）",
    "5. 对 core 核心簇额外提供：predictPrompt（先猜作者底层逻辑的问题）、selfExplainPrompt（为什么这样有效）及 firstPassRecommended=true。",
    "\n待拆解思想单元批次：",
    payload,
  ].join("\n");
}

export function buildCognitiveBottomPrompt(
  title: string,
  units: SourceUnit[],
  topModel: TopModelStepOutput,
  context?: PromptContext
): string {
  const digest = units
    .slice(0, 12)
    .map((u) => `[${u.unitCode}] ${u.rawPrimaryText.slice(0, 180)}`)
    .join("\n");
  const today = new Date().toISOString().slice(0, 10);

  return [
    "你是一位行动转化工作台架构师。严禁使用任何 Emoji 表情符号。",
    `基于文章《${title}》的认知内核（${topModel.globalContextSummary}），生成底部交互式个人重启工作台：`,
    formatCognitiveContext(context),
    "bottomBlocks 必须包含：",
    "1. type='flow-skeleton': 5 步认知-行动闭环链。",
    "2. type='aphorism-list': 提取全文最值得记住的 5 句原文核心金句（en + zh）。",
    "3. type='journal-prompts': 提取文中所有自我审计与规划问题，生成 4 个交互书写卡片（含 id, label, hint, placeholder）。",
    "4. type='checklist': 提炼 4 个今天就能执行的物理动作（含 id, tag, text）。",
    "5. type='first-principles-list': 拆解全文思想成立的 3 个前提与反例边界。",
    "6. type='socratic-qa': 3~4 道打乱顺序的深度内化自测题（附 cognitiveLevel）。",
    "7. type='feynman-challenge': 200 字向朋友复述本文底层框架。",
    `8. type='review-schedule': startDate='${today}' 的 Day 1/3/7/21 间隔践行检查计划。`,
    "\n思想单元摘要：",
    digest,
  ].join("\n");
}
