import { describe, expect, it, vi } from "vitest";
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

  it("falls back to GitHub /releases/latest HTTP redirect when REST API hits 403 rate limit (Tier 2)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("API rate limit exceeded", { status: 403 }))
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        url: "",
        headers: new Headers({
          location: "https://github.com/lyz-wave/deep-reading-workbench/releases/tag/v1.2.1",
        }),
      } as Response);

    const info = await fetchLatestReleaseInfo({
      currentVersion: "1.1.1",
      platform: "win32",
      arch: "x64",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
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
