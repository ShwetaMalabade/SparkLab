import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OFFLINE=1 at build time also tells the client (getMode() → "offline").
  env: { NEXT_PUBLIC_OFFLINE: process.env.OFFLINE === "1" ? "1" : "0" },
  cacheComponents: true,
  partialPrefetching: true,
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
