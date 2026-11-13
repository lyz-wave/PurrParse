import type { FigureBlock } from "@/core/contracts/document-ast";
import type { RawSourcePayload, SourceUnit } from "@/core/contracts/mode-plugin";
import { fetchCleanWebPage } from "@/core/engine/web-fetchers";

const FIGURE_MARKER_RE = /\[\[PRISM_FIGURE:([A-Za-z0-9+/=]+)\]\]/g;

function decodeFigureMarker(b64: string): FigureBlock | null {
  try {
    const json =
      typeof Buffer !== "undefined"
        ? Buffer.from(b64, "base64").toString("utf8")
        : decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as FigureBlock;
  } catch {
    return null;
  }
}

const SRT_TIMECODE_RE = /^\d{1,2}:\d{2}:\d{2}(?:[,.]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}:\d{2}(?:[,.]\d{1,3})?.*$/;
const SRT_INDEX_RE = /^\d+$/;
const VTT_HEADER_RE = /^WEBVTT(?:\s.*)?$/i;
const STAGE_TAG_RE = /\[(?:music|applause|laughter|silence|inaudible)\]/gi;
const HEADING_RE =
  /^(?:#{1,4}\s+.+|(?:part|arc|phase|step)\s+\d+[:.)\s-]+.+|(?:morning|daytime|afternoon|evening|night)\s*[:—-].+|第[一二三四五六七八九十\d]+[部分章节讲][：:\s]+.+|[一二三四五六七八九十]+、\s*.+|\d+(?:\.\d+)*[.、]\s+\S.{1,60})$/i;

function wordCount(text: string): number {
  const asciiWords = text.match(/[A-Za-z0-9'-]+/g)?.length ?? 0;
  const cjkChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return asciiWords + cjkChars;
}

function splitBySentences(text: string, targetWords = 135): string[] {
  const sentences = text
    .split(
      /(?<!\b(?:e\.g|i\.e|et al|Fig|Dr|Mr|Ms|No|\d))(?<=[.!?]["”’')\]]*)\s+(?=[A-Z\u4e00-\u9fff"“'(\[])|(?<=[。！？]["”’')\]]*)\s*/u
    )
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return [text.trim()];

  const chunks: string[] = [];
  let buf: string[] = [];

  for (const s of sentences) {
    buf.push(s);
    const joined = buf.join(buf.some((x) => /[\u4e00-\u9fff]/.test(x)) ? "" : " ");
    if (wordCount(joined) >= targetWords) {
      chunks.push(joined.trim());
      buf = [];
    }
  }
  if (buf.length > 0) {
    const rest = buf.join(buf.some((x) => /[\u4e00-\u9fff]/.test(x)) ? "" : " ").trim();
    if (chunks.length > 0 && wordCount(rest) < 35) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}${/[\u4e00-\u9fff]/.test(rest) ? "" : " "}${rest}`;
    } else if (rest) {
      chunks.push(rest);
    }
  }
  return chunks;
}

export function cleanTranscriptLines(rawText: string): string[] {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const cleaned: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) {
      cleaned.push("");
      continue;
    }
    if (VTT_HEADER_RE.test(line) || SRT_TIMECODE_RE.test(line) || SRT_INDEX_RE.test(line)) {
      continue;
    }
    line = line
      .replace(STAGE_TAG_RE, "")
      .replace(/\b(?:um+|uh+|er+|ah+)\b,?\s*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (line) {
      cleaned.push(line);
    }
  }

  return cleaned;
}

/**
 * Thought-Cluster Aggregator:
 * Handles web-pasted articles (single or double newlines), Chinese/English walls of text,
 * Dan Koe-style one-sentence lines, and SRT/VTT video transcripts into 120~240 word cohesive units.
 */
export function aggregateThoughtClusters(rawText: string): SourceUnit[] {
  const lines = cleanTranscriptLines(rawText);
  const nonEmpty = lines.filter((l) => l !== "");
  if (nonEmpty.length === 0) return [];

  const blankLineCount = lines.filter((l) => l === "").length;
  const avgLineWords =
    nonEmpty.reduce((acc, l) => acc + wordCount(l), 0) / Math.max(1, nonEmpty.length);
  // If user pasted prose with single `\n` between paragraphs (no blank lines, long lines), treat each line as a paragraph.
  const treatSingleNewlineAsParagraph = blankLineCount === 0 && nonEmpty.length >= 2 && avgLineWords >= 28;

  const segments: Array<{ isHeading: boolean; text: string }> = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length > 0) {
      segments.push({ isHeading: false, text: buffer.join("\n").trim() });
      buffer = [];
    }
  };

  for (const line of lines) {
    if (line === "") {
      flushBuffer();
      continue;
    }
    if (HEADING_RE.test(line) && line.length < 100) {
      flushBuffer();
      segments.push({ isHeading: true, text: line.replace(/^#+\s*/, "").trim() });
      continue;
    }
    if (treatSingleNewlineAsParagraph) {
      flushBuffer();
      segments.push({ isHeading: false, text: line });
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();

  // Split any oversized block (> 220 words, English or Chinese, with or without `\n`) cleanly along sentence/line boundaries
  const expandedSegments: Array<{ isHeading: boolean; text: string }> = [];
  for (const seg of segments) {
    if (seg.isHeading) {
      expandedSegments.push(seg);
      continue;
    }
    if (wordCount(seg.text) <= 220) {
      expandedSegments.push(seg);
      continue;
    }

    const subLines = seg.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (subLines.length >= 2) {
      for (const sub of subLines) {
        if (wordCount(sub) > 220) {
          for (const piece of splitBySentences(sub, 140)) {
            expandedSegments.push({ isHeading: false, text: piece });
          }
        } else {
          expandedSegments.push({ isHeading: false, text: sub });
        }
      }
    } else {
      for (const piece of splitBySentences(seg.text, 140)) {
        expandedSegments.push({ isHeading: false, text: piece });
      }
    }
  }

  const units: SourceUnit[] = [];
  let arcIndex = 1;
  let currentSectionId = "sec-arc1";
  let currentSectionTitle = "Arc 1 · 痛点刺穿与核心母题";
  let clusterParts: string[] = [];
  let clusterFigures: FigureBlock[] = [];
  let unitNum = 0;

  const flushCluster = () => {
    const joined = clusterParts.join("\n\n").trim();
    if (!joined) return;
    if (
      wordCount(joined) < 40 &&
      units.length > 0 &&
      units[units.length - 1].sectionId === currentSectionId
    ) {
      const prev = units[units.length - 1];
      prev.rawPrimaryText = `${prev.rawPrimaryText}\n\n${joined}`;
      if (clusterFigures.length > 0) {
        prev.metadata = {
          ...prev.metadata,
          figures: [...(prev.metadata?.figures ?? []), ...clusterFigures],
        };
      }
      clusterParts = [];
      clusterFigures = [];
      return;
    }
    unitNum += 1;
    const code = `UNIT #${String(unitNum).padStart(2, "0")}`;
    units.push({
      id: `unit-${String(unitNum).padStart(2, "0")}`,
      unitCode: code,
      sectionId: currentSectionId,
      sectionTitle: currentSectionTitle,
      primaryKind: "prose",
      rawPrimaryText: joined,
      metadata: clusterFigures.length > 0 ? { figures: clusterFigures } : undefined,
    });
    clusterParts = [];
    clusterFigures = [];
  };

  for (const seg of expandedSegments) {
    let segText = seg.text;
    if (!seg.isHeading) {
      for (const m of segText.matchAll(FIGURE_MARKER_RE)) {
        const fig = decodeFigureMarker(m[1]);
        if (fig) clusterFigures.push(fig);
      }
      segText = segText.replace(FIGURE_MARKER_RE, "").trim();
      if (!segText) continue;
    }

    if (seg.isHeading) {
      flushCluster();
      arcIndex += 1;
      currentSectionId = `sec-arc${arcIndex}`;
      currentSectionTitle = segText;
      continue;
    }

    const pendingWords = wordCount(clusterParts.join(" "));
    const segWords = wordCount(segText);
    if (clusterParts.length > 0 && pendingWords + segWords > 240) {
      flushCluster();
    }

    clusterParts.push(segText);
    if (wordCount(clusterParts.join(" ")) >= 120) {
      flushCluster();
    }
  }
  flushCluster();

  if (clusterFigures.length > 0 && units.length > 0) {
    const last = units[units.length - 1];
    last.metadata = {
      ...last.metadata,
      figures: [...(last.metadata?.figures ?? []), ...clusterFigures],
    };
  }

  return units;
}

export async function ingestCognitiveEssay(payload: RawSourcePayload): Promise<SourceUnit[]> {
  if (payload.kind === "remote-url") {
    const page = await fetchCleanWebPage(payload.content);
    if (page.title && !payload.title) {
      payload.title = page.title;
    }
    return aggregateThoughtClusters(page.text);
  }
  return aggregateThoughtClusters(payload.content);
}
