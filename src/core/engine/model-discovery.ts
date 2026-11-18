import type { LLMProviderId } from "./llm-adapters";

export interface DiscoveredModelItem {
  id: string;
  label?: string;
  source: "remote" | "preset";
}

export const PRESET_MODELS_BY_PROVIDER: Record<LLMProviderId, string[]> = {
  google: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  openai: ["gpt-4o-mini", "gpt-4o", "o3-mini", "gpt-4.1-mini"],
  anthropic: [
    "claude-3-7-sonnet-latest",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
  ],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  custom: ["qwen-plus", "qwen-max", "deepseek-chat", "llama3.1:8b"],
};

function normalizeBase(raw?: string): string | undefined {
  const trimmed = raw?.trim().replace(/\/+$/, "");
  return trimmed || undefined;
}

function validateHttpUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Base URL 仅支持 http:// 或 https:// 协议");
  }
  return parsed;
}

function buildModelsUrl(baseUrl: string, appendV1IfMissing: boolean): string {
  const clean = baseUrl.replace(/\/+$/, "");
  if (
    !appendV1IfMissing ||
    clean.endsWith("/v1") ||
    clean.endsWith("/v1beta") ||
    clean.endsWith("/v1alpha")
  ) {
    return `${clean}/models`;
  }
  return `${clean}/v1/models`;
}

function parseOpenAiCompatibleModels(payload: unknown): DiscoveredModelItem[] {
  const list = (payload as { data?: Array<{ id?: unknown }> })?.data;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const items: DiscoveredModelItem[] = [];
  for (const entry of list) {
    if (typeof entry?.id !== "string") continue;
    const id = entry.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    items.push({ id, source: "remote" });
  }
  return items.sort((a, b) => a.id.localeCompare(b.id));
}

function parseGoogleModels(payload: unknown): DiscoveredModelItem[] {
  const list = (
    payload as {
      models?: Array<{
        name?: unknown;
        displayName?: unknown;
        supportedGenerationMethods?: unknown;
      }>;
    }
  )?.models;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const items: DiscoveredModelItem[] = [];
  for (const entry of list) {
    if (typeof entry?.name !== "string") continue;
    if (
      Array.isArray(entry.supportedGenerationMethods) &&
      !entry.supportedGenerationMethods.includes("generateContent")
    ) {
      continue;
    }
    const id = entry.name.replace(/^models\//, "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const displayName =
      typeof entry.displayName === "string" ? entry.displayName.trim() : undefined;
    items.push({
      id,
      label: displayName && displayName !== id ? displayName : undefined,
      source: "remote",
    });
  }
  return items.sort((a, b) => a.id.localeCompare(b.id));
}

function parseAnthropicModels(payload: unknown): DiscoveredModelItem[] {
  const list = (payload as { data?: Array<{ id?: unknown; display_name?: unknown }> })?.data;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const items: DiscoveredModelItem[] = [];
  for (const entry of list) {
    if (typeof entry?.id !== "string") continue;
    const id = entry.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label =
      typeof entry.display_name === "string" ? entry.display_name.trim() : undefined;
    items.push({
      id,
      label: label && label !== id ? label : undefined,
      source: "remote",
    });
  }
  return items.sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchJsonWithTimeout(url: string, headers: Record<string, string>): Promise<unknown> {
  validateHttpUrl(url);
  const res = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(bodyText) as { error?: { message?: string }; message?: string };
      detail = parsed?.error?.message || parsed?.message || "";
    } catch {
      detail = bodyText.slice(0, 140);
    }
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

export async function fetchProviderModels(params: {
  provider: LLMProviderId;
  apiKey?: string;
  baseUrl?: string;
}): Promise<DiscoveredModelItem[]> {
  const provider = params.provider;
  const apiKey = params.apiKey?.trim() ?? "";
  const customBase = normalizeBase(params.baseUrl);

  if (!apiKey && !(provider === "custom" && customBase)) {
    throw new Error("请先填写 API Key 再拉取线上可用模型列表（Custom 本地网关可直接填 Base URL 后检索）");
  }

  if (provider === "google") {
    const base = customBase || "https://generativelanguage.googleapis.com/v1beta";
    const url = buildModelsUrl(base, false);
    const data = await fetchJsonWithTimeout(url, {
      "x-goog-api-key": apiKey,
    });
    return parseGoogleModels(data);
  }

  if (provider === "anthropic") {
    const base = customBase || "https://api.anthropic.com/v1";
    const url = buildModelsUrl(base, true);
    const data = await fetchJsonWithTimeout(url, {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    });
    return parseAnthropicModels(data);
  }

  const defaultBase =
    provider === "deepseek" ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1";
  const effectiveBase = customBase || defaultBase;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const primaryUrl = buildModelsUrl(effectiveBase, true);
  try {
    const data = await fetchJsonWithTimeout(primaryUrl, headers);
    return parseOpenAiCompatibleModels(data);
  } catch (err) {
    // Some gateways expose /models directly at base path without /v1 prefix
    const fallbackUrl = `${effectiveBase}/models`;
    if (customBase && fallbackUrl !== primaryUrl) {
      const data = await fetchJsonWithTimeout(fallbackUrl, headers);
      return parseOpenAiCompatibleModels(data);
    }
    throw err;
  }
}
