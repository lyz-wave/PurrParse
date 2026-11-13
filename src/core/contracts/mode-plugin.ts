import type { z } from "zod";
import type {
  BottomArsenalBlock,
  DataTableBlock,
  DimensionSpec,
  FigureBlock,
  HighlightDimensionKey,
  SectionAnchor,
  TopMentalModel,
  UnitWeight,
  WorkbenchDocument,
  WorkbenchUnit,
} from "./document-ast";

export type ModeId = "academic-paper" | "cognitive-essay" | "repo-deconstruct" | (string & {});

export interface SourceUnit {
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
}

export interface RawSourcePayload {
  title?: string;
  kind: "text" | "pdf-base64" | "repo-url" | "repo-files" | "remote-url" | "search-query";
  content: string;
  fileName?: string;
  files?: Array<{ path: string; content: string }>;
  readingPurpose?: string;
  userBackground?: string;
  userTopic?: string;
}

export interface AnnotatedUnitOutput {
  unitId: string;
  weight: UnitWeight;
  tldr: string;
  secondaryBlockText: string;
  tensorOrStateFlow?: string;
  highlights: Array<{ text: string; dim: HighlightDimensionKey; tooltip?: string }>;
  notes: Array<{
    body: string;
    echoTargetId?: string;
    echoLabel?: string;
    calloutBox?: string;
  }>;
  transitionSummary?: string;
  predictPrompt?: string;
  selfExplainPrompt?: { question: string; answer: string };
  misconceptionCallout?: string;
  firstPassRecommended?: boolean;
}

export interface TopModelStepOutput {
  title: string;
  subtitle: string;
  badges: string[];
  globalContextSummary: string;
  topMentalModel: TopMentalModel;
  sections: SectionAnchor[];
}

export interface BottomStepOutput {
  bottomTitle: string;
  bottomSubtitle?: string;
  bottomBlocks: BottomArsenalBlock[];
}

export interface WorkbenchModePlugin<
  TTop extends TopModelStepOutput = TopModelStepOutput,
  TBatch extends { units: AnnotatedUnitOutput[] } = { units: AnnotatedUnitOutput[] },
  TBottom extends BottomStepOutput = BottomStepOutput,
> {
  id: ModeId;
  name: string;
  shortLabel: string;
  description: string;
  layoutRatio: [number, number];
  inputConfig: {
    placeholder: string;
    hint: string;
    supportsFileUpload: boolean;
    acceptedFileTypes: string;
    supportsRepoUrl: boolean;
    supportsRemoteUrl?: boolean;
    remoteUrlLabel?: string;
    remoteUrlPlaceholder?: string;
    supportsAgentSearch?: boolean;
    searchLabel?: string;
    searchPlaceholder?: string;
  };
  dimensions: [DimensionSpec, DimensionSpec, DimensionSpec, DimensionSpec, DimensionSpec];
  annotationModuleLabels: [string, string, string, string];
  documentLabels: WorkbenchDocument["labels"];

  preprocessSource(payload: RawSourcePayload): Promise<SourceUnit[]>;

  schemas: {
    topMentalModel: z.ZodType<TTop, z.ZodTypeDef, unknown>;
    batchUnits: z.ZodType<TBatch, z.ZodTypeDef, unknown>;
    bottomWorkbench: z.ZodType<TBottom, z.ZodTypeDef, unknown>;
  };

  buildPrompts: {
    topModelPrompt(
      title: string,
      units: SourceUnit[],
      context?: { readingPurpose?: string; userBackground?: string; userTopic?: string }
    ): string;
    batchUnitsPrompt(
      batch: SourceUnit[],
      globalContextSummary: string,
      allSectionIds: string[]
    ): string;
    bottomWorkbenchPrompt(
      title: string,
      units: SourceUnit[],
      topModel: TTop,
      context?: { readingPurpose?: string; userBackground?: string; userTopic?: string }
    ): string;
  };

  hydrateUnit(source: SourceUnit, annotation: AnnotatedUnitOutput): WorkbenchUnit;

  createHeuristicDocument(title: string, units: SourceUnit[]): WorkbenchDocument;
}
