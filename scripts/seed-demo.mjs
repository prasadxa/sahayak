#!/usr/bin/env node
// Seed (or clear) the SIH demo data: a demo citizen, ~24 grievances and
// ~120 knowledge-base query log rows (see convex/demo.ts).
//
//   npm run seed:demo                 # seed the dev deployment in .env.local
//   npm run seed:demo -- --prod       # seed the production deployment
//   npm run seed:demo -- --clear      # remove only the demo rows
//   npm run seed:demo -- --prod --clear
//
// Seeding is idempotent. Demo grievances use refs GRV-DE000001…GRV-DE000018
// and demo queries have a createdAt ending in 123 ms, so `--clear` never
// touches real data.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const KNOWN_FLAGS = new Set(["--prod", "--clear"]);
const cliArgs = process.argv.slice(2);
const unknown = cliArgs.filter((a) => !KNOWN_FLAGS.has(a));
if (unknown.length > 0) {
  console.error(
    `Unknown argument(s): ${unknown.join(" ")}\nUsage: npm run seed:demo [-- --prod] [-- --clear]`
  );
  process.exit(2);
}
/** Extra flags for `npx convex run` (`--prod` targets the production deployment). */
const CONVEX_TARGET_FLAGS = cliArgs.includes("--prod") ? ["--prod"] : [];
const fn = cliArgs.includes("--clear") ? "demo:clear" : "demo:seed";

if (CONVEX_TARGET_FLAGS.length > 0) console.log("Target: production deployment (--prod)");
console.log(`Running ${fn} …`);

try {
  const out = execFileSync("npx", ["convex", "run", ...CONVEX_TARGET_FLAGS, fn, "{}"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const start = out.indexOf("{");
  let result;
  try {
    result = start >= 0 ? JSON.parse(out.slice(start)) : undefined;
  } catch {
    // Output format changed; the call itself succeeded.
  }
  if (!result) {
    console.log(out.trim());
  } else if (fn === "demo:seed") {
    console.log(
      `Seeded: demo user ${result.userCreated ? "created" : "already present"}, ` +
        `${result.grievances} grievances, ${result.queries} KB queries added.`
    );
  } else {
    console.log(
      `Cleared: ${result.users} demo user, ${result.grievances} grievances, ${result.queries} KB queries.`
    );
  }
} catch (e) {
  const detail = (e.stderr || e.message || String(e)).toString().trim().split("\n").slice(-3).join(" ");
  console.error(`✗ ${fn} failed: ${detail}`);
  process.exitCode = 1;
}
