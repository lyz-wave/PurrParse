"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  APP_RELEASES_PAGE_URL,
  APP_VERSION,
  createInitialUpdateState,
  detectClientPlatformArch,
  normalizeVersion,
  type AppUpdateState,
} from "@/core/engine/app-updater";
import { getDesktopBridge } from "./desktop-runtime";

const DISMISSED_UPDATE_STORAGE_KEY = "purrparse_dismissed_update_v1";

export interface UseAppUpdaterOptions {
  autoCheck?: boolean;
  onMenuCheckRequest?: () => void;
}

export interface UseAppUpdaterResult {
  state: AppUpdateState;
  isDesktopRuntime: boolean;
  isBannerDismissed: boolean;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  installUpdate: () => Promise<void>;
  openReleasePage: (url?: string) => Promise<void>;
  revealDownloadedFile: () => Promise<void>;
  dismissBanner: () => void;
}

function readDismissedVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(DISMISSED_UPDATE_STORAGE_KEY);
    return val ? normalizeVersion(val) : null;
  } catch {
    return null;
  }
}

export function useAppUpdater({
  autoCheck = false,
  onMenuCheckRequest,
}: UseAppUpdaterOptions = {}): UseAppUpdaterResult {
  const [isDesktopRuntime, setIsDesktopRuntime] = useState(false);
  const [state, setState] = useState<AppUpdateState>(() =>
    createInitialUpdateState(APP_VERSION, false)
  );
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() =>
    readDismissedVersion()
  );
  const [sessionForceShowBanner, setSessionForceShowBanner] = useState(false);

  const mountedRef = useRef(true);
  const onMenuCheckRef = useRef(onMenuCheckRequest);
  onMenuCheckRef.current = onMenuCheckRequest;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    const bridge = getDesktopBridge();
    if (bridge?.updater) {
      setState((prev) => ({ ...prev, status: "checking", error: null }));
      const next = await bridge.updater.checkForUpdates();
      if (mountedRef.current && next) {
        setState(next);
      }
      return;
    }

    setState((prev) => ({ ...prev, status: "checking", error: null }));
    try {
      const { platform, arch } = detectClientPlatformArch();
      const params = new URLSearchParams({ platform, arch });
      const res = await fetch(`/api/app-update?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as Partial<AppUpdateState> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `检查更新失败 (${res.status})`);
      }
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          ...data,
          error: null,
        }));
      }
    } catch (err) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          status: "error",
          checkedAt: Date.now(),
          error: err instanceof Error ? err.message : "检查更新失败，请稍后重试。",
        }));
      }
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    setSessionForceShowBanner(true);
    const bridge = getDesktopBridge();
    if (bridge?.updater) {
      const next = await bridge.updater.downloadUpdate();
      if (mountedRef.current && next) {
        setState(next);
      }
      return;
    }

    const url = state.downloadUrl || state.releaseUrl || APP_RELEASES_PAGE_URL;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [state.downloadUrl, state.releaseUrl]);

  const cancelDownload = useCallback(async () => {
    const bridge = getDesktopBridge();
    if (bridge?.updater) {
      const next = await bridge.updater.cancelDownload();
      if (mountedRef.current && next) {
        setState(next);
      }
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const bridge = getDesktopBridge();
    if (bridge?.updater) {
      const next = await bridge.updater.installUpdate();
      if (mountedRef.current && next) {
        setState(next);
      }
    }
  }, []);

  const openReleasePage = useCallback(
    async (url?: string) => {
      const target = url || state.releaseUrl || APP_RELEASES_PAGE_URL;
      const bridge = getDesktopBridge();
      if (bridge?.updater) {
        await bridge.updater.openReleasePage(target);
        return;
      }
      if (typeof window !== "undefined") {
        window.open(target, "_blank", "noopener,noreferrer");
      }
    },
    [state.releaseUrl]
  );

  const revealDownloadedFile = useCallback(async () => {
    const bridge = getDesktopBridge();
    if (bridge?.updater) {
      await bridge.updater.revealDownloadedFile();
    }
  }, []);

  const dismissBanner = useCallback(() => {
    const targetVer = normalizeVersion(state.latestVersion || "");
    setSessionForceShowBanner(false);
    if (targetVer) {
      setDismissedVersion(targetVer);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(DISMISSED_UPDATE_STORAGE_KEY, targetVer);
        } catch {
          // ignore storage quota errors
        }
      }
    }
  }, [state.latestVersion]);

  useEffect(() => {
    const bridge = getDesktopBridge();
    const hasDesktopUpdater = Boolean(bridge?.updater);
    setIsDesktopRuntime(hasDesktopUpdater);

    if (!bridge?.updater) return;

    let unsubState: (() => void) | undefined;
    let unsubMenu: (() => void) | undefined;

    void bridge.updater.getState().then((initial) => {
      if (mountedRef.current && initial) {
        setState(initial);
      }
    });

    unsubState = bridge.updater.onStateChange((next) => {
      if (mountedRef.current && next) {
        setState(next);
      }
    });

    unsubMenu = bridge.updater.onMenuCheckForUpdates(() => {
      setSessionForceShowBanner(true);
      onMenuCheckRef.current?.();
      void checkForUpdates();
    });

    return () => {
      unsubState?.();
      unsubMenu?.();
    };
  }, [checkForUpdates]);

  useEffect(() => {
    if (!autoCheck) return;
    if (process.env.NODE_ENV === "test") return;

    const timer = window.setTimeout(() => {
      void checkForUpdates();
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoCheck, checkForUpdates]);

  const latestNormalized = state.latestVersion ? normalizeVersion(state.latestVersion) : null;
  const isBannerDismissed = Boolean(
    !sessionForceShowBanner &&
      latestNormalized &&
      dismissedVersion &&
      dismissedVersion === latestNormalized
  );

  return {
    state,
    isDesktopRuntime,
    isBannerDismissed,
    checkForUpdates,
    downloadUpdate,
    cancelDownload,
    installUpdate,
    openReleasePage,
    revealDownloadedFile,
    dismissBanner,
  };
}
