import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface V2tSegment {
  start: number;
  end: number;
  text: string;
}

export interface V2tSourceMeta {
  input?: string;
  final_url?: string;
  platform?: string;
  id?: string;
  title?: string;
  uploader?: string;
  duration?: number;
}

export interface V2tTranscriptResult {
  source: V2tSourceMeta;
  segments: V2tSegment[];
  pageText: string;
}

function resolveV2tScriptPath(): string {
  const candidates: string[] = [];
  if (process.env.V2T_SCRIPT_PATH?.trim()) {
    candidates.push(process.env.V2T_SCRIPT_PATH.trim());
  }
  // 1) Bundled inside standalone / hot-standalone or repo scripts/
  candidates.push(path.join(process.cwd(), "scripts", "v2t.py"));
  const resPath = (process as { resourcesPath?: string }).resourcesPath;
  if (resPath) {
    candidates.push(path.join(resPath, "standalone", "scripts", "v2t.py"));
    candidates.push(path.join(resPath, "v2t", "v2t.py"));
  }
  // 2) User skill path fallback
  candidates.push(path.join(os.homedir(), ".agents", "skills", "video-to-text", "scripts", "v2t.py"));

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[candidates.length - 1];
}

function resolvePythonBinary(): string {
  const home = os.homedir();
  const candidates =
    process.platform === "win32"
      ? [
          path.join(home, "miniconda3", "python.exe"),
          path.join(home, "anaconda3", "python.exe"),
          path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python312", "python.exe"),
          path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python311", "python.exe"),
          "python",
        ]
      : [
          "/opt/miniconda3/bin/python3",
          "/opt/homebrew/bin/python3",
          path.join(home, "miniconda3", "bin", "python3"),
          path.join(home, "anaconda3", "bin", "python3"),
          "/usr/local/bin/python3",
          "python3",
        ];
  for (const bin of candidates) {
    if (!bin) continue;
    if (bin === "python3" || bin === "python" || fs.existsSync(bin)) {
      return bin;
    }
  }
  return process.platform === "win32" ? "python" : "python3";
}

export function isV2tAvailable(): boolean {
  if (process.env.VITEST) return false;
  return fs.existsSync(resolveV2tScriptPath());
}

function formatMmSs(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = String(Math.floor(s / 60)).padStart(2, "0");
  const secs = String(s % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function extractChaptersFromPageText(pageText: string): Array<{ time: string; title: string }> {
  const lines = pageText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const startIdx = lines.findIndex((l) => l.includes("章节"));
  if (startIdx === -1) return [];

  const chapters: Array<{ time: string; title: string }> = [];
  let prevSec = -1;
  let i = startIdx + 1;

  while (i < lines.length - 1 && chapters.length < 12) {
    const timeMatch = lines[i].match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) {
      i += 1;
      continue;
    }
    const sec = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
    const title = lines[i + 1];
    const ok = Boolean(title && title.length <= 40 && sec > prevSec);
    if (!ok) {
      if (chapters.length > 0) break;
      i += 1;
      continue;
    }
    chapters.push({ time: lines[i], title });
    prevSec = sec;
    i += 2;
  }

  return chapters;
}

/**
 * Converts a local v2t ASR transcript result into structured Markdown sections
 * suitable for chunked reading analysis.
 */
export function formatV2tResultToSections(
  result: V2tTranscriptResult,
  startSectionIndex: number
): string[] {
  const sections: string[] = [];
  let nextIdx = startSectionIndex;

  const chapters = extractChaptersFromPageText(result.pageText);
  if (chapters.length > 0) {
    const chapterLines = chapters.map((c) => `- [${c.time}] ${c.title}`).join("\n");
    sections.push(`# ${nextIdx}. 视频自带章节要点\n${chapterLines}`);
    nextIdx += 1;
  }

  // Group ASR segments into ~180-char semantic blocks with [MM:SS] anchors
  const paragraphs: string[] = [];
  let buf: string[] = [];
  let blockStart: number | null = null;
  let bufLen = 0;

  const flushBuf = () => {
    if (buf.length === 0 || blockStart === null) return;
    let joined = buf
      .map((s) => s.trim())
      .filter(Boolean)
      .join("，");
    if (joined && !/[。！？.!?]$/.test(joined)) {
      joined += "。";
    }
    if (joined) {
      paragraphs.push(`[${formatMmSs(blockStart)}] ${joined}`);
    }
    buf = [];
    blockStart = null;
    bufLen = 0;
  };

  for (const seg of result.segments) {
    const t = seg.text.trim();
    if (!t) continue;
    if (blockStart === null) blockStart = seg.start;
    buf.push(t);
    bufLen += t.length;
    if (bufLen >= 170) {
      flushBuf();
    }
  }
  flushBuf();

  if (paragraphs.length > 0) {
    sections.push(
      `# ${nextIdx}. 视频语音转写正文（本地 ASR 逐段实录）\n${paragraphs.join("\n\n")}`
    );
  }

  return sections;
}

/**
 * Invokes the local video-to-text skill (`v2t.py`) with persistent disk caching
 * under `.v2t-cache/<cacheKey>/`.
 */
export async function runVideoToTextBridge(
  url: string,
  cacheKey: string,
  lang = "zh"
): Promise<V2tTranscriptResult | null> {
  const scriptPath = resolveV2tScriptPath();
  if (!fs.existsSync(scriptPath)) return null;

  const safeKey = cacheKey.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 72) || "video";
  const cacheRoot =
    process.env.PURRPARSE_CACHE_DIR?.trim() || path.join(process.cwd(), ".v2t-cache");
  const workDir = path.join(cacheRoot, safeKey);
  const transcriptJsonPath = path.join(workDir, "transcript.json");
  const sourceJsonPath = path.join(workDir, "source.json");
  const pageTxtPath = path.join(workDir, "page.txt");
  const outMdPath = path.join(workDir, "transcript.md");

  const readCached = (): V2tTranscriptResult | null => {
    if (!fs.existsSync(transcriptJsonPath)) return null;
    try {
      const tData = JSON.parse(fs.readFileSync(transcriptJsonPath, "utf8")) as {
        segments?: V2tSegment[];
      };
      const segments = Array.isArray(tData.segments) ? tData.segments : [];
      if (segments.length === 0) return null;
      const source = fs.existsSync(sourceJsonPath)
        ? (JSON.parse(fs.readFileSync(sourceJsonPath, "utf8")) as V2tSourceMeta)
        : {};
      const pageText = fs.existsSync(pageTxtPath)
        ? fs.readFileSync(pageTxtPath, "utf8")
        : "";
      return { source, segments, pageText };
    } catch {
      return null;
    }
  };

  const cached = readCached();
  if (cached) return cached;

  fs.mkdirSync(workDir, { recursive: true });
  const pythonBin = resolvePythonBinary();
  const homeBin = path.join(os.homedir(), ".local", "bin");
  const augmentedPath =
    process.platform === "win32"
      ? `${homeBin};${process.env.PATH ?? ""}`
      : `${homeBin}:/opt/miniconda3/bin:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ""}`;

  try {
    await execFileAsync(
      pythonBin,
      [scriptPath, "run", url, "-o", outMdPath, "--workdir", workDir, "--lang", lang],
      {
        timeout: 25 * 60 * 1000,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: augmentedPath,
          PYTHONUTF8: "1",
          PYTHONIOENCODING: "utf-8",
        },
      }
    );
  } catch (err) {
    const stderr =
      typeof (err as { stderr?: unknown })?.stderr === "string"
        ? (err as { stderr: string }).stderr.trim().slice(-500)
        : "";
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[v2t] bridge execution failed", {
      scriptPath,
      pythonBin,
      cacheKey: safeKey,
      message: msg,
      stderr: stderr || undefined,
    });
    // Check whether ASR completed just before timeout/kill and wrote valid transcript.json
    const recoveredAfterErr = readCached();
    if (recoveredAfterErr) {
      return recoveredAfterErr;
    }
    throw new Error(stderr ? `${msg} (${stderr.split(/\r?\n/).pop() || ""})` : msg);
  }

  return readCached();
}
