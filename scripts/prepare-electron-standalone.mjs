import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STANDALONE_SRC = path.join(ROOT, ".next", "standalone");
const STATIC_SRC = path.join(ROOT, ".next", "static");
const PUBLIC_SRC = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "electron-resources", "standalone");

if (!fs.existsSync(path.join(STANDALONE_SRC, "server.js"))) {
  console.error(
    "[prepare-electron-standalone] Missing .next/standalone/server.js. Run `npm run build` first."
  );
  process.exit(1);
}

if (!fs.existsSync(STATIC_SRC)) {
  console.error(
    "[prepare-electron-standalone] Missing .next/static. Run `npm run build` first."
  );
  process.exit(1);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(path.dirname(OUT_DIR), { recursive: true });

// Preserve relative symlinks on POSIX/macOS; dereference cleanly on Windows to avoid Developer-Mode EPERM
const isWin = process.platform === "win32";
fs.cpSync(STANDALONE_SRC, OUT_DIR, {
  recursive: true,
  dereference: isWin,
  verbatimSymlinks: !isWin,
});

// Copy Next.js static assets into standalone/.next/static
const staticDest = path.join(OUT_DIR, ".next", "static");
fs.mkdirSync(path.dirname(staticDest), { recursive: true });
fs.cpSync(STATIC_SRC, staticDest, { recursive: true, dereference: true });

// Copy public/ directory if present
if (fs.existsSync(PUBLIC_SRC)) {
  fs.cpSync(PUBLIC_SRC, path.join(OUT_DIR, "public"), {
    recursive: true,
    dereference: true,
  });
}

// Verify zero broken symlinks and required files
let brokenSymlinks = 0;
function walkVerify(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(full);
      const resolved = path.resolve(path.dirname(full), target);
      if (!fs.existsSync(resolved)) {
        brokenSymlinks += 1;
        console.error(`[prepare-electron-standalone] Broken symlink: ${full} -> ${target}`);
      }
    } else if (entry.isDirectory()) {
      walkVerify(full);
    }
  }
}
walkVerify(OUT_DIR);

if (brokenSymlinks > 0) {
  process.exit(1);
}

console.log(`[prepare-electron-standalone] Ready: ${OUT_DIR}`);
