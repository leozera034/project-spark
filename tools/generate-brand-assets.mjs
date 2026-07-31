/**
 * Pediu Aqui — geracao de todos os ativos de marca.
 *
 * Uso: npm run brand:generate
 *
 * Regras:
 * - toda geometria vem de tools/brand-geometry.mjs;
 * - todo texto ja esta em contornos (tools/brand-text-paths.json), sem dependencia de fonte;
 * - nenhum PNG e editado manualmente;
 * - cada ativo e um arquivo separado, sem prancha e sem recorte manual.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import {
  COLORS,
  SYMBOL_BOX,
  SYMBOL_VIEWBOX,
  horizontalLockup,
  round,
  stackedLockup,
  svgDocument,
  symbolMarkup,
  textMarkup,
  textWidth,
  wordmarkMarkup,
  wordmarkWidth,
} from "./brand-geometry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "brand");
const publicDir = path.join(root, "public");

fs.mkdirSync(brandDir, { recursive: true });

const written = [];

function writeText(file, contents) {
  fs.writeFileSync(file, contents);
  written.push(path.relative(root, file));
}

async function writePng(file, svg, width, height) {
  const buffer = await sharp(Buffer.from(svg), { density: 384 })
    .resize(width, height, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(file, buffer);
  written.push(path.relative(root, file));
  return buffer;
}

/* ------------------------------------------------------------------ */
/* 1. SVGs oficiais                                                    */
/* ------------------------------------------------------------------ */

const symbolVariants = {
  "symbol-carbon-teal": { base: COLORS.carbon900, accent: COLORS.teal500 },
  "symbol-carbon": { base: COLORS.carbon900, accent: COLORS.carbon900 },
  "symbol-teal": { base: COLORS.teal600, accent: COLORS.teal600 },
  "symbol-white": { base: COLORS.white, accent: COLORS.white },
};

function symbolDocument(name, { base, accent }) {
  const markup = symbolMarkup({ base, accent, id: name });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SYMBOL_VIEWBOX.x} ${SYMBOL_VIEWBOX.y} ${SYMBOL_VIEWBOX.size} ${SYMBOL_VIEWBOX.size}" role="img" aria-label="Simbolo Pediu Aqui">
  <title>Simbolo Pediu Aqui</title>
  <desc>Letra P geometrica com faixa horizontal de movimento. Geometria unica derivada de pediu-aqui-master.svg.</desc>
${markup}
</svg>
`;
}

for (const [name, colors] of Object.entries(symbolVariants)) {
  writeText(path.join(brandDir, `${name}.svg`), symbolDocument(name, colors));
}

writeText(
  path.join(brandDir, "pediu-aqui-symbol.svg"),
  symbolDocument("pediu-aqui-symbol", symbolVariants["symbol-carbon-teal"]),
);

// Wordmark isolado
{
  const capHeight = 150;
  const markup = wordmarkMarkup({ fill: COLORS.carbon900, capHeight, x: 0, capTop: 0 });
  writeText(
    path.join(brandDir, "pediu-aqui-wordmark.svg"),
    svgDocument({
      markup,
      box: { x: 0, y: -12, w: wordmarkWidth(capHeight), h: capHeight + 36 },
      pad: 12,
      title: "Wordmark Pediu Aqui",
      desc: "Grafia oficial Pediu Aqui em contornos vetoriais.",
    }),
  );
}

const lockupVariants = {
  carbon: { base: COLORS.carbon900, accent: COLORS.teal500, wordFill: COLORS.carbon900 },
  white: { base: COLORS.white, accent: COLORS.teal400, wordFill: COLORS.white },
  monochrome: { base: COLORS.carbon900, accent: COLORS.carbon900, wordFill: COLORS.carbon900 },
};

for (const [variant, colors] of Object.entries(lockupVariants)) {
  const h = horizontalLockup({ ...colors, id: `h-${variant}` });
  writeText(
    path.join(brandDir, `logo-horizontal-${variant}.svg`),
    svgDocument({
      ...h,
      title: `Logotipo horizontal Pediu Aqui (${variant})`,
      desc: "Simbolo e wordmark em bloco horizontal oficial.",
    }),
  );
  const v = stackedLockup({ ...colors, id: `v-${variant}` });
  writeText(
    path.join(brandDir, `logo-stacked-${variant}.svg`),
    svgDocument({
      ...v,
      title: `Logotipo vertical Pediu Aqui (${variant})`,
      desc: "Simbolo sobre wordmark em bloco vertical oficial.",
    }),
  );
}

// Master: bloco horizontal oficial com proporcoes de referencia.
{
  const h = horizontalLockup({ ...lockupVariants.carbon, id: "master" });
  writeText(
    path.join(brandDir, "pediu-aqui-master.svg"),
    svgDocument({
      ...h,
      title: "Pediu Aqui — SVG master",
      desc:
        "Fonte unica de verdade da marca Pediu Aqui. Simbolo geometrico da letra P com faixa de movimento e wordmark em contornos. Todos os demais ativos derivam deste arquivo.",
    }),
  );
}

/* ------------------------------------------------------------------ */
/* 2. Composicoes de icone                                             */
/* ------------------------------------------------------------------ */

/**
 * Coloca o simbolo dentro de um canvas quadrado ou retangular,
 * mantendo a geometria exata do master. Somente escala e posicao mudam.
 */
function placedSymbol({ width, height, base, accent, contentRatio, id, cx = 0.5, cy = 0.5 }) {
  const target = Math.min(width, height) * contentRatio;
  const k = target / Math.max(SYMBOL_BOX.w, SYMBOL_BOX.h);
  const tx = width * cx - k * (SYMBOL_BOX.x + SYMBOL_BOX.w / 2);
  const ty = height * cy - k * (SYMBOL_BOX.y + SYMBOL_BOX.h / 2);
  return `  <g transform="translate(${round(tx)} ${round(ty)}) scale(${round(k, 6)})">
${symbolMarkup({ base, accent, id })}
  </g>`;
}

function iconSvg({ size, bg, base, accent, contentRatio, id }) {
  const layers = [];
  if (bg) layers.push(`  <rect width="${size}" height="${size}" fill="${bg}"/>`);
  layers.push(placedSymbol({ width: size, height: size, base, accent, contentRatio, id }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${layers.join("\n")}
</svg>
`;
}

/* favicon.svg — simbolo sobre carbono, legivel em abas claras e escuras */
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Pediu Aqui">
  <title>Pediu Aqui</title>
  <rect width="64" height="64" rx="14" fill="${COLORS.carbon900}"/>
${placedSymbol({ width: 64, height: 64, base: COLORS.white, accent: COLORS.teal400, contentRatio: 0.62, id: "fav" })}
</svg>
`;
writeText(path.join(publicDir, "favicon.svg"), faviconSvg);

const faviconSizes = [16, 32, 48, 64];
const faviconBuffers = [];
for (const size of faviconSizes) {
  const buffer = await writePng(
    path.join(brandDir, `favicon-${size}x${size}.png`),
    faviconSvg,
    size,
    size,
  );
  faviconBuffers.push(buffer);
}
const ico = await pngToIco(faviconBuffers.slice(0, 3));
fs.writeFileSync(path.join(publicDir, "favicon.ico"), ico);
written.push("public/favicon.ico");

/* PWA */
await writePng(
  path.join(brandDir, "pwa-icon-192x192.png"),
  iconSvg({ size: 192, bg: COLORS.carbon900, base: COLORS.white, accent: COLORS.teal400, contentRatio: 0.62, id: "pwa192" }),
  192,
  192,
);
await writePng(
  path.join(brandDir, "pwa-icon-512x512.png"),
  iconSvg({ size: 512, bg: COLORS.carbon900, base: COLORS.white, accent: COLORS.teal400, contentRatio: 0.62, id: "pwa512" }),
  512,
  512,
);
// maskable: conteudo dentro da safe zone de 80% do diametro (ratio 0.46 do lado)
await writePng(
  path.join(brandDir, "pwa-maskable-512x512.png"),
  iconSvg({ size: 512, bg: COLORS.carbon900, base: COLORS.white, accent: COLORS.teal400, contentRatio: 0.46, id: "pwaMask" }),
  512,
  512,
);

/* iOS — fundo solido, sem transparencia, sem cantos arredondados no arquivo */
for (const size of [180, 1024]) {
  const name = size === 180 ? "apple-touch-icon-180x180.png" : "ios-app-icon-1024x1024.png";
  const svg = iconSvg({ size, bg: COLORS.carbon900, base: COLORS.white, accent: COLORS.teal400, contentRatio: 0.6, id: `ios${size}` });
  const buffer = await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: "fill" })
    .flatten({ background: COLORS.carbon900 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(brandDir, name), buffer);
  written.push(`public/brand/${name}`);
}

/* Android */
await writePng(
  path.join(brandDir, "android-icon-512x512.png"),
  iconSvg({ size: 512, bg: COLORS.carbon900, base: COLORS.white, accent: COLORS.teal400, contentRatio: 0.6, id: "and512" }),
  512,
  512,
);
await writePng(
  path.join(brandDir, "android-adaptive-foreground-432x432.png"),
  iconSvg({ size: 432, bg: null, base: COLORS.white, accent: COLORS.teal400, contentRatio: 0.45, id: "andFg" }),
  432,
  432,
);
await writePng(
  path.join(brandDir, "android-adaptive-background-432x432.png"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 432 432"><rect width="432" height="432" fill="${COLORS.carbon900}"/></svg>`,
  432,
  432,
);
await writePng(
  path.join(brandDir, "android-monochrome-432x432.png"),
  iconSvg({ size: 432, bg: null, base: COLORS.white, accent: COLORS.white, contentRatio: 0.45, id: "andMono" }),
  432,
  432,
);

/* ------------------------------------------------------------------ */
/* 3. SEO, redes sociais e splash                                      */
/* ------------------------------------------------------------------ */

function lockupAt({ variant, capHeight, x, capTop, id }) {
  const colors = lockupVariants[variant];
  const k = capHeight / 150;
  const box = horizontalLockup({ ...colors, id }).box;
  const tx = x - box.x * k;
  const ty = capTop - SYMBOL_BOX.y * k;
  const markup = horizontalLockup({ ...colors, id }).markup;
  return {
    markup: `  <g transform="translate(${round(tx)} ${round(ty)}) scale(${round(k, 6)})">\n${markup}\n  </g>`,
    width: box.w * k,
    height: box.h * k,
  };
}

function socialSvg({ width, height, logoCap, taglineKey, taglineCap, margin, stackedText = false }) {
  const logo = lockupAt({ variant: "white", capHeight: logoCap, x: margin, capTop: margin, id: `sc${width}x${height}` });
  const tagWidth = textWidth(taglineKey, taglineCap);
  const parts = [
    `  <rect width="${width}" height="${height}" fill="${COLORS.carbon900}"/>`,
    `  <rect x="0" y="${height - 10}" width="${width}" height="10" fill="${COLORS.teal500}"/>`,
    logo.markup,
  ];
  const baseY = stackedText ? height * 0.52 : height - margin - taglineCap * 2.6;
  parts.push(
    textMarkup(taglineKey, {
      fill: COLORS.textInverse,
      capHeight: taglineCap,
      x: margin,
      capTop: baseY,
    }),
  );
  parts.push(
    `  <rect x="${margin}" y="${round(baseY + taglineCap * 2.0)}" width="${round(Math.min(tagWidth, width - margin * 2) * 0.28)}" height="8" rx="4" fill="${COLORS.teal500}"/>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${parts.join("\n")}
</svg>
`;
}

await writePng(
  path.join(brandDir, "og-image-1200x630.png"),
  socialSvg({ width: 1200, height: 630, logoCap: 74, taglineKey: "tagline", taglineCap: 46, margin: 80 }),
  1200,
  630,
);
await writePng(
  path.join(brandDir, "twitter-card-1200x600.png"),
  socialSvg({ width: 1200, height: 600, logoCap: 74, taglineKey: "taglineInst", taglineCap: 46, margin: 80 }),
  1200,
  600,
);
await writePng(
  path.join(brandDir, "social-square-1080x1080.png"),
  socialSvg({ width: 1080, height: 1080, logoCap: 78, taglineKey: "tagline", taglineCap: 52, margin: 88, stackedText: true }),
  1080,
  1080,
);
await writePng(
  path.join(brandDir, "social-story-1080x1920.png"),
  socialSvg({ width: 1080, height: 1920, logoCap: 82, taglineKey: "tagline", taglineCap: 56, margin: 96, stackedText: true }),
  1080,
  1920,
);

function splashSvg({ width, height, dark }) {
  const bg = dark ? COLORS.carbon900 : COLORS.background;
  const variant = dark ? "white" : "carbon";
  const capHeight = Math.min(width, height) * 0.075;
  const probe = lockupAt({ variant, capHeight, x: 0, capTop: 0, id: `sp${width}${dark}` });
  const x = (width - probe.width) / 2;
  const capTop = height / 2 - probe.height / 2;
  const logo = lockupAt({ variant, capHeight, x, capTop, id: `sp${width}${dark}` });
  const sigCap = capHeight * 0.28;
  const sigWidth = textWidth("tagline", sigCap);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
${logo.markup}
${textMarkup("tagline", {
  fill: dark ? COLORS.textInverse : COLORS.textSecondary,
  capHeight: sigCap,
  x: (width - sigWidth) / 2,
  capTop: capTop + probe.height + sigCap * 3,
})}
</svg>
`;
}

await writePng(path.join(brandDir, "splash-light-1080x1920.png"), splashSvg({ width: 1080, height: 1920, dark: false }), 1080, 1920);
await writePng(path.join(brandDir, "splash-dark-1080x1920.png"), splashSvg({ width: 1080, height: 1920, dark: true }), 1080, 1920);
await writePng(path.join(brandDir, "splash-landscape-light-1920x1080.png"), splashSvg({ width: 1920, height: 1080, dark: false }), 1920, 1080);
await writePng(path.join(brandDir, "splash-landscape-dark-1920x1080.png"), splashSvg({ width: 1920, height: 1080, dark: true }), 1920, 1080);

console.log(`Pediu Aqui — ${written.length} ativos gerados:`);
for (const file of written.sort()) console.log(`  ${file}`);
