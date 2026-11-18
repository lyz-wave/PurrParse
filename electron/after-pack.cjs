const fs = require("node:fs");
const path = require("node:path");

function countBrokenSymlinks(dir) {
  let broken = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(full);
      const resolved = path.resolve(path.dirname(full), target);
      if (!fs.existsSync(resolved)) {
        broken += 1;
        console.error(`[after-pack] Broken symlink: ${full} -> ${target}`);
      }
    } else if (entry.isDirectory()) {
      broken += countBrokenSymlinks(full);
    }
  }
  return broken;
}

exports.default = async function afterPack(context) {
  const projectRoot = context.packager.projectDir;
  const standaloneSrc = path.join(projectRoot, "electron-resources", "standalone");

  if (!fs.existsSync(path.join(standaloneSrc, "server.js"))) {
    throw new Error(
      `[after-pack] Standalone bundle missing at ${standaloneSrc}. Run npm run desktop:prepare first.`
    );
  }

  let resourcesDir;
  if (context.electronPlatformName === "darwin") {
    const appName = `${context.packager.appInfo.productFilename}.app`;
    resourcesDir = path.join(context.appOutDir, appName, "Contents", "Resources");
  } else {
    resourcesDir = path.join(context.appOutDir, "resources");
  }

  const standaloneDest = path.join(resourcesDir, "standalone");
  fs.rmSync(standaloneDest, { recursive: true, force: true });
  fs.mkdirSync(resourcesDir, { recursive: true });

  const isWin = process.platform === "win32";
  fs.cpSync(standaloneSrc, standaloneDest, {
    recursive: true,
    dereference: isWin,
    verbatimSymlinks: !isWin,
  });

  if (!fs.existsSync(path.join(standaloneDest, "node_modules", "next"))) {
    throw new Error("[after-pack] node_modules/next missing inside packaged standalone bundle.");
  }
  if (!fs.existsSync(path.join(standaloneDest, ".next", "static"))) {
    throw new Error("[after-pack] .next/static missing inside packaged standalone bundle.");
  }

  const broken = countBrokenSymlinks(standaloneDest);
  if (broken > 0) {
    throw new Error(`[after-pack] Found ${broken} broken symlinks in standalone bundle.`);
  }

  console.log(`[after-pack] Bundled complete Next.js standalone into ${standaloneDest}`);
};
