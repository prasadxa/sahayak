/// <reference types="vite/client" />
// Module map for convex-test: every Convex function file except tests.
export const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
