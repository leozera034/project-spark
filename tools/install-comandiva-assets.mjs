import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zipPath = path.join(root, "comandiva-main-ready.zip");
const brandDir = path.join(root, "public", "brand");
const publicDir = path.join(root, "public");

if (!fs.existsSync(zipPath)) {
  console.log("[brand] comandiva-main-ready.zip not found; keeping existing generated assets.");
  process.exit(0);
}

fs.mkdirSync(brandDir, { recursive: true });
const zip = fs.readFileSync(zipPath);

function findEocd(buffer) {
  const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Invalid ZIP: EOCD not found");
}

function readZipEntries(buffer) {
  const eocd = findEocd(buffer);
  const total = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const out = new Map();
  let p = centralOffset;

  for (let index = 0; index < total; index += 1) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) throw new Error("Invalid ZIP central directory");
    const method = buffer.readUInt16LE(p + 10);
    const compressedSize = buffer.readUInt32LE(p + 20);
    const fileNameLength = buffer.readUInt16LE(p + 28);
    const extraLength = buffer.readUInt16LE(p + 30);
    const commentLength = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.subarray(p + 46, p + 46 + fileNameLength).toString("utf8");

    if (!name.endsWith("/")) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error(`Invalid local ZIP header for ${name}`);
      }
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) data = Buffer.from(compressed);
      else if (method === 8) data = inflateRawSync(compressed);
      else throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
      out.set(name, data);
    }

    p += 46 + fileNameLength + extraLength + commentLength;
  }

  return out;
}

const entries = readZipEntries(zip);
const sourceRoot = "comandiva_main_ready/";
const copies = {
  "01-transparent-logos/comandiva-logo-horizontal.png": "comandiva-logo-horizontal.png",
  "01-transparent-logos/comandiva-logo-stacked.png": "comandiva-logo-stacked.png",
  "01-transparent-logos/comandiva-logo-stacked-alt.png": "comandiva-logo-stacked-alt.png",
  "01-transparent-logos/comandiva-symbol.png": "comandiva-symbol.png",
  "01-transparent-logos/comandiva-wordmark.png": "comandiva-wordmark.png",
  "02-site-assets/comandiva-app-icon.png": "comandiva-app-icon.png",
  "02-site-assets/comandiva-hero-operations.webp": "comandiva-hero-operations.webp",
  "02-site-assets/comandiva-dashboard-preview.webp": "comandiva-dashboard-preview.webp",
  "02-site-assets/comandiva-mobile-tracking.webp": "comandiva-mobile-tracking.webp",
  "02-site-assets/comandiva-og-image-1200x630.png": "og-image-1200x630.png",
  "02-site-assets/comandiva-pattern.svg": "comandiva-pattern.svg",
};

for (const [source, target] of Object.entries(copies)) {
  const key = sourceRoot + source;
  const data = entries.get(key);
  if (!data) throw new Error(`Missing required Comandiva asset in ZIP: ${key}`);
  fs.writeFileSync(path.join(brandDir, target), data);
}

const plum = "#4B1D6D";
const appPath = path.join(brandDir, "comandiva-app-icon.png");
const symbolPath = path.join(brandDir, "comandiva-symbol.png");

async function squareFromApp(size, target) {
  await sharp(appPath)
    .resize(size, size, { fit: "cover", position: "centre" })
    .flatten({ background: plum })
    .png({ compressionLevel: 9 })
    .toFile(path.join(brandDir, target));
}

await squareFromApp(1024, "ios-app-icon-1024x1024.png");
await squareFromApp(512, "android-icon-512x512.png");
await squareFromApp(180, "apple-touch-icon-180x180.png");
await squareFromApp(192, "pwa-icon-192x192.png");
await squareFromApp(512, "pwa-icon-512x512.png");

const maskableSymbol = await sharp(symbolPath)
  .resize(330, 330, { fit: "contain" })
  .png()
  .toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: plum } })
  .composite([{ input: maskableSymbol, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, "pwa-maskable-512x512.png"));

const adaptiveSymbol = await sharp(symbolPath)
  .resize(300, 300, { fit: "contain" })
  .png()
  .toBuffer();
await sharp({
  create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: adaptiveSymbol, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, "android-adaptive-foreground-432x432.png"));
await sharp({ create: { width: 432, height: 432, channels: 3, background: plum } })
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, "android-adaptive-background-432x432.png"));

const monoSymbol = await sharp(symbolPath)
  .resize(300, 300, { fit: "contain" })
  .tint("#FFFFFF")
  .png()
  .toBuffer();
await sharp({
  create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: monoSymbol, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, "android-monochrome-432x432.png"));

const faviconBuffers = [];
for (const size of [16, 32, 48, 64]) {
  const target = path.join(brandDir, `favicon-${size}x${size}.png`);
  await sharp(appPath)
    .resize(size, size, { fit: "cover" })
    .flatten({ background: plum })
    .png({ compressionLevel: 9 })
    .toFile(target);
  if (size <= 48) faviconBuffers.push(fs.readFileSync(target));
}
fs.writeFileSync(path.join(publicDir, "favicon.ico"), await pngToIco(faviconBuffers));

fs.writeFileSync(
  path.join(publicDir, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Comandiva"><rect width="64" height="64" rx="14" fill="#4B1D6D"/><path d="M38 10c-10 0-18 8-18 18 0 13 18 27 18 27s18-14 18-27c0-10-8-18-18-18Z" fill="none" stroke="#FFF6F1" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 27c0-4 5-6 8-2 3-4 8-2 8 2 0 5-8 10-8 10s-8-5-8-10Z" fill="#FF6A4D"/><path d="M4 21h17M7 29h12M10 37h14" stroke="#FF6A4D" stroke-width="5" stroke-linecap="round"/></svg>\n`,
);

await sharp(path.join(brandDir, "og-image-1200x630.png"))
  .resize(1200, 600, { fit: "cover", position: "centre" })
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandDir, "twitter-card-1200x600.png"));

console.log(
  `[brand] Installed ${Object.keys(copies).length} Comandiva source assets and generated platform variants.`,
);
