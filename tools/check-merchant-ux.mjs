import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const merchantRoutesRoot = join(root, "src/routes/app/loja");
const merchantShellPath = join(root, "src/routes/app/loja.tsx");
const legacySmartDeliveryPath = join(merchantRoutesRoot, "smart-delivery.tsx");

const violations = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

function fail(path, message) {
  violations.push(`${relative(root, path)}: ${message}`);
}

const merchantFiles = await walk(merchantRoutesRoot);
for (const path of merchantFiles) {
  const source = await readFile(path, "utf8");

  if (/Pediu\s*Aqui|PediuAqui/i.test(source)) {
    fail(path, "marca antiga encontrada em superfície do lojista");
  }

  if (/(?:bg|text|border|ring|from|via|to)-\[#(?:[0-9a-fA-F]{3,8})\]/.test(source)) {
    fail(path, "classe Tailwind com cor hexadecimal crua; use tokens semânticos da Comandiva");
  }

  if (/authContext\?*\.store_ids\?*\.\[?0\]?|store_ids\s*\[\s*0\s*\]/.test(source)) {
    fail(path, "seleção local da primeira loja encontrada; use o StoreScopeProvider global");
  }
}

const shellSource = await readFile(merchantShellPath, "utf8");
for (const required of ["useStoreScope", "StoreSwitcher", "Navegação principal", "Pedidos", "Cozinha", "Entregas"]) {
  if (!shellSource.includes(required)) fail(merchantShellPath, `shell global sem marcador obrigatório: ${required}`);
}

const smartDeliverySource = await readFile(legacySmartDeliveryPath, "utf8");
if (!smartDeliverySource.includes("redirect") || !smartDeliverySource.includes("/app/loja/entregas")) {
  fail(legacySmartDeliveryPath, "deep link técnico deve redirecionar para a central de Entregas");
}

if (violations.length > 0) {
  console.error("Merchant UX guard falhou:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Merchant UX guard passed (${merchantFiles.length} arquivos verificados).`);
