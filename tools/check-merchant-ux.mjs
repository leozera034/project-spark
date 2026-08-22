import { access, readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const merchantRoutesRoot = join(root, "src/routes/app/loja");
const merchantShellPath = join(root, "src/routes/app/loja.tsx");
const merchantHomePath = join(merchantRoutesRoot, "index.tsx");
const legacySmartDeliveryPath = join(merchantRoutesRoot, "smart-delivery.tsx");
const storeScopePath = join(root, "src/store-scope/StoreScopeProvider.tsx");
const obsoleteThemePath = join(root, "src/purple-overrides.css");
const criticalSurfaces = [
  join(root, "src/components/store/AddonPurchaseReadiness.tsx"),
  join(root, "src/components/store/BillingStatusBanner.tsx"),
  join(root, "src/components/store/NewOrderAlertControl.tsx"),
  join(root, "src/components/store/WhatsAppAutomationControlCard.tsx"),
  join(root, "src/components/store/WhatsAppEvolutionConnectionCard.tsx"),
  storeScopePath,
];

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

function checkBrand(source, path) {
  if (/Pediu\s*Aqui|PediuAqui/i.test(source)) {
    fail(path, "marca antiga encontrada em superfície do lojista");
  }
}

const merchantFiles = await walk(merchantRoutesRoot);
for (const path of merchantFiles) {
  const source = await readFile(path, "utf8");
  checkBrand(source, path);

  if (/(?:bg|text|border|ring|from|via|to)-\[#(?:[0-9a-fA-F]{3,8})\]/.test(source)) {
    fail(path, "classe Tailwind com cor hexadecimal crua; use tokens semânticos da Comandiva");
  }

  if (/authContext\?*\.store_ids\?*\.\[?0\]?|store_ids\s*\[\s*0\s*\]/.test(source)) {
    fail(path, "seleção local da primeira loja encontrada; use o StoreScopeProvider global");
  }
}

for (const path of criticalSurfaces) {
  const source = await readFile(path, "utf8");
  checkBrand(source, path);
}

const shellSource = await readFile(merchantShellPath, "utf8");
for (const required of [
  "useStoreScope",
  "StoreSwitcher",
  "Navegação principal",
  "Pedidos",
  "Cozinha",
  "Entregas",
  "useOrderRealtime",
  "NewOrderAlertControl",
]) {
  if (!shellSource.includes(required)) fail(merchantShellPath, `shell global sem marcador obrigatório: ${required}`);
}

const homeSource = await readFile(merchantHomePath, "utf8");
for (const required of ["Fila de prioridade", "PriorityOrderItem", "useOrderTransition"]) {
  if (!homeSource.includes(required)) fail(merchantHomePath, `central operacional sem marcador obrigatório: ${required}`);
}

const scopeSource = await readFile(storeScopePath, "utf8");
if (!scopeSource.includes("queryClient.invalidateQueries({ type: \"active\" })")) {
  fail(storeScopePath, "troca global de loja deve invalidar consultas ativas");
}
if (scopeSource.includes("/{store.slug}")) {
  fail(storeScopePath, "slug técnico não deve aparecer como informação principal na escolha de operação");
}

const smartDeliverySource = await readFile(legacySmartDeliveryPath, "utf8");
if (!smartDeliverySource.includes("redirect") || !smartDeliverySource.includes("/app/loja/entregas")) {
  fail(legacySmartDeliveryPath, "deep link técnico deve redirecionar para a central de Entregas");
}

try {
  await access(obsoleteThemePath);
  fail(obsoleteThemePath, "override visual legado voltou ao repositório; a camada oficial é comandiva-theme.css");
} catch {
  // Ausência esperada.
}

if (violations.length > 0) {
  console.error("Merchant UX guard falhou:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Merchant UX guard passed (${merchantFiles.length + criticalSurfaces.length} superfícies verificadas).`);
