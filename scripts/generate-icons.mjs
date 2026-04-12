/**
 * One-shot: resize public/branding/app-icon.png into favicon + PWA sizes.
 * Run: node scripts/generate-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "public", "branding", "app-icon.png");

if (!fs.existsSync(src)) {
  console.error("Missing:", src);
  process.exit(1);
}

const outDir = path.join(root, "public", "branding");
fs.mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 192, 512];
const pngBuffers = [];

for (const s of sizes) {
  const buf = await sharp(src).resize(s, s).png().toBuffer();
  pngBuffers.push(buf);
  if (s === 16 || s === 32) {
    fs.writeFileSync(path.join(outDir, `favicon-${s}x${s}.png`), buf);
  }
  if (s === 192 || s === 512) {
    fs.writeFileSync(path.join(outDir, `icon-${s}.png`), buf);
  }
}

const icoBuf = await pngToIco([pngBuffers[1], pngBuffers[0]]);
fs.writeFileSync(path.join(root, "public", "favicon.ico"), icoBuf);

const apple180 = await sharp(src).resize(180, 180).png().toBuffer();
fs.writeFileSync(path.join(root, "public", "apple-touch-icon.png"), apple180);

console.log("Wrote public/favicon.ico, public/apple-touch-icon.png, public/branding/favicon-*.png, icon-192/512.png");
