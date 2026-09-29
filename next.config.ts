import path from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Set by open-next.config.ts `buildCommand` for the Cloudflare Workers build.
const isWorkersBuild = process.env.CF_WORKERS_BUILD === "1";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "rapid-rook-878.convex.cloud",
      },
    ],
  },
  // Workers only: `convex/browser` resolves to its "node" build under the node
  // export condition, which inlines the `ws` package and crashes on Workers
  // ("Class extends value [object Module] is not a constructor"). The plain
  // build uses the global WebSocket, which Workers provide.
  ...(isWorkersBuild && {
    webpack: (config, { isServer }) => {
      if (isServer) {
        config.resolve.alias = {
          ...config.resolve.alias,
          "convex/browser$": path.resolve("node_modules/convex/dist/esm/browser/index.js"),
        };
      }
      return config;
    },
  }),
};

export default nextConfig;

// Lets `next dev` see Cloudflare bindings from wrangler.jsonc (no-op outside
// dev). See https://opennext.js.org/cloudflare/get-started
initOpenNextCloudflareForDev();
