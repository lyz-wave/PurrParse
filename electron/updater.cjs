const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const APP_GITHUB_REPO = "lyz-wave/PurrParse";
const APP_RELEASES_PAGE_URL = `https://github.com/${APP_GITHUB_REPO}/releases`;
const APP_LATEST_RELEASE_URL = `${APP_RELEASES_PAGE_URL}/latest`;
const APP_DOWNLOAD_PAGE_URL = "https://purrparse.xyz";

const TRUSTED_DOWNLOAD_PREFIXES = [
  `https://github.com/${APP_GITHUB_REPO}/`,
  "https://github.com/lyz-wave/deep-reading-workbench/",
  "https://objects.githubusercontent.com/",
  "https://release-assets.githubusercontent.com/",
  "https://github-releases.githubusercontent.com/",
];

const TRUSTED_EXTERNAL_PREFIXES = [
  `https://github.com/${APP_GITHUB_REPO}`,
  "https://github.com/lyz-wave/deep-reading-workbench",
  APP_DOWNLOAD_PAGE_URL,
  "https://www.purrparse.xyz",
];

function normalizeVersion(raw) {
  return String(raw || "")
    .trim()
    .replace(/^v+/i, "");
}

function parseSemver(raw) {
  const cleaned = normalizeVersion(raw);
  const dashIdx = cleaned.indexOf("-");
  const mainPart = dashIdx >= 0 ? cleaned.slice(0, dashIdx) : cleaned;
  const prePart = dashIdx >= 0 ? cleaned.slice(dashIdx + 1) : "";
  const [majRaw, minRaw, patchRaw] = (mainPart || "0.0.0").split(".");
  const toNum = (val) => {
    const n = Number.parseInt(String(val || "0").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    core: [toNum(majRaw), toNum(minRaw), toNum(patchRaw)],
    prerelease: prePart ? prePart.split(".").filter(Boolean) : [],
  };
}

function compareSemver(a, b) {
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

function buildExpectedAssetName(version, platform, arch) {
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

function selectPlatformAsset(assets, platform, arch, version) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const expected = buildExpectedAssetName(version, platform, arch);
  if (expected) {
    const exact = assets.find(
      (item) => item && item.name && item.name.toLowerCase() === expected.toLowerCase()
    );
    if (exact) return exact;
  }

  if (platform === "darwin") {
    const archToken = arch === "x64" ? "x64" : "arm64";
    const dmgWithArch = assets.find((item) => {
      const lower = (item && item.name ? item.name : "").toLowerCase();
      return lower.endsWith(".dmg") && lower.includes("mac") && lower.includes(archToken);
    });
    if (dmgWithArch) return dmgWithArch;
    const anyDmg = assets.find((item) => (item && item.name ? item.name : "").toLowerCase().endsWith(".dmg"));
    if (anyDmg) return anyDmg;
  }

  if (platform === "win32") {
    const archToken = arch === "arm64" ? "arm64" : "x64";
    const winWithArch = assets.find((item) => {
      const lower = (item && item.name ? item.name : "").toLowerCase();
      return lower.endsWith(".exe") && lower.includes("win") && lower.includes(archToken);
    });
    if (winWithArch) return winWithArch;
    const anySetupExe = assets.find((item) => {
      const lower = (item && item.name ? item.name : "").toLowerCase();
      return lower.endsWith("-setup.exe") || lower.endsWith(".exe");
    });
    if (anySetupExe) return anySetupExe;
  }

  return null;
}

function isTrustedDownloadUrl(url) {
  return typeof url === "string" && TRUSTED_DOWNLOAD_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function isTrustedExternalUrl(url) {
  return typeof url === "string" && TRUSTED_EXTERNAL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function buildDirectAssetFallbackUrl(tagName, platform, arch) {
  const expected = buildExpectedAssetName(tagName, platform, arch);
  if (!expected) {
    return { assetName: null, downloadUrl: null };
  }
  return {
    assetName: expected,
    downloadUrl: `${APP_RELEASES_PAGE_URL}/download/${encodeURIComponent(tagName)}/${encodeURIComponent(expected)}`,
  };
}

async function fetchLatestReleaseInfo(currentVersion, platform, arch, timeoutMs = 8000) {
  const cleanCurrent = normalizeVersion(currentVersion) || "1.1.4";

  // Tier 1: GitHub REST API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const apiRes = await fetch(`https://api.github.com/repos/${APP_GITHUB_REPO}/releases/latest`, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": `PurrParse/${cleanCurrent}`,
        },
        signal: controller.signal,
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
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
            assetName: matchedAsset?.name || fallbackAsset.assetName,
            downloadUrl: matchedAsset?.browser_download_url || fallbackAsset.downloadUrl,
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

  // Tier 2: GitHub web redirect fallback (follows up to 3 hops)
  const redirectController = new AbortController();
  const redirectTimer = setTimeout(() => redirectController.abort(), timeoutMs);
  try {
    let probeUrl = APP_LATEST_RELEASE_URL;
    let lastStatus = 0;

    for (let hop = 0; hop < 3; hop++) {
      const webRes = await fetch(probeUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": `PurrParse/${cleanCurrent}`,
        },
        signal: redirectController.signal,
      });
      lastStatus = webRes.status;

      const location = webRes.headers.get("location") || "";
      const redirectTarget = location ? new URL(location, probeUrl).toString() : webRes.url || "";
      const tagMatch = redirectTarget.match(/\/releases\/tag\/(v?[^/?#]+)/i);
      if (tagMatch && tagMatch[1]) {
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
    const detail =
      err instanceof Error && err.name === "AbortError"
        ? "请求超时"
        : err instanceof Error
          ? err.message
          : "";
    throw new Error(
      `无法连接 GitHub 获取最新版本信息${detail ? `（${detail}）` : ""}，请检查网络或稍后重试。`
    );
  } finally {
    clearTimeout(redirectTimer);
  }
}

function detectInstallCapabilities(app) {
  const platform = process.platform;
  if (platform === "win32") {
    return { canAutoInstall: true, installMode: "installer", appBundlePath: null };
  }
  if (platform === "darwin") {
    const appBundlePath = path.resolve(process.execPath, "..", "..", "..");
    const inWritableAppBundle =
      app.isPackaged &&
      appBundlePath.endsWith(".app") &&
      !appBundlePath.includes("/Volumes/") &&
      !appBundlePath.includes("/AppTranslocation/");
    if (inWritableAppBundle) {
      try {
        fs.accessSync(appBundlePath, fs.constants.W_OK);
        fs.accessSync(path.dirname(appBundlePath), fs.constants.W_OK);
        return { canAutoInstall: true, installMode: "self-replace", appBundlePath };
      } catch {
        return { canAutoInstall: true, installMode: "installer", appBundlePath };
      }
    }
    return { canAutoInstall: true, installMode: "installer", appBundlePath: null };
  }
  return { canAutoInstall: false, installMode: "external-download", appBundlePath: null };
}

function sanitizeAssetFilename(rawName) {
  return path.basename(String(rawName || "PurrParse-Update")).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function createDesktopUpdater({ app, shell, stopServer, getMainWindow }) {
  const currentVersion = normalizeVersion(app.getVersion() || "1.1.4");
  const capabilities = detectInstallCapabilities(app);
  const platform = process.platform;
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : "unknown";

  let downloadAbortController = null;
  let state = {
    status: "idle",
    currentVersion,
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
    canAutoInstall: capabilities.canAutoInstall,
    installMode: capabilities.installMode,
    checkedAt: null,
    error: null,
    source: null,
  };

  function getUpdatesDir() {
    const dir = path.join(app.getPath("userData"), "updates");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function broadcastState() {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("purrparse:update-state", { ...state });
    }
  }

  function patchState(patch) {
    state = { ...state, ...patch };
    broadcastState();
    return { ...state };
  }

  function getState() {
    return { ...state };
  }

  async function checkForUpdates() {
    if (state.status === "checking" || state.status === "downloading" || state.status === "installing") {
      return getState();
    }

    patchState({
      status: "checking",
      error: null,
    });

    try {
      const info = await fetchLatestReleaseInfo(currentVersion, platform, arch);
      let existingDownloadPath = null;
      let nextStatus = info.hasUpdate ? "available" : "up-to-date";
      let transferredBytes = 0;
      let totalBytes = info.assetSize || 0;
      let progressPercent = 0;

      if (info.hasUpdate && info.assetName && info.assetSize && info.assetSize > 0) {
        const safeName = sanitizeAssetFilename(info.assetName);
        const candidate = path.join(getUpdatesDir(), safeName);
        try {
          const stat = fs.statSync(candidate);
          if (stat.isFile() && stat.size === info.assetSize) {
            existingDownloadPath = candidate;
            nextStatus = "downloaded";
            transferredBytes = stat.size;
            totalBytes = stat.size;
            progressPercent = 100;
          }
        } catch {
          // Not yet downloaded
        }
      }

      return patchState({
        status: nextStatus,
        currentVersion: info.currentVersion,
        latestVersion: info.latestVersion,
        hasUpdate: info.hasUpdate,
        releaseNotes: info.releaseNotes,
        releaseUrl: info.releaseUrl,
        publishedAt: info.publishedAt,
        assetName: info.assetName,
        downloadUrl: info.downloadUrl,
        assetSize: info.assetSize,
        downloadedFilePath: existingDownloadPath,
        transferredBytes,
        totalBytes,
        progressPercent,
        bytesPerSecond: 0,
        checkedAt: Date.now(),
        error: null,
        source: info.source,
      });
    } catch (err) {
      return patchState({
        status: "error",
        checkedAt: Date.now(),
        error: err instanceof Error ? err.message : "检查更新失败，请稍后重试。",
      });
    }
  }

  async function downloadUpdate() {
    if (state.status === "downloading" || state.status === "installing") {
      return getState();
    }
    if (state.status === "downloaded" && state.downloadedFilePath && fs.existsSync(state.downloadedFilePath)) {
      return getState();
    }
    if (!state.downloadUrl || !isTrustedDownloadUrl(state.downloadUrl)) {
      return patchState({
        status: "error",
        error: "未找到受信任的安装包下载地址，请前往发布页手动下载。",
      });
    }

    const updatesDir = getUpdatesDir();
    const safeName = sanitizeAssetFilename(state.assetName || path.basename(new URL(state.downloadUrl).pathname));
    const targetPath = path.join(updatesDir, safeName);
    const partPath = `${targetPath}.part`;

    try {
      fs.rmSync(partPath, { force: true });
    } catch {
      // ignore
    }

    downloadAbortController = new AbortController();
    const expectedTotal = state.assetSize || 0;
    patchState({
      status: "downloading",
      progressPercent: 0,
      transferredBytes: 0,
      totalBytes: expectedTotal,
      bytesPerSecond: 0,
      downloadedFilePath: null,
      error: null,
    });

    let writeStream = null;
    try {
      const res = await fetch(state.downloadUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": `PurrParse/${currentVersion}`,
        },
        signal: downloadAbortController.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`下载服务器返回 HTTP ${res.status}`);
      }
      if (res.url && !isTrustedDownloadUrl(res.url)) {
        throw new Error("下载重定向目标不在允许域名列表内，已中止。");
      }

      const contentLen = Number.parseInt(res.headers.get("content-length") || "0", 10);
      const totalBytes =
        Number.isFinite(contentLen) && contentLen > 0 ? contentLen : expectedTotal;

      writeStream = fs.createWriteStream(partPath);
      const reader = res.body.getReader();
      let transferred = 0;
      const startedAt = Date.now();
      let lastEmitAt = 0;

      const writeChunk = (chunk) =>
        new Promise((resolve, reject) => {
          if (!writeStream) {
            reject(new Error("写入流已关闭"));
            return;
          }
          const ok = writeStream.write(chunk, (err) => {
            if (err) reject(err);
          });
          if (ok) {
            resolve();
          } else {
            writeStream.once("drain", resolve);
            writeStream.once("error", reject);
          }
        });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          await writeChunk(Buffer.from(value));
          transferred += value.byteLength;
          const now = Date.now();
          if (now - lastEmitAt >= 150) {
            const elapsedSec = Math.max(0.25, (now - startedAt) / 1000);
            const speed = Math.round(transferred / elapsedSec);
            const percent =
              totalBytes > 0 ? Math.min(99, Math.round((transferred / totalBytes) * 100)) : 0;
            patchState({
              status: "downloading",
              transferredBytes: transferred,
              totalBytes: totalBytes || transferred,
              progressPercent: percent,
              bytesPerSecond: speed,
            });
            lastEmitAt = now;
          }
        }
      }

      await new Promise((resolve, reject) => {
        if (!writeStream) return resolve();
        writeStream.end((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      writeStream = null;

      if (transferred <= 0) {
        throw new Error("下载文件为空，请重试。");
      }

      fs.renameSync(partPath, targetPath);

      // Cleanup stale installers in updates dir
      for (const entry of fs.readdirSync(updatesDir)) {
        if (entry !== safeName) {
          try {
            fs.rmSync(path.join(updatesDir, entry), { force: true, recursive: true });
          } catch {
            // ignore cleanup errors
          }
        }
      }

      return patchState({
        status: "downloaded",
        progressPercent: 100,
        transferredBytes: transferred,
        totalBytes: transferred,
        bytesPerSecond: 0,
        downloadedFilePath: targetPath,
        error: null,
      });
    } catch (err) {
      if (writeStream) {
        try {
          writeStream.destroy();
        } catch {
          // ignore
        }
      }
      try {
        fs.rmSync(partPath, { force: true });
      } catch {
        // ignore
      }

      if (err && err.name === "AbortError") {
        return patchState({
          status: state.hasUpdate ? "available" : "idle",
          progressPercent: 0,
          transferredBytes: 0,
          bytesPerSecond: 0,
          error: null,
        });
      }

      return patchState({
        status: "error",
        progressPercent: 0,
        bytesPerSecond: 0,
        error: `下载更新包失败：${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      downloadAbortController = null;
    }
  }

  function cancelDownload() {
    if (downloadAbortController) {
      downloadAbortController.abort();
      downloadAbortController = null;
    }
    if (state.status === "downloading") {
      return patchState({
        status: state.hasUpdate ? "available" : "idle",
        progressPercent: 0,
        transferredBytes: 0,
        bytesPerSecond: 0,
        error: null,
      });
    }
    return getState();
  }

  async function revealDownloadedFile() {
    if (state.downloadedFilePath && fs.existsSync(state.downloadedFilePath)) {
      shell.showItemInFolder(state.downloadedFilePath);
      return { ok: true };
    }
    return { ok: false };
  }

  async function openReleasePage(url) {
    const target = typeof url === "string" && isTrustedExternalUrl(url) ? url : state.releaseUrl || APP_RELEASES_PAGE_URL;
    await shell.openExternal(isTrustedExternalUrl(target) ? target : APP_RELEASES_PAGE_URL);
    return { ok: true };
  }

  async function installUpdate() {
    const filePath = state.downloadedFilePath;
    if (!filePath || !fs.existsSync(filePath)) {
      return patchState({
        status: "error",
        error: "安装包文件不存在，请重新下载。",
      });
    }

    if (platform === "win32") {
      patchState({ status: "installing", error: null });
      const child = spawn(filePath, [], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      child.unref();
      setTimeout(() => {
        stopServer();
        app.quit();
      }, 250);
      return getState();
    }

    if (platform === "darwin") {
      if (capabilities.installMode === "self-replace" && capabilities.appBundlePath) {
        patchState({ status: "installing", error: null });
        const scriptPath = path.join(os.tmpdir(), `purrparse-update-${Date.now()}.sh`);
        const scriptBody = [
          "#!/bin/bash",
          "set -euo pipefail",
          'OLD_PID="$1"',
          'DMG_PATH="$2"',
          'TARGET_APP="$3"',
          'TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/purrparse-upd.XXXXXX")',
          'MOUNT_DIR="$TMP_ROOT/mnt"',
          'STAGE_DIR="$TMP_ROOT/stage"',
          'BACKUP_APP="${TARGET_APP}.backup"',
          'mkdir -p "$MOUNT_DIR" "$STAGE_DIR"',
          "cleanup() {",
          '  hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || hdiutil detach "$MOUNT_DIR" -force -quiet 2>/dev/null || true',
          '  rm -rf "$TMP_ROOT"',
          '  rm -f "$0"',
          "}",
          "trap cleanup EXIT",
          "for _ in $(seq 1 40); do",
          '  if ! kill -0 "$OLD_PID" 2>/dev/null; then break; fi',
          "  sleep 0.5",
          "done",
          'if ! hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$MOUNT_DIR" -quiet; then',
          '  open "$DMG_PATH"',
          "  exit 1",
          "fi",
          'SRC_APP=$(find "$MOUNT_DIR" -maxdepth 2 -name "*.app" -print -quit)',
          'if [ -z "$SRC_APP" ]; then',
          '  open "$DMG_PATH"',
          "  exit 1",
          "fi",
          'APP_NAME=$(basename "$TARGET_APP")',
          'STAGE_APP="$STAGE_DIR/$APP_NAME"',
          'ditto "$SRC_APP" "$STAGE_APP"',
          'xattr -cr "$STAGE_APP" 2>/dev/null || true',
          'rm -rf "$BACKUP_APP"',
          'mv "$TARGET_APP" "$BACKUP_APP"',
          'if ! mv "$STAGE_APP" "$TARGET_APP"; then',
          '  mv "$BACKUP_APP" "$TARGET_APP" 2>/dev/null || true',
          '  open "$DMG_PATH"',
          "  exit 1",
          "fi",
          'rm -rf "$BACKUP_APP"',
          'xattr -cr "$TARGET_APP" 2>/dev/null || true',
          'open -n "$TARGET_APP"',
          "",
        ].join("\n");

        fs.writeFileSync(scriptPath, scriptBody, { mode: 0o700 });
        const helper = spawn("/bin/bash", [scriptPath, String(process.pid), filePath, capabilities.appBundlePath], {
          detached: true,
          stdio: "ignore",
        });
        helper.unref();
        setTimeout(() => {
          stopServer();
          app.quit();
        }, 250);
        return getState();
      }

      // Non-packaged or read-only directory fallback: open DMG in Finder
      const openErr = await shell.openPath(filePath);
      if (openErr) {
        return patchState({
          status: "error",
          error: `无法自动打开安装包：${openErr}`,
        });
      }
      return getState();
    }

    await openReleasePage(state.releaseUrl);
    return getState();
  }

  function dispose() {
    if (downloadAbortController) {
      downloadAbortController.abort();
      downloadAbortController = null;
    }
  }

  return {
    getState,
    checkForUpdates,
    downloadUpdate,
    cancelDownload,
    installUpdate,
    revealDownloadedFile,
    openReleasePage,
    dispose,
  };
}

module.exports = {
  createDesktopUpdater,
  normalizeVersion,
  compareSemver,
  selectPlatformAsset,
};
