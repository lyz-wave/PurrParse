import type { WorkbenchDocument } from "@/core/contracts/document-ast";
import { PluginRegistry } from "@/core/registry/plugin-registry";
import { academicPaperPlugin } from "@/plugins/academic-paper";
import { ATTENTION_DEMO_DOCUMENT } from "@/plugins/academic-paper/demo-data";
import { cognitiveEssayPlugin } from "@/plugins/cognitive-essay";
import { DANKOE_DEMO_DOCUMENT } from "@/plugins/cognitive-essay/demo-data";
import { repoDeconstructPlugin } from "@/plugins/repo-deconstruct";
import { ASYNCFLOW_DEMO_DOCUMENT } from "@/plugins/repo-deconstruct/demo-data";

export function createDefaultPluginRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  registry
    .register(academicPaperPlugin)
    .register(cognitiveEssayPlugin)
    .register(repoDeconstructPlugin);
  return registry;
}

export const defaultPluginRegistry = createDefaultPluginRegistry();

export const DEMO_DOCUMENTS: WorkbenchDocument[] = [
  ATTENTION_DEMO_DOCUMENT,
  DANKOE_DEMO_DOCUMENT,
  ASYNCFLOW_DEMO_DOCUMENT,
];

export {
  academicPaperPlugin,
  cognitiveEssayPlugin,
  repoDeconstructPlugin,
  ATTENTION_DEMO_DOCUMENT,
  DANKOE_DEMO_DOCUMENT,
  ASYNCFLOW_DEMO_DOCUMENT,
};
