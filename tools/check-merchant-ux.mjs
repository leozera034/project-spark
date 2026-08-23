import { access, readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const merchantRoutesRoot = join(root, "src/routes/app/loja");
const merchantShellPath = join(root, "src/routes/app/loja.tsx");
const merchantHomePath = join(merchantRoutesRoot, "index.tsx");
const merchantOrdersPath = join(merchantRoutesRoot, "pedidos.tsx");
const deliveriesPath = join(merchantRoutesRoot, "entregas.tsx");
const legacySmartDeliveryPath = join(merchantRoutesRoot, "smart-delivery.tsx");
const storeScopePath = join(root, "src/store-scope/StoreScopeProvider.tsx");
const atendimentoPath = join(merchantRoutesRoot, "configuracoes/atendimento.tsx");
const manualOpenApiPath = join(root, "src/store-config/manual-open.ts");
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
  "Início",
  "Pedidos",
  "Cozinha",
  "Cardápio",
  "Entregas",
  "Clientes",
  "WhatsApp",
  "Relatórios",
  "Recursos",
  "Configurações",
  "useOrderRealtime",
  "NewOrderAlertControl",
]) {
  if (!shellSource.includes(required)) fail(merchantShellPath, `shell global sem marcador obrigatório: ${required}`);
}

for (const forbidden of [
  '/app/loja/avaliacoes',
  '/app/loja/financeiro',
  '/app/loja/ajuda',
  'label: "Plano',
]) {
  if (shellSource.includes(forbidden)) fail(merchantShellPath, `item não deve estar na navegação principal do lojista: ${forbidden}`);
}

const mobilePrimaryMatches = [...shellSource.matchAll(/mobile:\s*true/g)].length;
if (mobilePrimaryMatches !== 4) {
  fail(merchantShellPath, `mobile deve ter exatamente 4 itens primários antes de Mais; encontrado: ${mobilePrimaryMatches}`);
}
for (const requiredMobile of [
  'label: "Início", icon: LayoutGrid, section: "Operação", mobile: true',
  'label: "Pedidos", icon: ShoppingBag, section: "Operação", mobile: true',
  'label: "Cozinha", icon: ChefHat, section: "Operação", mobile: true',
  'label: "Cardápio", icon: UtensilsCrossed, section: "Operação", mobile: true',
]) {
  if (!shellSource.includes(requiredMobile)) fail(merchantShellPath, `item mobile obrigatório ausente: ${requiredMobile}`);
}

const homeSource = await readFile(merchantHomePath, "utf8");
for (const required of ["Fila de prioridade", "PriorityOrderItem", "useOrderTransition"]) {
  if (!homeSource.includes(required)) fail(merchantHomePath, `central operacional sem marcador obrigatório: ${required}`);
}
for (const forbidden of [
  '/app/loja/avaliacoes',
  '/app/loja/financeiro',
  '/app/loja/ajuda',
  'useStoreFinancialCenter',
  'useStoreReviewCenter',
  'useStoreSupportCenter',
  'Stripe',
]) {
  if (homeSource.includes(forbidden)) fail(merchantHomePath, `home operacional contém área ou detalhe fora do escopo auditado: ${forbidden}`);
}

const ordersSource = await readFile(merchantOrdersPath, "utf8");
for (const required of ["delayedOnly", "fulfillment", "Filtrar pedidos", "ORDER_QUEUES"]) {
  if (!ordersSource.includes(required)) fail(merchantOrdersPath, `pedidos sem elemento operacional obrigatório: ${required}`);
}
for (const forbidden of ["iFood", "paymentFilter", "valueFilter", "periodFilter"]) {
  if (ordersSource.includes(forbidden)) fail(merchantOrdersPath, `filtro não suportado ou inventado encontrado: ${forbidden}`);
}

const deliveriesSource = await readFile(deliveriesPath, "utf8");
for (const forbidden of ["useSetStoreSmartDeliveryPause", "smart.jobs", "routesUsage", "pauseReason", "Pausar rotas", "kill switch", "API key"]) {
  if (deliveriesSource.includes(forbidden)) fail(deliveriesPath, `detalhe técnico/controle interno exposto ao lojista: ${forbidden}`);
}
if (!deliveriesSource.includes("Estimativa inteligente de entrega")) {
  fail(deliveriesPath, "central de Entregas deve expor apenas estado simples da estimativa inteligente");
}

const scopeSource = await readFile(storeScopePath, "utf8");
if (!scopeSource.includes("queryClient.invalidateQueries({ type: \"active\" })")) {
  fail(storeScopePath, "troca global de loja deve invalidar consultas ativas");
}
if (scopeSource.includes("/{store.slug}")) {
  fail(storeScopePath, "slug técnico não deve aparecer como informação principal na escolha de operação");
}

const atendimentoSource = await readFile(atendimentoPath, "utf8");
for (const required of ["manualOpen", "setManualStoreOpen", "Loja aberta manualmente", "Loja fechada manualmente"]) {
  if (!atendimentoSource.includes(required)) fail(atendimentoPath, `controle operacional manual incompleto: ${required}`);
}
const manualOpenApiSource = await readFile(manualOpenApiPath, "utf8");
if (!manualOpenApiSource.includes("set_my_store_manual_open")) {
  fail(manualOpenApiPath, "cliente do controle manual não chama o RPC autorizado");
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
