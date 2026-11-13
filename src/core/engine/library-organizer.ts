import type {
  LibraryTaxonomyMeta,
  MasteryStageKey,
  UserAnnotationsState,
  WorkbenchDocument,
} from "@/core/contracts/document-ast";

const DOMAIN_RULES: Array<{ category: string; keywords: string[]; defaultTag: string }> = [
  {
    category: "AI 与序列注意力架构",
    keywords: [
      "transformer",
      "attention",
      "self-attention",
      "multi-head",
      "decoder",
      "encoder",
      "translation",
      "token",
      "seq2seq",
      "neural",
      "llm",
      "diffusion",
      "vit",
    ],
    defaultTag: "大模型与架构",
  },
  {
    category: "智能体与强化学习",
    keywords: [
      "agent",
      "rlhf",
      "reinforcement",
      "policy",
      "reward",
      "reasoning",
      "planning",
      "tool",
      "mcp",
      "swarm",
      "multi-agent",
    ],
    defaultTag: "Agent与决策",
  },
  {
    category: "系统工程与并发源码",
    keywords: [
      "go",
      "rust",
      "kubernetes",
      "workqueue",
      "rate",
      "limiter",
      "mutex",
      "concurrency",
      "scheduler",
      "cache",
      "compiler",
      "runtime",
      "kernel",
      "distributed",
      "git",
      "github",
      "repository",
      "queue",
    ],
    defaultTag: "工程与源码",
  },
  {
    category: "智能建造与工程优化",
    keywords: [
      "building",
      "construction",
      "bim",
      "structural",
      "causal",
      "civil",
      "geometry",
      "optimization",
      "scheduling",
      "mesh",
      "concrete",
      "bridge",
    ],
    defaultTag: "工程优化",
  },
  {
    category: "认知科学与主动学习",
    keywords: [
      "cognitive",
      "mental",
      "learning",
      "memory",
      "feynman",
      "socratic",
      "pareto",
      "thinking",
      "metacognition",
      "reading",
      "认知",
      "思维",
      "学习",
      "心智",
      "记忆",
      "第一性",
    ],
    defaultTag: "认知方法论",
  },
];

export const MASTERY_STAGE_LABELS: Record<MasteryStageKey, string> = {
  struggling: "攻坚中 · 含待解疑点",
  review_due: "待间隔复习",
  unread: "待初读 · 新导入",
  mastered: "已彻底内化",
};

export interface DocumentLearningStats {
  totalUnits: number;
  coreUnits: number;
  understoodCount: number;
  fuzzyOrConfusedCount: number;
  qaCount: number;
  masteryPercent: number;
  stage: MasteryStageKey;
  stageLabel: string;
}

function cleanTagCandidate(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/[：:，,。.;；!！?？/\\|]+/g, " ")
    .trim()
    .slice(0, 18)
    .trim();
}

export function inferDocumentTaxonomy(doc: WorkbenchDocument): LibraryTaxonomyMeta {
  const glossaryText = doc.topMentalModel.glossary
    .map((g) => `${g.term} ${g.definition}`)
    .join(" ");
  const sampleUnits = doc.units
    .slice(0, 8)
    .map((u) => `${u.tldr} ${u.primaryText.slice(0, 220)}`)
    .join(" ");
  const haystack = `${doc.title} ${doc.subtitle} ${doc.modeName} ${doc.badges.join(" ")} ${
    doc.topMentalModel.oneSentenceSkeleton ?? ""
  } ${glossaryText} ${sampleUnits}`.toLowerCase();

  let bestCategory = "综合精读与专题资料";
  let bestScore = 0;
  let bestDefaultTag = "深度精读";

  for (const rule of DOMAIN_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (haystack.includes(kw.toLowerCase())) {
        score += kw.length >= 5 ? 3 : 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
      bestDefaultTag = rule.defaultTag;
    }
  }

  const totalUnits = Math.max(1, doc.units.length);
  const codeUnitCount = doc.units.filter((u) => u.primaryKind === "code").length;
  const formulaCount = doc.units.reduce((sum, u) => sum + (u.formulas?.length ?? 0), 0);
  const tableCount = doc.units.filter((u) => Boolean(u.dataTable)).length;
  const hasExperimentKeywords =
    /benchmark|ablation|bleu|accuracy|dataset|experiment|baseline|table\s+\d|消融|实验|对比/.test(
      haystack
    );
  const hasSurveyKeywords = /survey|review|taxonomy|overview|综述|脉络/.test(haystack);
  const hasTheoryKeywords = /theorem|lemma|proof|proposition|bound|收敛|证明|引理/.test(haystack);

  let paradigmType = "方法与架构创新型";
  if (codeUnitCount / totalUnits >= 0.3) {
    paradigmType = "核心源码与工程实现";
  } else if (hasSurveyKeywords) {
    paradigmType = "综述与脉络梳理型";
  } else if (hasTheoryKeywords && formulaCount >= 2 && !hasExperimentKeywords) {
    paradigmType = "理论推导与数学建模";
  } else if (tableCount >= 2 || (hasExperimentKeywords && formulaCount < 2)) {
    paradigmType = "实证评测与实验型";
  } else if (
    doc.bottomBlocks.some((b) => b.type === "checklist") &&
    formulaCount === 0 &&
    codeUnitCount === 0
  ) {
    paradigmType = "认知方法与思维框架";
  }

  const tagSet = new Set<string>();
  tagSet.add(bestDefaultTag);

  for (const g of doc.topMentalModel.glossary.slice(0, 3)) {
    const cleaned = cleanTagCandidate(g.term);
    if (cleaned.length >= 2) {
      tagSet.add(cleaned);
    }
    if (tagSet.size >= 3) break;
  }

  if (formulaCount > 0 && tagSet.size < 4) tagSet.add("公式推导");
  if (codeUnitCount > 0 && tagSet.size < 4) tagSet.add("源码剖析");
  if (tableCount > 0 && tagSet.size < 4) tagSet.add("实验对比");

  return {
    domainCategory: bestCategory,
    paradigmType,
    tags: Array.from(tagSet).slice(0, 4),
    pinned: doc.libraryMeta?.pinned ?? false,
    organizedAt: new Date().toISOString(),
  };
}

export function computeDocumentLearningStats(
  doc: WorkbenchDocument,
  annotations?: UserAnnotationsState
): DocumentLearningStats {
  const totalUnits = doc.units.length;
  const coreUnits = doc.units.filter((u) => u.weight === "core").length;
  const understandingMap = annotations?.unitUnderstanding ?? {};
  const qaMap = annotations?.unitQaThreads ?? {};

  let understoodCount = 0;
  let fuzzyOrConfusedCount = 0;
  let markedCount = 0;
  let qaCount = 0;

  for (const unit of doc.units) {
    const status = understandingMap[unit.id];
    if (status === "understood") {
      understoodCount++;
      markedCount++;
    } else if (status === "fuzzy" || status === "confused") {
      fuzzyOrConfusedCount++;
      markedCount++;
    }
    const threads = qaMap[unit.id] ?? [];
    for (const t of threads) {
      qaCount += 1 + (t.followUps?.length ?? 0);
    }
  }

  const recallSubmittedCount = Object.values(annotations?.sectionRecallAnswers ?? {}).filter(
    (item) => item?.submitted || Boolean(item?.text?.trim())
  ).length;
  const hasFeynman = Boolean(annotations?.feynmanEssay?.trim());
  const noteCount = Object.values(annotations?.unitNotes ?? {}).filter((v) =>
    Boolean(v?.trim())
  ).length;

  const hasAnyActivity =
    markedCount > 0 || qaCount > 0 || recallSubmittedCount > 0 || hasFeynman || noteCount > 0;

  const baseRatio = totalUnits > 0 ? understoodCount / totalUnits : 0;
  const masteryPercent = Math.min(
    100,
    Math.round(baseRatio * 80 + (hasFeynman ? 12 : 0) + (recallSubmittedCount > 0 ? 8 : 0))
  );

  let stage: MasteryStageKey = "unread";
  if (!hasAnyActivity) {
    stage = "unread";
  } else if (fuzzyOrConfusedCount > 0 || (qaCount > 0 && baseRatio < 0.7)) {
    stage = "struggling";
  } else if (
    (understoodCount >= Math.max(1, coreUnits) && (hasFeynman || recallSubmittedCount > 0)) ||
    masteryPercent >= 85
  ) {
    stage = "mastered";
  } else {
    stage = "review_due";
  }

  return {
    totalUnits,
    coreUnits,
    understoodCount,
    fuzzyOrConfusedCount,
    qaCount,
    masteryPercent,
    stage,
    stageLabel: MASTERY_STAGE_LABELS[stage],
  };
}
