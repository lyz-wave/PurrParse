import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { computeStandaloneCompatibilityMeta } = require("./standalone-meta.cjs");

const ROOT = process.cwd();
const STANDALONE_DIR = path.join(ROOT, "electron-resources", "standalone");
const OUT_DIR = path.join(ROOT, "dist-electron");

if (!fs.existsSync(path.join(STANDALONE_DIR, "server.js"))) {
  throw new Error(
    `[build-patch-bundle] Missing ${STANDALONE_DIR}/server.js. Run npm run desktop:prepare first.`
  );
}

const meta = computeStandaloneCompatibilityMeta(ROOT);
fs.writeFileSync(path.join(STANDALONE_DIR, "standalone-meta.json"), JSON.stringify(meta, null, 2));

fs.mkdirSync(OUT_DIR, { recursive: true });
const patchAsset = `PurrParse-patch-${meta.appVersion}.tar.gz`;
const patchPath = path.join(OUT_DIR, patchAsset);
const manifestPath = path.join(OUT_DIR, "PurrParse-patch-manifest.json");

const entries = ["server.js", ".next", "standalone-meta.json"];
if (fs.existsSync(path.join(STANDALONE_DIR, "public"))) {
  entries.push("public");
}
if (fs.existsSync(path.join(STANDALONE_DIR, "scripts"))) {
  entries.push("scripts");
}

execFileSync("tar", ["-czf", patchPath, "-C", STANDALONE_DIR, ...entries], {
  stdio: "inherit",
});

const patchBuf = fs.readFileSync(patchPath);
const patchSha256 = crypto.createHash("sha256").update(patchBuf).digest("hex");

const targetPlatforms = String(process.env.PURRPARSE_TARGET_PLATFORMS || "")
  .split(",")
  .map((item) => item.trim())
  .filter((item) => item === "darwin" || item === "win32" || item === "linux");

const manifest = {
  version: meta.appVersion,
  ...(targetPlatforms.length > 0 ? { platforms: targetPlatforms } : {}),
  depsHash: meta.depsHash,
  shellHash: meta.shellHash,
  patchAsset,
  patchSize: patchBuf.length,
  patchSha256,
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(
  `[build-patch-bundle] Created ${patchAsset} (${(patchBuf.length / (1024 * 1024)).toFixed(2)} MB, sha256=${patchSha256.slice(0, 12)}...)`
);
