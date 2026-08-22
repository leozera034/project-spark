import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const roots = [
  join(root, "src/routes"),
  join(root, "src/catalog"),
  join(root, "src/components/auth"),
  join(root, "src/components/brand"),
  join(root, "src/components/feedback"),
  join(root, "src/components/courier"),
  join(root, "src/components/store"),
  join(root, "src/components/storefront"),
  join(root, "src/storefront"),
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if ([".ts", ".tsx", ".css"].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = (await Promise.all(roots.map(walk))).flat();
const violations = [];
for (const path of files) {
  const source = await readFile(path, "utf8");
  if (/Pediu\s*Aqui|PediuAqui/i.test(source)) {
    violations.push(`${relative(root, path)}: marca antiga encontrada em superfície que pode chegar ao usuário`);
  }
}

if (violations.length > 0) {
  console.error("User-facing brand guard falhou:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`User-facing brand guard passed (${files.length} arquivos verificados).`);
