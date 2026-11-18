const fs = require("node:fs");
const path = require("node:path");

function toWinLongPath(p) {
  const abs = path.resolve(p);
  if (process.platform !== "win32" || abs.startsWith("\\\\?\\")) {
    return abs;
  }
  if (abs.startsWith("\\\\")) {
    return `\\\\?\\UNC\\${abs.slice(2)}`;
  }
  return `\\\\?\\${abs}`;
}

function countBrokenSymlinks(dir) {
  let broken = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(full);
      const resolved = path.resolve(path.dirname(full), target);
      if (!fs.existsSync(resolved)) {
        broken += 1;
        console.error(`[standalone] Broken symlink: ${full} -> ${target}`);
      }
    } else if (entry.isDirectory()) {
      broken += countBrokenSymlinks(full);
    }
  }
  return broken;
}

function copyDirDereferencedWindows(srcDir, destDir, activeAncestors) {
  const longSrcDir = toWinLongPath(srcDir);
  const longDestDir = toWinLongPath(destDir);
  let realSrcDir;
  try {
    realSrcDir = fs.realpathSync(longSrcDir);
  } catch {
    return;
  }

  if (activeAncestors.has(realSrcDir)) {
    return;
  }
  activeAncestors.add(realSrcDir);
  fs.mkdirSync(longDestDir, { recursive: true });

  const entries = fs.readdirSync(longSrcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcEntry = path.join(srcDir, entry.name);
    const destEntry = path.join(destDir, entry.name);
    const longSrcEntry = toWinLongPath(srcEntry);
    const longDestEntry = toWinLongPath(destEntry);

    let stat;
    try {
      stat = fs.statSync(longSrcEntry);
    } catch {
      // Skip dangling optional-dependency junctions on Windows cleanly
      continue;
    }

    if (stat.isDirectory()) {
      copyDirDereferencedWindows(srcEntry, destEntry, activeAncestors);
    } else if (stat.isFile()) {
      fs.copyFileSync(longSrcEntry, longDestEntry);
    }
  }

  activeAncestors.delete(realSrcDir);
}

function copyStandaloneBundle(src, dest, { dereference = false } = {}) {
  const longDest = toWinLongPath(dest);
  fs.rmSync(longDest, { recursive: true, force: true });
  fs.mkdirSync(toWinLongPath(path.dirname(dest)), { recursive: true });

  if (process.platform === "win32") {
    copyDirDereferencedWindows(src, dest, new Set());
    return 0;
  }

  fs.cpSync(src, dest, {
    recursive: true,
    dereference,
    verbatimSymlinks: !dereference,
  });

  if (dereference) {
    return 0;
  }
  return countBrokenSymlinks(dest);
}

module.exports = {
  copyStandaloneBundle,
  toWinLongPath,
};
