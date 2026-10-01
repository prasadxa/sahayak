/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import schema from "./schema";

// Module map for convex-test: every Convex function file except tests.
export const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

/**
 * A TestConvex instance with the app's components registered (the rate
 * limiter). Use it for any test that calls a rate-limited function —
 * plain convexTest() works for everything else.
 */
export function testConvex() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}
