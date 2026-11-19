import type { SourceUnit } from "@/core/contracts/mode-plugin";

interface PromptContext {
  readingPurpose?: string;
  userBackground?: string;
  userTopic?: string;
}

function formatRepoContext(context?: PromptContext): string {
  if (!context) return "";
  const lines: string[] = [];
  if (context.readingPurpose) lines.push(`- 拆解目的：${context.readingPurpose}`);
  if (context.userBackground) lines.push(`- 开发者技术栈背景：${context.userBackground}`);
  if (context.userTopic) lines.push(`- 目标业务/面试岗位方向：${context.userTopic}`);
  return lines.length > 0 ? `\n读者画像与定制方向：\n${lines.join("\n")}\n` : "";
}

export function buildRepoTopModelPrompt(
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

  const outline = units
    .map(
      (u) =>
        `[unitId=${u.id} | sectionId=${u.sectionId}] (${u.sectionTitle}) ${u.rawPrimaryText.slice(0, 260).replace(/\s+/g, " ")}`
    )
    .join("\n");

  return `你是一位顶尖开源架构师兼高级技术面试官（Zero-Emoji Strict Style）。
请分析开源项目「${title}」的核心源码片段，构建【20/80 核心架构导读与主调用链路图】。
${formatRepoContext(context)}
严格输出中文（技术术语可保留英文），禁止使用任何 emoji 表情符。关键判断前适度标明 [原文明示] 或 [分析推断]。
严格遵循以下要求：
1. topMentalModel.oneSentenceSkeleton: 用一句面试一句话总结概括：「针对 [并发/一致性/扩展性痛点]，项目通过 [核心源码机制]，在 [前置假设] 下实现了 [性能/收益]，代价是 [复杂度/限制]。」
2. topMentalModel.pretestItems: 2~3 道源码读前猜测题（例如“若并发量翻倍，先卡在哪里？”），答案会在底部揭晓。
3. topMentalModel.cards 至少包含 3 张卡片：
   - 第1张 tag="核心价值与并发瓶颈解决": 用一句话概括该项目用什么工程机制解决了什么高并发/一致性/解耦难题。
   - 第2张 tag="80% 可忽略外围 vs 20% 必读核心": 明确指出哪些文件/胶水代码面试可跳过，哪些核心引擎文件必须逐行吃透。
   - 第3张 tag="状态机与核心数据结构流": 提炼请求或任务从入口进入、状态流转到落盘/消费的关键数据结构链路。
4. topMentalModel.diagram 必须是【主请求/调度链路调用图 (Call Graph)】，rankdir 为 "LR" 或 "TB"，nodes 必须将 targetUnitId 精确绑定到下列真实 unitId（便于点击跳转对应代码）：
${units.map((u) => `- ${u.id}: ${u.sectionTitle}`).join("\n")}
5. topMentalModel.glossary 提炼 4-6 个底层工程术语及面试可复述的一句话解释。
6. topMentalModel.designChoices 列出 3 个关键工程架构选型对比（如为什么用该数据结构/锁模型而不是替代方案）。
7. sections 仅按下方列出的模块 sectionId 归并输出，并在重点模块填写凝练 summary（referenceRecall, established, openQuestions, rhetoricStrategy, reviewerCritique, socraticQuestions）：
${sectionList}

源码片段摘要如下：
${outline}`;
}

export function buildRepoBatchPrompt(
  batch: SourceUnit[],
  globalContextSummary: string,
  allSectionIds: string[]
): string {
  const unitsText = batch
    .map(
      (u) => `=== UNIT ${u.id} (${u.unitCode}) | section=${u.sectionId} | file=${u.metadata?.filePath ?? u.sectionTitle} ===
${u.rawPrimaryText}`
    )
    .join("\n\n");

  return `你正在进行开源项目底层的深度源码精讲与面试压力测试拆解（Zero-Emoji Strict Style）。
项目全局架构上下文：${globalContextSummary}
全部模块 sectionId 列表：${allSectionIds.join(", ")}

对每个代码块 unit，必须严格产出 JSON 注解对象：
- unitId: 原样返回 unit id
- weight: "core"（决定系统吞吐/一致性/核心算法的关键 20% 源码）| "support"（常规路由或模型定义）| "transition"（胶水或入口装配）
- tldr: 一句话极简总结该代码块的核心职责
- secondaryBlockText: 中文深度架构翻译与逐层执行流白话拆解（帮助面试者 30 秒口述清楚该模块的工作流）
- tensorOrStateFlow: 若涉及关键状态流转/锁粒度/数据结构变化，用纯文本箭头写出（例如 "Request -> IdempotencyKey(Redis SETNX) -> Lua Enqueue -> Worker Pop"），否则留空
- highlights: 从原代码中精确抽取 2-5 个逐字完全匹配的代码子串（exact substring from rawPrimaryText!），分配给 5 个工程维度之一：
  - dim1 (系统入口/路由): HTTP/RPC 入口、事件监听与主调度起点
  - dim2 (核心状态与算法): 核心算法、并发锁、原子脚本、状态机流转（必须填写通俗易懂的 tooltip 面试级原理解释！）
  - dim3 (边界校验与容错): 重试、超时熔断、优雅退出、防重入、幂等防御
  - dim4 (性能与并发权衡): 池化、Pipeline、异步批处理、零拷贝或牺牲一致性换吞吐的取舍
  - dim5 (潜在盲区/追问点): 硬编码魔法数、竞态隐患、可扩展性瓶颈、面试官最爱挑刺的漏洞
- notes: 严格提供 4 条深度批注，对应 4 个固定模块（不要自己编标签，顺序固定）：
  1. [01 / 调用链上下文与双向锚点]: 说明是谁调用了它、它又触发了谁；若存在关联源码 unitId，填写 echoTargetId 与 echoLabel（如 "[回溯核心调度入队实现]"）
  2. [02 / 核心源码机制拆解]: 剥开语法糖，讲透这段代码的真实计算机底层动作（如原子性保证、内存/网络开销、复杂度）
  3. [03 / 设计取舍与替代方案]: 为什么作者这样写而不是用另一种方案（如为什么不用分布式事务而用最终一致性/Lua脚本）
  4. [04 / 面试官高频深挖追问]: 给出 1-2 个面试官一定会顺着这段代码往下挖的问题及满分踩点回答，可附带 calloutBox 标出高危踩坑点
- transitionSummary: 若为 transition 类型则写一句衔接说明
- predictPrompt: 对 weight="core" 代码单元提供一道读前猜测题（例如“若这段代码在高并发下不加锁/不设超时会发生什么？”）
- selfExplainPrompt: { question: "为什么这里要采取这种设计而非直接遍历/加全局锁？", answer: "详细底层解释" }
- firstPassRecommended: 若属于 20% 核心架构链路则设为 true

严禁使用任何 emoji！以下是本批次待拆解源码单元：
${unitsText}`;
}

export function buildRepoBottomPrompt(
  title: string,
  units: SourceUnit[],
  topModel: { globalContextSummary: string },
  context?: PromptContext
): string {
  const unitSummaries = units.map(
    (u) => `- [${u.id}] ${u.sectionTitle}: ${u.rawPrimaryText.slice(0, 140).replace(/\s+/g, " ")}`
  );
  const today = new Date().toISOString().slice(0, 10);
  return `你正在为开源项目「${title}」生成【面试级项目武装与二次开发改造军火库】（Zero-Emoji Strict Style）。
禁止出现任何 emoji！
${formatRepoContext(context)}
全局上下文：${topModel.globalContextSummary}
模块摘要：
${unitSummaries.join("\n")}

请在 bottomTitle="08. 简历武装、压力测试与二开改造方案" 下，按顺序产出以下 bottomBlocks：
1. statement-banner (tag="PROJECT PITCH · 30秒电梯演讲版", body="给出一份可直接背诵的 30 秒项目总览介绍：问题背景 + 架构选型 + 核心指标")
2. socratic-qa (title="L1-L3 渐进式面试压力测试（附追问防线）"): 提供 4-6 组问答（附 cognitiveLevel 标注），涵盖 L1 主链路、L2 故障压测、L3 扩展对比。
3. star-bullets (title="简历 STAR 法则高含金量话术（双版本）")
4. ownership-blueprints (title="2小时可落地的 Ownership 二次开发改造计划（把开源变成自己的项目）"): 提供 3 个增量改造蓝图。
5. before-after-diff (title="可交互式代码改造对比区与压测记录")
6. feynman-challenge (title="面试官白板手撕费曼检验"): 要求 200 字给非该项目团队成员讲透核心架构及 3 个面试追问。
7. review-schedule (title="面试前间隔复习计划", startDate="${today}")`;
}
