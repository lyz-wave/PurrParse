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

function normalizeCanon(p) {
  return process.platform === "win32" ? p.toLowerCase() : p;
}

function safeRealpathCanon(p) {
  try {
    const rp = fs.realpathSync(toWinFsPath(p));
    return normalizeCanon(rp);
  } catch {
    return normalizeCanon(path.resolve(p));
  }
}

function safeCopyFile(srcFile, destFile) {
  fs.mkdirSync(toWinFsPath(path.dirname(destFile)), { recursive: true });
  fs.copyFileSync(toWinFsPath(srcFile), toWinFsPath(destFile));
}

function copyTreeNoSymlinks(srcDir, destDir, activeAncestors = new Set()) {
  const canonicalKey = safeRealpathCanon(srcDir);
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

    let lstat;
    try {
      lstat = fs.lstatSync(fsSrcEntry);
    } catch {
      continue;
    }

    if (lstat.isDirectory()) {
      copyTreeNoSymlinks(srcEntry, destEntry, activeAncestors);
      continue;
    }

    if (lstat.isFile()) {
      safeCopyFile(srcEntry, destEntry);
      continue;
    }

    if (lstat.isSymbolicLink()) {
      let targetStat;
      try {
        targetStat = fs.statSync(fsSrcEntry);
      } catch {
        // Skip dangling symlink cleanly
        continue;
      }
      if (targetStat.isDirectory()) {
        copyTreeNoSymlinks(srcEntry, destEntry, activeAncestors);
      } else if (targetStat.isFile()) {
        safeCopyFile(srcEntry, destEntry);
      }
    }
  }

  activeAncestors.delete(canonicalKey);
}

function listPackagesInNodeModules(nmDir) {
  const fsNmDir = toWinFsPath(nmDir);
  if (!fs.existsSync(fsNmDir)) return [];

  const result = [];
  const entries = fs
    .readdirSync(fsNmDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (entry.name === ".pnpm" || entry.name === ".bin" || entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(nmDir, entry.name);
    let lstat;
    try {
      lstat = fs.lstatSync(toWinFsPath(fullPath));
    } catch {
      continue;
    }

    if (entry.name.startsWith("@")) {
      if (lstat.isSymbolicLink() || !lstat.isDirectory()) continue;
      const scopeEntries = fs
        .readdirSync(toWinFsPath(fullPath), { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const sub of scopeEntries) {
        if (sub.name.startsWith(".")) continue;
        const subFull = path.join(fullPath, sub.name);
        let subLstat;
        try {
          subLstat = fs.lstatSync(toWinFsPath(subFull));
        } catch {
          continue;
        }
        result.push({
          name: `${entry.name}/${sub.name}`,
          fullPath: subFull,
          isSymlink: subLstat.isSymbolicLink(),
        });
      }
    } else {
      result.push({
        name: entry.name,
        fullPath,
        isSymlink: lstat.isSymbolicLink(),
      });
    }
  }
  return result;
}

function flattenNodeModules(srcNodeModules, destNodeModules) {
  fs.mkdirSync(toWinFsPath(destNodeModules), { recursive: true });

  const topPackages = listPackagesInNodeModules(srcNodeModules);
  const topTargetCanons = new Map();
  for (const pkg of topPackages) {
    try {
      if (fs.existsSync(toWinFsPath(pkg.fullPath))) {
        topTargetCanons.set(pkg.name, safeRealpathCanon(pkg.fullPath));
      }
    } catch {
      // ignore unreadable entry
    }
  }

  const byName = new Map();
  const stores = [];
  const pnpmDir = path.join(srcNodeModules, ".pnpm");

  if (fs.existsSync(toWinFsPath(pnpmDir))) {
    const storeEntries = fs
      .readdirSync(toWinFsPath(pnpmDir), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const storeEnt of storeEntries) {
      if (!storeEnt.isDirectory() || storeEnt.name === "node_modules" || storeEnt.name.startsWith(".")) {
        continue;
      }
      const storeNm = path.join(pnpmDir, storeEnt.name, "node_modules");
      const pkgs = listPackagesInNodeModules(storeNm);
      const realPkgs = [];
      const symDeps = [];

      for (const pkg of pkgs) {
        if (pkg.isSymlink) {
          if (fs.existsSync(toWinFsPath(pkg.fullPath))) {
            symDeps.push({
              name: pkg.name,
              targetCanon: safeRealpathCanon(pkg.fullPath),
            });
          }
        } else {
          const item = {
            name: pkg.name,
            srcPath: pkg.fullPath,
            canonSrc: safeRealpathCanon(pkg.fullPath),
            storeDir: storeEnt.name,
          };
          realPkgs.push(item);
          if (!byName.has(pkg.name)) byName.set(pkg.name, []);
          byName.get(pkg.name).push(item);
        }
      }

      if (realPkgs.length > 0) {
        stores.push({ storeDir: storeEnt.name, realPkgs, symDeps });
      }
    }
  }

  const hoistedByName = new Map();
  const realByCanon = new Map();

  for (const [pkgName, candidates] of byName.entries()) {
    const preferredCanon = topTargetCanons.get(pkgName);
    candidates.sort((a, b) => {
      if (preferredCanon) {
        if (a.canonSrc === preferredCanon && b.canonSrc !== preferredCanon) return -1;
        if (b.canonSrc === preferredCanon && a.canonSrc !== preferredCanon) return 1;
      }
      return a.storeDir.localeCompare(b.storeDir);
    });

    const primary = candidates[0];
    hoistedByName.set(pkgName, primary);
    for (const cand of candidates) {
      realByCanon.set(cand.canonSrc, cand);
    }

    copyTreeNoSymlinks(primary.srcPath, path.join(destNodeModules, pkgName));
  }

  // Nest any secondary multi-version deps into their direct consumer package's node_modules
  for (const store of stores) {
    for (const consumer of store.realPkgs) {
      const isPrimaryConsumer = hoistedByName.get(consumer.name)?.canonSrc === consumer.canonSrc;
      if (!isPrimaryConsumer) continue;

      for (const dep of store.symDeps) {
        const target = realByCanon.get(dep.targetCanon);
        if (!target || target.name === consumer.name) continue;
        const hoistedDep = hoistedByName.get(dep.name);
        if (hoistedDep && hoistedDep.canonSrc === target.canonSrc) continue;

        const nestedDest = path.join(destNodeModules, consumer.name, "node_modules", dep.name);
        if (!fs.existsSync(toWinFsPath(nestedDest))) {
          copyTreeNoSymlinks(target.srcPath, nestedDest);
        }
      }
    }
  }

  // Copy any real top-level packages or non-.pnpm symlinks (also handles already-flattened bundles)
  for (const pkg of topPackages) {
    if (hoistedByName.has(pkg.name)) continue;
    const destPkg = path.join(destNodeModules, pkg.name);
    if (!fs.existsSync(toWinFsPath(destPkg)) && fs.existsSync(toWinFsPath(pkg.fullPath))) {
      copyTreeNoSymlinks(pkg.fullPath, destPkg);
    }
  }
}

function inspectStandaloneBundle(rootDir) {
  const fsRoot = toWinFsPath(rootDir);
  if (!fs.existsSync(fsRoot)) {
    throw new Error(`[standalone] Bundle directory does not exist: ${rootDir}`);
  }

  const pnpmPath = path.join(rootDir, "node_modules", ".pnpm");
  if (fs.existsSync(toWinFsPath(pnpmPath))) {
    throw new Error(`[standalone] Unexpected unflattened node_modules/.pnpm directory at ${pnpmPath}`);
  }

  let fileCount = 0;
  let symlinkCount = 0;
  let maxRelPathLen = 0;
  let maxRelPath = "";

  function walk(currentDir) {
    const entries = fs.readdirSync(toWinFsPath(currentDir), { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath);
      if (relPath.length > maxRelPathLen) {
        maxRelPathLen = relPath.length;
        maxRelPath = relPath;
      }

      let lstat;
      try {
        lstat = fs.lstatSync(toWinFsPath(fullPath));
      } catch {
        continue;
      }

      if (lstat.isSymbolicLink()) {
        symlinkCount += 1;
        continue;
      }
      if (lstat.isDirectory()) {
        walk(fullPath);
      } else if (lstat.isFile()) {
        fileCount += 1;
      }
    }
  }

  walk(rootDir);

  if (symlinkCount > 0) {
    throw new Error(`[standalone] Found ${symlinkCount} unflattened symlinks inside ${rootDir}`);
  }
  if (maxRelPathLen >= 180) {
    throw new Error(
      `[standalone] Relative path length ${maxRelPathLen} >= 180 chars risks Windows MAX_PATH failure: ${maxRelPath}`
    );
  }

  return { fileCount, symlinkCount, maxRelPathLen, maxRelPath };
}

function copyStandaloneBundle(src, dest) {
  fs.rmSync(toWinFsPath(dest), { recursive: true, force: true });
  fs.mkdirSync(toWinFsPath(dest), { recursive: true });

  const entries = fs.readdirSync(toWinFsPath(src), { withFileTypes: true });
  for (const entry of entries) {
    const srcEntry = path.join(src, entry.name);
    const destEntry = path.join(dest, entry.name);

    if (entry.name === "node_modules") {
      flattenNodeModules(srcEntry, destEntry);
      continue;
    }

    let lstat;
    try {
      lstat = fs.lstatSync(toWinFsPath(srcEntry));
    } catch {
      continue;
    }

    if (lstat.isDirectory()) {
      copyTreeNoSymlinks(srcEntry, destEntry);
    } else if (lstat.isFile()) {
      safeCopyFile(srcEntry, destEntry);
    } else if (lstat.isSymbolicLink() && fs.existsSync(toWinFsPath(srcEntry))) {
      const targetStat = fs.statSync(toWinFsPath(srcEntry));
      if (targetStat.isDirectory()) {
        copyTreeNoSymlinks(srcEntry, destEntry);
      } else if (targetStat.isFile()) {
        safeCopyFile(srcEntry, destEntry);
      }
    }
  }

  const stats = inspectStandaloneBundle(dest);
  return {
    brokenSymlinks: stats.symlinkCount,
    ...stats,
  };
}

module.exports = {
  copyStandaloneBundle,
  inspectStandaloneBundle,
  toWinFsPath,
};
