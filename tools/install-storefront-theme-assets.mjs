import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const bundles = [
  {
    file: "comandiva_assets_parte_1_mobile_logos.zip",
    copies: [
      ["comandiva_assets_completos/wizard/mobile/", "public/storefront/wizard/mobile/"],
      ["comandiva_assets_completos/logos/", "public/brand/themes/"],
    ],
  },
  {
    file: "comandiva_assets_parte_2_desktop_integracao.zip",
    copies: [
      ["comandiva_assets_completos/wizard/desktop/", "public/storefront/wizard/desktop/"],
    ],
  },
  {
    file: "comandiva_banners_individuais.zip",
    flatTarget: "public/storefront/banners/",
    allowed: new Set([
      "pizzaria.png",
      "hamburgueria.png",
      "acai.png",
      "sorveteria.png",
      "restaurante.png",
      "lanchonete.png",
      "pastelaria.png",
      "adega.png",
      "mercado.png",
      "outros.png",
    ]),
  },
];

let installed = 0;
for (const bundle of bundles) {
  const zipPath = path.join(root, bundle.file);
  if (!fs.existsSync(zipPath)) {
    console.log(`[storefront-theme] ${bundle.file} not found; keeping existing assets.`);
    continue;
  }

  const entries = readZipEntries(fs.readFileSync(zipPath));

  if (bundle.flatTarget) {
    for (const [entryName, data] of entries) {
      const baseName = path.posix.basename(entryName);
      if (!bundle.allowed?.has(baseName)) continue;
      const target = path.join(root, bundle.flatTarget, baseName);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
      installed += 1;
    }
    continue;
  }

  for (const [sourcePrefix, targetPrefix] of bundle.copies) {
    for (const [entryName, data] of entries) {
      if (!entryName.startsWith(sourcePrefix)) continue;
      const relative = entryName.slice(sourcePrefix.length);
      if (!relative || relative.includes("..") || path.isAbsolute(relative)) continue;
      const target = path.join(root, targetPrefix, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
      installed += 1;
    }
  }
}

console.log(`[storefront-theme] Installed ${installed} storefront theme assets.`);
