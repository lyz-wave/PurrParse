const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function computeFileHash(filePath) {
  if (!fs.existsSync(filePath)) return "missing";
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, 16);
}

function computeStandaloneCompatibilityMeta(projectRoot) {
  const pkgPath = path.join(projectRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const lockPath = path.join(projectRoot, "pnpm-lock.yaml");

  const depsFingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(pkg.dependencies || {}))
    .update("\n")
    .update(fs.existsSync(lockPath) ? fs.readFileSync(lockPath) : "")
    .digest("hex")
    .slice(0, 16);

  const shellHash = crypto
    .createHash("sha256")
    .update(computeFileHash(path.join(projectRoot, "electron", "main.cjs")))
    .update("|")
    .update(computeFileHash(path.join(projectRoot, "electron", "preload.cjs")))
    .update("|")
    .update(computeFileHash(path.join(projectRoot, "electron", "updater.cjs")))
    .digest("hex")
    .slice(0, 16);

  return {
    appVersion: String(pkg.version || "0.0.0").trim(),
    depsHash: depsFingerprint,
    shellHash,
  };
}

module.exports = {
  computeStandaloneCompatibilityMeta,
};
