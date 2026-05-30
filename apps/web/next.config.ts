import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { NextConfig } from "next";

const here = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Pin the workspace root to the Crealify repo so Next stops walking up to
  // the user's home directory and picking up a stray package-lock.json.
  outputFileTracingRoot: resolve(here, "../.."),
  // Keep native/binary deps out of the webpack server bundle.
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffmpeg-installer/darwin-arm64",
    "@ffmpeg-installer/darwin-x64",
    "@ffmpeg-installer/linux-x64",
    "@ffmpeg-installer/linux-arm64",
    "fluent-ffmpeg",
    "firebase-admin",
    "postgres",
  ],
  transpilePackages: [
    "@crealify/anthropic",
    "@crealify/db",
    "@crealify/elevenlabs",
    "@crealify/ffmpeg",
    "@crealify/higgsfield",
    "@crealify/meta",
    "@crealify/shared",
    "@crealify/tiktok",
  ],
};

export default config;
