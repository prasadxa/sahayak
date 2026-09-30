import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    // Convex function tests run in the edge runtime that convex-test expects;
    // pure lib/ tests run in node.
    environmentMatchGlobs: [["convex/**", "edge-runtime"]],
    server: {
      deps: {
        // .ts sources in node_modules (component test helpers, import.meta.glob)
        // only transform correctly when inlined.
        inline: ["convex-test", "@convex-dev/rate-limiter", "@convex-dev/batch-worker"],
      },
    },
    exclude: ["node_modules", ".next", "convex/_generated"],
  },
});
