/**
 * Pediu Aqui — geometria oficial da marca.
 *
 * Este arquivo e o unico lugar onde a geometria do simbolo existe.
 * Todos os SVGs e todos os PNGs sao derivados destas constantes.
 * Nunca redesenhe o simbolo em outro arquivo.
 *
 * Canvas de referencia: 512 x 512.
 * Caixa de conteudo do simbolo: x 80..432, y 96..416 (352 x 320), centro optico 256,256.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Contornos tipograficos (Inter) ja convertidos para paths. Sem dependencia de fonte instalada. */
export const TEXT = JSON.parse(
  fs.readFileSync(path.join(here, "brand-text-paths.json"), "utf8"),
);

export const COLORS = {
  carbon950: "#071014",
  carbon900: "#0B171C",
  carbon800: "#14252B",
  carbon700: "#20343A",
  teal700: "#008C7D",
  teal600: "#00A896",
  teal500: "#00C2A8",
  teal400: "#30D6BE",
  teal300: "#75E6D4",
  white: "#FFFFFF",
  background: "#F4F7F7",
  surfaceMuted: "#EAF0F0",
  textPrimary: "#101718",
  textSecondary: "#526164",
  textInverse: "#F7FAFA",
  border: "#D8E1E1",
};

/** Caixa de conteudo do simbolo dentro do canvas 512. */
export const SYMBOL_BOX = { x: 80, y: 96, w: 352, h: 320 };

/** viewBox quadrado oficial do simbolo isolado. */
export const SYMBOL_VIEWBOX = { x: 64, y: 64, size: 384 };

/**
 * Marcacao do simbolo no sistema de coordenadas 512.
 * - haste vertical do P
 * - barriga do P em traco geometrico constante
 * - faixa teal horizontal atravessando o contraforma e avancando para a direita
 * A faixa e separada do carbono por um recorte de mascara, entao o simbolo
 * continua legivel em uma unica cor.
 */
export function symbolMarkup({ base, accent, id }) {
  return `  <defs>
    <mask id="${id}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <rect x="0" y="0" width="512" height="512" fill="#fff"/>
      <rect x="140" y="188" width="304" height="72" rx="10" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#${id}-cut)">
    <rect x="80" y="96" width="72" height="320" rx="8" fill="${base}"/>
    <path d="M152 132 H252 A92 92 0 0 1 252 316 H152" fill="none" stroke="${base}" stroke-width="72"/>
  </g>
  <rect x="152" y="200" width="280" height="48" rx="6" fill="${accent}"/>`;
}

/** Wordmark "Pediu Aqui" em contornos, alinhado por altura de caixa alta. */
export function wordmarkMarkup({ fill, capHeight, x, capTop }) {
  const src = TEXT.wordmark;
  const s = capHeight / src.cap;
  const tx = x - src.bbox.x1 * s;
  const ty = capTop + capHeight;
  return `  <g transform="translate(${round(tx)} ${round(ty)}) scale(${round(s, 6)})" fill="${fill}"><path d="${src.d}"/></g>`;
}

export function wordmarkWidth(capHeight) {
  const src = TEXT.wordmark;
  const s = capHeight / src.cap;
  return (src.bbox.x2 - src.bbox.x1) * s;
}

/** Texto auxiliar (assinaturas) em contornos. */
export function textMarkup(key, { fill, capHeight, x, capTop, opacity = 1 }) {
  const src = TEXT[key];
  const s = capHeight / src.cap;
  const tx = x - src.bbox.x1 * s;
  const ty = capTop + capHeight;
  return `  <g transform="translate(${round(tx)} ${round(ty)}) scale(${round(s, 6)})" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ""}><path d="${src.d}"/></g>`;
}

export function textWidth(key, capHeight) {
  const src = TEXT[key];
  const s = capHeight / src.cap;
  return (src.bbox.x2 - src.bbox.x1) * s;
}

export function round(n, p = 2) {
  return Number.parseFloat(Number(n).toFixed(p));
}

/** Bloco horizontal: simbolo + wordmark. Retorna markup e caixa de conteudo. */
export function horizontalLockup({ base, accent, wordFill, id }) {
  const capHeight = 150;
  const gap = 96;
  const wordX = SYMBOL_BOX.x + SYMBOL_BOX.w + gap;
  const capTop = 256 - capHeight / 2;
  const markup = [symbolMarkup({ base, accent, id }), wordmarkMarkup({ fill: wordFill, capHeight, x: wordX, capTop })].join("\n");
  const box = {
    x: SYMBOL_BOX.x,
    y: SYMBOL_BOX.y,
    w: wordX + wordmarkWidth(capHeight) - SYMBOL_BOX.x,
    h: SYMBOL_BOX.h,
  };
  return { markup, box };
}

/** Bloco vertical: simbolo sobre wordmark. */
export function stackedLockup({ base, accent, wordFill, id }) {
  const capHeight = 72;
  const gap = 72;
  const width = wordmarkWidth(capHeight);
  const wordX = 256 - width / 2;
  const capTop = SYMBOL_BOX.y + SYMBOL_BOX.h + gap;
  const markup = [symbolMarkup({ base, accent, id }), wordmarkMarkup({ fill: wordFill, capHeight, x: wordX, capTop })].join("\n");
  const left = Math.min(SYMBOL_BOX.x, wordX);
  const right = Math.max(SYMBOL_BOX.x + SYMBOL_BOX.w, wordX + width);
  return {
    markup,
    box: { x: left, y: SYMBOL_BOX.y, w: right - left, h: capTop + capHeight - SYMBOL_BOX.y },
  };
}

/** Envelope SVG com viewBox ajustado a caixa de conteudo mais margem. */
export function svgDocument({ markup, box, pad = 24, title, desc }) {
  const x = round(box.x - pad);
  const y = round(box.y - pad);
  const w = round(box.w + pad * 2);
  const h = round(box.h + pad * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" role="img" aria-label="${title}">
  <title>${title}</title>
  <desc>${desc}</desc>
${markup}
</svg>
`;
}
