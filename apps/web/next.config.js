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
  ]
};

module.exports = nextConfig;
