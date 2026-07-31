import opentype from 'opentype.js';
import fs from 'node:fs';
for (const n of ['Inter-Bold','Inter-SemiBold','Inter-Regular']) {
  const f = opentype.parse(fs.readFileSync(`/tmp/fonts/${n}.ttf`).buffer);
  console.log(n, JSON.stringify(f.names.fontFamily), JSON.stringify(f.names.fontSubfamily), f.unitsPerEm);
}
