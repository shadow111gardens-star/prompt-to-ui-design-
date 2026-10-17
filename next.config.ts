import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    // Keep ancestor lockfiles from changing this application's workspace root.
    root: __dirname,
  },
  experimental: {
    // Avoid restoring incompatible dev cache entries after the workspace root changed.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
