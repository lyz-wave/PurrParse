import type { DataTableBlock, FigureBlock } from "@/core/contracts/document-ast";
import type { RawSourcePayload, SourceUnit } from "@/core/contracts/mode-plugin";
import {
  fetchArxivHtmlPaper,
  fetchArxivPaperPdf,
  fetchCleanWebPage,
  parseArxivIdentifier,
} from "@/core/engine/web-fetchers";

const SECTION_HEADING_RE =
  /^(?:abstract|introduction|background|related work|problem statement|our method|methodology|methods|model architecture|empirical experiments?|experiments?|experimental setup|results?|evaluation|discussion|conclusion|future work|acknowledgments?|acknowledgements?|references|bibliography|appendix(?:\s+[A-Z0-9]+)?|摘要|引言|绪论|相关工作|研究方法|方法论|实验结果|讨论|结论|第[一二三四五六七八九十\d]+[章部分节]\s*[^\n]{1,50}|[一二三四五六七八九十]+、\s*[^\n]{1,50}|(?:[1-9]|1\d)(?:\.\d+)*[.、]?\s+[A-Z\u4e00-\u9fff][^\n]{1,75})$/i;

const SUB_SECTION_HEADING_RE =
  /^(?:[1-9]|1\d)\.\d+(?:\.\d+)*[.、]?\s+[A-Z\u4e00-\u9fff][^\n]{1,75}$/;

const FIGURE_MARKER_RE = /\[\[PRISM_FIGURE:([A-Za-z0-9+/=]+)\]\]/g;
const TABLE_MARKER_RE = /\[\[PRISM_TABLE:([A-Za-z0-9+/=]+)\]\]/g;

function decodePrismMarker<T>(b64: string): T | null {
  try {
    const json =
      typeof Buffer !== "undefined"
        ? Buffer.from(b64, "base64").toString("utf8")
        : decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function isLikelySectionHeading(rawLine: string): boolean {
  const clean = rawLine.replace(/^\s*#+\s*/, "").trim();
  if (!clean || clean.length >= 90) return false;
  // Reject prose sentences or numeric metric statements like "175 billion trainable parameters.1"
  if (/\b(?:billion|million|thousand|parameters|tokens|epochs|percent)\b|%\s*$/i.test(clean)) {
    return false;
  }
  if (/[.!?。！？]\d*$/.test(clean) && !/^(?:references|abstract|introduction|conclusion)/i.test(clean)) {
    return false;
  }
  return SECTION_HEADING_RE.test(clean);
}

function isSubSectionHeading(rawLine: string): boolean {
  const clean = rawLine.replace(/^\s*#+\s*/, "").trim();
  if (!clean || clean.length >= 90) return false;
  if (/[.!?。！？]\d*$/.test(clean)) return false;
  return SUB_SECTION_HEADING_RE.test(clean);
}

function isAcademicNoiseBlock(rawText: string): boolean {
  const text = rawText.trim();
  if (!text) return true;
  if (/\bfootnotemark\s*:/i.test(text)) return true;
  if (/^(?:†|\*|\d+)\s*(?:†\s*)?thanks\s*:/i.test(text)) return true;
  if (/^(?:email|correspondence(?:\s+to)?)\s*:/i.test(text)) return true;
  if (
    /^(?:content selection saved|arxiv is now an independent nonprofit|license:\s*arxiv|provided proper attribution is provided|preprint\.\s*under review|instructions for reporting errors)/i.test(
      text
    )
  ) {
    return true;
  }
  if (text.length < 220 && /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text)) {
    return true;
  }
  if (
    text.length < 180 &&
    /\b(?:equal contribution|listing order is random|work performed while at)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

function preprocessAcademicRawText(rawText: string): string {
  let cleaned = rawText
    .replace(/\r\n/g, "\n")
    .replace(/-\n([A-Za-z])/g, "$1")
    // Strip arXiv PDF running page headers
    .replace(/\barXiv:\d{4}\.\d{4,5}(?:v\d+)?\s*\[[^\]]+\]\s*\d+\s+[A-Za-z]+\s+\d{4}\b/gi, "")
    // Separate glued ALL-CAPS PDF section headings from following prose (e.g. "1 INTRODUCTIONPretrained")
    .replace(
      /(^|\n)((?:[1-9]|1\d)(?:\.\d+)*\s+[A-Z][A-Z\s-]{2,32}?)([A-Z][a-z]{3,}\b)/g,
      "$1$2\n$3"
    )
    .trim();

  // If raw text starts with noisy PDF front-matter (author lists/emails/licenses) before Abstract, start at Abstract
  const absMatch = cleaned.match(/^(?:#+\s*)?abstract\s*$/im);
  if (absMatch && typeof absMatch.index === "number" && absMatch.index > 0) {
    const prefix = cleaned.slice(0, absMatch.index);
    const prefixLines = prefix.split("\n").filter((l) => l.trim().length > 0);
    const hasNoiseSignals =
      prefix.length > 180 ||
      prefixLines.length >= 3 ||
      /@|footnotemark|university|google|arxiv|license|thanks:/i.test(prefix);
    if (hasNoiseSignals && absMatch.index < cleaned.length * 0.35) {
      cleaned = cleaned.slice(absMatch.index).trim();
    }
  }

  return cleaned;
}

function splitOversizedBlock(block: string): string[] {
  const trimmed = block.trim();
  if (/^\[\[PRISM_(?:FIGURE|TABLE):[A-Za-z0-9+/=]+\]\]$/.test(trimmed)) {
    return [trimmed];
  }
  if (/^\$\$[\s\S]+\$\$$/.test(trimmed)) {
    return [trimmed];
  }
  if (block.length <= 820 && !block.includes("\n")) return [block];

  const lines = block.split("\n");
  if (lines.length > 1) {
    // Detect whether single `\n` separates whole paragraphs (web copy-paste) vs wrapped narrow PDF lines
    const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
    const avgLen = nonEmpty.reduce((s, l) => s + l.length, 0) / Math.max(1, nonEmpty.length);
    const sentenceEndingLines = nonEmpty.filter((l) =>
      /[.!?。！？…]["”’')\]]*$/.test(l)
    ).length;
    const looksLikeParagraphPerLine =
      avgLen >= 95 || (nonEmpty.length >= 2 && sentenceEndingLines / nonEmpty.length >= 0.6);

    if (looksLikeParagraphPerLine) {
      return nonEmpty.flatMap((p) => splitOversizedBlock(p));
    }

    const blocks: string[] = [];
    let buffer: string[] = [];
    let bufferChars = 0;
    const flush = () => {
      if (buffer.length > 0) {
        const joined = buffer.join(" ").replace(/\s{2,}/g, " ").trim();
        blocks.push(...(joined.length > 900 ? splitOversizedBlock(joined) : [joined]));
        buffer = [];
        bufferChars = 0;
      }
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        flush();
        continue;
      }
      if (isLikelySectionHeading(line)) {
        flush();
        blocks.push(line);
        continue;
      }
      buffer.push(line);
      bufferChars += line.length + 1;
      const endsSentence = /[.!?。！？]["”’')\]]*$/.test(line);
      const looksLikeShortLastLine = line.length < 66 && endsSentence && bufferChars >= 180;
      if ((bufferChars >= 520 && endsSentence) || looksLikeShortLastLine || bufferChars >= 880) {
        flush();
      }
    }
    flush();
    return blocks;
  }

  // Single unbroken wall of text (> 820 chars): split on sentence boundaries without breaking decimals or Fig./et al.
  const sentences = block
    .split(
      /(?<!\b(?:e\.g|i\.e|et al|Fig|Figs|Tab|Tabs|Eq|Eqs|Sec|Secs|cf|vs|Dr|Prof|Mr|Mrs|Ms|No|Vol|pp|\d))(?<=[.!?]["”’')\]]*)\s+(?=[A-Z\u4e00-\u9fff"“'(\[])|(?<=[。！？]["”’')\]]*)\s*/u
    )
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return [block];

  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    const sep = buf ? (/[\u4e00-\u9fff]/.test(s) ? "" : " ") : "";
    if (buf && buf.length + s.length > 560) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf = `${buf}${sep}${s}`;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function splitPdfLinesIntoBlocks(normalized: string): string[] {
  const initial = normalized.includes("\n\n")
    ? normalized
        .split(/\n{2,}/)
        .map((b) => b.trim())
        .filter((b) => b.length > 0)
    : [normalized];

  return initial.flatMap((block) => splitOversizedBlock(block));
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:application\/pdf;base64,/, "");
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(cleaned, "base64"));
  }
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extractFormulas(text: string): string[] {
  const formulas: string[] = [];
  const blockMatches = text.matchAll(/\$\$([\s\S]+?)\$\$/g);
  for (const m of blockMatches) {
    const f = m[1].trim();
    if (f) formulas.push(f);
  }
  const envMatches = text.matchAll(/\\begin\{(?:equation|align)\*?\}([\s\S]+?)\\end\{(?:equation|align)\*?\}/g);
  for (const m of envMatches) {
    const f = m[1].trim();
    if (f) formulas.push(f);
  }
  return formulas;
}

function normalizeSectionId(title: string, idx: number): string {
  const numMatch = title.match(/^(\d+(?:\.\d+)*)/);
  if (numMatch) {
    return `sec-${numMatch[1].replace(/\./g, "-")}`;
  }
  if (/^abstract$/i.test(title)) return "sec-abstract";
  if (/^conclusion/i.test(title)) return "sec-conclusion";
  return `sec-${idx}`;
}

function effectiveProseLength(text: string): number {
  const cjkCount = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return text.length + Math.round(cjkCount * 2.5);
}

interface PendingRawUnit {
  sectionId: string;
  sectionTitle: string;
  rawPrimaryText: string;
  formulas: string[];
  figures: FigureBlock[];
  dataTable?: DataTableBlock;
}

export function parsePaperTextIntoUnits(rawText: string): SourceUnit[] {
  const normalized = preprocessAcademicRawText(rawText);
  if (!normalized) return [];

  const blocks = splitPdfLinesIntoBlocks(normalized);

  const rawUnits: PendingRawUnit[] = [];
  let currentSectionId = "sec-abstract";
  let currentSectionTitle = "Abstract / Opening";
  let sectionCounter = 1;
  let lastHeadingSawUnit = false;

  let pendingFigures: FigureBlock[] = [];
  let pendingTable: DataTableBlock | undefined;
  let pendingPrefix: string[] = [];
  let expectPostFormulaMerge = false;

  const getPrevInSameSection = (): PendingRawUnit | undefined => {
    if (!lastHeadingSawUnit || rawUnits.length === 0) return undefined;
    const candidate = rawUnits[rawUnits.length - 1];
    return candidate.sectionId === currentSectionId ? candidate : undefined;
  };

  const attachPendingMediaToPrev = (target: PendingRawUnit) => {
    if (pendingFigures.length > 0) {
      target.figures.push(...pendingFigures);
      pendingFigures = [];
    }
    if (pendingTable && !target.dataTable) {
      target.dataTable = pendingTable;
      pendingTable = undefined;
    }
  };

  for (const rawBlock of blocks) {
    let block = rawBlock;

    // 1. Decode embedded figure / table markers from HTML fetcher
    for (const m of block.matchAll(FIGURE_MARKER_RE)) {
      const fig = decodePrismMarker<FigureBlock>(m[1]);
      if (fig) pendingFigures.push(fig);
    }
    block = block.replace(FIGURE_MARKER_RE, "").trim();

    for (const m of block.matchAll(TABLE_MARKER_RE)) {
      const tbl = decodePrismMarker<{ caption?: string; headers: string[]; rows: string[][] }>(m[1]);
      if (tbl && tbl.headers?.length > 0 && tbl.rows?.length > 0) {
        pendingTable = { headers: tbl.headers, rows: tbl.rows };
      }
    }
    block = block.replace(TABLE_MARKER_RE, "").trim();

    if (!block) continue;

    // 2. Skip boilerplate UI/author/email/footnote fragments
    if (isAcademicNoiseBlock(block)) continue;

    const lines = block.split("\n").map((l) => l.trim());
    const firstLine = lines[0] ?? "";

    // 3. Handle headings & subsections
    let bodyText = lines.join(" ").trim();
    if (lines.length === 1 && isSubSectionHeading(firstLine)) {
      pendingPrefix.push(`[${firstLine.replace(/^\s*#+\s*/, "")}]`);
      continue;
    }

    if (isLikelySectionHeading(firstLine)) {
      const cleanHeading = firstLine.replace(/^\s*#+\s*/, "");
      if (isSubSectionHeading(cleanHeading)) {
        pendingPrefix.push(`[${cleanHeading}]`);
        if (lines.length === 1) continue;
        bodyText = lines.slice(1).join(" ").trim();
      } else {
        // Attach any trailing pending media before switching sections
        const prev = getPrevInSameSection();
        if (prev) attachPendingMediaToPrev(prev);

        currentSectionTitle = cleanHeading;
        currentSectionId = normalizeSectionId(currentSectionTitle, sectionCounter++);
        pendingPrefix = [];
        expectPostFormulaMerge = false;
        lastHeadingSawUnit = false;

        if (
          /^(references|bibliography|appendix|acknowledgments?|acknowledgements?|instructions for reporting errors)/i.test(
            currentSectionTitle
          )
        ) {
          break;
        }
        if (lines.length === 1) continue;
        bodyText = lines.slice(1).join(" ").trim();
      }
    }

    // 4. Standalone PDF figure caption lines (no HTML image URL available, preserve anchor)
    const captionMatch = bodyText.match(/^(?:Figure|Fig\.|图)\s*(\d+)\s*[:.：]\s*(.+)/i);
    if (captionMatch && bodyText.length < 320 && !bodyText.includes("$$")) {
      pendingFigures.push({
        label: `Figure ${captionMatch[1]}`,
        caption: bodyText,
        imageUrls: [],
      });
      continue;
    }

    // 5. Merge standalone display equations into the preceding paragraph
    if (/^\$\$[\s\S]+\$\$$/.test(bodyText)) {
      const prev = getPrevInSameSection();
      if (prev) {
        prev.rawPrimaryText = `${prev.rawPrimaryText}\n\n${bodyText}`;
        prev.formulas.push(...extractFormulas(bodyText));
        expectPostFormulaMerge = true;
        continue;
      }
    }

    // 6. Keep bullet list items attached to their introducing paragraph
    if (bodyText.startsWith("• ")) {
      if (pendingPrefix.length > 0) {
        bodyText = `${pendingPrefix.join(" ")}\n${bodyText}`;
        pendingPrefix = [];
      }
      const prev = getPrevInSameSection();
      if (
        prev &&
        (prev.rawPrimaryText.trim().endsWith(":") || prev.rawPrimaryText.includes("\n• ") || prev.rawPrimaryText.startsWith("• "))
      ) {
        prev.rawPrimaryText = `${prev.rawPrimaryText}\n${bodyText}`;
        attachPendingMediaToPrev(prev);
        continue;
      }
    }

    // 7. Buffer run-in labels / colon lead-ins into the following paragraph
    if (bodyText.endsWith(":") && bodyText.length < 130 && !bodyText.includes("$$")) {
      pendingPrefix.push(bodyText);
      continue;
    }

    if (pendingPrefix.length > 0) {
      bodyText = `${pendingPrefix.join(" ")} ${bodyText}`;
      pendingPrefix = [];
    }

    if (bodyText.length < 30 && pendingFigures.length === 0 && !pendingTable) {
      continue;
    }

    const prev = getPrevInSameSection();
    if (prev) {
      // Merge post-formula variable definitions ("where pos is...") back with the formula paragraph
      if (
        expectPostFormulaMerge &&
        (/^(?:where|here|with|and|in which|this corresponds|while )/i.test(bodyText) ||
          bodyText.length < 260)
      ) {
        prev.rawPrimaryText = `${prev.rawPrimaryText}\n\n${bodyText}`;
        prev.formulas.push(...extractFormulas(bodyText));
        attachPendingMediaToPrev(prev);
        expectPostFormulaMerge = false;
        continue;
      }
      expectPostFormulaMerge = false;

      // Compact stray 1-sentence fragments inside the same section into coherent reading blocks
      const prevLen = effectiveProseLength(prev.rawPrimaryText);
      const currIsPureAsciiShort = !/[\u4e00-\u9fff]/.test(bodyText) && bodyText.length < 180;
      const shouldMergeForwardIntro = prevLen < 95 && prev.rawPrimaryText.length + bodyText.length <= 860;
      const shouldMergeShortBody =
        (prevLen < 105 || currIsPureAsciiShort) &&
        prev.rawPrimaryText.length + bodyText.length <= 860 &&
        !bodyText.startsWith("[");
      if (shouldMergeForwardIntro || shouldMergeShortBody) {
        prev.rawPrimaryText = `${prev.rawPrimaryText}\n\n${bodyText}`;
        prev.formulas.push(...extractFormulas(bodyText));
        attachPendingMediaToPrev(prev);
        continue;
      }
    } else {
      expectPostFormulaMerge = false;
    }

    const newUnit: PendingRawUnit = {
      sectionId: currentSectionId,
      sectionTitle: currentSectionTitle,
      rawPrimaryText: bodyText,
      formulas: extractFormulas(bodyText),
      figures: pendingFigures,
      dataTable: pendingTable,
    };
    pendingFigures = [];
    pendingTable = undefined;
    rawUnits.push(newUnit);
    lastHeadingSawUnit = true;
  }

  // Attach any trailing media/table to the final unit
  if ((pendingFigures.length > 0 || pendingTable) && rawUnits.length > 0) {
    attachPendingMediaToPrev(rawUnits[rawUnits.length - 1]);
  }

  const perSectionCounts = new Map<string, number>();
  const hydrated: SourceUnit[] = [];
  for (const item of rawUnits) {
    const nextIdx = (perSectionCounts.get(item.sectionId) ?? 0) + 1;
    perSectionCounts.set(item.sectionId, nextIdx);

    const secShort = item.sectionId.replace("sec-", "§");
    const unitCode =
      item.sectionId === "sec-abstract" ? `Abs.P${nextIdx}` : `${secShort}.P${nextIdx}`;

    const hasMeta = item.formulas.length > 0 || item.figures.length > 0 || Boolean(item.dataTable);
    hydrated.push({
      id: `${item.sectionId}-p${nextIdx}`,
      unitCode,
      sectionId: item.sectionId,
      sectionTitle: item.sectionTitle,
      primaryKind: "prose",
      rawPrimaryText: item.rawPrimaryText,
      metadata: hasMeta
        ? {
            formulas: item.formulas.length > 0 ? item.formulas : undefined,
            figures: item.figures.length > 0 ? item.figures : undefined,
            dataTable: item.dataTable,
          }
        : undefined,
    });
    if (hydrated.length >= 80) break;
  }

  return hydrated;
}

export async function ingestAcademicPaper(payload: RawSourcePayload): Promise<SourceUnit[]> {
  let text = payload.content;

  if (payload.kind === "pdf-base64") {
    const { extractText } = await import("unpdf");
    const bytes = decodeBase64ToUint8Array(payload.content);
    const extracted = await extractText(bytes, { mergePages: false });
    text = Array.isArray(extracted.text) ? extracted.text.join("\n") : String(extracted.text);
  } else if (payload.kind === "remote-url") {
    const rawTarget = payload.content.trim();
    const arxivId = parseArxivIdentifier(rawTarget);
    if (arxivId) {
      const htmlPaper = await fetchArxivHtmlPaper(arxivId);
      if (htmlPaper) {
        if (htmlPaper.title && !payload.title) {
          payload.title = htmlPaper.title;
        }
        text = htmlPaper.text;
      } else {
        const { bytes, meta } = await fetchArxivPaperPdf(arxivId);
        if (meta?.title && !payload.title) {
          payload.title = meta.title;
        }
        const { extractText } = await import("unpdf");
        const extracted = await extractText(bytes, { mergePages: false });
        text = Array.isArray(extracted.text) ? extracted.text.join("\n") : String(extracted.text);
      }
    } else if (/^https?:\/\/.+\.pdf(?:$|\?)/i.test(rawTarget)) {
      const resp = await fetch(rawTarget);
      if (!resp.ok) {
        throw new Error(`下载远程 PDF 失败 (${resp.status}): ${rawTarget}`);
      }
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const { extractText } = await import("unpdf");
      const extracted = await extractText(bytes, { mergePages: false });
      text = Array.isArray(extracted.text) ? extracted.text.join("\n") : String(extracted.text);
    } else if (/^https?:\/\//i.test(rawTarget)) {
      const page = await fetchCleanWebPage(rawTarget);
      if (page.title && !payload.title) {
        payload.title = page.title;
      }
      text = page.text;
    } else {
      throw new Error("未能识别该 arXiv 编号或论文链接，请使用如 1706.03762 或 https://arxiv.org/abs/2106.09685 的格式。");
    }
  }

  return parsePaperTextIntoUnits(text);
}
