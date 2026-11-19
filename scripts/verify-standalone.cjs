const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { inspectStandaloneBundle, toWinFsPath } = require("./copy-standalone.cjs");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen({ port: 0, host: "127.0.0.1" }, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => {
        if (port > 0) resolve(port);
        else reject(new Error("Failed to allocate free loopback port"));
      });
    });
  });
}

function httpGetText(url, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`HTTP timeout for ${url}`));
    });
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
      resolve();
    }, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const standaloneArg = process.argv[2];
  const runtimeArg = process.argv[3];

  if (!standaloneArg) {
    console.error("Usage: node scripts/verify-standalone.cjs <standaloneDir> [runtimeExecutable]");
    process.exit(1);
  }

  const standaloneDir = path.resolve(standaloneArg);
  const runtimeExecutable = runtimeArg ? path.resolve(runtimeArg) : process.execPath;

  const stats = inspectStandaloneBundle(standaloneDir);

  const requiredPaths = [
    path.join(standaloneDir, "server.js"),
    path.join(standaloneDir, "node_modules", "next"),
    path.join(standaloneDir, ".next", "static"),
    path.join(standaloneDir, "public", "brand-logo.svg"),
  ];
  for (const p of requiredPaths) {
    if (!fs.existsSync(toWinFsPath(p))) {
      throw new Error(`[verify-standalone] Missing required asset: ${p}`);
    }
  }

  if (!fs.existsSync(toWinFsPath(runtimeExecutable))) {
    throw new Error(`[verify-standalone] Runtime executable not found: ${runtimeExecutable}`);
  }

  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const logs = [];

  const child = spawn(runtimeExecutable, [path.join(standaloneDir, "server.js")], {
    cwd: standaloneDir,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const appendLog = (chunk) => {
    for (const line of chunk.toString("utf8").split(/\r?\n/)) {
      if (line.trim()) {
        logs.push(line);
        if (logs.length > 60) logs.shift();
      }
    }
  };
  child.stdout?.on("data", appendLog);
  child.stderr?.on("data", appendLog);

  try {
    const deadline = Date.now() + 30000;
    let healthy = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(
          `[verify-standalone] Server exited early (code=${child.exitCode})\n${logs.join("\n")}`
        );
      }
      try {
        const health = await httpGetText(`${origin}/api/health`, 1500);
        if (health.statusCode === 200) {
          const parsed = JSON.parse(health.body);
          if (parsed && parsed.ok === true) {
            healthy = true;
            break;
          }
        }
      } catch {
        // retry until deadline
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!healthy) {
      throw new Error(
        `[verify-standalone] Timed out waiting for ${origin}/api/health\n${logs.join("\n")}`
      );
    }

    const rootPage = await httpGetText(`${origin}/`, 5000);
    if (rootPage.statusCode !== 200) {
      throw new Error(`[verify-standalone] GET / returned HTTP ${rootPage.statusCode}`);
    }
    if (!rootPage.body.includes("PurrParse")) {
      throw new Error("[verify-standalone] GET / response body missing expected PurrParse marker");
    }

    console.log(
      `[verify-standalone] OK: ${stats.fileCount} files, 0 symlinks, maxRelPathLen=${stats.maxRelPathLen}, health & / verified via ${path.basename(runtimeExecutable)}`
    );
  } finally {
    await stopChild(child);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
