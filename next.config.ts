import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // QR and receipt images (shrunk to under 900 KB) travel inside a Server Action request.
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  images: {
    // 90 is for the homepage screenshots (src/components/home/story-step.tsx); 75 is the default.
    qualities: [75, 90],
    remotePatterns: [new URL("https://lh3.googleusercontent.com/**")],
  },
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
