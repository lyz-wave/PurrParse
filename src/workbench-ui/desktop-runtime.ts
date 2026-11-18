export interface PurrParseDesktopBridge {
  isDesktop?: boolean;
  platform?: string;
}

/**
 * Returns true when running inside the packaged/dev Electron macOS window
 * where traffic lights sit inside a hiddenInset top bar.
 */
export function isMacDesktopRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (window as unknown as { purrparseDesktop?: PurrParseDesktopBridge }).purrparseDesktop;
  return Boolean(bridge?.isDesktop && bridge?.platform === "darwin");
}
