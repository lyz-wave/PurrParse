import type { AppUpdateState } from "@/core/engine/app-updater";

export interface PurrParseDesktopUpdaterBridge {
  getState: () => Promise<AppUpdateState>;
  checkForUpdates: () => Promise<AppUpdateState>;
  downloadUpdate: () => Promise<AppUpdateState>;
  cancelDownload: () => Promise<AppUpdateState>;
  installUpdate: () => Promise<AppUpdateState>;
  revealDownloadedFile: () => Promise<{ ok: boolean }>;
  openReleasePage: (url?: string) => Promise<{ ok: boolean }>;
  onStateChange: (callback: (state: AppUpdateState) => void) => () => void;
  onMenuCheckForUpdates: (callback: () => void) => () => void;
}

export interface PurrParseDesktopBridge {
  isDesktop?: boolean;
  platform?: string;
  arch?: string;
  versions?: {
    electron?: string;
    chrome?: string;
    node?: string;
  };
  windowControls?: {
    setTheme?: (themeMode: string) => void;
  };
  updater?: PurrParseDesktopUpdaterBridge;
}

/** Returns the preload desktop bridge when running inside Electron, or null in browser mode. */
export function getDesktopBridge(): PurrParseDesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { purrparseDesktop?: PurrParseDesktopBridge }).purrparseDesktop;
  return bridge?.isDesktop ? bridge : null;
}

/**
 * Returns true when running inside the packaged/dev Electron macOS window
 * where traffic lights sit inside a hiddenInset top bar.
 */
export function isMacDesktopRuntime(): boolean {
  const bridge = getDesktopBridge();
  return Boolean(bridge?.isDesktop && bridge?.platform === "darwin");
}

/**
 * Returns true when running inside the packaged/dev Electron Windows window
 * where Window Controls Overlay (min/max/close) sits inside a unified frameless top bar.
 */
export function isWinDesktopRuntime(): boolean {
  const bridge = getDesktopBridge();
  return Boolean(bridge?.isDesktop && bridge?.platform === "win32");
}

/** Syncs Electron Windows titleBarOverlay symbol color to match light/dark theme mode. */
export function syncDesktopWindowTheme(themeMode: string): void {
  const bridge = getDesktopBridge();
  bridge?.windowControls?.setTheme?.(themeMode);
}
