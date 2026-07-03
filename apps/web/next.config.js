const path = require("node:path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: [
    "@reelforge/audio-engine",
    "@reelforge/caption-engine",
    "@reelforge/cinematic-engine",
    "@reelforge/hybrid-visual-engine",
    "@reelforge/media-collector",
    "@reelforge/research-collector",
    "@reelforge/story-engine",
    "@reelforge/templates",
    "@reelforge/video-engine"
  ],
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"]
    };
    return config;
  }
};

module.exports = nextConfig;
