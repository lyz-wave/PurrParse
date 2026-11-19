const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { createDesktopUpdater } = require("./updater.cjs");

const PREFERRED_PORT = 18923;
const APP_TITLE = "PurrParse";

let mainWindow = null;
let serverProcess = null;
let serverOrigin = null;
let isQuitting = false;
let logStream = null;
let desktopUpdater = null;

function createSplashDataUrl() {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>PurrParse</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f1eadc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
    }
    .card {
      text-align: center;
      padding: 28px 36px;
      border-radius: 18px;
      background: rgba(255, 252, 245, 0.9);
      border: 1px solid rgba(15, 23, 42, 0.1);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0 0 8px;
    }
    .sub {
      font-size: 13px;
      color: #475569;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <p class="title">PurrParse</p>
    <p class="sub">正在启动本地精读与架构解析引擎...</p>
  </div>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function getStandaloneServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone", "server.js");
  }
  const staged = path.join(app.getAppPath(), "electron-resources", "standalone", "server.js");
  if (fs.existsSync(staged)) {
    return staged;
  }
  return path.join(app.getAppPath(), ".next", "standalone", "server.js");
}

function checkPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.unref();
    tester.on("error", () => resolve(false));
    tester.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
      tester.close(() => resolve(true));
    });
  });
}

function getEphemeralPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen({ port: 0, host: "127.0.0.1" }, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => {
        if (port > 0) resolve(port);
        else reject(new Error("Unable to allocate local port"));
      });
    });
  });
}

async function selectPort() {
  if (await checkPortFree(PREFERRED_PORT)) {
    return PREFERRED_PORT;
  }
  return getEphemeralPort();
}

function probeHealth(origin) {
  return new Promise((resolve) => {
    const req = http.get(`${origin}/api/health`, { timeout: 1000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServerReady(origin, timeoutMs = 45000, getTailLogs = () => "") {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess && serverProcess.exitCode !== null) {
      const tail = getTailLogs();
      throw new Error(
        `Next.js standalone server exited early with code ${serverProcess.exitCode}${
          tail ? `\n\n最近服务日志：\n${tail}` : ""
        }`
      );
    }
    if (await probeHealth(origin)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  const tail = getTailLogs();
  throw new Error(
    `Timed out waiting for PurrParse local server to become ready.${
      tail ? `\n\n最近服务日志：\n${tail}` : ""
    }`
  );
}

function buildServerEnv(port, cacheDir) {
  const childEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    PURRPARSE_CACHE_DIR: cacheDir,
  };

  const homeBin = path.join(os.homedir(), ".local", "bin");
  if (process.platform === "win32") {
    const pathKey = Object.keys(childEnv).find((k) => k.toLowerCase() === "path") || "Path";
    const currentPath = childEnv[pathKey] || "";
    if (fs.existsSync(homeBin)) {
      childEnv[pathKey] = currentPath ? `${homeBin}${path.delimiter}${currentPath}` : homeBin;
    }
    return childEnv;
  }

  const extraPaths = [
    homeBin,
    "/opt/miniconda3/bin",
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const basePath = childEnv.PATH || "/usr/bin:/bin:/usr/sbin:/sbin";
  childEnv.PATH = [...extraPaths, basePath].filter(Boolean).join(path.delimiter);
  return childEnv;
}

async function startEmbeddedServer() {
  const devUrl = !app.isPackaged ? process.env.ELECTRON_DEV_URL?.trim() : "";
  if (devUrl) {
    serverOrigin = devUrl.replace(/\/+$/, "");
    return serverOrigin;
  }

  const serverEntry = getStandaloneServerPath();
  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Standalone server not found at ${serverEntry}. Please run npm run desktop:prepare or npm run desktop:pack.`
    );
  }

  const standaloneDir = path.dirname(serverEntry);
  const port = await selectPort();
  const origin = `http://127.0.0.1:${port}`;
  serverOrigin = origin;

  const logsDir = app.getPath("logs");
  fs.mkdirSync(logsDir, { recursive: true });
  const logFilePath = path.join(logsDir, "next-server.log");
  logStream = fs.createWriteStream(logFilePath, { flags: "w" });

  const cacheDir = path.join(app.getPath("userData"), "v2t-cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  const recentServerLogs = [];
  const appendLogTail = (chunk) => {
    logStream?.write(chunk);
    for (const line of chunk.toString("utf8").split(/\r?\n/)) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      recentServerLogs.push(trimmed);
      if (recentServerLogs.length > 25) {
        recentServerLogs.shift();
      }
    }
  };

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: standaloneDir,
    windowsHide: true,
    env: buildServerEnv(port, cacheDir),
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout?.on("data", appendLogTail);
  serverProcess.stderr?.on("data", appendLogTail);
  serverProcess.on("exit", (code, signal) => {
    logStream?.write(`\n[electron] server exited (code=${code}, signal=${signal})\n`);
  });

  await waitForServerReady(origin, 45000, () => recentServerLogs.join("\n"));
  return origin;
}

function stopEmbeddedServer() {
  if (serverProcess && serverProcess.exitCode === null) {
    try {
      serverProcess.kill("SIGTERM");
    } catch {
      // ignore already exited
    }
    const ref = serverProcess;
    setTimeout(() => {
      if (ref.exitCode === null) {
        try {
          ref.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
    }, 2500).unref();
  }
  serverProcess = null;
  if (logStream) {
    try {
      logStream.end();
    } catch {
      // ignore
    }
    logStream = null;
  }
}

function isAllowedInternalUrl(rawUrl) {
  if (!serverOrigin) return false;
  if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) return true;
  try {
    return new URL(rawUrl).origin === new URL(serverOrigin).origin;
  } catch {
    return false;
  }
}

function triggerMenuCheckForUpdates() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send("purrparse:menu-check-updates");
  }
}

function registerUpdaterIpcHandlers() {
  if (!desktopUpdater) return;
  ipcMain.handle("purrparse:updater:get-state", () => desktopUpdater.getState());
  ipcMain.handle("purrparse:updater:check", () => desktopUpdater.checkForUpdates());
  ipcMain.handle("purrparse:updater:download", () => desktopUpdater.downloadUpdate());
  ipcMain.handle("purrparse:updater:cancel", () => desktopUpdater.cancelDownload());
  ipcMain.handle("purrparse:updater:install", () => desktopUpdater.installUpdate());
  ipcMain.handle("purrparse:updater:reveal", () => desktopUpdater.revealDownloadedFile());
  ipcMain.handle("purrparse:updater:open-release", (_event, url) => desktopUpdater.openReleasePage(url));
}

function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: APP_TITLE,
            submenu: [
              { role: "about", label: "关于 PurrParse" },
              {
                label: "检查更新…",
                click: triggerMenuCheckForUpdates,
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide", label: "隐藏 PurrParse" },
              { role: "hideOthers", label: "隐藏其他" },
              { role: "unhide", label: "显示全部" },
              { type: "separator" },
              { role: "quit", label: "退出 PurrParse" },
            ],
          },
        ]
      : []),
    {
      label: "文件",
      submenu: [
        {
          label: "重新加载工作台",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (mainWindow && serverOrigin) {
              mainWindow.loadURL(serverOrigin);
            }
          },
        },
        isMac ? { role: "close", label: "关闭窗口" } : { role: "quit", label: "退出" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "toggleDevTools", label: "开发者工具" },
        { type: "separator" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "进入/退出全屏" },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        ...(isMac ? [{ type: "separator" }, { role: "front", label: "前置全部窗口" }] : []),
      ],
    },
    ...(!isMac
      ? [
          {
            label: "帮助",
            submenu: [
              {
                label: "检查更新…",
                click: triggerMenuCheckForUpdates,
              },
              {
                label: "前往下载主页",
                click: () => {
                  shell.openExternal("https://purrparse.xyz");
                },
              },
            ],
          },
        ]
      : []),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow() {
  const isMac = process.platform === "darwin";
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: APP_TITLE,
    backgroundColor: "#142038",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    ...(isMac ? { trafficLightPosition: { x: 16, y: 17 } } : {}),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (!isAllowedInternalUrl(url)) {
        shell.openExternal(url);
        return { action: "deny" };
      }
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if ((url.startsWith("http://") || url.startsWith("https://")) && !isAllowedInternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(createSplashDataUrl());
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.setName(APP_TITLE);

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createMainWindow();
      if (serverOrigin) mainWindow?.loadURL(serverOrigin);
    }
  });

  app.whenReady().then(async () => {
    desktopUpdater = createDesktopUpdater({
      app,
      shell,
      stopServer: stopEmbeddedServer,
      getMainWindow: () => mainWindow,
    });
    registerUpdaterIpcHandlers();
    buildAppMenu();
    createMainWindow();

    try {
      const origin = await startEmbeddedServer();
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.loadURL(origin);
      }
    } catch (err) {
      const logHint = path.join(app.getPath("logs"), "next-server.log");
      dialog.showErrorBox(
        "PurrParse 启动失败",
        `${err instanceof Error ? err.message : String(err)}\n\n日志位置：${logHint}`
      );
      isQuitting = true;
      stopEmbeddedServer();
      app.quit();
    }
  });

  app.on("activate", () => {
    if (!mainWindow && serverOrigin && !isQuitting) {
      createMainWindow();
      mainWindow?.loadURL(serverOrigin);
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    isQuitting = true;
    desktopUpdater?.dispose();
    stopEmbeddedServer();
  });

  app.on("will-quit", () => {
    desktopUpdater?.dispose();
    stopEmbeddedServer();
  });

  process.on("SIGINT", () => {
    isQuitting = true;
    stopEmbeddedServer();
    app.quit();
  });

  process.on("SIGTERM", () => {
    isQuitting = true;
    stopEmbeddedServer();
    app.quit();
  });
}
