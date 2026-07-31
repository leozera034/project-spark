import opentype from 'opentype.js';
import fs from 'node:fs';
const load = w => opentype.parse(new Uint8Array(fs.readFileSync(`/tmp/fonts/Inter-${w}.ttf`)).buffer);
const fonts = { 400: load(400), 600: load(600), 700: load(700) };
function make(text, weight, size, tracking = 0) {
  const font = fonts[weight];
  const full = new opentype.Path();
  let x = 0;
  const glyphs = font.stringToGlyphs(text);
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const p = g.getPath(x, 0, size);
    full.extend(p);
    x += (g.advanceWidth / font.unitsPerEm) * size + tracking;
  }
  const bb = full.getBoundingBox();
  return { d: full.toPathData(2), bbox: { x1: +bb.x1.toFixed(2), y1: +bb.y1.toFixed(2), x2: +bb.x2.toFixed(2), y2: +bb.y2.toFixed(2) }, advance: +x.toFixed(2) };
}
const out = {
  wordmark: make('Pediu Aqui', 700, 200, -4),
  tagline: make('Seu cardápio, seus pedidos, tudo aqui.', 600, 100, 0),
  taglineInst: make('Pedidos simples. Operação precisa.', 600, 100, 0),
  brandSmall: make('Pediu Aqui', 700, 100, -2),
};
fs.writeFileSync('tools/brand-text-paths.json', JSON.stringify(out, null, 2));
for (const k of Object.keys(out)) console.log(k, out[k].bbox, out[k].advance, out[k].d.length);
