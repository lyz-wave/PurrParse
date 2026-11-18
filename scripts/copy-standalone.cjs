const fs = require("node:fs");
const path = require("node:path");

function toWinFsPath(p) {
  const abs = path.resolve(p);
  if (process.platform !== "win32" || abs.length < 240 || abs.startsWith("\\\\?\\")) {
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

function resolveCanonicalDirKey(dir) {
  const abs = path.resolve(dir);
  try {
    return fs.realpathSync.native(abs).toLowerCase();
  } catch {
    return abs.toLowerCase();
  }
}

function copyDirDereferencedWindows(srcDir, destDir, activeAncestors) {
  const canonicalKey = resolveCanonicalDirKey(srcDir);
  if (activeAncestors.has(canonicalKey)) {
    return;
  }
  activeAncestors.add(canonicalKey);
  fs.mkdirSync(toWinFsPath(destDir), { recursive: true });

  const entries = fs.readdirSync(toWinFsPath(srcDir), { withFileTypes: true });
  for (const entry of entries) {
    const srcEntry = path.join(srcDir, entry.name);
    const destEntry = path.join(destDir, entry.name);
    const fsSrcEntry = toWinFsPath(srcEntry);
    const fsDestEntry = toWinFsPath(destEntry);

    if (entry.isDirectory()) {
      copyDirDereferencedWindows(srcEntry, destEntry, activeAncestors);
      continue;
    }

    if (entry.isFile()) {
      fs.copyFileSync(fsSrcEntry, fsDestEntry);
      continue;
    }

    let stat;
    try {
      stat = fs.statSync(fsSrcEntry);
    } catch {
      // Skip dangling optional-dependency junctions cleanly
      continue;
    }
    if (stat.isDirectory()) {
      copyDirDereferencedWindows(srcEntry, destEntry, activeAncestors);
    } else if (stat.isFile()) {
      fs.copyFileSync(fsSrcEntry, fsDestEntry);
    }
  }

  activeAncestors.delete(canonicalKey);
}

function copyStandaloneBundle(src, dest, { dereference = false } = {}) {
  fs.rmSync(toWinFsPath(dest), { recursive: true, force: true });
  fs.mkdirSync(toWinFsPath(path.dirname(dest)), { recursive: true });

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
  toWinFsPath,
};
