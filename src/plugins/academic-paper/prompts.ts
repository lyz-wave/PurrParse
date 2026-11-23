import type { SourceUnit, TopModelStepOutput } from "@/core/contracts/mode-plugin";
import { isPrimarilyChineseProse } from "@/core/contracts/shared-schemas";

interface PromptContext {
  readingPurpose?: string;
  userBackground?: string;
  userTopic?: string;
}

function formatContextBlock(context?: PromptContext): string {
  if (!context) return "";
  const lines: string[] = [];
  if (context.readingPurpose) lines.push(`- 阅读目的：${context.readingPurpose}`);
  if (context.userBackground) lines.push(`- 读者背景：${context.userBackground}`);
  if (context.userTopic) lines.push(`- 读者自身研究课题：${context.userTopic}`);
  return lines.length > 0 ? `\n读者画像与配置：\n${lines.join("\n")}\n` : "";
}

export function buildAcademicTopModelPrompt(
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
    "你是一位顶尖学术审稿人与领域导师。严禁在输出中使用任何 Emoji 表情符号。",
    "所有推断必须与原文区分，并在关键结论前使用 `[原文明示]`、`[分析推断]` 或 `[原文未说明]` 标注；若原文前后数据冲突，保留并标 `[原文不一致]`。",
    `请针对论文《${title}》生成全局顶层认知脚手架、预测试、渐隐手算/走查、设计选择表、三遍路径与全文章节导航（含节末小结 summary）。`,
    formatContextBlock(context),
    "要求：",
    "1. topMentalModel.oneSentenceSkeleton: 用一句完整的话概括：`针对 [问题]，作者通过 [方法]，在 [条件] 下得到 [结果]，代价是 [限制]。`",
    "2. topMentalModel.pretestItems: 设计 3 道读前预测试（含 id, question, answer, targetUnitId），只问机制与预测，答案将在底部揭晓。",
    "3. topMentalModel.cards 必须包含 3 个卡片，tag 分别为：",
    "   - '[PROBLEM & GAP / 真问题与前人死结]'",
    "   - '[EUREKA INTUITION / 核心破局直觉]'",
    "   - '[FUNDAMENTAL TRADE-OFF / 核心交换代价]'",
    "4. topMentalModel.diagram.nodes 中的每个节点尽量绑定 targetUnitId（取自下文 unitId）。",
    "5. topMentalModel.glossary 列出 4~6 个核心术语与数学符号的大白话直觉定义。",
    "6. topMentalModel.readingPath: 给出三遍阅读法（pass1Summary, pass2Summary, pass3Summary, recommendedUnitIds）。",
    "7. topMentalModel.fadedExamples: 针对论文最核心公式或机制构建 3 级渐隐手算/案例走查（level=1 完整极小数值推演；level=2 半填空；level=3 独立求解，标注 `[教学示例，非论文原始数据]`）。",
    "8. topMentalModel.designChoices: 列出 3~5 个关键设计决策与替代方案对比。",
    "9. topMentalModel.prerequisiteMap: 若读者提供了背景，列出 3~6 个前置知识速成；若未填写背景，禁止猜测读者水平，可简略列出通用领域概念。",
    "10. sections 必须仅按下方列出的逻辑章节 sectionId 归并输出（严禁把 sec-1-p1 / sec-1-p2 等具体段落 unitId 当作独立 section 展开），并在各章节填写凝练 summary（含 established, openQuestions, rhetoricStrategy, referenceRecall, reviewerCritique 与 1~2 道含 category[澄清概念/检查假设/追问证据/换个视角/推演后果/反问问题本身] 的 socraticQuestions）。",
    "\n逻辑章节列表（仅输出这里的 sectionId 作为 sections[].id）：",
    sectionList,
    "\n论文结构化片段摘要：",
    digest,
  ].join("\n");
}

export function buildAcademicBatchPrompt(
  batch: SourceUnit[],
  globalContextSummary: string,
  allSectionIds: string[]
): string {
  const payload = batch
    .map((u) => {
      const langHint = isPrimarilyChineseProse(u.rawPrimaryText)
        ? "语言判定: 中文原文（无需翻译，secondaryBlockText 直接输出空字符串 \"\"）"
        : "语言判定: 外文原文（须逐句忠实完整意译，不可写成概括摘要）";
      return `unitId: ${u.id}\nunitCode: ${u.unitCode}\nsectionId: ${u.sectionId}\n${langHint}\n原文:\n${u.rawPrimaryText}`;
    })
    .join("\n\n---\n\n");

  return [
    "你是一位顶尖学术论文精读导师。严禁使用任何 Emoji 表情符号。",
    `全局论文脉络：${globalContextSummary}`,
    `可用章节 ID 列表：${allSectionIds.join(", ")}`,
    "请为以下每一个单元生成结构化精读批注：",
    "1. weight 严格区分 'core'（核心论点/核心公式/关键实验）、'support'（论证基石）、'transition'（过渡段）。",
    "2. secondaryBlockText：若为中文原文则直接输出空字符串 \"\"；若为外文原文则必须是忠实完整的中文学术翻译（保留所有定量结果、条件与因果关系，不缩略为摘要）。",
    "3. highlights 必须严格提取原文中真实存在的连续子串，按五维分类：",
    "   - dim1 (黄): 核心论点/假说",
    "   - dim2 (红): 关键概念/术语（必须附带 tooltip 一句话白话定义）",
    "   - dim3 (蓝): 实证证据/数据/引用支撑",
    "   - dim4 (绿): 让步/反驳/局限性讨论",
    "   - dim5 (紫): 方法论/模型设计/数学设定",
    "4. 若本段含公式或算法，在 tensorOrStateFlow 中写出清晰的张量维度流向与符号定义，所有数学符号与公式必须用 `$ ... $` 包裹标准 LaTeX（例如 `$Q[n,d_k] \\times K^T[d_k,m] \\rightarrow \\mathrm{Scores}[n,m]$`、`$\\hat{z}_{t+1:t+H}[H, d_z]$`、`$L_{\\mathrm{distill}} = \\lVert P(F_t) - G_t \\rVert^2$`；多字母下标用 `_{\\mathrm{...}}`，戴帽字母用 `\\hat{...}` 而非 Unicode 组合字符）。",
    "5. notes 数组按顺序固定输出 4 项，并在重要判断前标明 `[原文明示]`、`[分析推断]` 或 `[原文未说明]`：",
    "   - notes[0]: 逻辑演进与跨节锚点（如有跨节呼应，填 echoTargetId 与 echoLabel）",
    "   - notes[1]: 段落功能与逻辑角色（必须回答：若删掉这一段，论证链是否真的断裂？）",
    "   - notes[2]: 硬核破译（公式推导、变量单位/维度与直觉解释）",
    "   - notes[3]: 审稿人视角（可学写法 vs 隐含假设/漏洞与证据强度评估）",
    "6. 主动学习增强字段（重点为 weight='core' 单元提供）：",
    "   - predictPrompt: 针对本段内容的读前预测引导问题（禁止千篇一律，需紧扣本段矛盾/设计）；",
    "   - selfExplainPrompt: { question: '为什么...的因果追问', answer: '参考解释' }；",
    "   - misconceptionCallout: 若本段存在极易混淆的知识点，按 `[易误解] 错误理解：……；更准确的理解：……` 格式填写，无则省略；",
    "   - firstPassRecommended: 若属于第一遍速读必读 20% 核心段则设为 true。",
    "\n待精读段落批次：",
    payload,
  ].join("\n");
}

export function buildAcademicBottomPrompt(
  title: string,
  units: SourceUnit[],
  topModel: TopModelStepOutput,
  context?: PromptContext
): string {
  const coreDigest = units
    .slice(0, 12)
    .map((u) => `[${u.unitCode}] ${u.rawPrimaryText.slice(0, 180)}`)
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);

  return [
    "你是一位顶会 Area Chair。严禁使用任何 Emoji 表情符号。",
    `基于论文《${title}》的全局脉络（${topModel.globalContextSummary}），生成底部论证复盘、主张-证据对照、第一性原理拆解、交错自测与费曼检验：`,
    formatContextBlock(context),
    "bottomBlocks 必须包含以下模块：",
    "1. type='flow-skeleton': 5 步全文论证骨架（01 PROBLEM -> 02 THESIS -> 03 MECHANISM -> 04 EVIDENCE -> 05 BOUNDARY）。",
    "2. type='statement-banner': tag='CORE CONTRIBUTION FORMULA / 作者核心主张一句话公式'。",
    "3. type='comparison-pair': left 为 '[STRONGEST STRIKE / 全文论证最强处]' (tone='success')，right 为 '[ACHILLES' HEEL / 论证最脆弱处]' (tone='danger')。",
    "4. type='first-principles-list': 将核心方法拆解成 3~5 个最基本前提（premise, ifViolated, basis）。",
    "5. type='claim-evidence-table': 编号 C1..Cn 对齐作者主张、支撑证据锚点、证据局限与未覆盖边界。",
    "6. type='prior-work-table': 列出 2~4 篇文中重点讨论的前作差异对比（注明依据本文描述、未独立核验）。",
    "7. type='socratic-qa': 提供 4~6 道打乱章节顺序的交错自测题，每题标明 cognitiveLevel（理解/应用/分析/评价），含至少 2 道机制辨析题。",
    "8. type='feynman-challenge': 要求用 200 字向非专业人士解释本文，附参考大白话讲解与 3 个外行追问。",
    context?.readingPurpose || context?.userTopic
      ? `9. type='purpose-tailored': 针对读者设定的目的「${context?.readingPurpose ?? "深度理解"}」${context?.userTopic ? `与课题「${context.userTopic}」` : ""}输出可借鉴点、复现/审稿清单或差异缺口。`
      : "",
    `10. type='review-schedule': startDate='${today}'，给出 Day 1 / Day 3 / Day 7 / Day 21 的 4 条具体复习动作。`,
    "\n关键段落摘要：",
    coreDigest,
  ]
    .filter(Boolean)
    .join("\n");
}
