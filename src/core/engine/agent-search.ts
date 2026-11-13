import { createOpenAI } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";
import type { RawSourcePayload, WorkbenchModePlugin } from "@/core/contracts/mode-plugin";
import { resolveLanguageModel, type LLMConfig } from "./llm-adapters";
import {
  fetchCleanWebPage,
  parseArxivIdentifier,
  searchArxivPapers,
  searchGitHubRepos,
  searchWebPages,
} from "./web-fetchers";

export interface AgentSearchResolution {
  payload: RawSourcePayload;
  resolvedTitle?: string;
  toolTrace: string[];
}

/**
 * Some OpenAI-compatible proxies (including DeepSeek reasoning relays) split
 * assistant reasoning/text into choices[0] and the actual tool_calls into
 * choices[1] without setting finish_reason on choices[0]. Merge all choices
 * back into a single OpenAI choice so AI SDK tool loops execute reliably.
 */
function createMultiChoiceNormalizingFetch(): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return response;
    }

    const rawText = await response.text();
    try {
      const json = JSON.parse(rawText) as {
        choices?: Array<{
          index?: number;
          finish_reason?: string | null;
          message?: {
            role?: string;
            content?: string | null;
            tool_calls?: Array<Record<string, unknown>>;
          };
        }>;
      };

      if (Array.isArray(json.choices) && json.choices.length > 1) {
        const textParts: string[] = [];
        const mergedToolCalls: Array<Record<string, unknown>> = [];
        let finishReason: string | null | undefined;
        let role = "assistant";

        for (const choice of json.choices) {
          const msg = choice.message;
          if (msg?.role) role = msg.role;
          if (typeof msg?.content === "string" && msg.content.trim().length > 0) {
            textParts.push(msg.content);
          }
          if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0) {
            for (const tc of msg.tool_calls) {
              mergedToolCalls.push({
                ...tc,
                index: mergedToolCalls.length,
              });
            }
          }
          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }
        }

        if (mergedToolCalls.length > 0 && !finishReason) {
          finishReason = "tool_calls";
        }

        json.choices = [
          {
            index: 0,
            finish_reason: finishReason ?? "stop",
            message: {
              role,
              content: textParts.length > 0 ? textParts.join("\n") : null,
              ...(mergedToolCalls.length > 0 ? { tool_calls: mergedToolCalls } : {}),
            },
          },
        ];

        const headers = new Headers(response.headers);
        headers.delete("content-length");
        return new Response(JSON.stringify(json), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    } catch {
      // Leave unparseable payloads untouched
    }

    return new Response(rawText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

function resolveToolCapableModel(llmConfig: LLMConfig) {
  if (
    llmConfig.provider === "openai" ||
    llmConfig.provider === "deepseek" ||
    llmConfig.provider === "custom"
  ) {
    const raw = llmConfig.baseUrl?.trim().replace(/\/+$/, "");
    const baseURL = raw
      ? raw.endsWith("/v1") || /\/v\d+(alpha|beta)?$/.test(raw)
        ? raw
        : `${raw}/v1`
      : llmConfig.provider === "deepseek"
        ? "https://api.deepseek.com/v1"
        : undefined;
    const provider = createOpenAI({
      apiKey: llmConfig.apiKey,
      baseURL,
      compatibility: "compatible",
      fetch: createMultiChoiceNormalizingFetch(),
    });
    return provider.chat(llmConfig.model);
  }
  return resolveLanguageModel(llmConfig);
}

function sanitizeResolvedSelection(
  resolvedKind: string,
  content: string,
  plugin: WorkbenchModePlugin
): { resolvedKind: "remote-url" | "repo-url" | "text"; content: string } {
  const trimmed = content.trim();
  const githubMatch = trimmed.match(/https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/);
  if ((resolvedKind === "repo-url" || plugin.inputConfig.supportsRepoUrl) && githubMatch) {
    return { resolvedKind: "repo-url", content: githubMatch[0] };
  }

  const isExplicitArticleText = resolvedKind === "text" && trimmed.length >= 260;
  if (!isExplicitArticleText && plugin.inputConfig.acceptedFileTypes.includes(".pdf")) {
    const arxivId = parseArxivIdentifier(trimmed);
    if (arxivId) {
      return { resolvedKind: "remote-url", content: arxivId };
    }
  }

  if (!isExplicitArticleText && trimmed.length < 500) {
    const urlMatch = trimmed.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/);
    if (urlMatch) {
      return { resolvedKind: "remote-url", content: urlMatch[0] };
    }
  }

  const fallbackKind =
    resolvedKind === "repo-url" || resolvedKind === "text" ? resolvedKind : "remote-url";
  return { resolvedKind: fallbackKind, content: trimmed };
}

export async function resolveSearchQueryWithTools(params: {
  query: string;
  plugin: WorkbenchModePlugin;
  llmConfig?: LLMConfig;
  onProgress?: (message: string) => void;
}): Promise<AgentSearchResolution> {
  const { query, plugin, llmConfig, onProgress } = params;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("请输入搜索关键词、论文标题/arXiv 号或开源项目名称。");
  }

  // Fast direct-route if user pasted a direct arXiv ID / URL or HTTP URL inside the search box
  const directArxivId = parseArxivIdentifier(trimmedQuery);
  if (directArxivId && !plugin.inputConfig.supportsRepoUrl) {
    onProgress?.(`[DIRECT RESOLVE] 识别到 arXiv 编号 ${directArxivId}，直接拉取原文 PDF...`);
    return {
      payload: { kind: "remote-url", content: directArxivId },
      toolTrace: [`direct-arxiv:${directArxivId}`],
    };
  }
  if (/^https?:\/\//i.test(trimmedQuery)) {
    onProgress?.(`[DIRECT RESOLVE] 识别到直达链接 ${trimmedQuery}...`);
    return {
      payload: {
        kind: plugin.inputConfig.supportsRepoUrl ? "repo-url" : "remote-url",
        content: trimmedQuery,
      },
      toolTrace: [`direct-url:${trimmedQuery}`],
    };
  }

  const toolTrace: string[] = [];

  // Agentic Multi-Step Tool-Calling when an API key is configured
  if (llmConfig && llmConfig.apiKey.trim().length > 0) {
    onProgress?.(`[AGENT SEARCH] 大模型正在规划搜索工具检索「${trimmedQuery}」...`);
    const model = resolveToolCapableModel(llmConfig);

    let chosenResolution: {
      resolvedKind: "remote-url" | "repo-url" | "text";
      title: string;
      content: string;
    } | null = null;

    // Keep parameter schemas flat required strings (avoid .optional() / .min() / z.enum)
    // for maximum OpenAI-compatible proxy & DeepSeek tool-calling compatibility.
    const searchTools = {
      searchArxivPapers: tool({
        description:
          "Search arXiv academic papers by title, author, or keywords. Returns arXiv IDs, titles, authors, and abstracts.",
        parameters: z.object({
          query: z.string().describe("English academic search query or paper title"),
        }),
        execute: async ({ query: q }) => {
          toolTrace.push(`searchArxivPapers(${q})`);
          onProgress?.(`[TOOL CALL] 大模型调用 arXiv 检索工具：${q}`);
          return searchArxivPapers(q, 5);
        },
      }),
      searchGitHubRepos: tool({
        description:
          "Search public GitHub open-source repositories by name, topic, or stack keywords.",
        parameters: z.object({
          query: z.string().describe("GitHub search query"),
        }),
        execute: async ({ query: q }) => {
          toolTrace.push(`searchGitHubRepos(${q})`);
          onProgress?.(`[TOOL CALL] 大模型调用 GitHub 检索工具：${q}`);
          return searchGitHubRepos(q, 5);
        },
      }),
      searchWebPages: tool({
        description:
          "Search the web for articles, blog essays, technical talks, transcripts, or documentation pages.",
        parameters: z.object({
          query: z.string().describe("Web search query"),
        }),
        execute: async ({ query: q }) => {
          toolTrace.push(`searchWebPages(${q})`);
          onProgress?.(`[TOOL CALL] 大模型调用网页搜索工具：${q}`);
          return searchWebPages(q, 5);
        },
      }),
      fetchCleanWebPage: tool({
        description:
          "Fetch and extract clean readable text from a discovered web article URL.",
        parameters: z.object({
          url: z.string().describe("Full HTTP/HTTPS URL"),
        }),
        execute: async ({ url }) => {
          toolTrace.push(`fetchCleanWebPage(${url})`);
          onProgress?.(`[TOOL CALL] 大模型抓取网页正文：${url}`);
          const page = await fetchCleanWebPage(url);
          return {
            title: page.title,
            url: page.finalUrl,
            excerpt: page.text.slice(0, 6000),
            totalChars: page.text.length,
          };
        },
      }),
      selectResolvedSource: tool({
        description:
          "Commit the best primary source found for the user's workbench mode once located. For arXiv papers, pass only the bare arXiv ID (e.g. '2106.09685') in content and resolvedKind='remote-url'. For GitHub repos, pass only the exact repo URL in content and resolvedKind='repo-url'.",
        parameters: z.object({
          resolvedKind: z
            .string()
            .describe("One of: remote-url, repo-url, text"),
          title: z.string().describe("Clean title for the resulting workbench"),
          content: z
            .string()
            .describe(
              "Bare arXiv ID (like '2106.09685'), exact GitHub repository URL, exact article URL, or full clean text."
            ),
        }),
        execute: async ({ resolvedKind, title, content }) => {
          const sanitized = sanitizeResolvedSelection(resolvedKind, content, plugin);
          toolTrace.push(`selectResolvedSource(${sanitized.resolvedKind}:${title})`);
          chosenResolution = {
            resolvedKind: sanitized.resolvedKind,
            title,
            content: sanitized.content,
          };
          return {
            accepted: true,
            resolvedKind: sanitized.resolvedKind,
            title,
            content: sanitized.content,
          };
        },
      }),
    };

    try {
      const result = await generateText({
        model,
        maxSteps: 6,
        tools: searchTools,
        prompt: [
          `你是一个精准资料检索 Agent，当前工作台模式为：${plugin.name}（${plugin.description}）。`,
          `用户输入的搜索需求：「${trimmedQuery}」`,
          "请自主调用提供的搜索工具查找最权威的一手源资料：",
          "1. 如果是论文精读，调用 searchArxivPapers 查找精准 arXiv 编号（如 1706.03762 或 2106.09685）；然后调用 selectResolvedSource(resolvedKind='remote-url', title=论文标题, content=arxivId)。",
          "2. 如果是源码拆解，调用 searchGitHubRepos 查找高星匹配仓库；然后调用 selectResolvedSource(resolvedKind='repo-url', title=repoFullName, content=repoUrl)。",
          "3. 如果是认知长文/博客/演讲，调用 searchWebPages 寻找优质文章 URL（可调用 fetchCleanWebPage 验证内容），然后调用 selectResolvedSource(resolvedKind='remote-url', title=文章标题, content=articleUrl) 或 resolvedKind='text'。",
          "务必调用工具完成搜索并通过 selectResolvedSource 提交唯一最佳结果。",
        ].join("\n"),
      });

      if (chosenResolution) {
        const res = chosenResolution as {
          resolvedKind: "remote-url" | "repo-url" | "text";
          title: string;
          content: string;
        };
        return {
          payload: {
            kind: res.resolvedKind,
            title: res.title,
            content: res.content,
          },
          resolvedTitle: res.title,
          toolTrace,
        };
      }

      // If LLM answered with text containing an arXiv ID or URL without invoking selectResolvedSource
      const arxivMatch = result.text.match(/\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/);
      if (arxivMatch && plugin.inputConfig.acceptedFileTypes.includes(".pdf")) {
        return {
          payload: { kind: "remote-url", content: arxivMatch[1] },
          toolTrace: [...toolTrace, `text-arxiv:${arxivMatch[1]}`],
        };
      }
      const ghMatch = result.text.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/);
      if (ghMatch && plugin.inputConfig.supportsRepoUrl) {
        return {
          payload: { kind: "repo-url", content: ghMatch[0] },
          toolTrace: [...toolTrace, `text-github:${ghMatch[0]}`],
        };
      }
    } catch {
      // Fall back cleanly to deterministic search below
    }
  }

  // Offline / Deterministic Fallback Search (works with zero API Key too)
  if (plugin.inputConfig.supportsRepoUrl) {
    onProgress?.(`[OFFLINE SEARCH] 正在搜索 GitHub 仓库：${trimmedQuery}...`);
    const repos = await searchGitHubRepos(trimmedQuery, 3);
    if (repos.length > 0) {
      toolTrace.push(`fallbackGitHub(${repos[0].fullName})`);
      return {
        payload: { kind: "repo-url", title: repos[0].fullName, content: repos[0].url },
        resolvedTitle: repos[0].fullName,
        toolTrace,
      };
    }
  }

  if (plugin.inputConfig.acceptedFileTypes.includes(".pdf")) {
    onProgress?.(`[OFFLINE SEARCH] 正在检索 arXiv 论文库：${trimmedQuery}...`);
    const papers = await searchArxivPapers(trimmedQuery, 3);
    if (papers.length > 0) {
      toolTrace.push(`fallbackArxiv(${papers[0].arxivId})`);
      return {
        payload: { kind: "remote-url", title: papers[0].title, content: papers[0].arxivId },
        resolvedTitle: papers[0].title,
        toolTrace,
      };
    }
  }

  onProgress?.(`[OFFLINE SEARCH] 正在全网检索文章资源：${trimmedQuery}...`);
  const webHits = await searchWebPages(trimmedQuery, 5);
  for (const hit of webHits) {
    try {
      const page = await fetchCleanWebPage(hit.url);
      if (page.text.length >= 260) {
        toolTrace.push(`fallbackWeb(${hit.url})`);
        return {
          payload: { kind: "text", title: page.title || hit.title, content: page.text },
          resolvedTitle: page.title || hit.title,
          toolTrace,
        };
      }
    } catch {
      // Try next hit
    }
  }

  throw new Error(
    `未能在网上检索到足够清晰的「${trimmedQuery}」全文资料，请尝试换用英文关键词、直接填写 arXiv 论文号/URL，或粘贴正文。`
  );
}
