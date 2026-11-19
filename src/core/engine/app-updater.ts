export const APP_GITHUB_REPO = "lyz-wave/PurrParse";
export const APP_RELEASES_PAGE_URL = `https://github.com/${APP_GITHUB_REPO}/releases`;
export const APP_LATEST_RELEASE_URL = `${APP_RELEASES_PAGE_URL}/latest`;
export const APP_DOWNLOAD_PAGE_URL = "https://purrparse.xyz";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "1.1.6";

export type AppUpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";

export type AppUpdatePlatform = "darwin" | "win32" | "linux" | "web";
export type AppUpdateArch = "arm64" | "x64" | "unknown";
export type AppUpdateInstallMode = "self-replace" | "installer" | "external-download";
export type AppUpdateSource = "github-api" | "github-redirect";

export interface ReleaseAssetMeta {
  name: string;
  browser_download_url: string;
  size?: number;
}

export interface AppUpdateState {
  status: AppUpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseNotes: string;
  releaseUrl: string;
  publishedAt: string | null;
  assetName: string | null;
  downloadUrl: string | null;
  assetSize: number | null;
  progressPercent: number;
  transferredBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  downloadedFilePath: string | null;
  canAutoInstall: boolean;
  installMode: AppUpdateInstallMode;
  checkedAt: number | null;
  error: string | null;
  source: AppUpdateSource | null;
}

/** Strips whitespace and any leading "v"/"V" prefix from a semver string. */
export function normalizeVersion(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^v+/i, "");
}

interface ParsedSemver {
  core: [number, number, number];
  prerelease: string[];
}

function parseSemver(raw: string): ParsedSemver {
  const cleaned = normalizeVersion(raw);
  const [mainPart, prePart = ""] = cleaned.split("-", 2);
  const [majRaw, minRaw, patchRaw] = (mainPart || "0.0.0").split(".");
  const toNum = (val?: string): number => {
    const n = Number.parseInt((val || "0").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    core: [toNum(majRaw), toNum(minRaw), toNum(patchRaw)],
    prerelease: prePart ? prePart.split(".").filter(Boolean) : [],
  };
}

/**
 * Compares two semver strings numerically.
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] > pb.core[i]) return 1;
    if (pa.core[i] < pb.core[i]) return -1;
  }
  const aPre = pa.prerelease;
  const bPre = pb.prerelease;
  if (aPre.length === 0 && bPre.length === 0) return 0;
  if (aPre.length === 0) return 1;
  if (bPre.length === 0) return -1;

  const len = Math.max(aPre.length, bPre.length);
  for (let i = 0; i < len; i++) {
    const segA = aPre[i];
    const segB = bPre[i];
    if (segA === undefined) return -1;
    if (segB === undefined) return 1;
    const numA = /^\d+$/.test(segA) ? Number.parseInt(segA, 10) : null;
    const numB = /^\d+$/.test(segB) ? Number.parseInt(segB, 10) : null;
    if (numA !== null && numB !== null) {
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    } else if (numA !== null) {
      return -1;
    } else if (numB !== null) {
      return 1;
    } else if (segA !== segB) {
      return segA > segB ? 1 : -1;
    }
  }
  return 0;
}

/** Returns the expected release asset filename for a target platform and architecture. */
export function buildExpectedAssetName(
  version: string,
  platform: AppUpdatePlatform,
  arch: AppUpdateArch
): string | null {
  const clean = normalizeVersion(version);
  if (!clean) return null;
  if (platform === "darwin") {
    const resolvedArch = arch === "x64" ? "x64" : "arm64";
    return `PurrParse-${clean}-mac-${resolvedArch}.dmg`;
  }
  if (platform === "win32") {
    const resolvedArch = arch === "arm64" ? "arm64" : "x64";
    return `PurrParse-${clean}-win-${resolvedArch}-Setup.exe`;
  }
  return null;
}

/** Selects the best matching release installer asset for the given OS/arch. */
export function selectPlatformAsset(
  assets: ReleaseAssetMeta[],
  platform: AppUpdatePlatform,
  arch: AppUpdateArch,
  version: string
): ReleaseAssetMeta | null {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const expected = buildExpectedAssetName(version, platform, arch);
  if (expected) {
    const exact = assets.find(
      (item) => item?.name && item.name.toLowerCase() === expected.toLowerCase()
    );
    if (exact) return exact;
  }

  if (platform === "darwin") {
    const archToken = arch === "x64" ? "x64" : "arm64";
    const dmgWithArch = assets.find((item) => {
      const lower = (item?.name || "").toLowerCase();
      return lower.endsWith(".dmg") && lower.includes("mac") && lower.includes(archToken);
    });
    if (dmgWithArch) return dmgWithArch;
    const anyDmg = assets.find((item) => (item?.name || "").toLowerCase().endsWith(".dmg"));
    if (anyDmg) return anyDmg;
  }

  if (platform === "win32") {
    const archToken = arch === "arm64" ? "arm64" : "x64";
    const winWithArch = assets.find((item) => {
      const lower = (item?.name || "").toLowerCase();
      return lower.endsWith(".exe") && lower.includes("win") && lower.includes(archToken);
    });
    if (winWithArch) return winWithArch;
    const anySetupExe = assets.find((item) => {
      const lower = (item?.name || "").toLowerCase();
      return lower.endsWith("-setup.exe") || lower.endsWith(".exe");
    });
    if (anySetupExe) return anySetupExe;
  }

  return null;
}

/** Detects client OS & CPU architecture heuristically when running inside a browser. */
export function detectClientPlatformArch(): {
  platform: AppUpdatePlatform;
  arch: AppUpdateArch;
} {
  if (typeof navigator === "undefined") {
    return { platform: "web", arch: "unknown" };
  }
  const ua = `${navigator.userAgent || ""} ${(navigator as { platform?: string }).platform || ""}`.toLowerCase();
  if (ua.includes("mac") || ua.includes("darwin")) {
    const arch: AppUpdateArch = ua.includes("intel") && !ua.includes("arm") ? "x64" : "arm64";
    return { platform: "darwin", arch };
  }
  if (ua.includes("win")) {
    const arch: AppUpdateArch = ua.includes("arm64") || ua.includes("woa64") ? "arm64" : "x64";
    return { platform: "win32", arch };
  }
  if (ua.includes("linux")) {
    return { platform: "linux", arch: ua.includes("arm64") || ua.includes("aarch64") ? "arm64" : "x64" };
  }
  return { platform: "web", arch: "unknown" };
}

/** Formats byte counts into compact human-readable labels. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx++;
  }
  return `${idx === 0 ? Math.round(value) : value.toFixed(1)} ${units[idx]}`;
}

export function createInitialUpdateState(
  currentVersion = APP_VERSION,
  isDesktop = false
): AppUpdateState {
  return {
    status: "idle",
    currentVersion: normalizeVersion(currentVersion) || "1.1.6",
    latestVersion: null,
    hasUpdate: false,
    releaseNotes: "",
    releaseUrl: APP_RELEASES_PAGE_URL,
    publishedAt: null,
    assetName: null,
    downloadUrl: null,
    assetSize: null,
    progressPercent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    bytesPerSecond: 0,
    downloadedFilePath: null,
    canAutoInstall: false,
    installMode: isDesktop ? "installer" : "external-download",
    checkedAt: null,
    error: null,
    source: null,
  };
}

export interface FetchLatestReleaseOptions {
  currentVersion: string;
  platform: AppUpdatePlatform;
  arch: AppUpdateArch;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface LatestReleaseResolution {
  currentVersion: string;
  latestVersion: string;
  tagName: string;
  hasUpdate: boolean;
  releaseNotes: string;
  releaseUrl: string;
  publishedAt: string | null;
  assetName: string | null;
  downloadUrl: string | null;
  assetSize: number | null;
  source: AppUpdateSource;
}

function buildDirectAssetFallbackUrl(
  tagName: string,
  platform: AppUpdatePlatform,
  arch: AppUpdateArch
): { assetName: string | null; downloadUrl: string | null } {
  const expected = buildExpectedAssetName(tagName, platform, arch);
  if (!expected) {
    return { assetName: null, downloadUrl: null };
  }
  return {
    assetName: expected,
    downloadUrl: `${APP_RELEASES_PAGE_URL}/download/${encodeURIComponent(tagName)}/${encodeURIComponent(expected)}`,
  };
}

/**
 * Resolves the latest PurrParse release using a two-tier strategy:
 * 1) GitHub REST API (full metadata + release notes + exact asset sizes)
 * 2) GitHub /releases/latest HTTP redirect fallback (not subject to API rate limits)
 */
export async function fetchLatestReleaseInfo({
  currentVersion,
  platform,
  arch,
  fetchImpl = fetch,
  timeoutMs = 8000,
}: FetchLatestReleaseOptions): Promise<LatestReleaseResolution> {
  const cleanCurrent = normalizeVersion(currentVersion) || "1.1.6";

  // Tier 1: GitHub REST API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const apiRes = await fetchImpl(
        `https://api.github.com/repos/${APP_GITHUB_REPO}/releases/latest`,
        {
          method: "GET",
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": `PurrParse/${cleanCurrent}`,
          },
          cache: "no-store",
          signal: controller.signal,
        }
      );

      if (apiRes.ok) {
        const data = (await apiRes.json()) as {
          tag_name?: string;
          body?: string;
          html_url?: string;
          published_at?: string;
          assets?: ReleaseAssetMeta[];
        };
        const rawTag = typeof data.tag_name === "string" ? data.tag_name.trim() : "";
        const latestVersion = normalizeVersion(rawTag);
        if (latestVersion) {
          const matchedAsset = selectPlatformAsset(
            Array.isArray(data.assets) ? data.assets : [],
            platform,
            arch,
            latestVersion
          );
          const fallbackAsset = buildDirectAssetFallbackUrl(rawTag || `v${latestVersion}`, platform, arch);
          return {
            currentVersion: cleanCurrent,
            latestVersion,
            tagName: rawTag || `v${latestVersion}`,
            hasUpdate: compareSemver(latestVersion, cleanCurrent) > 0,
            releaseNotes: typeof data.body === "string" ? data.body.trim() : "",
            releaseUrl:
              typeof data.html_url === "string" && data.html_url.startsWith("https://")
                ? data.html_url
                : `${APP_RELEASES_PAGE_URL}/tag/${encodeURIComponent(rawTag)}`,
            publishedAt: typeof data.published_at === "string" ? data.published_at : null,
            assetName: matchedAsset?.name ?? fallbackAsset.assetName,
            downloadUrl: matchedAsset?.browser_download_url ?? fallbackAsset.downloadUrl,
            assetSize: typeof matchedAsset?.size === "number" ? matchedAsset.size : null,
            source: "github-api",
          };
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Fall through to Tier 2 redirect probe
  }

  // Tier 2: GitHub web redirect fallback (bypasses unauthenticated API 403 rate limits; follows up to 3 hops)
  const redirectController = new AbortController();
  const redirectTimer = setTimeout(() => redirectController.abort(), timeoutMs);
  try {
    let probeUrl = APP_LATEST_RELEASE_URL;
    let lastStatus = 0;

    for (let hop = 0; hop < 3; hop++) {
      const webRes = await fetchImpl(probeUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": `PurrParse/${cleanCurrent}`,
        },
        cache: "no-store",
        signal: redirectController.signal,
      });
      lastStatus = webRes.status;

      const location = webRes.headers.get("location") || "";
      const redirectTarget = location ? new URL(location, probeUrl).toString() : webRes.url || "";
      const tagMatch = redirectTarget.match(/\/releases\/tag\/(v?[^/?#]+)/i);
      if (tagMatch?.[1]) {
        const rawTag = decodeURIComponent(tagMatch[1]).trim();
        const latestVersion = normalizeVersion(rawTag);
        if (latestVersion) {
          const fallbackAsset = buildDirectAssetFallbackUrl(rawTag, platform, arch);
          return {
            currentVersion: cleanCurrent,
            latestVersion,
            tagName: rawTag,
            hasUpdate: compareSemver(latestVersion, cleanCurrent) > 0,
            releaseNotes: "",
            releaseUrl: `${APP_RELEASES_PAGE_URL}/tag/${encodeURIComponent(rawTag)}`,
            publishedAt: null,
            assetName: fallbackAsset.assetName,
            downloadUrl: fallbackAsset.downloadUrl,
            assetSize: null,
            source: "github-redirect",
          };
        }
      }

      if (location && redirectTarget !== probeUrl) {
        probeUrl = redirectTarget;
        continue;
      }
      break;
    }

    throw new Error(`HTTP ${lastStatus}`);
  } catch (err) {
    const detail = err instanceof Error && err.name === "AbortError" ? "请求超时" : err instanceof Error ? err.message : "";
    throw new Error(
      `无法连接 GitHub 获取最新版本信息${detail ? `（${detail}）` : ""}，请检查网络或稍后重试。`
    );
  } finally {
    clearTimeout(redirectTimer);
  }
}
