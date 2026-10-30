import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fly runs the standalone server bundle.
  output: "standalone",
  // sharp ships platform binaries, so it must not be bundled.
  serverExternalPackages: ["sharp"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
