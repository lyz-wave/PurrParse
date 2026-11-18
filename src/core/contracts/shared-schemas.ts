import { z } from "zod";
import type { DataTableBlock, FigureBlock } from "./document-ast";

const optString = z
  .string()
  .nullish()
  .transform((v) => (v == null || v === "" ? undefined : v));

const UnitWeightSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.enum(["core", "support", "transition"]).catch("support")
);

const DimKeySchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.enum(["dim1", "dim2", "dim3", "dim4", "dim5"]).catch("dim1")
);

const ColorSlotNullableSchema = z
  .enum(["yellow", "red", "blue", "green", "purple", "navy"])
  .nullish()
  .transform((v) => v ?? undefined);

export const HighlightSpanSchema = z.object({
  text: z.string().min(1),
  dim: DimKeySchema,
  tooltip: optString,
});

export const DiagramGraphSchema = z.object({
  title: z.string(),
  hint: z.string(),
  rankdir: z
    .enum(["LR", "TB"])
    .nullish()
    .transform((v) => v ?? undefined),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      subLabel: optString,
      targetUnitId: optString,
      colorSlot: ColorSlotNullableSchema,
    })
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      label: optString,
    })
  ),
});

export const SectionSummarySchema = z.object({
  established: z.string(),
  openQuestions: z.string(),
  rhetoricStrategy: z.string(),
  referenceRecall: z.string(),
  reviewerCritique: z.string(),
  socraticQuestions: z
    .array(
      z.object({
        category: z.string(),
        question: z.string(),
        answer: z.string(),
      })
    )
    .catch([]),
});

export const SectionAnchorSchema = z.object({
  id: z.string(),
  navLabel: z.string(),
  navRole: optString,
  title: z.string(),
  taskBadge: z.string(),
  summary: SectionSummarySchema.nullish().transform((v) => v ?? undefined),
});

export const TopModelBaseSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  badges: z.array(z.string()).catch([]),
  globalContextSummary: z.string(),
  topMentalModel: z.object({
    title: z.string(),
    subtitle: z.string(),
    rawSummaryBanner: z
      .object({
        tag: z.string(),
        body: z.string(),
      })
      .nullish()
      .transform((v) => v ?? undefined),
    oneSentenceSkeleton: optString,
    cards: z
      .array(
        z.object({
          tag: z.string().catch("核心维度"),
          body: z.string().catch(""),
        })
      )
      .nullish()
      .transform((v) => v ?? [])
      .catch([]),
    comparisonPair: z
      .object({
        leftTitle: z.string(),
        leftTone: z.enum(["danger", "neutral"]).nullish().transform((v) => v ?? "danger"),
        leftItems: z.array(z.string()),
        rightTitle: z.string(),
        rightTone: z.enum(["success", "neutral"]).nullish().transform((v) => v ?? "success"),
        rightItems: z.array(z.string()),
      })
      .nullish()
      .transform((v) => v ?? undefined),
    diagram: DiagramGraphSchema,
    glossaryTitle: z.string(),
    glossary: z
      .array(
        z.object({
          term: z.string(),
          badge: optString,
          definition: z.string(),
        })
      )
      .catch([]),
    pretestItems: z
      .array(
        z.object({
          id: z.string(),
          question: z.string(),
          answer: z.string(),
          targetUnitId: optString,
        })
      )
      .nullish()
      .transform((v) => v ?? undefined),
    prerequisiteMap: z
      .array(
        z.object({
          concept: z.string(),
          whyNeeded: z.string(),
          level: z.string(),
          quickPrimer: z.string(),
          anchor: optString,
        })
      )
      .nullish()
      .transform((v) => v ?? undefined),
    readingPath: z
      .object({
        pass1Summary: z.string(),
        pass2Summary: z.string(),
        pass3Summary: z.string(),
        recommendedUnitIds: z.array(z.string()).catch([]),
      })
      .nullish()
      .transform((v) => v ?? undefined),
    fadedExamples: z
      .array(
        z.object({
          level: z
            .union([z.literal(1), z.literal(2), z.literal(3)])
            .catch(1),
          label: z.string(),
          prompt: z.string(),
          walkthrough: z.string(),
          answer: optString,
        })
      )
      .nullish()
      .transform((v) => v ?? undefined),
    designChoices: z
      .array(
        z.object({
          decision: z.string(),
          alternatives: z.string(),
          rationale: z.string(),
          ablationOrProof: z.string(),
          anchor: z.string(),
        })
      )
      .nullish()
      .transform((v) => v ?? undefined),
  }),
  sections: z.array(SectionAnchorSchema).catch([]),
});

export const AnnotatedUnitBaseSchema = z.object({
  unitId: z.string(),
  weight: UnitWeightSchema,
  tldr: z.string(),
  secondaryBlockText: z.string(),
  tensorOrStateFlow: optString,
  highlights: z.array(HighlightSpanSchema).catch([]),
  notes: z
    .array(
      z.object({
        body: z.string(),
        echoTargetId: optString,
        echoLabel: optString,
        calloutBox: optString,
      })
    )
    .catch([]),
  transitionSummary: optString,
  predictPrompt: optString,
  selfExplainPrompt: z
    .object({
      question: z.string(),
      answer: z.string(),
    })
    .nullish()
    .transform((v) => v ?? undefined),
  misconceptionCallout: optString,
  firstPassRecommended: z
    .boolean()
    .nullish()
    .transform((v) => v ?? undefined),
});

export const BatchUnitsBaseSchema = z.object({
  units: z.array(AnnotatedUnitBaseSchema),
});

export const BottomArsenalBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("flow-skeleton"),
    title: optString,
    steps: z.array(z.object({ tag: z.string(), body: z.string() })),
  }),
  z.object({
    type: z.literal("statement-banner"),
    tag: z.string(),
    body: z.string(),
  }),
  z.object({
    type: z.literal("comparison-pair"),
    left: z.object({
      tag: z.string(),
      body: z.string(),
      tone: z.enum(["success", "danger"]).nullish().transform((v) => v ?? "success"),
    }),
    right: z.object({
      tag: z.string(),
      body: z.string(),
      tone: z.enum(["success", "danger"]).nullish().transform((v) => v ?? "danger"),
    }),
  }),
  z.object({
    type: z.literal("socratic-qa"),
    title: z.string(),
    items: z.array(
      z.object({
        id: optString,
        cognitiveLevel: optString,
        question: z.string(),
        answer: z.string(),
      })
    ),
  }),
  z.object({
    type: z.literal("claim-evidence-table"),
    title: z.string(),
    rows: z.array(
      z.object({
        claimId: z.string(),
        claim: z.string(),
        evidenceAnchor: z.string(),
        limitation: z.string(),
        unverifiedGap: z.string(),
      })
    ),
  }),
  z.object({
    type: z.literal("prior-work-table"),
    title: z.string(),
    rows: z.array(
      z.object({
        priorWork: z.string(),
        claimedDifference: z.string(),
        anchor: z.string(),
        infoGap: z.string(),
      })
    ),
  }),
  z.object({
    type: z.literal("first-principles-list"),
    title: z.string(),
    items: z.array(
      z.object({
        premise: z.string(),
        ifViolated: z.string(),
        basis: z.string(),
      })
    ),
  }),
  z.object({
    type: z.literal("feynman-challenge"),
    title: z.string(),
    prompt: z.string(),
    referenceExplanation: z.string(),
    laypersonQuestions: z.array(z.string()).catch([]),
  }),
  z.object({
    type: z.literal("review-schedule"),
    title: z.string(),
    startDate: optString,
    tasks: z.array(z.string()).catch([]),
  }),
  z.object({
    type: z.literal("purpose-tailored"),
    title: z.string(),
    purposeLabel: z.string(),
    items: z.array(z.object({ tag: z.string(), body: z.string() })),
  }),
  z.object({
    type: z.literal("aphorism-list"),
    title: z.string(),
    items: z.array(z.object({ en: z.string(), zh: z.string() })),
  }),
  z.object({
    type: z.literal("journal-prompts"),
    title: z.string(),
    items: z.array(
      z.object({
        id: z
          .string()
          .nullish()
          .transform((v) => v ?? `prompt-${Math.random().toString(36).slice(2, 7)}`),
        label: z.string(),
        hint: z.string().nullish().transform((v) => v ?? ""),
        placeholder: z.string().nullish().transform((v) => v ?? ""),
      })
    ),
  }),
  z.object({
    type: z.literal("checklist"),
    title: z.string(),
    items: z.array(
      z.object({
        id: z
          .string()
          .nullish()
          .transform((v) => v ?? `chk-${Math.random().toString(36).slice(2, 7)}`),
        tag: z.string(),
        text: z.string(),
      })
    ),
  }),
  z.object({
    type: z.literal("star-bullets"),
    title: z.string(),
    versions: z.array(
      z.object({
        versionLabel: z.string(),
        summary: z.string(),
        bullets: z.array(z.string()),
      })
    ),
  }),
  z.object({
    type: z.literal("ownership-blueprints"),
    title: z.string(),
    plans: z.array(
      z.object({
        title: z.string(),
        timeEstimate: z.string(),
        targetFiles: z.string(),
        changeSteps: z.string(),
        benchmarkMetric: z.string(),
        interviewPitch: z.string(),
      })
    ),
  }),
  z.object({
    type: z.literal("before-after-diff"),
    title: z.string(),
    description: z.string(),
    defaultBeforeCode: z.string(),
    defaultAfterCode: z.string(),
    defaultBenchmarkNote: z.string(),
  }),
]);

export const BottomStepBaseSchema = z.object({
  bottomTitle: z.string(),
  bottomSubtitle: optString,
  bottomBlocks: z.array(BottomArsenalBlockSchema),
});

/**
 * Shared helper used by plugins to hydrate a WorkbenchUnit cleanly without duplicating mapping logic.
 */
export function buildHydratedUnit(
  source: {
    id: string;
    unitCode: string;
    sectionId: string;
    sectionTitle: string;
    sectionTask?: string;
    primaryKind: "prose" | "code";
    codeLanguage?: string;
    rawPrimaryText: string;
    metadata?: {
      filePath?: string;
      formulas?: string[];
      figures?: FigureBlock[];
      dataTable?: DataTableBlock;
    };
  },
  annotation: z.infer<typeof AnnotatedUnitBaseSchema>,
  moduleLabels: [string, string, string, string]
) {
  const formulas =
    source.metadata?.formulas?.map((latex, idx) => ({
      latex,
      flowLabel: idx === 0 && annotation.tensorOrStateFlow ? "TENSOR / STATE FLOW" : undefined,
      flowText: idx === 0 ? annotation.tensorOrStateFlow : undefined,
    })) ??
    (annotation.tensorOrStateFlow && source.primaryKind === "prose"
      ? [{ latex: "", flowLabel: "TENSOR / STATE FLOW", flowText: annotation.tensorOrStateFlow }]
      : undefined);

  return {
    id: source.id,
    unitCode: source.unitCode,
    sectionId: source.sectionId,
    sectionTitle: source.sectionTitle,
    sectionTask: source.sectionTask,
    weight: annotation.weight,
    tldr: annotation.tldr,
    primaryKind: source.primaryKind,
    codeLanguage: source.codeLanguage,
    filePath: source.metadata?.filePath,
    primaryText: source.rawPrimaryText,
    formulas: formulas?.filter((f) => f.latex || f.flowText),
    figures: source.metadata?.figures,
    dataTable: source.metadata?.dataTable,
    highlights: annotation.highlights,
    secondaryBlockText: annotation.secondaryBlockText,
    notes: annotation.notes.map((n, idx) => ({
      label: moduleLabels[idx] ?? `0${idx + 1} / 深度批注`,
      body: n.body,
      echoTargetId: n.echoTargetId,
      echoLabel: n.echoLabel,
      calloutBox: n.calloutBox,
    })),
    transitionSummary: annotation.transitionSummary,
    predictPrompt:
      annotation.predictPrompt ??
      (annotation.weight === "core"
        ? `先合上右栏想一想：本单元（${source.unitCode}）试图解决什么矛盾，或为什么非得这样设计？`
        : undefined),
    selfExplainPrompt:
      annotation.weight === "transition" ? undefined : annotation.selfExplainPrompt,
    misconceptionCallout:
      annotation.weight === "transition"
        ? undefined
        : annotation.misconceptionCallout?.replace(/^\s*\[易误解\]\s*:?\s*/, "").trim() || undefined,
    firstPassRecommended:
      annotation.firstPassRecommended ?? (annotation.weight === "core" ? true : undefined),
  };
}
