import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

// Minimal config: no R2/KV incremental cache. Every page here is dynamic
// (auth-gated or Convex-backed), so ISR caching buys nothing.
// See https://opennext.js.org/cloudflare/caching to add one later.
const config = defineCloudflareConfig({});

const workersConfig = {
  ...config,
  // `npm run build` uses `next build --turbo`, whose server chunks are loaded
  // with dynamic require() that Workers can't resolve ("Failed to load chunk
  // server/chunks/ssr/..."). Build with webpack for the Workers bundle; local
  // `next dev --turbo` is unaffected.
  buildCommand: "CF_WORKERS_BUILD=1 npx next build",
};

export default workersConfig;
