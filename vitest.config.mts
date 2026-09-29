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
    server: { deps: { inline: ["convex-test"] } },
    exclude: ["node_modules", ".next", "convex/_generated"],
  },
});
