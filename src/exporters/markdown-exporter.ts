import type {
  BottomArsenalBlock,
  UserAnnotationsState,
  WorkbenchDocument,
} from "@/core/contracts/document-ast";

function formatBottomBlockToMarkdown(
  block: BottomArsenalBlock,
  annotations?: UserAnnotationsState
): string[] {
  const lines: string[] = [];

  switch (block.type) {
    case "flow-skeleton": {
      if (block.title) lines.push(`### ${block.title}`);
      block.steps.forEach((s) => lines.push(`- **[${s.tag}]** ${s.body}`));
      break;
    }
    case "statement-banner": {
      lines.push(`> **[${block.tag}]** ${block.body}`);
      break;
    }
    case "comparison-pair": {
      lines.push(`- **${block.left.tag}**: ${block.left.body}`);
      lines.push(`- **${block.right.tag}**: ${block.right.body}`);
      break;
    }
    case "socratic-qa": {
      lines.push(`### ${block.title}`);
      block.items.forEach((item, idx) => {
        const qKey = item.id ?? `sq-export-${idx}`;
        const userAns = annotations?.socraticAnswers?.[qKey];
        lines.push(
          `${idx + 1}. ${item.cognitiveLevel ? `[${item.cognitiveLevel}] ` : ""}**Q:** ${item.question}`
        );
        if (userAns?.answer?.trim()) {
          lines.push(`   **我的作答 (${userAns.confidence})**: ${userAns.answer.trim()}`);
        }
        lines.push(`   **参考解析:** ${item.answer}`);
      });
      break;
    }
    case "claim-evidence-table": {
      lines.push(`### ${block.title}`);
      lines.push("| 编号 | 核心主张 | 支撑证据及锚点 | 证据类型与局限 | 未覆盖边界 |");
      lines.push("| :--- | :--- | :--- | :--- | :--- |");
      block.rows.forEach((r) => {
        lines.push(
          `| ${r.claimId} | ${r.claim} | ${r.evidenceAnchor} | ${r.limitation} | ${r.unverifiedGap} |`
        );
      });
      break;
    }
    case "prior-work-table": {
      lines.push(`### ${block.title}`);
      lines.push("| 关键前作 | 本文声称差异 | 原文锚点 | 信息缺口 |");
      lines.push("| :--- | :--- | :--- | :--- |");
      block.rows.forEach((r) => {
        lines.push(`| ${r.priorWork} | ${r.claimedDifference} | ${r.anchor} | ${r.infoGap} |`);
      });
      break;
    }
    case "first-principles-list": {
      lines.push(`### ${block.title}`);
      block.items.forEach((it, idx) => {
        lines.push(`${idx + 1}. **前提**: ${it.premise}`);
        lines.push(`   - **若不成立**: ${it.ifViolated}`);
        lines.push(`   - **依据**: ${it.basis}`);
      });
      break;
    }
    case "feynman-challenge": {
      lines.push(`### ${block.title}`);
      lines.push(`*任务*: ${block.prompt}`);
      const essay = annotations?.feynmanEssay?.trim();
      if (essay) lines.push(`\n**我的 200 字费曼复述**:\n\n${essay}`);
      lines.push(`\n**参考讲解**: ${block.referenceExplanation}`);
      if (block.laypersonQuestions.length > 0) {
        lines.push("**外行追问清单**:");
        block.laypersonQuestions.forEach((q) => lines.push(`- ${q}`));
      }
      break;
    }
    case "purpose-tailored": {
      lines.push(`### ${block.title} (${block.purposeLabel})`);
      block.items.forEach((it) => lines.push(`- **[${it.tag}]** ${it.body}`));
      break;
    }
    case "review-schedule": {
      lines.push(`### ${block.title}`);
      const days = [1, 3, 7, 21];
      const base = block.startDate ? new Date(block.startDate) : new Date();
      const validBase = Number.isNaN(base.getTime()) ? new Date() : base;
      days.forEach((d, idx) => {
        const dt = new Date(validBase.getTime() + d * 86400_000).toISOString().slice(0, 10);
        lines.push(
          `- **Day ${d} (${dt})**: ${block.tasks[idx] ?? "闭卷画结构图 + 重做 3 道交错自测题 + 复查待攻克清单"}`
        );
      });
      break;
    }
    case "aphorism-list": {
      lines.push(`### ${block.title}`);
      block.items.forEach((item) => {
        lines.push(`- *"${item.en}"* -- ${item.zh}`);
      });
      break;
    }
    case "journal-prompts": {
      lines.push(`### ${block.title}`);
      block.items.forEach((item) => {
        const answer = annotations?.journalAnswers?.[item.id]?.trim();
        lines.push(`#### ${item.label}`);
        lines.push(`*提示：${item.hint}*`);
        lines.push(answer ? `\n${answer}` : `\n(未填写)`);
      });
      break;
    }
    case "checklist": {
      lines.push(`### ${block.title}`);
      block.items.forEach((item) => {
        const checked = Boolean(annotations?.checklistStates?.[item.id]);
        lines.push(`- [${checked ? "x" : " "}] **[${item.tag}]** ${item.text}`);
      });
      break;
    }
    case "star-bullets": {
      lines.push(`### ${block.title}`);
      block.versions.forEach((v) => {
        lines.push(`#### ${v.versionLabel}`);
        lines.push(v.summary);
        v.bullets.forEach((b) => lines.push(`- ${b}`));
      });
      break;
    }
    case "ownership-blueprints": {
      lines.push(`### ${block.title}`);
      block.plans.forEach((plan, idx) => {
        lines.push(`#### ${idx + 1}. ${plan.title} (${plan.timeEstimate})`);
        lines.push(`- **目标文件**: ${plan.targetFiles}`);
        lines.push(`- **实施步骤**: ${plan.changeSteps}`);
        lines.push(`- **验证指标**: ${plan.benchmarkMetric}`);
        lines.push(`- **表达切入**: ${plan.interviewPitch}`);
      });
      break;
    }
    case "before-after-diff": {
      lines.push(`### ${block.title}`);
      lines.push(block.description);
      const before = annotations?.beforeAfterDiff?.beforeCode ?? block.defaultBeforeCode;
      const after = annotations?.beforeAfterDiff?.afterCode ?? block.defaultAfterCode;
      const bench = annotations?.beforeAfterDiff?.benchmarkNote ?? block.defaultBenchmarkNote;
      lines.push("```diff\n--- BEFORE\n" + before + "\n+++ AFTER\n" + after + "\n```");
      if (bench.trim()) {
        lines.push(`**压测与对比记录:**\n\n${bench}`);
      }
      break;
    }
  }

  return lines;
}

export function exportDocumentToMarkdown(
  doc: WorkbenchDocument,
  annotations?: UserAnnotationsState
): string {
  const out: string[] = [];

  out.push(`# ${doc.title}`);
  out.push(`> ${doc.subtitle}`);
  out.push(`> 模式：${doc.modeName} | 导出时间：${new Date().toISOString().slice(0, 10)}`);
  out.push("");

  out.push(`## ${doc.topMentalModel.title}`);
  out.push(doc.topMentalModel.subtitle);
  if (doc.topMentalModel.rawSummaryBanner) {
    out.push("");
    out.push(`**[${doc.topMentalModel.rawSummaryBanner.tag}]** ${doc.topMentalModel.rawSummaryBanner.body}`);
  }
  if (doc.topMentalModel.oneSentenceSkeleton) {
    out.push("");
    out.push(`> **[一句话骨架]** ${doc.topMentalModel.oneSentenceSkeleton}`);
  }
  if (doc.topMentalModel.pretestItems && doc.topMentalModel.pretestItems.length > 0) {
    out.push("");
    out.push("### 读前预测试记录与揭晓");
    doc.topMentalModel.pretestItems.forEach((item, idx) => {
      const saved = annotations?.pretestAnswers?.[item.id];
      out.push(`${idx + 1}. **Q:** ${item.question}`);
      if (saved) {
        out.push(`   - **我的预测 (信心: ${saved.confidence})**: ${saved.answer || "(未作答)"}`);
      }
      out.push(`   - **参考答案**: ${item.answer}`);
    });
  }
  out.push("");
  doc.topMentalModel.cards.forEach((card) => {
    out.push(`- **${card.tag}**: ${card.body}`);
  });

  if (doc.topMentalModel.comparisonPair) {
    const cp = doc.topMentalModel.comparisonPair;
    out.push("");
    out.push(`### ${cp.leftTitle} vs ${cp.rightTitle}`);
    out.push(`**${cp.leftTitle}:**`);
    cp.leftItems.forEach((item) => out.push(`- ${item}`));
    out.push(`**${cp.rightTitle}:**`);
    cp.rightItems.forEach((item) => out.push(`- ${item}`));
  }

  if (doc.topMentalModel.glossary.length > 0) {
    out.push("");
    out.push(`### ${doc.topMentalModel.glossaryTitle}`);
    doc.topMentalModel.glossary.forEach((g) => {
      out.push(`- **${g.term}**${g.badge ? ` (${g.badge})` : ""}: ${g.definition}`);
    });
  }

  if (doc.topMentalModel.designChoices && doc.topMentalModel.designChoices.length > 0) {
    out.push("");
    out.push("### 核心设计选择表");
    out.push("| 关键决策 | 替代方案 | 选择理由 | 消融/证明与锚点 |");
    out.push("| :--- | :--- | :--- | :--- |");
    doc.topMentalModel.designChoices.forEach((row) => {
      out.push(
        `| ${row.decision} | ${row.alternatives} | ${row.rationale} | ${row.ablationOrProof} (${row.anchor}) |`
      );
    });
  }

  const pushSectionRecall = (secId: string) => {
    if (!secId) return;
    const secMeta = doc.sections.find((s) => s.id === secId);
    const userRecall = annotations?.sectionRecallAnswers?.[secId]?.text?.trim();
    if (!secMeta?.summary && !userRecall) return;
    out.push("");
    out.push(`#### [${secMeta?.title ?? secId}] 节末闭卷复述与审稿小结`);
    if (userRecall) out.push(`- **我的闭卷复述**: ${userRecall}`);
    if (secMeta?.summary) {
      out.push(`- **参考复述**: ${secMeta.summary.referenceRecall}`);
      out.push(`- **审稿人追问**: ${secMeta.summary.reviewerCritique}`);
    }
  };

  let currentSectionId = "";
  for (const unit of doc.units) {
    if (unit.sectionId !== currentSectionId) {
      pushSectionRecall(currentSectionId);
      currentSectionId = unit.sectionId;
      out.push("");
      out.push(`## ${unit.sectionTitle}`);
      if (unit.sectionTask) out.push(`*${unit.sectionTask}*`);
    }

    const understanding = annotations?.unitUnderstanding?.[unit.id];
    const understandingLabel =
      understanding && understanding !== "unmarked" ? ` [${understanding}]` : "";
    out.push("");
    out.push(
      `### [${unit.unitCode}] (${unit.weight.toUpperCase()})${understandingLabel} ${unit.tldr}`
    );
    if (unit.primaryKind === "code") {
      out.push(`\`\`\`${unit.codeLanguage || ""}`);
      out.push(unit.primaryText);
      out.push("```");
    } else {
      out.push(unit.primaryText);
    }

    if (unit.formulas && unit.formulas.length > 0) {
      unit.formulas.forEach((f) => {
        if (f.latex) out.push(`\n$$\n${f.latex}\n$$`);
        if (f.flowText) out.push(`> **${f.flowLabel ?? "FLOW"}**: \`${f.flowText}\``);
      });
    }

    if (unit.figures && unit.figures.length > 0) {
      unit.figures.forEach((fig) => {
        fig.imageUrls?.forEach((url) => {
          out.push(`\n![${fig.caption || "Figure"}](${url})`);
        });
        if (fig.caption) out.push(`> ${fig.caption}`);
      });
    }

    if (unit.secondaryBlockText) {
      out.push("");
      out.push(`> ${unit.secondaryBlockText}`);
    }

    unit.notes.forEach((n) => {
      out.push(`- **${n.label}**: ${n.body}`);
      if (n.calloutBox) out.push(`  - *重点提示*: ${n.calloutBox}`);
    });

    const predNote = annotations?.unitPredictionAnswers?.[unit.id]?.trim();
    if (predNote) {
      out.push(`- **我的先猜后看预测**: ${predNote}`);
    }

    const userNote = annotations?.unitNotes?.[unit.id]?.trim();
    if (userNote) {
      out.push(`- **个人随手笔记**: ${userNote}`);
    }

    const qaThreads = annotations?.unitQaThreads?.[unit.id] ?? [];
    if (qaThreads.length > 0) {
      const qaCount = qaThreads.reduce(
        (sum, t) => sum + 1 + (t.followUps?.length ?? 0),
        0
      );
      out.push(`- **[已追问 ${qaCount} 次 · AI 划词追问与证据记录]**`);
      qaThreads.forEach((thread, idx) => {
        out.push(
          `  - **线索 ${idx + 1}** [${thread.scope === "document" ? "全文跨节证据" : "本段精讲"}] 选中片段: “${thread.selectedText}”`
        );
        out.push(`    - **Q1**: ${thread.question}`);
        out.push(`    - **A1**: ${thread.answer.replace(/\n+/g, " ")}`);
        thread.evidences.forEach((ev) => {
          out.push(
            `      - [证据 · ${ev.unitCode}] (${ev.rationale}): “${ev.quote}”`
          );
        });
        (thread.followUps ?? []).forEach((turn, tIdx) => {
          out.push(`    - **Q${tIdx + 2}**: ${turn.question}`);
          out.push(`    - **A${tIdx + 2}**: ${turn.answer.replace(/\n+/g, " ")}`);
          turn.evidences.forEach((ev) => {
            out.push(
              `      - [证据 · ${ev.unitCode}] (${ev.rationale}): “${ev.quote}”`
            );
          });
        });
      });
    }
  }
  pushSectionRecall(currentSectionId);

  const pendingUnits = doc.units.filter((u) => {
    const s = annotations?.unitUnderstanding?.[u.id];
    return s === "fuzzy" || s === "confused";
  });
  if (pendingUnits.length > 0) {
    out.push("");
    out.push("## 待攻克清单（标记为模糊与不懂的单元）");
    pendingUnits.forEach((u) => {
      const s = annotations?.unitUnderstanding?.[u.id];
      out.push(`- **[${u.unitCode} · ${s}]** ${u.tldr}`);
    });
  }

  out.push("");
  out.push(`## ${doc.bottomTitle}`);
  if (doc.bottomSubtitle) out.push(doc.bottomSubtitle);
  for (const block of doc.bottomBlocks) {
    out.push("");
    out.push(...formatBottomBlockToMarkdown(block, annotations));
  }

  if (!doc.bottomBlocks.some((b) => b.type === "review-schedule")) {
    const base = new Date();
    out.push("");
    out.push("## 间隔复习计划 (Day 1 / 3 / 7 / 21)");
    [1, 3, 7, 21].forEach((d) => {
      const dt = new Date(base.getTime() + d * 86400_000).toISOString().slice(0, 10);
      out.push(`- **Day ${d} (${dt})**: 闭卷画出结构图 + 重做交错自测 + 清理待攻克清单。`);
    });
  }

  return out.join("\n").trim() + "\n";
}
