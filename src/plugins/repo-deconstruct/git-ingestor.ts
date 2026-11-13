import type { RawSourcePayload, SourceUnit } from "@/core/contracts/mode-plugin";

export interface RepoFileInput {
  path: string;
  content: string;
}

const IGNORED_PATH_PATTERNS = [
  /(^|\/)(node_modules|\.git|dist|build|\.next|coverage|vendor|__pycache__|\.venv|target)\//i,
  /\.(lock|sum|svg|png|jpe?g|gif|ico|woff2?|ttf|eot|pdf|zip|tar|gz|map|min\.js|min\.css)$/i,
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|go\.sum|Cargo\.lock|poetry\.lock)$/i,
  /(\.test\.|\.spec\.|_test\.go$|__tests__\/|test_[^/]+\.py$)/i,
  /(^|\/)\.(eslintrc|prettierrc|gitignore|editorconfig|dockerignore)/i,
];

const SUPPORTED_CODE_EXTENSIONS: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  go: "go",
  py: "python",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  cpp: "cpp",
  cc: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  rb: "ruby",
  php: "php",
  sql: "sql",
  lua: "lua",
  sh: "bash",
  yaml: "yaml",
  yml: "yaml",
};

const HIGH_SIGNAL_PATH_TOKENS = [
  "main",
  "index",
  "app",
  "server",
  "router",
  "engine",
  "core",
  "scheduler",
  "worker",
  "queue",
  "store",
  "cache",
  "auth",
  "handler",
  "service",
  "controller",
  "state",
  "pipeline",
  "dispatch",
  "broker",
  "pool",
  "lock",
  "lua",
];

export interface ParsedGitHubTarget {
  owner: string;
  repo: string;
  branch?: string;
  subPath?: string;
}

export function parseGitHubUrl(rawUrl: string): ParsedGitHubTarget | null {
  const trimmed = rawUrl.trim();
  // Support shorthand owner/repo or full https://github.com/owner/repo/...
  const shorthandMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthandMatch) {
    return { owner: shorthandMatch[1], repo: shorthandMatch[2].replace(/\.git$/, "") };
  }

  try {
    const url = new URL(trimmed);
    if (!/github\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");
    let branch: string | undefined;
    let subPath: string | undefined;
    if (parts[2] === "tree" && parts.length >= 4) {
      branch = parts[3];
      if (parts.length > 4) {
        subPath = parts.slice(4).join("/");
      }
    }
    return { owner, repo, branch, subPath };
  } catch {
    return null;
  }
}

export function detectCodeLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_CODE_EXTENSIONS[ext] ?? "typescript";
}

export function scoreRepoFile(filePath: string, sizeBytes?: number): number {
  if (IGNORED_PATH_PATTERNS.some((re) => re.test(filePath))) return -1;
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_CODE_EXTENSIONS[ext]) return -1;

  let score = 20;
  const lower = filePath.toLowerCase();
  const depth = filePath.split("/").length;

  for (const token of HIGH_SIGNAL_PATH_TOKENS) {
    if (lower.includes(token)) score += 14;
  }
  if (/^(src|internal|pkg|cmd|app|lib|server|core)\//i.test(filePath)) score += 12;
  if (ext === "yaml" || ext === "yml") score -= 12;
  if (depth <= 3) score += 8;

  if (typeof sizeBytes === "number") {
    if (sizeBytes < 120) score -= 20;
    else if (sizeBytes >= 400 && sizeBytes <= 18000) score += 12;
    else if (sizeBytes > 60000) score -= 18;
  }
  return score;
}

export function selectCoreRepoFiles<T extends { path: string; size?: number }>(
  files: T[],
  maxFiles = 8
): T[] {
  return files
    .map((file) => ({ file, score: scoreRepoFile(file.path, file.size) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles)
    .map((entry) => entry.file);
}

/**
 * Slices a source code file cleanly into top-level logical chunks (functions/classes/blocks)
 * while respecting line budgets and never cutting mid-line.
 */
export function sliceCodeFileIntoUnits(
  filePath: string,
  content: string,
  sectionIndex: number,
  maxLinesPerUnit = 75
): SourceUnit[] {
  const cleanContent = content.replace(/\r\n/g, "\n").trim();
  if (!cleanContent) return [];

  const language = detectCodeLanguage(filePath);
  const lines = cleanContent.split("\n");
  const sectionId = `sec-mod-${sectionIndex}`;
  const fileBase = filePath.split("/").pop() ?? filePath;

  const boundaries: number[] = [0];
  const boundaryRe =
    /^(export\s+)?(async\s+)?(function|class|interface|type)\s+|^(func|type)\s+|^(def|class|async\s+def)\s+|^(pub\s+)?(fn|struct|impl|enum|trait)\s+/;

  for (let i = 1; i < lines.length; i += 1) {
    if (boundaryRe.test(lines[i]) && i - boundaries[boundaries.length - 1] >= 16) {
      boundaries.push(i);
    }
  }

  const rawChunks: Array<{ start: number; end: number; text: string }> = [];
  for (let b = 0; b < boundaries.length; b += 1) {
    const start = boundaries[b];
    const end = b + 1 < boundaries.length ? boundaries[b + 1] : lines.length;
    if (end - start <= maxLinesPerUnit) {
      rawChunks.push({ start, end, text: lines.slice(start, end).join("\n").trim() });
    } else {
      for (let cursor = start; cursor < end; cursor += maxLinesPerUnit) {
        const sliceEnd = Math.min(end, cursor + maxLinesPerUnit);
        rawChunks.push({
          start: cursor,
          end: sliceEnd,
          text: lines.slice(cursor, sliceEnd).join("\n").trim(),
        });
      }
    }
  }

  // Merge tiny trailing chunks (< 8 lines) with previous chunk
  const merged: Array<{ text: string }> = [];
  for (const chunk of rawChunks) {
    if (!chunk.text) continue;
    const lineCount = chunk.text.split("\n").length;
    if (merged.length > 0 && lineCount < 8) {
      merged[merged.length - 1].text = `${merged[merged.length - 1].text}\n\n${chunk.text}`;
    } else {
      merged.push({ text: chunk.text });
    }
  }

  return merged.map((chunk, idx) => ({
    id: `mod-${sectionIndex}-u-${idx + 1}`,
    unitCode: `${fileBase} · Unit ${sectionIndex}.${idx + 1}`,
    sectionId,
    sectionTitle: `${String(sectionIndex).padStart(2, "0")}. ${filePath}`,
    sectionTask: `核心模块拆解 · ${language.toUpperCase()}`,
    primaryKind: "code",
    codeLanguage: language,
    rawPrimaryText: chunk.text,
    metadata: { filePath },
  }));
}

/**
 * Parses pasted text that may contain multiple `// === FILE: path ===` or markdown ```lang code fences
 * or a single monolithic code snippet.
 */
export function parsePastedRepoText(rawText: string): RepoFileInput[] {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const fileHeaderRegex = /^(?:\/\/|#|--|\/\*)\s*(?:===|---)?\s*FILE:\s*([^\s=*]+)\s*(?:===|---|\*\/)?$/gim;
  const matches = Array.from(normalized.matchAll(fileHeaderRegex));
  if (matches.length > 0) {
    const results: RepoFileInput[] = [];
    for (let i = 0; i < matches.length; i += 1) {
      const m = matches[i];
      const filePath = m[1].trim();
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length;
      const content = normalized.slice(start, end).trim();
      if (content) results.push({ path: filePath, content });
    }
    if (results.length > 0) return results;
  }

  const fenceRegex = /```([a-zA-Z0-9_-]+)?(?:\s+([^\n`]+))?\n([\s\S]*?)```/g;
  const fencedMatches = Array.from(normalized.matchAll(fenceRegex));
  if (fencedMatches.length > 0) {
    return fencedMatches
      .map((m, idx) => {
        const lang = (m[1] || "ts").toLowerCase();
        const ext = lang === "python" ? "py" : lang === "javascript" ? "js" : lang === "typescript" ? "ts" : lang;
        const hintedPath = m[2]?.trim() || `src/module_${idx + 1}.${ext}`;
        return { path: hintedPath, content: m[3].trim() };
      })
      .filter((f) => f.content.length > 0);
  }

  const guessedLang = /^\s*package\s+\w+/m.test(normalized)
    ? "go"
    : /^\s*(def|class)\s+\w+/m.test(normalized)
      ? "py"
      : /^\s*(fn|pub\s+fn|struct)\s+/m.test(normalized)
        ? "rs"
        : "ts";

  return [{ path: `src/core_entry.${guessedLang}`, content: normalized }];
}

function decodeTarFiles(
  tarBuffer: Uint8Array,
  subPath?: string
): Array<{ path: string; size: number; content: string }> {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const entries: Array<{ path: string; size: number; content: string }> = [];
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    offset += 512;

    // Two consecutive zero blocks mark end of archive
    if (header.every((b) => b === 0)) break;

    const rawName = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, "");
    const rawPrefix = decoder.decode(header.subarray(345, 500)).replace(/\0.*$/, "");
    const fullName = rawPrefix ? `${rawPrefix}/${rawName}` : rawName;
    const sizeOctal = decoder.decode(header.subarray(124, 136)).replace(/\0.*$/, "").trim();
    const size = parseInt(sizeOctal || "0", 8) || 0;
    const typeFlag = header[156];

    const paddedSize = Math.ceil(size / 512) * 512;
    const fileSlice = tarBuffer.subarray(offset, offset + size);
    offset += paddedSize;

    // Regular file ('0' = 48 or '\0' = 0)
    if ((typeFlag === 48 || typeFlag === 0) && size > 0 && size <= 120000) {
      const slashIdx = fullName.indexOf("/");
      const relPath = slashIdx >= 0 ? fullName.slice(slashIdx + 1) : fullName;
      if (!relPath || (subPath && !relPath.startsWith(subPath))) continue;
      if (scoreRepoFile(relPath, size) > 0) {
        entries.push({
          path: relPath,
          size,
          content: decoder.decode(fileSlice),
        });
      }
    }
  }
  return entries;
}

async function fetchGitHubTarballFallback(
  target: ParsedGitHubTarget,
  maxFiles: number
): Promise<{ repoName: string; files: RepoFileInput[] }> {
  const ref = target.branch ? `refs/heads/${encodeURIComponent(target.branch)}` : "HEAD";
  const tarballUrl = `https://codeload.github.com/${target.owner}/${target.repo}/tar.gz/${ref}`;
  const resp = await fetch(tarballUrl, {
    headers: { "User-Agent": "Prism-Workbench/1.0" },
  });
  if (resp.status === 404) {
    throw new Error(`仓库 ${target.owner}/${target.repo} 不存在或为私有仓库。`);
  }
  if (!resp.ok || !resp.body) {
    throw new Error(`拉取 GitHub 源码归档失败 (${resp.status})，请改用本地代码文件上传或粘贴源码。`);
  }

  const decompressedStream = resp.body.pipeThrough(new DecompressionStream("gzip"));
  const tarArrayBuf = await new Response(decompressedStream).arrayBuffer();
  const candidates = decodeTarFiles(new Uint8Array(tarArrayBuf), target.subPath);
  const selected = selectCoreRepoFiles(candidates, maxFiles);
  if (selected.length === 0) {
    throw new Error("未在该仓库中筛选出可解析的核心源代码文件。");
  }
  return {
    repoName: `${target.owner}/${target.repo}`,
    files: selected.map((f) => ({ path: f.path, content: f.content })),
  };
}

export async function fetchGitHubRepoFiles(
  repoUrl: string,
  maxFiles = 8
): Promise<{ repoName: string; files: RepoFileInput[] }> {
  const target = parseGitHubUrl(repoUrl);
  if (!target) {
    throw new Error("无法识别 GitHub 仓库地址，请使用 https://github.com/owner/repo 或 owner/repo 格式。");
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Prism-Workbench/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let branch = target.branch;
  if (!branch) {
    const repoResp = await fetch(`https://api.github.com/repos/${target.owner}/${target.repo}`, { headers });
    if (repoResp.status === 404) {
      throw new Error(`仓库 ${target.owner}/${target.repo} 不存在或为私有仓库。`);
    }
    if (repoResp.status === 403 || repoResp.status === 429) {
      return fetchGitHubTarballFallback(target, maxFiles);
    }
    if (!repoResp.ok) {
      return fetchGitHubTarballFallback(target, maxFiles);
    }
    const repoJson = (await repoResp.json()) as { default_branch?: string };
    branch = repoJson.default_branch || "main";
  }

  const treeResp = await fetch(
    `https://api.github.com/repos/${target.owner}/${target.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers }
  );
  if (treeResp.status === 403 || treeResp.status === 429) {
    return fetchGitHubTarballFallback({ ...target, branch }, maxFiles);
  }
  if (!treeResp.ok) {
    return fetchGitHubTarballFallback({ ...target, branch }, maxFiles);
  }

  const treeData = (await treeResp.json()) as {
    tree?: Array<{ path: string; type: string; size?: number }>;
  };

  const blobs = (treeData.tree ?? []).filter((item) => {
    if (item.type !== "blob") return false;
    if (target.subPath && !item.path.startsWith(target.subPath)) return false;
    return true;
  });

  const selected = selectCoreRepoFiles(blobs, maxFiles);
  if (selected.length === 0) {
    throw new Error("未在该仓库中筛选出可解析的核心源代码文件。");
  }

  const fetchedFiles = await Promise.all(
    selected.map(async (entry) => {
      const rawUrl = `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${encodeURIComponent(branch)}/${entry.path}`;
      const resp = await fetch(rawUrl, { headers: { "User-Agent": "Prism-Workbench/1.0" } });
      if (!resp.ok) return null;
      const content = await resp.text();
      return { path: entry.path, content };
    })
  );

  const validFiles = fetchedFiles.filter((f): f is RepoFileInput => f !== null && f.content.trim().length > 0);
  if (validFiles.length === 0) {
    throw new Error("抓取核心代码文件内容失败，请检查网络或改用本地代码输入。");
  }

  return {
    repoName: `${target.owner}/${target.repo}`,
    files: validFiles,
  };
}

export async function ingestRepoSource(payload: RawSourcePayload): Promise<SourceUnit[]> {
  let files: RepoFileInput[] = [];

  if (payload.kind === "repo-files" && payload.files?.length) {
    const selected = selectCoreRepoFiles(
      payload.files.map((f) => ({ ...f, size: f.content.length })),
      10
    );
    files = selected.length > 0 ? selected : payload.files.slice(0, 8);
  } else if (payload.kind === "repo-url" || payload.kind === "remote-url") {
    const result = await fetchGitHubRepoFiles(payload.content, 8);
    if (!payload.title) {
      payload.title = result.repoName;
    }
    files = result.files;
  } else {
    files = parsePastedRepoText(payload.content);
  }

  if (files.length === 0) {
    throw new Error("未检测到有效源码内容，请输入 GitHub URL、上传代码文件或粘贴源码片段。");
  }

  const units: SourceUnit[] = [];
  files.forEach((file, fileIdx) => {
    const sliced = sliceCodeFileIntoUnits(file.path, file.content, fileIdx + 1, 75);
    units.push(...sliced);
  });

  return units.slice(0, 16);
}
