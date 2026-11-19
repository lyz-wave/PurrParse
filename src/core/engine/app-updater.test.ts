import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_RELEASES_PAGE_URL,
  compareSemver,
  fetchLatestReleaseInfo,
  selectPlatformAsset,
  type ReleaseAssetMeta,
} from "./app-updater";

const SAMPLE_ASSETS: ReleaseAssetMeta[] = [
  {
    name: "PurrParse-1.2.0-mac-arm64.dmg",
    browser_download_url: `${APP_RELEASES_PAGE_URL}/download/v1.2.0/PurrParse-1.2.0-mac-arm64.dmg`,
    size: 138_000_000,
  },
  {
    name: "PurrParse-1.2.0-mac-x64.dmg",
    browser_download_url: `${APP_RELEASES_PAGE_URL}/download/v1.2.0/PurrParse-1.2.0-mac-x64.dmg`,
    size: 142_000_000,
  },
  {
    name: "PurrParse-1.2.0-win-x64-Setup.exe",
    browser_download_url: `${APP_RELEASES_PAGE_URL}/download/v1.2.0/PurrParse-1.2.0-win-x64-Setup.exe`,
    size: 118_000_000,
  },
  {
    name: "PurrParse-1.2.0-win-arm64-Setup.exe",
    browser_download_url: `${APP_RELEASES_PAGE_URL}/download/v1.2.0/PurrParse-1.2.0-win-arm64-Setup.exe`,
    size: 120_000_000,
  },
];

describe("app-updater core engine", () => {
  it("compares semantic versions numerically including prerelease and v-prefix handling", () => {
    expect(compareSemver("v1.1.2", "1.1.1")).toBe(1);
    expect(compareSemver("1.10.0", "1.2.0")).toBe(1);
    expect(compareSemver("v1.1.1", "1.1.1")).toBe(0);
    expect(compareSemver("1.1.0", "1.1.1")).toBe(-1);
    expect(compareSemver("1.2.0", "1.2.0-beta.1")).toBe(1);
    expect(compareSemver("1.2.0-beta.2", "1.2.0-beta.1")).toBe(1);
  });

  it("selects the exact release installer asset across macOS and Windows architectures", () => {
    expect(selectPlatformAsset(SAMPLE_ASSETS, "darwin", "arm64", "1.2.0")?.name).toBe(
      "PurrParse-1.2.0-mac-arm64.dmg"
    );
    expect(selectPlatformAsset(SAMPLE_ASSETS, "darwin", "x64", "1.2.0")?.name).toBe(
      "PurrParse-1.2.0-mac-x64.dmg"
    );
    expect(selectPlatformAsset(SAMPLE_ASSETS, "win32", "x64", "1.2.0")?.name).toBe(
      "PurrParse-1.2.0-win-x64-Setup.exe"
    );
    expect(selectPlatformAsset(SAMPLE_ASSETS, "win32", "arm64", "1.2.0")?.name).toBe(
      "PurrParse-1.2.0-win-arm64-Setup.exe"
    );
  });

  it("resolves latest release via GitHub REST API (Tier 1)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tag_name: "v1.2.0",
          body: "- 新增后台多篇并行精读\n- 新增应用内自动检查更新",
          published_at: "2026-11-19T10:00:00Z",
          html_url: `${APP_RELEASES_PAGE_URL}/tag/v1.2.0`,
          assets: SAMPLE_ASSETS,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const info = await fetchLatestReleaseInfo({
      currentVersion: "1.1.1",
      platform: "darwin",
      arch: "arm64",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(info.source).toBe("github-api");
    expect(info.latestVersion).toBe("1.2.0");
    expect(info.hasUpdate).toBe(true);
    expect(info.assetName).toBe("PurrParse-1.2.0-mac-arm64.dmg");
    expect(info.assetSize).toBe(138_000_000);
    expect(info.releaseNotes).toContain("新增应用内自动检查更新");
  });

  it("falls back to GitHub /releases/latest HTTP redirect (including multi-hop repo redirects) when REST API hits 403", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("API rate limit exceeded", { status: 403 }))
      .mockResolvedValueOnce({
        ok: false,
        status: 301,
        url: "",
        headers: new Headers({
          location: "https://github.com/lyz-wave/purrparse/releases/latest",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        url: "",
        headers: new Headers({
          location: "https://github.com/lyz-wave/PurrParse/releases/tag/v1.2.1",
        }),
      } as Response);

    const info = await fetchLatestReleaseInfo({
      currentVersion: "1.1.1",
      platform: "win32",
      arch: "x64",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(info.source).toBe("github-redirect");
    expect(info.latestVersion).toBe("1.2.1");
    expect(info.hasUpdate).toBe(true);
    expect(info.assetName).toBe("PurrParse-1.2.1-win-x64-Setup.exe");
    expect(info.downloadUrl).toBe(
      `${APP_RELEASES_PAGE_URL}/download/v1.2.1/PurrParse-1.2.1-win-x64-Setup.exe`
    );
  });

  it("throws a clear Chinese error if both GitHub API and redirect probe fail", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ENOTFOUND api.github.com"))
      .mockRejectedValueOnce(new Error("ENOTFOUND github.com"));

    await expect(
      fetchLatestReleaseInfo({
        currentVersion: "1.1.1",
        platform: "darwin",
        arch: "arm64",
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).rejects.toThrow("无法连接 GitHub 获取最新版本信息");
  });
});

describe("Desktop Dual-Track Incremental Patch Updater", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("validates shellHash and depsHash compatibility cleanly via isPatchManifestCompatible", async () => {
    const updaterMod = await import("../../../electron/updater.cjs");
    const { isPatchManifestCompatible } = updaterMod;

    const localMeta = {
      appVersion: "1.1.6",
      depsHash: "aaaa1111bbbb2222",
      shellHash: "cccc3333dddd4444",
    };

    expect(
      isPatchManifestCompatible(
        localMeta,
        {
          version: "1.1.7",
          depsHash: "aaaa1111bbbb2222",
          shellHash: "cccc3333dddd4444",
          patchAsset: "PurrParse-patch-1.1.7.tar.gz",
          patchSha256: "deadbeef",
        },
        "1.1.7"
      )
    ).toBe(true);

    expect(
      isPatchManifestCompatible(
        localMeta,
        {
          version: "1.1.7",
          depsHash: "changed_deps_hash",
          shellHash: "cccc3333dddd4444",
          patchAsset: "PurrParse-patch-1.1.7.tar.gz",
          patchSha256: "deadbeef",
        },
        "1.1.7"
      )
    ).toBe(false);

    expect(
      isPatchManifestCompatible(
        localMeta,
        {
          version: "1.1.7",
          depsHash: "aaaa1111bbbb2222",
          shellHash: "changed_shell_hash",
          patchAsset: "PurrParse-patch-1.1.7.tar.gz",
          patchSha256: "deadbeef",
        },
        "1.1.7"
      )
    ).toBe(false);
  });

  it("downloads, verifies SHA-256, extracts hot-patch standalone bundle, links node_modules, and falls back when hashes mismatch", async () => {
    const updaterMod = await import("../../../electron/updater.cjs");
    const { createDesktopUpdater } = updaterMod;

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "purrparse-hotpatch-test-"));
    try {
      const bundledDir = path.join(tmpRoot, "bundled-standalone");
      const bundledModules = path.join(bundledDir, "node_modules", "next");
      const hotDir = path.join(tmpRoot, "userData", "hot-standalone");
      const patchSource = path.join(tmpRoot, "patch-src");

      fs.mkdirSync(bundledModules, { recursive: true });
      fs.writeFileSync(path.join(bundledDir, "server.js"), "// bundled");
      fs.writeFileSync(
        path.join(bundledDir, "standalone-meta.json"),
        JSON.stringify({ appVersion: "1.1.6", depsHash: "deps1234", shellHash: "shell5678" })
      );

      fs.mkdirSync(path.join(patchSource, ".next"), { recursive: true });
      fs.writeFileSync(path.join(patchSource, "server.js"), "// patched 1.1.7");
      fs.writeFileSync(path.join(patchSource, ".next", "BUILD_ID"), "build-117");
      fs.writeFileSync(
        path.join(patchSource, "standalone-meta.json"),
        JSON.stringify({ appVersion: "1.1.7", depsHash: "deps1234", shellHash: "shell5678" })
      );

      const archivePath = path.join(tmpRoot, "PurrParse-patch-1.1.7.tar.gz");
      execFileSync("tar", ["-czf", archivePath, "-C", patchSource, "server.js", ".next", "standalone-meta.json"]);
      const archiveBytes = fs.readFileSync(archivePath);
      const archiveSha = crypto.createHash("sha256").update(archiveBytes).digest("hex");

      const patchAssetUrl = `${APP_RELEASES_PAGE_URL}/download/v1.1.7/PurrParse-patch-1.1.7.tar.gz`;
      const manifestUrl = `${APP_RELEASES_PAGE_URL}/download/v1.1.7/PurrParse-patch-manifest.json`;

      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/releases/latest")) {
          return new Response(
            JSON.stringify({
              tag_name: "v1.1.7",
              body: "patch update",
              assets: [
                {
                  name: "PurrParse-1.1.7-mac-arm64.dmg",
                  browser_download_url: `${APP_RELEASES_PAGE_URL}/download/v1.1.7/PurrParse-1.1.7-mac-arm64.dmg`,
                  size: 140_000_000,
                },
                {
                  name: "PurrParse-patch-manifest.json",
                  browser_download_url: manifestUrl,
                  size: 256,
                },
                {
                  name: "PurrParse-patch-1.1.7.tar.gz",
                  browser_download_url: patchAssetUrl,
                  size: archiveBytes.length,
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url === manifestUrl) {
          return new Response(
            JSON.stringify({
              version: "1.1.7",
              depsHash: "deps1234",
              shellHash: "shell5678",
              patchAsset: "PurrParse-patch-1.1.7.tar.gz",
              patchSize: archiveBytes.length,
              patchSha256: archiveSha,
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url === patchAssetUrl) {
          return new Response(archiveBytes, {
            status: 200,
            headers: {
              "content-type": "application/gzip",
              "content-length": String(archiveBytes.length),
            },
          });
        }
        return new Response("Not Found", { status: 404 });
      });
      vi.stubGlobal("fetch", fetchMock);

      const relaunchSpy = vi.fn();
      const exitSpy = vi.fn();
      const stopServerSpy = vi.fn();

      const updater = createDesktopUpdater({
        app: {
          getVersion: () => "1.1.6",
          isPackaged: true,
          getPath: (key: string) => (key === "userData" ? path.join(tmpRoot, "userData") : tmpRoot),
          relaunch: relaunchSpy,
          exit: exitSpy,
          quit: vi.fn(),
        },
        shell: { openExternal: vi.fn(), openPath: vi.fn(), showItemInFolder: vi.fn() },
        stopServer: stopServerSpy,
        getMainWindow: () => null,
        getBundledStandaloneDir: () => bundledDir,
        getHotStandaloneDir: () => hotDir,
        getActiveVersion: () => "1.1.6",
      });

      const checked = await updater.checkForUpdates();
      expect(checked.hasUpdate).toBe(true);
      expect(checked.installMode).toBe("hot-patch");
      expect(checked.updateChannel).toBe("patch");
      expect(checked.assetName).toBe("PurrParse-patch-1.1.7.tar.gz");
      expect(checked.assetSize).toBe(archiveBytes.length);

      const downloaded = await updater.downloadUpdate();
      expect(downloaded.status).toBe("downloaded");
      expect(downloaded.downloadedFilePath).toBeTruthy();

      await updater.installUpdate();
      expect(fs.readFileSync(path.join(hotDir, "server.js"), "utf8")).toBe("// patched 1.1.7");
      expect(fs.readFileSync(path.join(hotDir, ".next", "BUILD_ID"), "utf8")).toBe("build-117");
      expect(fs.existsSync(path.join(hotDir, "node_modules", "next"))).toBe(true);

      await new Promise((r) => setTimeout(r, 320));
      expect(stopServerSpy).toHaveBeenCalledTimes(1);
      expect(relaunchSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);

      // Mismatched shellHash must fall back to full installer
      fs.writeFileSync(
        path.join(bundledDir, "standalone-meta.json"),
        JSON.stringify({ appVersion: "1.1.6", depsHash: "deps1234", shellHash: "old_shell" })
      );
      const updaterMismatch = createDesktopUpdater({
        app: {
          getVersion: () => "1.1.6",
          isPackaged: true,
          getPath: (key: string) => (key === "userData" ? path.join(tmpRoot, "userData") : tmpRoot),
          relaunch: vi.fn(),
          exit: vi.fn(),
          quit: vi.fn(),
        },
        shell: { openExternal: vi.fn(), openPath: vi.fn(), showItemInFolder: vi.fn() },
        stopServer: vi.fn(),
        getMainWindow: () => null,
        getBundledStandaloneDir: () => bundledDir,
        getHotStandaloneDir: () => hotDir,
        getActiveVersion: () => "1.1.6",
      });
      const fallbackChecked = await updaterMismatch.checkForUpdates();
      expect(fallbackChecked.installMode).not.toBe("hot-patch");
      expect(fallbackChecked.updateChannel).toBe("full");
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
