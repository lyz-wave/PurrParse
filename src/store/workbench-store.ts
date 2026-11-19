import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type {
  ConfidenceLevel,
  HighlightDimensionKey,
  LibraryTaxonomyMeta,
  QaFollowUpTurn,
  UnderstandingStatus,
  UnitQaThread,
  UserAnnotationsState,
  WorkbenchDocument,
  WorkbenchUnit,
} from "@/core/contracts/document-ast";
import type { AnalysisSpeedMode } from "@/core/engine/chunk-orchestrator";
import { inferDocumentTaxonomy } from "@/core/engine/library-organizer";
import type { LLMConfig } from "@/core/engine/llm-adapters";
import { DEMO_DOCUMENTS } from "@/plugins";

export type WorkbenchThemeMode = "paper" | "aurora" | "studio";
export type ReadingDepthMode = "pure" | "workbench" | "review";
export type PureLangMode = "original" | "chinese";
export type WorkbenchViewMode = "home" | "reader";
export type AnalysisTaskStatus = "queued" | "running" | "completed" | "error" | "cancelled";

export interface AnalysisTaskItem {
  id: string;
  modeId: string;
  modeName: string;
  title: string;
  sourceLabel: string;
  speedMode: AnalysisSpeedMode;
  status: AnalysisTaskStatus;
  progress: number;
  message: string;
  startedAt: number;
  finishedAt?: number;
  documentId?: string;
  hasPartialDoc?: boolean;
  error?: string;
}

const STORAGE_KEYS = {
  DOCUMENTS: "prism_workbench_docs_v1",
  ANNOTATIONS: "prism_workbench_annotations_v1",
  ACTIVE_DOC_ID: "prism_workbench_active_doc_v1",
  LLM_CONFIG: "prism_workbench_llm_config_v1",
  THEME: "prism_workbench_theme_v1",
  READING_DEPTH: "prism_workbench_reading_depth_v1",
  PURE_LANG: "prism_workbench_pure_lang_v1",
  ONBOARDING_DONE: "purrparse_onboarding_done_v1",
  START_ON_HOME: "purrparse_start_on_home_v1",
  ANALYSIS_SPEED: "purrparse_analysis_speed_v1",
} as const;

const EMPTY_ANNOTATIONS: UserAnnotationsState = {
  unitNotes: {},
  journalAnswers: {},
  checklistStates: {},
  unitQaThreads: {},
};

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

async function persistValue<T>(key: string, value: T): Promise<void> {
  if (!canUseBrowserStorage()) return;
  try {
    await idbSet(key, value);
  } catch {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota errors silently
    }
  }
}

async function readPersistedValue<T>(key: string): Promise<T | undefined> {
  if (!canUseBrowserStorage()) return undefined;
  try {
    const val = await idbGet<T>(key);
    if (val !== undefined) return val;
  } catch {
    // fallback below
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

export interface WorkbenchStoreState {
  hydrated: boolean;
  documents: WorkbenchDocument[];
  activeDocumentId: string;
  annotationsByDocId: Record<string, UserAnnotationsState>;
  llmConfig: LLMConfig;

  // UI Ephemeral Controls
  activeDimFilter: HighlightDimensionKey | null;
  paretoMode: boolean;
  fuzzyOnlyMode: boolean;
  firstPassMode: boolean;
  hideSecondary: boolean;
  hideNotes: boolean;
  autoHideHeader: boolean;
  themeMode: WorkbenchThemeMode;
  readingDepthMode: ReadingDepthMode;
  pureLangMode: PureLangMode;
  viewMode: WorkbenchViewMode;
  startOnHome: boolean;
  backJumpOriginId: string | null;
  flashUnitId: string | null;
  tooltip: TooltipState;
  onboardingOpen: boolean;
  onboardingCompleted: boolean;
  analysisTasks: AnalysisTaskItem[];
  analysisSpeedMode: AnalysisSpeedMode;

  // Actions
  hydrateFromStorage: () => Promise<void>;
  setViewMode: (mode: WorkbenchViewMode) => void;
  toggleStartOnHome: () => void;
  openDocumentForReview: (docId: string) => void;
  openOnboarding: () => void;
  completeOnboarding: () => void;
  setActiveDocument: (id: string) => void;
  upsertDocument: (doc: WorkbenchDocument, options?: { activate?: boolean }) => void;
  replaceDocumentUnits: (docId: string, updatedUnits: WorkbenchUnit[]) => void;
  setAnalysisSpeedMode: (mode: AnalysisSpeedMode) => void;
  addAnalysisTask: (task: AnalysisTaskItem) => void;
  updateAnalysisTask: (taskId: string, patch: Partial<AnalysisTaskItem>) => void;
  removeAnalysisTask: (taskId: string) => void;
  clearFinishedAnalysisTasks: () => void;
  deleteDocument: (id: string) => void;
  resetDemos: () => void;
  autoOrganizeLibrary: (
    overridesByDocId?: Record<string, Partial<LibraryTaxonomyMeta>>
  ) => void;
  updateDocumentLibraryMeta: (docId: string, patch: Partial<LibraryTaxonomyMeta>) => void;
  setLlmConfig: (config: LLMConfig) => void;

  setUnitNote: (docId: string, unitId: string, note: string) => void;
  setJournalAnswer: (docId: string, promptId: string, answer: string) => void;
  toggleChecklistItem: (docId: string, itemId: string) => void;
  setBeforeAfterDiff: (
    docId: string,
    patch: Partial<NonNullable<UserAnnotationsState["beforeAfterDiff"]>>
  ) => void;
  setUnitUnderstanding: (docId: string, unitId: string, status: UnderstandingStatus) => void;
  setUnitPrediction: (docId: string, unitId: string, text: string) => void;
  unlockUnitNotes: (docId: string, unitId: string) => void;
  setPretestAnswer: (
    docId: string,
    itemId: string,
    patch: { answer?: string; confidence?: ConfidenceLevel }
  ) => void;
  setSectionRecall: (
    docId: string,
    sectionId: string,
    patch: { text?: string; submitted?: boolean }
  ) => void;
  setSocraticAnswer: (
    docId: string,
    itemId: string,
    patch: { answer?: string; confidence?: ConfidenceLevel }
  ) => void;
  setFeynmanEssay: (docId: string, text: string) => void;
  addUnitQaThread: (docId: string, unitId: string, thread: UnitQaThread) => void;
  appendUnitQaFollowUp: (
    docId: string,
    unitId: string,
    threadId: string,
    turn: QaFollowUpTurn
  ) => void;
  deleteUnitQaThread: (docId: string, unitId: string, threadId: string) => void;

  toggleDimFilter: (dim: HighlightDimensionKey) => void;
  toggleParetoMode: () => void;
  toggleFuzzyOnlyMode: () => void;
  toggleFirstPassMode: () => void;
  toggleHideSecondary: () => void;
  toggleHideNotes: () => void;
  toggleAutoHideHeader: () => void;
  setThemeMode: (theme: WorkbenchThemeMode) => void;
  setReadingDepthMode: (mode: ReadingDepthMode) => void;
  setPureLangMode: (lang: PureLangMode) => void;

  jumpToUnit: (targetUnitId: string, originUnitId?: string) => void;
  returnToOrigin: () => void;
  showTooltip: (text: string, x: number, y: number) => void;
  hideTooltip: () => void;
}

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "google",
  apiKey: "",
  model: "gemini-2.5-flash",
  baseUrl: "",
};

function scrollElementIntoFocus(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export const useWorkbenchStore = create<WorkbenchStoreState>((set, get) => ({
  hydrated: false,
  documents: DEMO_DOCUMENTS,
  activeDocumentId: DEMO_DOCUMENTS[0].id,
  annotationsByDocId: {},
  llmConfig: DEFAULT_LLM_CONFIG,

  activeDimFilter: null,
  paretoMode: false,
  fuzzyOnlyMode: false,
  firstPassMode: false,
  hideSecondary: false,
  hideNotes: false,
  autoHideHeader: true,
  themeMode: "paper",
  readingDepthMode: "workbench",
  pureLangMode: "original",
  viewMode: "reader",
  startOnHome: true,
  backJumpOriginId: null,
  flashUnitId: null,
  tooltip: { visible: false, text: "", x: 0, y: 0 },
  onboardingOpen: false,
  onboardingCompleted: true,
  analysisTasks: [],
  analysisSpeedMode: "balanced",

  hydrateFromStorage: async () => {
    if (get().hydrated) return;
    const [
      savedDocs,
      savedAnnotations,
      savedActiveId,
      savedLlm,
      savedTheme,
      savedDepth,
      savedPureLang,
      savedOnboardingDone,
      savedStartOnHome,
      savedAnalysisSpeed,
    ] = await Promise.all([
      readPersistedValue<WorkbenchDocument[]>(STORAGE_KEYS.DOCUMENTS),
      readPersistedValue<Record<string, UserAnnotationsState>>(STORAGE_KEYS.ANNOTATIONS),
      readPersistedValue<string>(STORAGE_KEYS.ACTIVE_DOC_ID),
      readPersistedValue<LLMConfig>(STORAGE_KEYS.LLM_CONFIG),
      readPersistedValue<WorkbenchThemeMode>(STORAGE_KEYS.THEME),
      readPersistedValue<ReadingDepthMode>(STORAGE_KEYS.READING_DEPTH),
      readPersistedValue<PureLangMode>(STORAGE_KEYS.PURE_LANG),
      readPersistedValue<boolean>(STORAGE_KEYS.ONBOARDING_DONE),
      readPersistedValue<boolean>(STORAGE_KEYS.START_ON_HOME),
      readPersistedValue<AnalysisSpeedMode>(STORAGE_KEYS.ANALYSIS_SPEED),
    ]);

    const repoDemo = DEMO_DOCUMENTS.find((d) => d.modeId === "repo-deconstruct");
    let docs: WorkbenchDocument[];
    let docsMigrated = false;

    if (savedDocs && savedDocs.length > 0) {
      const hasLegacyAsyncflow = savedDocs.some((d) => d.id === "demo-repo-asyncflow");
      if (hasLegacyAsyncflow && repoDemo) {
        const hasNewRepoDemo = savedDocs.some((d) => d.id === repoDemo.id);
        docs = savedDocs
          .map((d) => (d.id === "demo-repo-asyncflow" ? (hasNewRepoDemo ? null : repoDemo) : d))
          .filter((d): d is WorkbenchDocument => d !== null);
        docsMigrated = true;
      } else {
        docs = savedDocs;
      }
    } else {
      docs = DEMO_DOCUMENTS;
    }

    const mappedSavedActiveId =
      savedActiveId === "demo-repo-asyncflow" && repoDemo ? repoDemo.id : savedActiveId;
    const activeId =
      mappedSavedActiveId && docs.some((d) => d.id === mappedSavedActiveId)
        ? mappedSavedActiveId
        : docs[0].id;
    const validTheme: WorkbenchThemeMode =
      savedTheme === "aurora" || savedTheme === "studio" || savedTheme === "paper"
        ? savedTheme
        : "paper";
    const validDepth: ReadingDepthMode =
      savedDepth === "pure" || savedDepth === "review" || savedDepth === "workbench"
        ? savedDepth
        : "workbench";
    const validPureLang: PureLangMode = savedPureLang === "chinese" ? "chinese" : "original";
    const completed = savedOnboardingDone === true;
    const preferHome = savedStartOnHome !== false;
    const validSpeedMode: AnalysisSpeedMode = savedAnalysisSpeed === "fast" ? "fast" : "balanced";

    set({
      hydrated: true,
      documents: docs,
      activeDocumentId: activeId,
      annotationsByDocId: savedAnnotations ?? {},
      llmConfig: savedLlm ?? DEFAULT_LLM_CONFIG,
      themeMode: validTheme,
      readingDepthMode: validDepth,
      pureLangMode: validPureLang,
      startOnHome: preferHome,
      viewMode: preferHome ? "home" : "reader",
      onboardingCompleted: completed,
      onboardingOpen: !completed,
      analysisSpeedMode: validSpeedMode,
    });

    if (docsMigrated) {
      void persistValue(STORAGE_KEYS.DOCUMENTS, docs);
      if (savedActiveId === "demo-repo-asyncflow") {
        void persistValue(STORAGE_KEYS.ACTIVE_DOC_ID, activeId);
      }
    }
  },

  setViewMode: (viewMode) => {
    set({ viewMode });
  },

  toggleStartOnHome: () => {
    const next = !get().startOnHome;
    set({ startOnHome: next });
    void persistValue(STORAGE_KEYS.START_ON_HOME, next);
  },

  openDocumentForReview: (docId) => {
    set({
      activeDocumentId: docId,
      viewMode: "reader",
      readingDepthMode: "review",
      activeDimFilter: null,
      paretoMode: false,
      fuzzyOnlyMode: false,
      firstPassMode: false,
      backJumpOriginId: null,
    });
    void persistValue(STORAGE_KEYS.ACTIVE_DOC_ID, docId);
    void persistValue(STORAGE_KEYS.READING_DEPTH, "review");
  },

  openOnboarding: () => {
    set({ onboardingOpen: true });
  },

  completeOnboarding: () => {
    set({ onboardingOpen: false, onboardingCompleted: true });
    void persistValue(STORAGE_KEYS.ONBOARDING_DONE, true);
  },

  setActiveDocument: (id) => {
    set({
      activeDocumentId: id,
      viewMode: "reader",
      activeDimFilter: null,
      paretoMode: false,
      fuzzyOnlyMode: false,
      firstPassMode: false,
      backJumpOriginId: null,
    });
    void persistValue(STORAGE_KEYS.ACTIVE_DOC_ID, id);
  },

  upsertDocument: (doc, options) => {
    const activate = options?.activate ?? true;
    const normalizedDoc: WorkbenchDocument = doc.libraryMeta
      ? doc
      : { ...doc, libraryMeta: inferDocumentTaxonomy(doc) };
    const existing = get().documents;
    const idx = existing.findIndex((d) => d.id === normalizedDoc.id);
    const nextDocs =
      idx >= 0
        ? existing.map((d, i) => (i === idx ? normalizedDoc : d))
        : [normalizedDoc, ...existing];

    if (!activate) {
      set({ documents: nextDocs });
      void persistValue(STORAGE_KEYS.DOCUMENTS, nextDocs);
      return;
    }

    set({
      documents: nextDocs,
      activeDocumentId: normalizedDoc.id,
      viewMode: "reader",
      activeDimFilter: null,
      paretoMode: false,
      fuzzyOnlyMode: false,
      firstPassMode: false,
      backJumpOriginId: null,
    });
    void persistValue(STORAGE_KEYS.DOCUMENTS, nextDocs);
    void persistValue(STORAGE_KEYS.ACTIVE_DOC_ID, normalizedDoc.id);
  },

  replaceDocumentUnits: (docId, updatedUnits) => {
    if (updatedUnits.length === 0) return;
    const byId = new Map(updatedUnits.map((u) => [u.id, u]));
    const existing = get().documents;
    const nextDocs = existing.map((doc) => {
      if (doc.id !== docId) return doc;
      const nextUnits = doc.units.map((u) => byId.get(u.id) ?? u);
      return {
        ...doc,
        units: nextUnits,
        updatedAt: new Date().toISOString(),
      };
    });
    set({ documents: nextDocs });
    void persistValue(STORAGE_KEYS.DOCUMENTS, nextDocs);
  },

  setAnalysisSpeedMode: (analysisSpeedMode) => {
    set({ analysisSpeedMode });
    void persistValue(STORAGE_KEYS.ANALYSIS_SPEED, analysisSpeedMode);
  },

  addAnalysisTask: (task) =>
    set((state) => ({
      analysisTasks: [task, ...state.analysisTasks.filter((t) => t.id !== task.id)],
    })),

  updateAnalysisTask: (taskId, patch) =>
    set((state) => ({
      analysisTasks: state.analysisTasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    })),

  removeAnalysisTask: (taskId) =>
    set((state) => ({
      analysisTasks: state.analysisTasks.filter((t) => t.id !== taskId),
    })),

  clearFinishedAnalysisTasks: () =>
    set((state) => ({
      analysisTasks: state.analysisTasks.filter(
        (t) => t.status === "queued" || t.status === "running"
      ),
    })),

  deleteDocument: (id) => {
    const filtered = get().documents.filter((d) => d.id !== id);
    const nextDocs = filtered.length > 0 ? filtered : DEMO_DOCUMENTS;
    const nextActive =
      get().activeDocumentId === id ? nextDocs[0].id : get().activeDocumentId;
    set({
      documents: nextDocs,
      activeDocumentId: nextActive,
    });
    void persistValue(STORAGE_KEYS.DOCUMENTS, nextDocs);
    void persistValue(STORAGE_KEYS.ACTIVE_DOC_ID, nextActive);
  },

  resetDemos: () => {
    const customDocs = get().documents.filter((d) => !d.isDemo && !d.id.startsWith("demo-"));
    const merged = [...DEMO_DOCUMENTS, ...customDocs];
    set({
      documents: merged,
      activeDocumentId: DEMO_DOCUMENTS[0].id,
    });
    void persistValue(STORAGE_KEYS.DOCUMENTS, merged);
    void persistValue(STORAGE_KEYS.ACTIVE_DOC_ID, DEMO_DOCUMENTS[0].id);
  },

  autoOrganizeLibrary: (overridesByDocId) => {
    const nextDocs = get().documents.map((doc) => {
      const baseMeta = inferDocumentTaxonomy(doc);
      const override = overridesByDocId?.[doc.id];
      return {
        ...doc,
        libraryMeta: {
          ...baseMeta,
          ...(override ?? {}),
          pinned: override?.pinned ?? doc.libraryMeta?.pinned ?? baseMeta.pinned ?? false,
          organizedAt: new Date().toISOString(),
        },
      };
    });
    set({ documents: nextDocs });
    void persistValue(STORAGE_KEYS.DOCUMENTS, nextDocs);
  },

  updateDocumentLibraryMeta: (docId, patch) => {
    const nextDocs = get().documents.map((doc) => {
      if (doc.id !== docId) return doc;
      const currentMeta = doc.libraryMeta ?? inferDocumentTaxonomy(doc);
      return {
        ...doc,
        libraryMeta: {
          ...currentMeta,
          ...patch,
        },
      };
    });
    set({ documents: nextDocs });
    void persistValue(STORAGE_KEYS.DOCUMENTS, nextDocs);
  },

  setLlmConfig: (config) => {
    set({ llmConfig: config });
    void persistValue(STORAGE_KEYS.LLM_CONFIG, config);
  },

  setUnitNote: (docId, unitId, note) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const nextState: UserAnnotationsState = {
      ...current,
      unitNotes: { ...current.unitNotes, [unitId]: note },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  setJournalAnswer: (docId, promptId, answer) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const nextState: UserAnnotationsState = {
      ...current,
      journalAnswers: { ...current.journalAnswers, [promptId]: answer },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  toggleChecklistItem: (docId, itemId) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const prevVal = Boolean(current.checklistStates?.[itemId]);
    const nextState: UserAnnotationsState = {
      ...current,
      checklistStates: { ...current.checklistStates, [itemId]: !prevVal },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  setBeforeAfterDiff: (docId, patch) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const existingDiff = current.beforeAfterDiff ?? {
      beforeCode: "",
      afterCode: "",
      benchmarkNote: "",
    };
    const nextState: UserAnnotationsState = {
      ...current,
      beforeAfterDiff: { ...existingDiff, ...patch },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  setUnitUnderstanding: (docId, unitId, status) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const nextState: UserAnnotationsState = {
      ...current,
      unitUnderstanding: { ...(current.unitUnderstanding ?? {}), [unitId]: status },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  setUnitPrediction: (docId, unitId, text) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const nextState: UserAnnotationsState = {
      ...current,
      unitPredictionAnswers: { ...(current.unitPredictionAnswers ?? {}), [unitId]: text },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  unlockUnitNotes: (docId, unitId) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const nextState: UserAnnotationsState = {
      ...current,
      unitNotesUnlocked: { ...(current.unitNotesUnlocked ?? {}), [unitId]: true },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  setPretestAnswer: (docId, itemId, patch) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const existing = current.pretestAnswers?.[itemId] ?? { answer: "", confidence: "medium" as const };
    const nextState: UserAnnotationsState = {
      ...current,
      pretestAnswers: {
        ...(current.pretestAnswers ?? {}),
        [itemId]: { ...existing, ...patch },
      },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  setSectionRecall: (docId, sectionId, patch) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const existing = current.sectionRecallAnswers?.[sectionId] ?? { text: "", submitted: false };
    const nextState: UserAnnotationsState = {
      ...current,
      sectionRecallAnswers: {
        ...(current.sectionRecallAnswers ?? {}),
        [sectionId]: { ...existing, ...patch },
      },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  setSocraticAnswer: (docId, itemId, patch) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const existing = current.socraticAnswers?.[itemId] ?? { answer: "", confidence: "medium" as const };
    const nextState: UserAnnotationsState = {
      ...current,
      socraticAnswers: {
        ...(current.socraticAnswers ?? {}),
        [itemId]: { ...existing, ...patch },
      },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  setFeynmanEssay: (docId, text) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const nextState: UserAnnotationsState = {
      ...current,
      feynmanEssay: text,
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  addUnitQaThread: (docId, unitId, thread) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const existingList = current.unitQaThreads?.[unitId] ?? [];
    const nextState: UserAnnotationsState = {
      ...current,
      unitQaThreads: {
        ...(current.unitQaThreads ?? {}),
        [unitId]: [...existingList, thread],
      },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  appendUnitQaFollowUp: (docId, unitId, threadId, turn) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const existingList = current.unitQaThreads?.[unitId] ?? [];
    const updatedList = existingList.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            followUps: [...(thread.followUps ?? []), turn],
          }
        : thread
    );
    const nextState: UserAnnotationsState = {
      ...current,
      unitQaThreads: {
        ...(current.unitQaThreads ?? {}),
        [unitId]: updatedList,
      },
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  deleteUnitQaThread: (docId, unitId, threadId) => {
    const current = get().annotationsByDocId[docId] ?? EMPTY_ANNOTATIONS;
    const existingList = current.unitQaThreads?.[unitId] ?? [];
    const filtered = existingList.filter((thread) => thread.id !== threadId);
    const nextThreads = { ...(current.unitQaThreads ?? {}) };
    if (filtered.length > 0) {
      nextThreads[unitId] = filtered;
    } else {
      delete nextThreads[unitId];
    }
    const nextState: UserAnnotationsState = {
      ...current,
      unitQaThreads: nextThreads,
    };
    const nextMap = { ...get().annotationsByDocId, [docId]: nextState };
    set({ annotationsByDocId: nextMap });
    void persistValue(STORAGE_KEYS.ANNOTATIONS, nextMap);
  },

  toggleDimFilter: (dim) =>
    set((state) => ({
      activeDimFilter: state.activeDimFilter === dim ? null : dim,
    })),

  toggleParetoMode: () => set((state) => ({ paretoMode: !state.paretoMode })),
  toggleFuzzyOnlyMode: () => set((state) => ({ fuzzyOnlyMode: !state.fuzzyOnlyMode })),
  toggleFirstPassMode: () => set((state) => ({ firstPassMode: !state.firstPassMode })),
  toggleHideSecondary: () => set((state) => ({ hideSecondary: !state.hideSecondary })),
  toggleHideNotes: () => set((state) => ({ hideNotes: !state.hideNotes })),
  toggleAutoHideHeader: () => set((state) => ({ autoHideHeader: !state.autoHideHeader })),
  setThemeMode: (themeMode) => {
    set({ themeMode });
    void persistValue(STORAGE_KEYS.THEME, themeMode);
  },
  setReadingDepthMode: (readingDepthMode) => {
    set({ readingDepthMode });
    void persistValue(STORAGE_KEYS.READING_DEPTH, readingDepthMode);
  },
  setPureLangMode: (pureLangMode) => {
    set({ pureLangMode });
    void persistValue(STORAGE_KEYS.PURE_LANG, pureLangMode);
  },

  jumpToUnit: (targetUnitId, originUnitId) => {
    set({
      backJumpOriginId: originUnitId ?? get().backJumpOriginId,
      flashUnitId: targetUnitId,
    });
    scrollElementIntoFocus(targetUnitId);
    setTimeout(() => {
      if (get().flashUnitId === targetUnitId) {
        set({ flashUnitId: null });
      }
    }, 1800);
  },

  returnToOrigin: () => {
    const origin = get().backJumpOriginId;
    if (!origin) return;
    set({ backJumpOriginId: null, flashUnitId: origin });
    scrollElementIntoFocus(origin);
    setTimeout(() => {
      if (get().flashUnitId === origin) {
        set({ flashUnitId: null });
      }
    }, 1800);
  },

  showTooltip: (text, x, y) => set({ tooltip: { visible: true, text, x, y } }),
  hideTooltip: () =>
    set((state) => (state.tooltip.visible ? { tooltip: { ...state.tooltip, visible: false } } : state)),
}));
