import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { copyStandaloneBundle, toWinLongPath } = require("./copy-standalone.cjs");

const ROOT = process.cwd();
const STANDALONE_SRC = path.join(ROOT, ".next", "standalone");
const STATIC_SRC = path.join(ROOT, ".next", "static");
const PUBLIC_SRC = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "electron-resources", "standalone");

try {
  if (!fs.existsSync(path.join(STANDALONE_SRC, "server.js"))) {
    console.log(
      "[prepare-electron-standalone] Missing .next/standalone/server.js. Run `npm run build` first."
    );
    process.exitCode = 1;
  } else if (!fs.existsSync(STATIC_SRC)) {
    console.log(
      "[prepare-electron-standalone] Missing .next/static. Run `npm run build` first."
    );
    process.exitCode = 1;
  } else {
    const broken = copyStandaloneBundle(STANDALONE_SRC, OUT_DIR, { dereference: false });

    const staticDest = path.join(OUT_DIR, ".next", "static");
    fs.mkdirSync(toWinLongPath(path.dirname(staticDest)), { recursive: true });
    fs.cpSync(toWinLongPath(STATIC_SRC), toWinLongPath(staticDest), {
      recursive: true,
      dereference: true,
    });

    if (fs.existsSync(PUBLIC_SRC)) {
      fs.cpSync(toWinLongPath(PUBLIC_SRC), toWinLongPath(path.join(OUT_DIR, "public")), {
        recursive: true,
        dereference: true,
      });
    }

    if (broken > 0) {
      console.log(`[prepare-electron-standalone] Found ${broken} broken symlinks.`);
      process.exitCode = 1;
    } else {
      console.log(`[prepare-electron-standalone] Ready: ${OUT_DIR}`);
    }
  }
} catch (err) {
  console.log("[prepare-electron-standalone] Fatal error:", err);
  process.exitCode = 1;
}
