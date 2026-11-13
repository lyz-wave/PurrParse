/**
 * Prism Workbench Core Document AST
 * Invariant data contract shared across all plugins, streaming engine, UI renderer, and exporters.
 */

export type UnitWeight = "core" | "support" | "transition";

export type UnderstandingStatus = "unmarked" | "understood" | "fuzzy" | "confused";

export type ConfidenceLevel = "low" | "medium" | "high";

export type HighlightDimensionKey = "dim1" | "dim2" | "dim3" | "dim4" | "dim5";

export type ColorSlot = "yellow" | "red" | "blue" | "green" | "purple";

export interface DimensionSpec {
  key: HighlightDimensionKey;
  colorSlot: ColorSlot;
  label: string;
  extractionRule: string;
  enableTooltip?: boolean;
}

export interface HighlightSpan {
  text: string;
  dim: HighlightDimensionKey;
  tooltip?: string;
}

export interface FormulaBlock {
  latex: string;
  flowLabel?: string;
  flowText?: string;
}

export interface FigureBlock {
  label?: string;
  caption: string;
  imageUrls: string[];
}

export interface DataTableBlock {
  headers: string[];
  rows: string[][];
}

export interface CalloutListBlock {
  title: string;
  items: string[];
}

export interface AnnotationModuleItem {
  label: string;
  body: string;
  echoTargetId?: string;
  echoLabel?: string;
  calloutBox?: string;
}

export interface WorkbenchUnit {
  id: string;
  unitCode: string;
  sectionId: string;
  sectionTitle: string;
  sectionTask?: string;
  weight: UnitWeight;
  tldr: string;
  primaryKind: "prose" | "code";
  codeLanguage?: string;
  filePath?: string;
  primaryText: string;
  formulas?: FormulaBlock[];
  figures?: FigureBlock[];
  dataTable?: DataTableBlock;
  calloutList?: CalloutListBlock;
  highlights: HighlightSpan[];
  secondaryBlockText: string;
  notes: AnnotationModuleItem[];
  transitionSummary?: string;
  predictPrompt?: string;
  selfExplainPrompt?: { question: string; answer: string };
  misconceptionCallout?: string;
  firstPassRecommended?: boolean;
}

export interface DiagramNode {
  id: string;
  label: string;
  subLabel?: string;
  targetUnitId?: string;
  colorSlot?: ColorSlot | "navy";
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramGraph {
  title: string;
  hint: string;
  rankdir?: "LR" | "TB";
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface TopMentalCard {
  tag: string;
  body: string;
}

export interface ComparisonPair {
  leftTitle: string;
  leftTone: "danger" | "neutral";
  leftItems: string[];
  rightTitle: string;
  rightTone: "success" | "neutral";
  rightItems: string[];
}

export interface GlossaryItem {
  term: string;
  badge?: string;
  definition: string;
}

export interface PretestItem {
  id: string;
  question: string;
  answer: string;
  targetUnitId?: string;
}

export interface FadedExampleItem {
  level: 1 | 2 | 3;
  label: string;
  prompt: string;
  walkthrough: string;
  answer?: string;
}

export interface DesignChoiceRow {
  decision: string;
  alternatives: string;
  rationale: string;
  ablationOrProof: string;
  anchor: string;
}

export interface PrerequisiteItem {
  concept: string;
  whyNeeded: string;
  level: string;
  quickPrimer: string;
  anchor?: string;
}

export interface ReadingPathPlan {
  pass1Summary: string;
  pass2Summary: string;
  pass3Summary: string;
  recommendedUnitIds: string[];
}

export interface TopMentalModel {
  title: string;
  subtitle: string;
  rawSummaryBanner?: {
    tag: string;
    body: string;
  };
  oneSentenceSkeleton?: string;
  cards: TopMentalCard[];
  comparisonPair?: ComparisonPair;
  diagram: DiagramGraph;
  glossaryTitle: string;
  glossary: GlossaryItem[];
  pretestItems?: PretestItem[];
  prerequisiteMap?: PrerequisiteItem[];
  readingPath?: ReadingPathPlan;
  fadedExamples?: FadedExampleItem[];
  designChoices?: DesignChoiceRow[];
}

export interface SectionSummaryData {
  established: string;
  openQuestions: string;
  rhetoricStrategy: string;
  referenceRecall: string;
  reviewerCritique: string;
  socraticQuestions: Array<{
    category: string;
    question: string;
    answer: string;
  }>;
}

export interface SectionAnchor {
  id: string;
  navLabel: string;
  navRole?: string;
  title: string;
  taskBadge: string;
  summary?: SectionSummaryData;
}

export type BottomArsenalBlock =
  | {
      type: "flow-skeleton";
      title?: string;
      steps: Array<{ tag: string; body: string }>;
    }
  | {
      type: "statement-banner";
      tag: string;
      body: string;
    }
  | {
      type: "comparison-pair";
      left: { tag: string; body: string; tone: "success" | "danger" };
      right: { tag: string; body: string; tone: "success" | "danger" };
    }
  | {
      type: "socratic-qa";
      title: string;
      items: Array<{
        id?: string;
        cognitiveLevel?: string;
        question: string;
        answer: string;
      }>;
    }
  | {
      type: "claim-evidence-table";
      title: string;
      rows: Array<{
        claimId: string;
        claim: string;
        evidenceAnchor: string;
        limitation: string;
        unverifiedGap: string;
      }>;
    }
  | {
      type: "prior-work-table";
      title: string;
      rows: Array<{
        priorWork: string;
        claimedDifference: string;
        anchor: string;
        infoGap: string;
      }>;
    }
  | {
      type: "first-principles-list";
      title: string;
      items: Array<{
        premise: string;
        ifViolated: string;
        basis: string;
      }>;
    }
  | {
      type: "feynman-challenge";
      title: string;
      prompt: string;
      referenceExplanation: string;
      laypersonQuestions: string[];
    }
  | {
      type: "review-schedule";
      title: string;
      startDate?: string;
      tasks: string[];
    }
  | {
      type: "purpose-tailored";
      title: string;
      purposeLabel: string;
      items: Array<{ tag: string; body: string }>;
    }
  | {
      type: "aphorism-list";
      title: string;
      items: Array<{ en: string; zh: string }>;
    }
  | {
      type: "journal-prompts";
      title: string;
      items: Array<{ id: string; label: string; hint: string; placeholder: string }>;
    }
  | {
      type: "checklist";
      title: string;
      items: Array<{ id: string; tag: string; text: string }>;
    }
  | {
      type: "star-bullets";
      title: string;
      versions: Array<{ versionLabel: string; summary: string; bullets: string[] }>;
    }
  | {
      type: "ownership-blueprints";
      title: string;
      plans: Array<{
        title: string;
        timeEstimate: string;
        targetFiles: string;
        changeSteps: string;
        benchmarkMetric: string;
        interviewPitch: string;
      }>;
    }
  | {
      type: "before-after-diff";
      title: string;
      description: string;
      defaultBeforeCode: string;
      defaultAfterCode: string;
      defaultBenchmarkNote: string;
    };

export type MasteryStageKey = "struggling" | "review_due" | "unread" | "mastered";

export interface LibraryTaxonomyMeta {
  domainCategory: string;
  paradigmType: string;
  tags: string[];
  pinned?: boolean;
  organizedAt?: string;
}

export interface WorkbenchDocument {
  id: string;
  modeId: string;
  modeName: string;
  title: string;
  subtitle: string;
  badges: string[];
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
  libraryMeta?: LibraryTaxonomyMeta;
  layoutRatio: [number, number];
  dimensions: [DimensionSpec, DimensionSpec, DimensionSpec, DimensionSpec, DimensionSpec];
  labels: {
    paretoButton: string;
    toggleSecondaryButton: string;
    toggleNotesButton: string;
    exportMdButton: string;
    exportHtmlButton: string;
    userNoteButton: string;
    userNotePlaceholder: string;
    transitionPrefix: string;
    mentalNavLabel: string;
    bottomNavLabel: string;
  };
  topMentalModel: TopMentalModel;
  sections: SectionAnchor[];
  units: WorkbenchUnit[];
  bottomTitle: string;
  bottomSubtitle?: string;
  bottomBlocks: BottomArsenalBlock[];
  completionChecklist?: {
    modeDescription: string;
    unitCount: number;
    formulaOrTableCount: number;
    sectionCount: number;
    inconsistencies: string[];
    manualVerifyHints: string[];
  };
}

export type QaScope = "paragraph" | "document";

export interface QaEvidenceItem {
  unitCode: string;
  unitId?: string;
  quote: string;
  rationale: string;
}

export interface QaFollowUpTurn {
  id: string;
  question: string;
  scope: QaScope;
  answer: string;
  evidences: QaEvidenceItem[];
  createdAt: string;
}

export interface UnitQaThread {
  id: string;
  unitId: string;
  unitCode: string;
  selectedText: string;
  question: string;
  scope: QaScope;
  answer: string;
  evidences: QaEvidenceItem[];
  followUps?: QaFollowUpTurn[];
  createdAt: string;
}

export interface UserAnnotationsState {
  unitNotes: Record<string, string>;
  journalAnswers: Record<string, string>;
  checklistStates: Record<string, boolean>;
  beforeAfterDiff?: {
    beforeCode: string;
    afterCode: string;
    benchmarkNote: string;
  };
  unitUnderstanding?: Record<string, UnderstandingStatus>;
  unitPredictionAnswers?: Record<string, string>;
  unitNotesUnlocked?: Record<string, boolean>;
  pretestAnswers?: Record<string, { answer: string; confidence: ConfidenceLevel }>;
  sectionRecallAnswers?: Record<string, { text: string; submitted: boolean }>;
  socraticAnswers?: Record<string, { answer: string; confidence: ConfidenceLevel }>;
  feynmanEssay?: string;
  unitQaThreads?: Record<string, UnitQaThread[]>;
}
