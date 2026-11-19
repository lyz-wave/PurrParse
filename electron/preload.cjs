const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("purrparseDesktop", {
  isDesktop: true,
  platform: process.platform,
  arch: process.arch,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  windowControls: {
    setTheme: (themeMode) => ipcRenderer.send("purrparse:window:set-theme", themeMode),
  },
  updater: {
    getState: () => ipcRenderer.invoke("purrparse:updater:get-state"),
    checkForUpdates: () => ipcRenderer.invoke("purrparse:updater:check"),
    downloadUpdate: () => ipcRenderer.invoke("purrparse:updater:download"),
    cancelDownload: () => ipcRenderer.invoke("purrparse:updater:cancel"),
    installUpdate: () => ipcRenderer.invoke("purrparse:updater:install"),
    revealDownloadedFile: () => ipcRenderer.invoke("purrparse:updater:reveal"),
    openReleasePage: (url) => ipcRenderer.invoke("purrparse:updater:open-release", url),
    onStateChange: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, nextState) => callback(nextState);
      ipcRenderer.on("purrparse:update-state", listener);
      return () => ipcRenderer.removeListener("purrparse:update-state", listener);
    },
    onMenuCheckForUpdates: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = () => callback();
      ipcRenderer.on("purrparse:menu-check-updates", listener);
      return () => ipcRenderer.removeListener("purrparse:menu-check-updates", listener);
    },
  },
});
