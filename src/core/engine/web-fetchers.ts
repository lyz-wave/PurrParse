import {
  detectSocialPlatform,
  extractUrlFromShareText,
  type ExtractedShareLink,
  type SocialPlatform,
} from "./social-url";

export {
  detectSocialPlatform,
  extractUrlFromShareText,
  type ExtractedShareLink,
  type SocialPlatform,
};

export interface ArxivPaperSearchHit {
  arxivId: string;
  title: string;
  authors: string[];
  published: string;
  summary: string;
  absUrl: string;
  pdfUrl: string;
}

export interface GitHubRepoSearchHit {
  fullName: string;
  url: string;
  description: string;
  stars: number;
  language: string;
}

export interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
}

const REQUEST_HEADERS = {
  "User-Agent": "Prism-Workbench/1.0 (https://localhost)",
  Accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
};

export function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripElementsWithClass(html: string, classSubstrings: string[]): string {
  let result = html;
  for (const sub of classSubstrings) {
    const openRe = new RegExp(`<([a-zA-Z0-9]+)\\b[^>]*class="[^"]*${sub}[^"]*"[^>]*>`, "i");
    let safety = 0;
    while (safety++ < 800) {
      const m = openRe.exec(result);
      if (!m) break;
      const tag = m[1];
      const startIdx = m.index;
      const tagRe = new RegExp(`<(\\/)?${tag}\\b[^>]*>`, "gi");
      tagRe.lastIndex = startIdx + m[0].length;
      let depth = 1;
      let endIdx = result.length;
      while (depth > 0) {
        const tm = tagRe.exec(result);
        if (!tm) break;
        if (tm[0].endsWith("/>")) continue;
        if (tm[1]) depth--;
        else depth++;
        if (depth === 0) {
          endIdx = tm.index + tm[0].length;
          break;
        }
      }
      result = result.slice(0, startIdx) + " " + result.slice(endIdx);
    }
  }
  return result;
}

function extractBalancedBlocks(
  html: string,
  tagName: string,
  replaceFn: (fullBlock: string, openTag: string) => string
): string {
  const result = html;
  const openRe = new RegExp(`<${tagName}\\b[^>]*>`, "i");
  let cursor = 0;
  let safety = 0;
  let out = "";
  while (safety++ < 800) {
    openRe.lastIndex = 0;
    const slice = result.slice(cursor);
    const m = openRe.exec(slice);
    if (!m) {
      out += slice;
      break;
    }
    const startIdx = cursor + m.index;
    out += result.slice(cursor, startIdx);
    const tagRe = new RegExp(`<(\\/)?${tagName}\\b[^>]*>`, "gi");
    tagRe.lastIndex = startIdx + m[0].length;
    let depth = 1;
    let endIdx = result.length;
    while (depth > 0) {
      const tm = tagRe.exec(result);
      if (!tm) break;
      if (tm[0].endsWith("/>")) continue;
      if (tm[1]) depth--;
      else depth++;
      if (depth === 0) {
        endIdx = tm.index + tm[0].length;
        break;
      }
    }
    out += replaceFn(result.slice(startIdx, endIdx), m[0]);
    cursor = endIdx;
  }
  return out;
}

function encodePrismMarker(kind: "FIGURE" | "TABLE", payload: unknown): string {
  const json = JSON.stringify(payload);
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(json, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(json)));
  return `\n\n[[PRISM_${kind}:${b64}]]\n\n`;
}

function resolveSafeUrl(rawSrc: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(decodeHtmlEntities(rawSrc).trim(), baseUrl).href;
    if (!/^https?:\/\//i.test(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}

/**
 * Extracts canonical arXiv ID from bare ID (`1706.03762`, `arXiv:2106.09685v2`)
 * or full `arxiv.org/{abs,pdf,html}/...` URL.
 */
export function parseArxivIdentifier(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const bareNew = trimmed.match(/^(?:arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?)$/i);
  if (bareNew) return bareNew[1];

  const bareOld = trimmed.match(/^(?:arxiv:)?([a-z-]+(?:\.[a-z-]+)?\/\d{7}(?:v\d+)?)$/i);
  if (bareOld) return bareOld[1];

  try {
    const url = new URL(trimmed);
    if (!/(?:^|\.)arxiv\.org$/i.test(url.hostname)) return null;
    const m = url.pathname.match(/^\/(?:abs|pdf|html)\/(.+?)(?:\.pdf)?\/?$/i);
    if (!m) return null;
    const candidate = m[1];
    if (/^(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z-]+)?\/\d{7}(?:v\d+)?)$/i.test(candidate)) {
      return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

function extractXmlTag(xml: string, tagName: string): string {
  const m = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return m ? decodeHtmlEntities(m[1]).replace(/\s+/g, " ").trim() : "";
}

function parseArxivAtomFeed(xml: string): ArxivPaperSearchHit[] {
  const entries = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi));
  const hits: ArxivPaperSearchHit[] = [];

  for (const match of entries) {
    const block = match[1];
    const idUrl = extractXmlTag(block, "id");
    const arxivId = parseArxivIdentifier(idUrl) ?? idUrl.split("/abs/").pop()?.trim() ?? "";
    const title = extractXmlTag(block, "title");
    const summary = extractXmlTag(block, "summary");
    const published = extractXmlTag(block, "published").slice(0, 10);
    const authors = Array.from(block.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/gi)).map((a) =>
      decodeHtmlEntities(a[1]).trim()
    );

    if (arxivId && title) {
      hits.push({
        arxivId,
        title,
        authors,
        published,
        summary,
        absUrl: `https://arxiv.org/abs/${arxivId}`,
        pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
      });
    }
  }
  return hits;
}

function makeTimeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

export async function searchArxivPapers(
  query: string,
  maxResults = 5
): Promise<ArxivPaperSearchHit[]> {
  const directId = parseArxivIdentifier(query);
  const endpoint = directId
    ? `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(directId)}`
    : `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query.trim())}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

  const resp = await fetch(endpoint, {
    headers: REQUEST_HEADERS,
    signal: makeTimeoutSignal(10000),
  });
  if (!resp.ok) {
    throw new Error(`arXiv 检索失败 (${resp.status})`);
  }
  const xml = await resp.text();
  return parseArxivAtomFeed(xml);
}

export async function fetchArxivHtmlPaper(
  arxivId: string
): Promise<{ title?: string; text: string } | null> {
  const cleanId = parseArxivIdentifier(arxivId) ?? arxivId.trim();
  const [metaList, htmlResp] = await Promise.all([
    searchArxivPapers(cleanId, 1).catch(() => []),
    fetch(`https://arxiv.org/html/${encodeURIComponent(cleanId)}`, {
      headers: REQUEST_HEADERS,
      signal: makeTimeoutSignal(6000),
    }).catch(() => null),
  ]);

  if (!htmlResp || !htmlResp.ok) {
    return null;
  }

  const html = await htmlResp.text();
  if (!html.includes("ltx_document") && !html.includes("<article")) {
    return null;
  }

  const baseUrl = htmlResp.url || `https://arxiv.org/html/${encodeURIComponent(cleanId)}`;
  let workingHtml = html;

  const articleMatch = workingHtml.match(
    /<article[^>]*class="[^"]*ltx_document[^"]*"[^>]*>([\s\S]*?)<\/article>/i
  );
  if (articleMatch) {
    workingHtml = articleMatch[1];
  }
  const absIdx = workingHtml.search(/<div[^>]*class="[^"]*ltx_abstract[^"]*"/i);
  if (absIdx !== -1) {
    workingHtml = workingHtml.slice(absIdx);
  }
  const bibIdx = workingHtml.search(
    /<(?:section|div)[^>]*class="[^"]*(?:ltx_bibliography|ltx_acknowledgement)[^"]*"|<h[1-6][^>]*>\s*(?:References|Bibliography|Acknowledgements?|Instructions for reporting errors)\b/i
  );
  if (bibIdx !== -1) {
    workingHtml = workingHtml.slice(0, bibIdx);
  }

  workingHtml = stripElementsWithClass(workingHtml, [
    "ltx_note",
    "ltx_role_footnote",
    "ltx_authors",
    "ltx_dates",
    "ltx_engrafo",
    "ltx_bibliography",
    "ltx_acknowledgement",
    "modal",
    "arxiv-html-header",
    "ds-announcement",
    "sr-only",
    "ltx_tag_equation",
    "ltx_ERROR",
  ]).replace(/<(script|style|noscript|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Protect math tokens from downstream HTML tag stripping (e.g. "$k < n$" containing literal "<")
  const mathPlaceholders: string[] = [];
  const stashMath = (tex: string, display: boolean): string => {
    const idx = mathPlaceholders.length;
    mathPlaceholders.push(display ? `\n\n$$\n${tex.trim()}\n$$\n\n` : ` $${tex.trim()}$ `);
    return `[[PRISM_MATH_${idx}]]`;
  };

  // Convert display LaTeXML equation tables (including multi-cell align/eqnarray)
  workingHtml = workingHtml
    .replace(
      /<table[^>]*class="[^"]*ltx_eq(?:n_table|uation|uationgroup)[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
      (_m, tableInner: string) => {
        const mathParts = Array.from(
          tableInner.matchAll(/<math[^>]*alttext="([^"]+)"[^>]*>[\s\S]*?<\/math>/gi)
        ).map((m) => decodeHtmlEntities(m[1]).trim());
        if (mathParts.length === 0) return _m;
        return stashMath(mathParts.join(" "), true);
      }
    )
    // Convert inline / remaining LaTeXML math nodes using intact LaTeX alttext
    .replace(
      /<math[^>]*alttext="([^"]+)"[^>]*>[\s\S]*?<\/math>/gi,
      (_m, tex: string) => stashMath(decodeHtmlEntities(tex), false)
    );

  // Extract figures (images / SVGs) and data tables before stripping remaining tags
  workingHtml = extractBalancedBlocks(workingHtml, "figure", (block) => {
    const restoreMath = (s: string) =>
      s.replace(/\[\[PRISM_MATH_(\d+)\]\]/g, (_mm, i) => mathPlaceholders[Number(i)] ?? "");
    const imgs = Array.from(block.matchAll(/<img[^>]+src="([^"]+)"/gi))
      .map((m) => resolveSafeUrl(m[1], baseUrl))
      .filter((u): u is string => Boolean(u));
    const objs = Array.from(block.matchAll(/<object[^>]+data="([^"]+)"/gi))
      .map((m) => resolveSafeUrl(m[1], baseUrl))
      .filter((u): u is string => Boolean(u));
    const media = Array.from(new Set([...imgs, ...objs])).filter(
      (u) => !u.includes("/static/") && !u.startsWith("data:")
    );

    const caps = Array.from(block.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi))
      .map((m) =>
        restoreMath(decodeHtmlEntities(m[1].replace(/<[^>]+>/g, " ")))
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);
    const caption = caps.join(" ");

    if (media.length > 0) {
      return encodePrismMarker("FIGURE", {
        caption: caption || "Figure",
        imageUrls: media,
      });
    }

    const trMatches = Array.from(block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    const parsedRows = trMatches
      .map((tr) =>
        Array.from(tr[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)).map((cell) =>
          restoreMath(decodeHtmlEntities(cell[1].replace(/<[^>]+>/g, " ")))
            .replace(/\s+/g, " ")
            .trim()
        )
      )
      .filter((r) => r.length > 0 && r.some(Boolean));

    if (parsedRows.length >= 2) {
      return encodePrismMarker("TABLE", {
        caption,
        headers: parsedRows[0],
        rows: parsedRows.slice(1, 13),
      });
    }

    return caption ? `\n\n${caption}\n\n` : "\n\n";
  });

  const normalizedHtml = workingHtml
    // Run-in bold subheadings (h5) stay compact with a trailing colon
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_m, inner: string) => {
      const cleanTitle = decodeHtmlEntities(inner.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      return cleanTitle ? `\n\n${cleanTitle.endsWith(":") ? cleanTitle : `${cleanTitle}:`}\n\n` : "";
    })
    // Major and Abstract headings (h1-h4, h6)
    .replace(/<(h[1-46])[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner: string) => {
      const cleanHeading = decodeHtmlEntities(inner.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      return cleanHeading ? `\n\n${cleanHeading}\n\n` : "\n\n";
    })
    // Keep bullet symbols bound to their item text
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => {
      const itemText = decodeHtmlEntities(
        inner.replace(/<\/?(?:div|p|span)[^>]*>/gi, " ").replace(/<[^>]+>/g, " ")
      )
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[•\-*]\s*/, "");
      return itemText ? `\n\n• ${itemText}\n\n` : "\n\n";
    })
    .replace(/<\/?(?:p|div|section|article|blockquote|br)[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[PRISM_MATH_(\d+)\]\]/g, (_m, idxStr: string) => mathPlaceholders[Number(idxStr)] ?? "");

  const blocks = decodeHtmlEntities(normalizedHtml)
    .split(/\n{2,}/)
    .map((b) => b.replace(/[ \t]+/g, " ").trim())
    .filter((b) => b.length > 0);

  const text = blocks.join("\n\n");
  if (text.length < 400) {
    return null;
  }

  return {
    title: metaList[0]?.title,
    text,
  };
}

export async function fetchArxivPaperPdf(
  arxivId: string
): Promise<{ bytes: Uint8Array; meta?: ArxivPaperSearchHit }> {
  const cleanId = parseArxivIdentifier(arxivId) ?? arxivId.trim();
  const [metaList, pdfResp] = await Promise.all([
    searchArxivPapers(cleanId, 1).catch(() => []),
    fetch(`https://arxiv.org/pdf/${encodeURIComponent(cleanId)}`, {
      headers: { "User-Agent": REQUEST_HEADERS["User-Agent"] },
      signal: makeTimeoutSignal(25000),
    }),
  ]);

  if (!pdfResp.ok) {
    throw new Error(`下载 arXiv PDF 失败 (${pdfResp.status})，请确认论文号 ${cleanId} 是否存在。`);
  }
  const buf = await pdfResp.arrayBuffer();
  return {
    bytes: new Uint8Array(buf),
    meta: metaList[0],
  };
}

export async function searchGitHubRepos(
  query: string,
  maxResults = 5
): Promise<GitHubRepoSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": REQUEST_HEADERS["User-Agent"],
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const resp = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${maxResults}`,
      { headers }
    );
    if (resp.ok) {
      const json = (await resp.json()) as {
        items?: Array<{
          full_name: string;
          html_url: string;
          description?: string | null;
          stargazers_count?: number;
          language?: string | null;
        }>;
      };
      return (json.items ?? []).map((item) => ({
        fullName: item.full_name,
        url: item.html_url,
        description: item.description || "",
        stars: item.stargazers_count ?? 0,
        language: item.language || "Unknown",
      }));
    }
  } catch {
    // Fall through to GitHub HTML search fallback below
  }

  // Fallback: scrape lightweight repository links from github.com/search
  const htmlResp = await fetch(
    `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`,
    { headers: REQUEST_HEADERS }
  );
  if (!htmlResp.ok) return [];
  const html = await htmlResp.text();
  const seen = new Set<string>();
  const hits: GitHubRepoSearchHit[] = [];

  for (const m of html.matchAll(/href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"/g)) {
    const fullName = m[1];
    if (
      /^(features|sponsors|pricing|enterprise|login|signup|topics|trending|collections|explore|settings|marketplace|apps)\//i.test(
        fullName
      )
    ) {
      continue;
    }
    if (!seen.has(fullName)) {
      seen.add(fullName);
      hits.push({
        fullName,
        url: `https://github.com/${fullName}`,
        description: "",
        stars: 0,
        language: "GitHub",
      });
      if (hits.length >= maxResults) break;
    }
  }
  return hits;
}

export async function searchWebPages(query: string, maxResults = 5): Promise<WebSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const hits: WebSearchHit[] = [];

  try {
    const ddgResp = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      { headers: REQUEST_HEADERS }
    );
    if (ddgResp.ok) {
      const html = await ddgResp.text();
      const blocks = html.split(/class="result__body"/i).slice(1);
      for (const blk of blocks) {
        const linkMatch = blk.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = blk.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;
        let href = decodeHtmlEntities(linkMatch[1]);
        const uddg = href.match(/[?&]uddg=([^&]+)/);
        if (uddg) {
          href = decodeURIComponent(uddg[1]);
        } else if (href.startsWith("//")) {
          href = `https:${href}`;
        }
        if (!/^https?:\/\//i.test(href)) continue;

        const title = decodeHtmlEntities(linkMatch[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
        const snippet = snippetMatch
          ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()
          : "";

        hits.push({ title, url: href, snippet });
        if (hits.length >= maxResults) break;
      }
    }
  } catch {
    // Fall back to Wikipedia opensearch below
  }

  if (hits.length === 0) {
    try {
      const wikiResp = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=${maxResults}&format=json`,
        { headers: REQUEST_HEADERS }
      );
      if (wikiResp.ok) {
        const [, titles, snippets, urls] = (await wikiResp.json()) as [
          string,
          string[],
          string[],
          string[],
        ];
        for (let i = 0; i < (titles?.length ?? 0); i += 1) {
          hits.push({
            title: titles[i],
            url: urls[i],
            snippet: snippets[i] ?? "",
          });
        }
      }
    } catch {
      // ignore
    }
  }

  if (hits.length === 0) {
    const toutiaoHits = await fetchToutiaoArticlesByQuery(q, Math.min(maxResults, 3)).catch(() => []);
    for (const art of toutiaoHits) {
      hits.push({
        title: art.title,
        url: art.url,
        snippet: art.paragraphs.slice(0, 2).join(" ").slice(0, 280),
      });
    }
  }

  return hits;
}

const SOCIAL_MOBILE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

const DESKTOP_BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

const GOOGLEBOT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

export interface VideoTranscriptSectionsResult {
  sections: string[];
  title?: string;
  uploader?: string;
  durationSec?: number;
}

export type VideoTranscriberFn = (
  url: string,
  cacheKey: string,
  startSectionIndex: number,
  lang?: string
) => Promise<VideoTranscriptSectionsResult | null>;

let registeredVideoTranscriber: VideoTranscriberFn | null = null;

/**
 * Registers a server-side local ASR / video-to-text transcriber without
 * pulling Node-only modules into client bundles.
 */
export function registerVideoTranscriber(fn: VideoTranscriberFn | null): void {
  registeredVideoTranscriber = fn;
}

function buildUrlCacheKey(prefix: string, rawUrl: string): string {
  let hash = 0;
  for (let i = 0; i < rawUrl.length; i += 1) {
    hash = (hash * 31 + rawUrl.charCodeAt(i)) >>> 0;
  }
  return `${prefix}-${hash.toString(36)}`;
}

async function resolveFinalRedirectUrl(
  url: string,
  headers: Record<string, string>
): Promise<string> {
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers,
      signal: AbortSignal.timeout(8000),
    });
    return resp.url || url;
  } catch {
    return url;
  }
}

async function fetchViaJinaReader(url: string): Promise<{ title?: string; text: string } | null> {
  try {
    const resp = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const raw = await resp.text();
    if (!raw || raw.trim().length < 60) return null;

    const titleLine = raw.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
    const mdIdx = raw.indexOf("Markdown Content:");
    const body = (mdIdx !== -1 ? raw.slice(mdIdx + "Markdown Content:".length) : raw)
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .trim();

    if (body.length < 40) return null;
    return { title: titleLine, text: body.slice(0, 26000) };
  } catch {
    return null;
  }
}

export interface ToutiaoArticleResult {
  title: string;
  source: string;
  url: string;
  paragraphs: string[];
}

export function deriveVideoTopicQuery(rawTitle: string): {
  fullQuery: string;
  coreTokens: string[];
} {
  const cleaned = rawTitle
    .replace(/#[^\s#，,。！!?？]+/g, " ")
    .replace(/@[^\s@，,。！!?？]+/g, " ")
    .replace(/\s*[-|—]\s*(?:抖音|B站|哔哩哔哩)\s*$/i, " ")
    .replace(/\d+(?:\.\d+)?\s*复制打开抖音[，,]?\s*看看/g, " ")
    .replace(/【[^】]{1,28}的作品】/g, " ")
    .replace(/[【】\[\]（）()《》]/g, " ")
    .replace(
      /(?:完整版|全篇[^\s，,。]{0,12}|可以收藏[^\s，,。]{0,12}|慢慢品|[\u4e00-\u9fa5]{1,5}频道|中字精华版|中英字幕|官方双字|双语字幕|精华版|中字|纯享版|未删减版|合集|第一[期部集讲]|第二[期部集讲]|第三[期部集讲]|作品|看看)/g,
      " "
    )
    .replace(/(?:做客|对话|专访|采访)/g, " ")
    .replace(/([\u4e00-\u9fa5])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([\u4e00-\u9fa5])/g, "$1 $2")
    .replace(/[，,。；;：:！!？?、/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return { fullQuery: "", coreTokens: [] };
  }

  const rawParts = cleaned.split(/\s+/).filter(Boolean);
  const zhStopWords = new Set(["普通人", "如何", "怎么", "怎样", "一门", "一个", "详细", "分享", "这个", "那个", "什么", "为什么", "到底", "其实"]);
  const expandedParts: string[] = [];
  const segmenter =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new Intl.Segmenter("zh-CN", { granularity: "word" })
      : null;

  for (const part of rawParts) {
    if (segmenter && /[\u4e00-\u9fa5]/.test(part) && part.length >= 6) {
      for (const seg of segmenter.segment(part)) {
        const w = seg.segment.trim();
        if (w.length >= 2 && !zhStopWords.has(w)) {
          expandedParts.push(w);
        }
      }
    } else if (!zhStopWords.has(part)) {
      expandedParts.push(part);
    }
  }

  const queryParts: string[] = [];
  const coreTokens: string[] = [];
  const seenLower = new Set<string>();

  for (const part of expandedParts) {
    const isAscii = /^[A-Za-z0-9-]+$/.test(part);
    if (isAscii ? part.length < 3 : part.length < 2) continue;
    const lower = part.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      queryParts.push(part);
      coreTokens.push(lower);
    }
    if (queryParts.length >= 5) break;
  }

  const fullQuery = queryParts.join(" ") || cleaned.slice(0, 48);
  return { fullQuery, coreTokens };
}

function stripToutiaoArticleHtml(html: string): string[] {
  const withBreaks = html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?(?:p|div|h[1-6]|li|blockquote|br|section|article|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeHtmlEntities(withBreaks);
  const boilerplateRe =
    /^(?:视频加载中|免责声明|版权声明|图片来源于网络|图源网络|侵权请联系删除|侵删|关注我|点击上方|点赞收藏|欢迎留言|本文仅代表作者观点|特别声明|阅读原文|了解更多|展开全文|声明：)/i;

  return decoded
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/[ \t]+/g, " ")
        .trim()
        // Keep internal numbered subheadings inline so top-level section structure stays clean
        .replace(/^([一二三四五六七八九十]+|\d{1,2})[、.]\s+/, "【$1】")
    )
    .filter((line) => {
      if (line.length < 22) return false;
      if (boilerplateRe.test(line)) return false;
      if (/^https?:\/\/\S+$/i.test(line)) return false;
      return true;
    });
}

function isToutiaoArticleRelevant(
  title: string,
  paragraphs: string[],
  coreTokens: string[]
): boolean {
  if (coreTokens.length === 0) return true;
  const titleLower = title.toLowerCase();
  const corpusLower = `${title} ${paragraphs.slice(0, 8).join(" ")}`.toLowerCase();
  const matchedInTitle = coreTokens.some((token) => titleLower.includes(token));
  if (!matchedInTitle) return false;
  const matchedInCorpus = coreTokens.filter((token) => corpusLower.includes(token)).length;
  return matchedInCorpus >= Math.min(2, coreTokens.length);
}

/**
 * Retrieves full-length companion transcripts, dialogue breakdowns, and deep articles
 * matching a video topic when the social video platform does not expose subtitles directly.
 */
async function fetchToutiaoArticlesByQuery(
  rawTitle: string,
  maxArticles = 3
): Promise<ToutiaoArticleResult[]> {
  const { fullQuery, coreTokens } = deriveVideoTopicQuery(rawTitle);
  if (!fullQuery || coreTokens.length === 0) return [];

  let searchHtml = "";
  try {
    const searchResp = await fetch(
      `https://so.toutiao.com/search?keyword=${encodeURIComponent(fullQuery)}&pd=synthesis&source=input`,
      {
        headers: SOCIAL_MOBILE_HEADERS,
        signal: AbortSignal.timeout(7000),
      }
    );
    if (!searchResp.ok) return [];
    searchHtml = await searchResp.text();
  } catch {
    return [];
  }

  const candidateIds: string[] = [];
  const seenIds = new Set<string>();
  const idRe = /(?:toutiao\.com\/(?:group|article|a)\/|"(?:item_id|group_id)"\s*:\s*"?)(\d{15,22})/g;
  for (const m of searchHtml.matchAll(idRe)) {
    const id = m[1];
    if (!seenIds.has(id)) {
      seenIds.add(id);
      candidateIds.push(id);
      if (candidateIds.length >= 6) break;
    }
  }
  if (candidateIds.length === 0) return [];

  const fetched = await Promise.allSettled(
    candidateIds.map(async (id) => {
      const resp = await fetch(`https://m.toutiao.com/i${id}/info/`, {
        headers: SOCIAL_MOBILE_HEADERS,
        signal: AbortSignal.timeout(6000),
      });
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        success?: boolean;
        data?: {
          title?: string;
          source?: string;
          content?: string;
        };
      };
      if (json.success === false || !json.data?.content) return null;
      const artTitle = decodeHtmlEntities(String(json.data.title ?? "")).trim();
      const source = String(json.data.source ?? "全网实录整理").trim() || "全网实录整理";
      const paragraphs = stripToutiaoArticleHtml(String(json.data.content));
      if (!artTitle || paragraphs.length === 0) return null;
      return {
        id,
        title: artTitle,
        source,
        url: `https://www.toutiao.com/article/${id}/`,
        paragraphs,
      };
    })
  );

  const results: ToutiaoArticleResult[] = [];
  const seenParagraphFp = new Set<string>();
  let totalChars = 0;

  for (const entry of fetched) {
    if (entry.status !== "fulfilled" || !entry.value) continue;
    const art = entry.value;
    if (!isToutiaoArticleRelevant(art.title, art.paragraphs, coreTokens)) continue;

    const dedupedParagraphs: string[] = [];
    for (const p of art.paragraphs) {
      const fp = p.replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, "").slice(0, 24).toLowerCase();
      if (!fp || seenParagraphFp.has(fp)) continue;
      seenParagraphFp.add(fp);
      dedupedParagraphs.push(p);
      totalChars += p.length;
      if (totalChars >= 3800) break;
    }

    const joinedLen = dedupedParagraphs.join("").length;
    if (joinedLen >= 120) {
      results.push({
        title: art.title,
        source: art.source,
        url: art.url,
        paragraphs: dedupedParagraphs,
      });
    }

    if (results.length >= maxArticles || totalChars >= 3800) break;
  }

  return results;
}

function formatEnrichedArticleSections(
  articles: ToutiaoArticleResult[],
  startingSectionIndex: number
): string[] {
  return articles.map((art, idx) => {
    const cleanHeadingTitle = art.title.replace(/\s+/g, " ").trim().slice(0, 52);
    return `# ${startingSectionIndex + idx}. 视频正片核心内容深度还原（${idx + 1}）：${cleanHeadingTitle}\n来源：${art.source}\n\n${art.paragraphs.join("\n\n")}`;
  });
}

async function fetchBilibiliContent(
  rawUrl: string,
  sharePrefixText: string
): Promise<{ title: string; text: string; finalUrl: string }> {
  const resolvedUrl = /(?:b23\.tv|acg\.tv)/i.test(rawUrl)
    ? await resolveFinalRedirectUrl(rawUrl, DESKTOP_BROWSER_HEADERS)
    : rawUrl;

  const bvMatch = resolvedUrl.match(/\/(BV[0-9A-Za-z]{10})|[?&]bvid=(BV[0-9A-Za-z]{10})/i);
  const avMatch = resolvedUrl.match(/\/av(\d+)|[?&]aid=(\d+)/i);
  const bvid = bvMatch?.[1] ?? bvMatch?.[2] ?? "";
  const aidFromUrl = avMatch?.[1] ?? avMatch?.[2] ?? "";

  const apiUrl = bvid
    ? `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`
    : aidFromUrl
      ? `https://api.bilibili.com/x/web-interface/view?aid=${encodeURIComponent(aidFromUrl)}`
      : "";

  const parts: string[] = [];
  let title = sharePrefixText || resolvedUrl;
  let coverUrl = "";
  let hasSubtitles = false;

  if (apiUrl) {
    try {
      const viewResp = await fetch(apiUrl, {
        headers: { ...DESKTOP_BROWSER_HEADERS, Referer: "https://www.bilibili.com/" },
        signal: AbortSignal.timeout(8000),
      });
      if (viewResp.ok) {
        const json = (await viewResp.json()) as {
          code?: number;
          data?: {
            aid?: number;
            bvid?: string;
            title?: string;
            desc?: string;
            pic?: string;
            tname?: string;
            duration?: number;
            owner?: { name?: string };
            stat?: { view?: number; like?: number; coin?: number; favorite?: number };
            pages?: Array<{ page?: number; part?: string; duration?: number }>;
            subtitle?: {
              list?: Array<{ lan_doc?: string; subtitle_url?: string }>;
            };
          };
        };

        const d = json.data;
        if (json.code === 0 && d) {
          title = d.title?.trim() || title;
          coverUrl = d.pic ? d.pic.replace(/^http:\/\//i, "https://") : "";
          const mins = d.duration ? Math.round(d.duration / 60) : 0;

          parts.push("# 1. 视频概览与核心信息");
          parts.push(
            `标题：${title}\nUP主：${d.owner?.name ?? "未知"} | 分区：${d.tname ?? "视频"} | 时长：约 ${mins} 分钟 | 链接：https://www.bilibili.com/video/${d.bvid ?? bvid}`
          );
          if (d.desc?.trim()) {
            parts.push(`视频简介：\n${d.desc.trim()}`);
          }

          if (coverUrl) {
            parts.push(encodePrismMarker("FIGURE", { caption: `B站视频封面：${title}`, imageUrls: [coverUrl] }));
          }

          if (d.pages && d.pages.length > 1) {
            const tocLines = d.pages
              .slice(0, 20)
              .map((p) => `- P${p.page ?? ""}: ${p.part ?? ""} (${Math.round((p.duration ?? 0) / 60)}m)`)
              .join("\n");
            parts.push(`# 2. 视频分 P 章节目录\n${tocLines}`);
          }

          // Fetch CC subtitles if publicly available
          const subUrlRaw = d.subtitle?.list?.[0]?.subtitle_url;
          if (subUrlRaw) {
            const subUrl = subUrlRaw.startsWith("//") ? `https:${subUrlRaw}` : subUrlRaw;
            try {
              const subResp = await fetch(subUrl, {
                headers: DESKTOP_BROWSER_HEADERS,
                signal: AbortSignal.timeout(6000),
              });
              if (subResp.ok) {
                const subJson = (await subResp.json()) as {
                  body?: Array<{ content?: string }>;
                };
                const subLines = (subJson.body ?? [])
                  .map((item) => item.content?.trim())
                  .filter((s): s is string => Boolean(s));
                if (subLines.length > 0) {
                  hasSubtitles = true;
                  // Group ~8 subtitle lines per paragraph for clean prose
                  const subParagraphs: string[] = [];
                  for (let i = 0; i < subLines.length; i += 8) {
                    subParagraphs.push(subLines.slice(i, i + 8).join("，") + "。");
                  }
                  parts.push(`# 3. CC 字幕 / 口播实录\n${subParagraphs.join("\n\n")}`);
                }
              }
            } catch {
              // ignore subtitle fetch error
            }
          }

          // Enrich with local video-to-text ASR or companion articles when Bilibili CC subtitles are unavailable
          if (!hasSubtitles) {
            const startSec = d.pages && d.pages.length > 1 ? 3 : 2;
            let usedV2t = false;
            if (registeredVideoTranscriber) {
              try {
                const v2tRes = await registeredVideoTranscriber(
                  resolvedUrl,
                  bvid ? `bilibili-${bvid}` : buildUrlCacheKey("bilibili", resolvedUrl),
                  startSec,
                  "zh"
                );
                if (v2tRes && v2tRes.sections.length > 0) {
                  parts.push(...v2tRes.sections);
                  usedV2t = true;
                }
              } catch {
                // fall back to companion articles below
              }
            }
            if (!usedV2t && title) {
              const enrichedArticles = await fetchToutiaoArticlesByQuery(title, 3).catch(() => []);
              if (enrichedArticles.length > 0) {
                parts.push(...formatEnrichedArticleSections(enrichedArticles, startSec));
              }
            }
          }

          // Fetch top/pinned comments (often contain creator notes or "课代表" summaries)
          if (d.aid) {
            try {
              const replyResp = await fetch(
                `https://api.bilibili.com/x/v2/reply/main?type=1&oid=${d.aid}&mode=3&ps=6`,
                {
                  headers: { ...DESKTOP_BROWSER_HEADERS, Referer: "https://www.bilibili.com/" },
                  signal: AbortSignal.timeout(6000),
                }
              );
              if (replyResp.ok) {
                const replyJson = (await replyResp.json()) as {
                  code?: number;
                  data?: {
                    top?: { upper?: { member?: { uname?: string }; content?: { message?: string } } };
                    replies?: Array<{
                      like?: number;
                      member?: { uname?: string };
                      content?: { message?: string };
                    }>;
                  };
                };
                const commentLines: string[] = [];
                const topMsg = replyJson.data?.top?.upper?.content?.message?.trim();
                if (topMsg) {
                  commentLines.push(`[UP主置顶补充] ${topMsg}`);
                }
                for (const r of replyJson.data?.replies?.slice(0, 5) ?? []) {
                  const msg = r.content?.message?.trim();
                  if (msg && msg.length >= 18) {
                    commentLines.push(`[高赞评论 ${r.like ?? 0}赞 @${r.member?.uname ?? "观众"}] ${msg}`);
                  }
                }
                if (commentLines.length > 0) {
                  const nextSecIdx = parts.filter((p) => p.startsWith("# ")).length + 1;
                  parts.push(`# ${nextSecIdx}. 置顶补充与高赞笔记评论\n${commentLines.join("\n\n")}`);
                }
              }
            } catch {
              // ignore reply fetch error
            }
          }
        }
      }
    } catch {
      // fall through to Jina Reader fallback below
    }
  }

  if (parts.length === 0) {
    const jina = await fetchViaJinaReader(resolvedUrl);
    if (jina) {
      title = jina.title || title;
      parts.push(`# 1. B站页面内容\n${jina.text}`);
    }
  }

  if (parts.length === 0 && sharePrefixText.length >= 12) {
    parts.push(`# 1. 分享文本摘要\n${sharePrefixText}`);
  }

  if (parts.length === 0) {
    throw new Error(
      "未能从该 B站 链接获取到公开简介或字幕（可能受访问限制）。请直接粘贴视频口播文字稿、CC 字幕或课代表总结。"
    );
  }

  return {
    title,
    text: parts.join("\n\n"),
    finalUrl: resolvedUrl,
  };
}

async function fetchXStatusContent(
  rawUrl: string,
  sharePrefixText: string
): Promise<{ title: string; text: string; finalUrl: string }> {
  const statusMatch = rawUrl.match(/\/(?:status|statuses)\/(\d+)/i);
  const statusId = statusMatch?.[1] ?? "";
  const canonicalUrl = rawUrl.replace(
    /^https?:\/\/(?:www\.)?(?:twitter\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com)/i,
    "https://x.com"
  );

  const parts: string[] = [];
  let title = sharePrefixText || "X (Twitter) 帖子 / 长文解析";

  if (statusId) {
    for (const endpoint of [
      `https://api.fxtwitter.com/i/status/${statusId}`,
      `https://api.vxtwitter.com/i/status/${statusId}`,
    ]) {
      try {
        const resp = await fetch(endpoint, {
          headers: DESKTOP_BROWSER_HEADERS,
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) continue;
        const json = (await resp.json()) as {
          tweet?: {
            text?: string;
            author?: { name?: string; screen_name?: string };
            article?: {
              title?: string;
              content?: { blocks?: Array<{ text?: string }> };
            };
            quote?: {
              text?: string;
              author?: { name?: string; screen_name?: string };
            };
            media?: { photos?: Array<{ url?: string }> };
          };
          text?: string;
          user_name?: string;
          user_screen_name?: string;
          mediaURLs?: string[];
        };

        const tw = json.tweet;
        if (tw) {
          const authorLabel = tw.author?.screen_name
            ? `${tw.author.name ?? ""} (@${tw.author.screen_name})`
            : "X 创作者";
          if (tw.article?.title) {
            title = tw.article.title;
            const blocks = (tw.article.content?.blocks ?? [])
              .map((b) => b.text?.trim())
              .filter((s): s is string => Boolean(s));
            parts.push(`# 1. X 长文章正文\n作者：${authorLabel}\n\n${blocks.join("\n\n")}`);
          }
          if (tw.text?.trim()) {
            if (!tw.article?.title) {
              title = `${authorLabel}: ${tw.text.trim().slice(0, 60)}`;
            }
            parts.push(`# ${parts.length + 1}. 原帖核心观点\n作者：${authorLabel}\n\n${tw.text.trim()}`);
          }
          if (tw.quote?.text?.trim()) {
            const qAuthor = tw.quote.author?.screen_name
              ? `@${tw.quote.author.screen_name}`
              : "原推作者";
            parts.push(`# ${parts.length + 1}. 引用推文 (${qAuthor})\n${tw.quote.text.trim()}`);
          }
          const photos = (tw.media?.photos ?? [])
            .map((p) => p.url)
            .filter((u): u is string => Boolean(u));
          if (photos.length > 0) {
            parts.push(
              encodePrismMarker("FIGURE", {
                caption: `X 帖子配图 (${authorLabel})`,
                imageUrls: photos,
              })
            );
          }
          break;
        } else if (json.text?.trim()) {
          const authorLabel = json.user_screen_name
            ? `${json.user_name ?? ""} (@${json.user_screen_name})`
            : "X 创作者";
          title = `${authorLabel}: ${json.text.trim().slice(0, 60)}`;
          parts.push(`# 1. 原帖核心观点\n作者：${authorLabel}\n\n${json.text.trim()}`);
          if (json.mediaURLs && json.mediaURLs.length > 0) {
            parts.push(
              encodePrismMarker("FIGURE", {
                caption: `X 帖子配图 (${authorLabel})`,
                imageUrls: json.mediaURLs,
              })
            );
          }
          break;
        }
      } catch {
        // try next endpoint
      }
    }
  }

  if (parts.length === 0) {
    const jina = await fetchViaJinaReader(canonicalUrl);
    if (jina) {
      title = jina.title || title;
      parts.push(`# 1. X 页面提取内容\n${jina.text}`);
    }
  }

  if (parts.length === 0) {
    try {
      const oembedResp = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (oembedResp.ok) {
        const oembed = (await oembedResp.json()) as { author_name?: string; html?: string };
        const plain = decodeHtmlEntities((oembed.html ?? "").replace(/<[^>]+>/g, " "))
          .replace(/\s+/g, " ")
          .trim();
        if (plain) {
          title = `${oembed.author_name ?? "X"}: ${plain.slice(0, 56)}`;
          parts.push(`# 1. X 原帖正文\n作者：${oembed.author_name ?? ""}\n\n${plain}`);
        }
      }
    } catch {
      // ignore
    }
  }

  if (parts.length === 0 && sharePrefixText.length >= 12) {
    parts.push(`# 1. 分享文本内容\n${sharePrefixText}`);
  }

  if (parts.length === 0) {
    throw new Error(
      "未能读取该 X (Twitter) 链接（可能需要登录态或网络代理无法直连）。请直接复制推文 Thread 全文或视频口播稿粘贴到文本框。"
    );
  }

  return { title, text: parts.join("\n\n"), finalUrl: canonicalUrl };
}

interface DouyinJsonLdComment {
  text?: string;
  creator?: { name?: string };
  author?: { name?: string };
  interactionStatistic?:
    | { userInteractionCount?: number | string }
    | Array<{ userInteractionCount?: number | string }>;
}

interface DouyinJsonLdVideoObject {
  "@type"?: string;
  name?: string;
  description?: string;
  duration?: string;
  thumbnailUrl?: string | string[];
  creator?: { name?: string };
  comment?: DouyinJsonLdComment[];
}

function formatIsoDuration(raw?: string): string {
  if (!raw) return "";
  const match = raw.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return "";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const segments: string[] = [];
  if (hours > 0) segments.push(`${hours}小时`);
  if (minutes > 0) segments.push(`${minutes}分`);
  if (seconds > 0 || segments.length === 0) segments.push(`${seconds}秒`);
  return segments.join("");
}

function extractJsonLdObjects(html: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const scriptRe = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRe)) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry && typeof entry === "object") {
            results.push(entry as Record<string, unknown>);
          }
        }
      } else if (parsed && typeof parsed === "object") {
        results.push(parsed as Record<string, unknown>);
      }
    } catch {
      // skip malformed JSON-LD script block
    }
  }
  return results;
}

function getInteractionLikes(stat: DouyinJsonLdComment["interactionStatistic"]): number {
  const entry = Array.isArray(stat) ? stat[0] : stat;
  const count = Number(entry?.userInteractionCount ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function formatDouyinCommentBody(rawText: string): string {
  const cleaned = rawText
    .replace(/\[[^\]\s]{1,8}\]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  // Keep numbered lists readable without triggering per-line heading splits
  return cleaned
    .replace(
      /(^|[：:；;。\n])\s*(\d{1,2})[.、]\s*(?=\S)/g,
      (_, sep: string, num: string) => `${sep === "\n" ? "" : sep}\n（${num}）`
    )
    .trim();
}

function isSubstantiveVideoComment(rawText: string): {
  keep: boolean;
  isNote: boolean;
  cleaned: string;
  meaningfulLen: number;
} {
  const cleaned = formatDouyinCommentBody(rawText);
  const withoutBots = cleaned.replace(/@(?:豆包|元宝|Kimi|DeepSeek)\S*/gi, "").trim();
  const meaningfulLen = withoutBots.replace(/\s+/g, "").length;

  const chatterRe =
    /(?:请问.{0,20}(?:哪里|在哪|怎么找|有没)|不想再看.{0,10}片段|可以总结.{0,18}(?:内容|语录|全文)|太棒了.{0,15}谢谢|辛苦了.{0,15}谢谢|有中英(?:对照|全文)吗|求.{0,12}(?:完整版|链接|原视频|指路)|^I really want to be|^终于找到了|^收藏了|^马住|^感谢分享|怎么办$|什么叫|那什么是)/i;

  if (meaningfulLen < 16 || chatterRe.test(withoutBots)) {
    return { keep: false, isNote: false, cleaned, meaningfulLen };
  }

  const hasNumberedStructure = /(?:^|[：:；;。\n])（?\d{1,2}[)）.、]\s*\S/.test(cleaned);
  const englishWordCount = withoutBots.match(/[A-Za-z]{3,}/g)?.length ?? 0;
  const keep =
    hasNumberedStructure ||
    meaningfulLen >= 65 ||
    (englishWordCount >= 6 && meaningfulLen >= 35);

  return { keep, isNote: meaningfulLen >= 16, cleaned, meaningfulLen };
}

function extractDouyinVideoObject(html: string): {
  title: string;
  rawName: string;
  overviewSection: string;
  coverMarker: string;
  substantiveComments: string[];
  discussionComments: string[];
} | null {
  const ldObjects = extractJsonLdObjects(html);
  const videoObj = ldObjects.find((obj) => obj["@type"] === "VideoObject") as
    | DouyinJsonLdVideoObject
    | undefined;
  if (!videoObj) return null;

  const rawName = String(videoObj.name ?? "")
    .replace(/\s*-\s*抖音\s*$/i, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const rawDesc = String(videoObj.description ?? "")
    .replace(/\s*-\s*抖音\s*$/i, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const creatorName = String(videoObj.creator?.name ?? "抖音创作者").trim();
  const durationLabel = formatIsoDuration(videoObj.duration);
  const coverUrl = Array.isArray(videoObj.thumbnailUrl)
    ? String(videoObj.thumbnailUrl[0] ?? "").trim()
    : String(videoObj.thumbnailUrl ?? "").trim();

  const resolvedTitle = (rawName || rawDesc || "抖音视频内化笔记").slice(0, 88);

  const metaParts = [`创作者：@${creatorName}`];
  if (durationLabel) metaParts.push(`时长：${durationLabel}`);

  const overviewLines = [metaParts.join(" | "), "", `作品主题与文案：${rawName || rawDesc}`];
  if (rawDesc && rawDesc !== rawName && !rawDesc.startsWith(rawName.slice(0, 24))) {
    overviewLines.push("", `内容简介：${rawDesc}`);
  }
  const coverMarker = coverUrl
    ? encodePrismMarker("FIGURE", {
        caption: `抖音视频封面：${resolvedTitle}`,
        imageUrls: [coverUrl],
      })
    : "";
  const overviewSection = `# 1. 抖音视频核心档案与背景\n${overviewLines.join("\n")}${
    coverMarker ? `\n${coverMarker}` : ""
  }`;

  const parsedComments = (videoObj.comment ?? []).map((c) => {
    const check = isSubstantiveVideoComment(String(c.text ?? ""));
    const author = String(c.creator?.name ?? c.author?.name ?? "匿名观众").trim() || "匿名观众";
    return {
      keep: check.keep,
      isNote: check.isNote,
      text: check.cleaned,
      meaningfulLen: check.meaningfulLen,
      likes: getInteractionLikes(c.interactionStatistic),
      author,
    };
  });

  const rankedComments = parsedComments
    .filter((c) => c.keep)
    .sort((a, b) => b.likes - a.likes || b.meaningfulLen - a.meaningfulLen)
    .slice(0, 6)
    .map((c) => `[高赞笔记 ${c.likes}赞 @${c.author}]\n${c.text}`);

  const discussionComments = parsedComments
    .filter((c) => c.isNote)
    .sort((a, b) => b.likes - a.likes || b.meaningfulLen - a.meaningfulLen)
    .slice(0, 6)
    .map((c) => `[高赞讨论 ${c.likes}赞 @${c.author}]\n${c.text}`);

  return {
    title: resolvedTitle,
    rawName: rawName || rawDesc,
    overviewSection,
    coverMarker,
    substantiveComments: rankedComments,
    discussionComments,
  };
}

async function fetchDouyinContent(
  rawUrl: string,
  sharePrefixText: string
): Promise<{ title: string; text: string; finalUrl: string }> {
  const resolvedUrl = await resolveFinalRedirectUrl(rawUrl, SOCIAL_MOBILE_HEADERS);
  const idMatch = resolvedUrl.match(/\/(?:video|note)\/(\d+)|[?&]modal_id=(\d+)/i);
  const videoId = idMatch?.[1] ?? idMatch?.[2] ?? "";

  let title = "抖音视频内化笔记";
  let topicQuerySource = "";
  let overviewSection = "";
  let fallbackBodySection = "";
  let substantiveComments: string[] = [];
  let discussionComments: string[] = [];

  if (videoId) {
    try {
      const shareResp = await fetch(`https://www.iesdouyin.com/share/video/${videoId}/`, {
        headers: SOCIAL_MOBILE_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (shareResp.ok) {
        const html = await shareResp.text();
        const isChallenge = /验证码|滑块|验证您是真人|captcha/i.test(html) && !html.includes("_ROUTER_DATA");
        if (!isChallenge) {
          const routerMatch = html.match(/window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\})<\/script>/i);
          if (routerMatch) {
            try {
              const routerData = JSON.parse(routerMatch[1]) as {
                loaderData?: Record<
                  string,
                  {
                    videoInfoRes?: {
                      item_list?: Array<{
                        desc?: string;
                        author?: { nickname?: string };
                        video?: { cover?: { url_list?: string[] }; duration?: number };
                        music?: { title?: string };
                      }>;
                    };
                  }
                >;
              };
              const loaderValues = Object.values(routerData.loaderData ?? {});
              const item = loaderValues.find((v) => v?.videoInfoRes?.item_list?.length)
                ?.videoInfoRes?.item_list?.[0];
              if (item?.desc) {
                title = item.desc.slice(0, 80);
                topicQuerySource = item.desc;
                const coverUrl = item.video?.cover?.url_list?.[0] ?? "";
                const coverMarker = coverUrl
                  ? encodePrismMarker("FIGURE", {
                      caption: `抖音视频封面：${title}`,
                      imageUrls: [coverUrl],
                    })
                  : "";
                overviewSection = `# 1. 抖音视频核心信息\n作者：@${item.author?.nickname ?? "抖音创作者"} | 时长：${Math.round(
                  (item.video?.duration ?? 0) / 1000
                )} 秒\n\n文案标题：\n${item.desc}${coverMarker ? `\n${coverMarker}` : ""}`;
              }
            } catch {
              // fallback below
            }
          }
        }
      }
    } catch {
      // fallback below
    }
  }

  // Fallback 1: Googlebot SSR HTML includes schema.org VideoObject JSON-LD with full metadata & structured notes
  if (!overviewSection && videoId) {
    try {
      const botResp = await fetch(`https://www.iesdouyin.com/share/video/${videoId}/`, {
        headers: GOOGLEBOT_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (botResp.ok) {
        const botHtml = await botResp.text();
        const extracted = extractDouyinVideoObject(botHtml);
        if (extracted) {
          title = extracted.title;
          topicQuerySource = extracted.rawName || extracted.title;
          overviewSection = extracted.overviewSection;
          substantiveComments = extracted.substantiveComments;
          discussionComments = extracted.discussionComments;
        }
      }
    } catch {
      // fallback below
    }
  }

  if (!overviewSection) {
    const jina = await fetchViaJinaReader(resolvedUrl);
    if (jina && !/验证码|验证您是真人|captcha/i.test(jina.text)) {
      title = jina.title || title;
      topicQuerySource = jina.title || title;
      fallbackBodySection = `# 1. 抖音页面公开文本\n${jina.text}`;
    }
  }

  // Extract pasted share copy-text topic fallback if needed
  const cleanedShare = sharePrefixText
    .replace(/\d+(?:\.\d+)?\s*复制打开抖音[，,]?\s*看看/g, "")
    .replace(/[A-Za-z0-9@._/:]{3,}\s*$/g, "")
    .trim();

  if (cleanedShare.length >= 8) {
    const bracketTitle = cleanedShare.match(/【([^】]+)】/)?.[1];
    if (bracketTitle && title === "抖音视频内化笔记") {
      title = bracketTitle;
    }
    if (!topicQuerySource) {
      topicQuerySource = cleanedShare;
    }
  }

  // 1. Try local video-to-text ASR skill first to capture real spoken audio transcript
  let v2tSections: string[] = [];
  if (registeredVideoTranscriber) {
    try {
      const startSec = overviewSection ? 2 : 1;
      const cacheKey = videoId ? `douyin-${videoId}` : buildUrlCacheKey("douyin", resolvedUrl);
      const v2tRes = await registeredVideoTranscriber(resolvedUrl, cacheKey, startSec, "zh");
      if (v2tRes && v2tRes.sections.length > 0) {
        v2tSections = v2tRes.sections;
        if (title === "抖音视频内化笔记" && v2tRes.title) {
          title = v2tRes.title.slice(0, 88);
        }
      }
    } catch {
      // fall through to web transcript enrichment below
    }
  }

  // 2. Fallback: Web transcript & deep-article enrichment whenever neither ASR nor direct text is available
  const directTranscriptChars =
    fallbackBodySection.length + substantiveComments.join("").length;
  let enrichedArticles: ToutiaoArticleResult[] = [];
  if (
    v2tSections.length === 0 &&
    directTranscriptChars < 1000 &&
    (topicQuerySource || title !== "抖音视频内化笔记")
  ) {
    enrichedArticles = await fetchToutiaoArticlesByQuery(topicQuerySource || title, 4).catch(
      () => []
    );
  }

  const parts: string[] = [];
  if (overviewSection) {
    parts.push(overviewSection);
  } else if (fallbackBodySection) {
    parts.push(fallbackBodySection);
  } else if (cleanedShare.length >= 8) {
    parts.push(`# 1. 视频核心主题与分享线索\n${cleanedShare}`);
  }

  if (v2tSections.length > 0) {
    parts.push(...v2tSections);
  } else if (enrichedArticles.length > 0) {
    const startSec = parts.length > 0 ? parts.length + 1 : 1;
    parts.push(...formatEnrichedArticleSections(enrichedArticles, startSec));
  } else if (!fallbackBodySection) {
    const noticeSecIdx = parts.length + 1;
    parts.push(
      `# ${noticeSecIdx}. 视频口播实录获取说明（未公开字幕）\n该抖音作品为创作者原发视频，抖音网页端未公开字幕轨且音视频流受平台 Cookie 访问限制，全网亦未检索到对应的公开逐字文字稿。\n\n如需对完整口播内容进行逐段拆解，可将视频字幕（.srt / .vtt）或飞书妙记、通义听悟、剪映等工具转写的语音文字稿直接粘贴到「导入新源 -> 粘贴正文」中。`
    );
  }

  const hasFullTranscript = v2tSections.length > 0 || enrichedArticles.length > 0;
  const effectiveComments =
    hasFullTranscript || substantiveComments.length >= 2
      ? substantiveComments
      : discussionComments;

  if (effectiveComments.length > 0) {
    const commentSecIdx = parts.length + 1;
    parts.push(
      `# ${commentSecIdx}. ${
        hasFullTranscript ? "高赞课代表结构化拆解" : "评论区高赞核心讨论"
      }\n${effectiveComments.join("\n\n")}`
    );
  }

  if (parts.length === 0) {
    throw new Error(
      "抖音服务端开启了反爬验证或需要登录态，无法直接抓取视频音频流。建议复制该作品的完整分享口令（含【标题】）或将视频语音转写稿/字幕粘贴到文本框。"
    );
  }

  return { title, text: parts.join("\n\n"), finalUrl: resolvedUrl };
}

async function fetchVideoViaV2tOrFallback(
  rawUrl: string,
  sharePrefixText: string,
  platform: "youtube" | "xiaohongshu" | "tiktok"
): Promise<{ title: string; text: string; finalUrl: string } | null> {
  if (!registeredVideoTranscriber) return null;
  try {
    const cacheKey = buildUrlCacheKey(platform, rawUrl);
    const v2tRes = await registeredVideoTranscriber(rawUrl, cacheKey, 2, "zh");
    if (!v2tRes || v2tRes.sections.length === 0) return null;

    const title = v2tRes.title?.trim() || sharePrefixText || `${platform} 视频内化笔记`;
    const metaLines = [
      `平台：${platform}`,
      v2tRes.uploader ? `作者：${v2tRes.uploader}` : "",
      v2tRes.durationSec ? `时长：${Math.round(v2tRes.durationSec)} 秒` : "",
      `链接：${rawUrl}`,
    ]
      .filter(Boolean)
      .join(" | ");

    const parts = [`# 1. 视频核心档案与来源\n${metaLines}`, ...v2tRes.sections];
    return { title, text: parts.join("\n\n"), finalUrl: rawUrl };
  } catch {
    return null;
  }
}

export async function fetchCleanWebPage(
  rawUrl: string
): Promise<{ title: string; text: string; finalUrl: string }> {
  const extracted = extractUrlFromShareText(rawUrl);
  const url = extracted?.url ?? rawUrl.trim();
  const sharePrefixText = extracted?.sharePrefixText ?? "";
  const platform = extracted?.platform ?? detectSocialPlatform(url);

  if (platform === "bilibili") {
    return fetchBilibiliContent(url, sharePrefixText);
  }
  if (platform === "x") {
    return fetchXStatusContent(url, sharePrefixText);
  }
  if (platform === "douyin") {
    return fetchDouyinContent(url, sharePrefixText);
  }
  if (platform === "youtube" || platform === "xiaohongshu" || platform === "tiktok") {
    const v2tPage = await fetchVideoViaV2tOrFallback(url, sharePrefixText, platform);
    if (v2tPage) return v2tPage;
  }

  const resp = await fetch(url, { headers: REQUEST_HEADERS });
  if (!resp.ok) {
    const jina = await fetchViaJinaReader(url);
    if (jina) {
      return { title: jina.title || url, text: jina.text, finalUrl: url };
    }
    throw new Error(`读取网页失败 (${resp.status}): ${url}`);
  }
  const html = await resp.text();

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()
    : url;

  const finalUrl = resp.url || url;
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  let bodyHtml =
    articleMatch && articleMatch[1].length >= 600
      ? articleMatch[1]
      : mainMatch && mainMatch[1].length >= 600
      ? mainMatch[1]
      : html;

  bodyHtml = stripElementsWithClass(bodyHtml, [
    "cookie",
    "banner",
    "modal",
    "popup",
    "newsletter",
    "subscribe",
    "comment",
    "sidebar",
    "share",
    "social",
    "footer",
    "header",
    "nav",
  ]).replace(/<(script|style|noscript|svg|nav|footer|aside|header)[^>]*>[\s\S]*?<\/\1>/gi, "");

  bodyHtml = extractBalancedBlocks(bodyHtml, "figure", (block) => {
    const imgs = Array.from(block.matchAll(/<img[^>]+src="([^"]+)"/gi))
      .map((m) => resolveSafeUrl(m[1], finalUrl))
      .filter((u): u is string => Boolean(u))
      .filter(
        (u) => !/(?:\/static\/|avatar|icon|logo|pixel|1x1|\.svg(?:\?|$))/i.test(u)
      );
    const cap = decodeHtmlEntities(
      (block.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ")
    )
      .replace(/\s+/g, " ")
      .trim();
    if (imgs.length > 0) {
      return encodePrismMarker("FIGURE", { caption: cap || "Figure", imageUrls: imgs });
    }
    return cap ? `\n\n${cap}\n\n` : "\n\n";
  });

  const cleanedHtml = bodyHtml
    .replace(/<\/?(?:p|br|div|section|article|h[1-6]|li|tr|blockquote)[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  const paragraphs = decodeHtmlEntities(cleanedHtml)
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter((p) => p.length >= 25 || /^\[\[PRISM_(?:FIGURE|TABLE):/.test(p));

  const selected: string[] = [];
  let accLen = 0;
  for (const p of paragraphs) {
    if (accLen > 0 && accLen + p.length + 2 > 28000) break;
    selected.push(p);
    accLen += p.length + 2;
  }

  const joinedText = selected.join("\n\n");
  if (joinedText.length < 120) {
    const jina = await fetchViaJinaReader(finalUrl);
    if (jina) {
      return {
        title: jina.title || title,
        text: jina.text,
        finalUrl,
      };
    }
  }

  return {
    title,
    text: joinedText,
    finalUrl,
  };
}
