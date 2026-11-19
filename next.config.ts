import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["unpdf"],
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  outputFileTracingExcludes: {
    "*": [
      "./landing/**",
      "./prism-showreel/**",
      "./electron/**",
      "./electron-resources/**",
      "./dist-electron/**",
      "./.v2t-cache/**",
    ],
  },
};

export default nextConfig;
