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

export async function searchArxivPapers(
  query: string,
  maxResults = 5
): Promise<ArxivPaperSearchHit[]> {
  const directId = parseArxivIdentifier(query);
  const endpoint = directId
    ? `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(directId)}`
    : `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query.trim())}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

  const resp = await fetch(endpoint, { headers: REQUEST_HEADERS });
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
      signal: AbortSignal.timeout(10000),
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

  return hits;
}

export async function fetchCleanWebPage(
  rawUrl: string
): Promise<{ title: string; text: string; finalUrl: string }> {
  const url = rawUrl.trim();
  const resp = await fetch(url, { headers: REQUEST_HEADERS });
  if (!resp.ok) {
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

  return {
    title,
    text: selected.join("\n\n"),
    finalUrl,
  };
}
