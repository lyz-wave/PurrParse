import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["unpdf"],
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
