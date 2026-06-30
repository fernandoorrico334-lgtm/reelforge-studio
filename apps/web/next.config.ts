import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(configDirectory, "../.."),
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

export default nextConfig;

