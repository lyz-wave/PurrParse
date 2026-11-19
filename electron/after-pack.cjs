const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { copyStandaloneBundle, inspectStandaloneBundle } = require("../scripts/copy-standalone.cjs");

exports.default = async function afterPack(context) {
  const projectRoot = context.packager.projectDir;
  const standaloneSrc = path.join(projectRoot, "electron-resources", "standalone");

  if (!fs.existsSync(path.join(standaloneSrc, "server.js"))) {
    throw new Error(
      `[after-pack] Standalone bundle missing at ${standaloneSrc}. Run npm run desktop:prepare first.`
    );
  }

  let resourcesDir;
  let macAppPath = null;
  if (context.electronPlatformName === "darwin") {
    const appName = `${context.packager.appInfo.productFilename}.app`;
    macAppPath = path.join(context.appOutDir, appName);
    resourcesDir = path.join(macAppPath, "Contents", "Resources");
  } else {
    resourcesDir = path.join(context.appOutDir, "resources");
  }

  const standaloneDest = path.join(resourcesDir, "standalone");
  copyStandaloneBundle(standaloneSrc, standaloneDest);
  const stats = inspectStandaloneBundle(standaloneDest);

  if (!fs.existsSync(path.join(standaloneDest, "node_modules", "next"))) {
    throw new Error("[after-pack] node_modules/next missing inside packaged standalone bundle.");
  }
  if (!fs.existsSync(path.join(standaloneDest, ".next", "static"))) {
    throw new Error("[after-pack] .next/static missing inside packaged standalone bundle.");
  }

  console.log(
    `[after-pack] Bundled flattened Next.js standalone into ${standaloneDest} (${stats.fileCount} files, maxRelPathLen=${stats.maxRelPathLen})`
  );

  if (context.electronPlatformName === "darwin" && macAppPath) {
    const hasDeveloperCert =
      Boolean(process.env.CSC_LINK || process.env.CSC_NAME) &&
      process.env.CSC_IDENTITY_AUTO_DISCOVERY !== "false";

    if (!hasDeveloperCert) {
      execFileSync("codesign", ["--force", "--deep", "--sign", "-", macAppPath], {
        stdio: "inherit",
      });
      execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", macAppPath], {
        stdio: "inherit",
      });
      console.log(`[after-pack] Ad-hoc signed and verified ${macAppPath}`);
    }
  }
};
