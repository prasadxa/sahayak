#!/usr/bin/env node
// Seed the shared knowledge base from data/kb/*.md.
//
// Each file starts with front matter:
//   ---
//   title: ...
//   category: laws|schemes|pmfby|finance|grievance|general
//   source: https://...
//   ---
// Files whose title already exists are skipped, so re-running is safe.
// Uses `npx convex run` against the deployment in .env.local (CONVEX_DEPLOYMENT).
// Works while the embeddings API is down: chunks are stored without
// embeddings and can be embedded later with the Backfill button on /knowledge.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KB_DIR = path.join(ROOT, "data", "kb");
const CATEGORIES = new Set(["laws", "schemes", "pmfby", "finance", "grievance", "general"]);

/** Minimal front-matter parser: `key: value` lines between leading `---` fences. */
function parseFrontMatter(raw, file) {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing front matter`);
  const meta = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    meta[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  if (!meta.title) throw new Error(`${file}: front matter needs a title`);
  if (!CATEGORIES.has(meta.category)) {
    throw new Error(`${file}: invalid category "${meta.category}"`);
  }
  const content = match[2].trim();
  if (!content) throw new Error(`${file}: empty body`);
  return { title: meta.title, category: meta.category, source: meta.source || undefined, content };
}

/** Run `npx convex run <fn> <json>` and return its stdout (no shell, no quoting issues). */
function convexRun(fn, args) {
  return execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
}

function lastLine(out) {
  const lines = out.trim().split("\n").filter(Boolean);
  return lines.at(-1)?.trim() ?? "";
}

function main() {
  const files = readdirSync(KB_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();
  if (files.length === 0) {
    console.log(`No .md files in ${KB_DIR}`);
    return;
  }

  const summary = { added: [], skipped: [], failed: [] };

  for (const file of files) {
    let doc;
    try {
      doc = parseFrontMatter(readFileSync(path.join(KB_DIR, file), "utf8"), file);
    } catch (e) {
      summary.failed.push({ file, error: e.message });
      console.error(`✗ ${file}: ${e.message}`);
      continue;
    }

    try {
      const exists = lastLine(convexRun("kb:hasTitle", { title: doc.title })) === "true";
      if (exists) {
        summary.skipped.push(file);
        console.log(`- skip  ${file} (already seeded: "${doc.title}")`);
        continue;
      }
      const out = convexRun("kb:seedIngest", doc);
      let chunks = "?";
      let embedded = "?";
      try {
        const start = out.indexOf("{");
        const result = JSON.parse(out.slice(start));
        chunks = result.chunks;
        embedded = result.embedded ? "yes" : "no (pending backfill)";
      } catch {
        // Output format changed; the ingest itself succeeded.
      }
      summary.added.push(file);
      console.log(`+ added ${file} → ${chunks} chunks, embedded: ${embedded}`);
    } catch (e) {
      const detail = (e.stderr || e.message || String(e)).toString().trim().split("\n").slice(-3).join(" ");
      summary.failed.push({ file, error: detail });
      console.error(`✗ ${file}: ${detail}`);
    }
  }

  console.log(
    `\nSeed summary: ${summary.added.length} added, ${summary.skipped.length} skipped, ${summary.failed.length} failed (of ${files.length} files)`
  );
  if (summary.failed.length > 0) process.exitCode = 1;
}

main();
