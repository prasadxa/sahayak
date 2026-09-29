#!/usr/bin/env node
// Renders the PWA / Apple icons from public/icons/icon.svg.
//
//   node scripts/generate-icons.mjs
//
// icon.svg has a rounded-square background (`<rect id="bg">`) and the artwork
// in `<g id="mark">`. The "any" icons are straight renders of the SVG. The
// maskable and Apple icons are rebuilt on a full-bleed square so the platform
// can apply its own mask: the mark is scaled into the maskable safe zone
// (a centred circle of radius 40% of the icon size).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const iconsDir = path.join(root, "public", "icons");
const BRAND_GREEN = "#15803d";

const source = await readFile(path.join(iconsDir, "icon.svg"), "utf8");

const mark = source.match(/<g id="mark">[\s\S]*?<\/g>/)?.[0];
if (!mark) throw new Error('icon.svg must contain <g id="mark">…</g>');

/** Full-bleed square with the mark scaled around the centre. */
const fullBleed = (
  scale
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${BRAND_GREEN}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${mark}</g>
</svg>`;

const outputs = [
  { file: "icon-192.png", size: 192, svg: source },
  { file: "icon-512.png", size: 512, svg: source },
  // Mark's farthest point is ~232 units from centre; 0.8 × 232 ≈ 186 < 204.8 (40% of 512).
  { file: "maskable-512.png", size: 512, svg: fullBleed(0.8) },
  // iOS rounds the corners itself and shows transparency as black, so no rounded rect here.
  { file: "apple-touch-icon.png", size: 180, svg: fullBleed(0.9) },
];

for (const { file, size, svg } of outputs) {
  const png = await sharp(Buffer.from(svg), {
    density: Math.ceil((72 * size) / 512) * 4,
  })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(iconsDir, file), png);
  console.log(`wrote public/icons/${file} (${size}×${size}, ${png.length} bytes)`);
}
