import opentype from 'opentype.js';
const f = opentype.loadSync('/tmp/fonts/Inter-Bold.ttf');
console.log(f.names.fullName, f.unitsPerEm);
const p = f.getPath('Pediu Aqui', 0, 0, 100);
console.log(p.toPathData(2).slice(0,120));
const bb = p.getBoundingBox(); console.log(bb);
