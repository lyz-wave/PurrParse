import { NextRequest, NextResponse } from "next/server";
import packageJson from "../../../../package.json";
import {
  APP_RELEASES_PAGE_URL,
  createInitialUpdateState,
  fetchLatestReleaseInfo,
  normalizeVersion,
  type AppUpdateArch,
  type AppUpdatePlatform,
} from "@/core/engine/app-updater";

export const dynamic = "force-dynamic";

function sanitizePlatform(raw: string | null): AppUpdatePlatform {
  if (raw === "darwin" || raw === "win32" || raw === "linux" || raw === "web") {
    return raw;
  }
  return "web";
}

function sanitizeArch(raw: string | null): AppUpdateArch {
  if (raw === "arm64" || raw === "x64") {
    return raw;
  }
  return "unknown";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = sanitizePlatform(searchParams.get("platform"));
  const arch = sanitizeArch(searchParams.get("arch"));
  const currentVersion = normalizeVersion(packageJson.version || "1.1.1");

  try {
    const info = await fetchLatestReleaseInfo({
      currentVersion,
      platform,
      arch,
    });
    const base = createInitialUpdateState(currentVersion, false);
    return NextResponse.json({
      ...base,
      status: info.hasUpdate ? "available" : "up-to-date",
      latestVersion: info.latestVersion,
      hasUpdate: info.hasUpdate,
      releaseNotes: info.releaseNotes,
      releaseUrl: info.releaseUrl,
      publishedAt: info.publishedAt,
      assetName: info.assetName,
      downloadUrl: info.downloadUrl,
      assetSize: info.assetSize,
      canAutoInstall: false,
      installMode: "external-download",
      checkedAt: Date.now(),
      error: null,
      source: info.source,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "检查更新失败，请稍后重试或前往发布页下载。";
    return NextResponse.json(
      {
        error: message,
        currentVersion,
        releaseUrl: APP_RELEASES_PAGE_URL,
      },
      { status: 502 }
    );
  }
}
