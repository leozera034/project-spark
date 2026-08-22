import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const checks = [
  {
    path: "src/routes/loja/$slug/index.tsx",
    markers: [
      "<OrderingContextBar",
      "<CartBar",
      "<ProductConfigurator",
      'aria-label="Buscar no cardápio"',
    ],
    reason: "vitrine pública precisa preservar contexto, busca, configuração do item e acesso ao carrinho",
  },
  {
    path: "src/components/storefront/ProductConfigurator.tsx",
    markers: [
      "/preco",
      "price?.ok",
      "pendingGroups",
      "size-11",
      "Adicionar ao carrinho",
    ],
    reason: "configurador precisa validar escolhas, cotar no servidor e manter controles móveis adequados",
  },
  {
    path: "src/components/storefront/CartBar.tsx",
    markers: [
      "minimumOrderMet",
      "hasBlockingIssues",
      'to="/loja/$slug/carrinho"',
    ],
    reason: "barra do carrinho precisa antecipar bloqueios e levar à revisão",
  },
  {
    path: "src/routes/loja/$slug/carrinho.tsx",
    markers: [
      "cart.revalidate",
      "cart.canCheckout",
      'to: "/loja/$slug/checkout"',
      "priceChanges",
    ],
    reason: "carrinho precisa recotizar, sinalizar mudanças e bloquear checkout inválido",
  },
  {
    path: "src/routes/loja/$slug/checkout.tsx",
    markers: [
      "postOrder",
      "currentIdempotencyKey",
      "saveReceipt",
      "cart.canCheckout",
    ],
    reason: "checkout precisa permanecer autoritativo, idempotente e rastreável",
  },
  {
    path: "src/routes/loja/$slug/pedido-enviado.tsx",
    markers: [
      "trackingToken",
      "Acompanhar pedido",
      "readReceipt",
    ],
    reason: "confirmação deve entregar acompanhamento sem depender de conta",
  },
  {
    path: "src/routes/loja/$slug/acompanhar.tsx",
    markers: [
      "window.location.hash",
      "replaceState",
      "useOrderTracking",
      '"Cache-Control": "no-store"',
    ],
    reason: "rastreamento deve manter o segredo fora da URL persistente e nunca ser cacheado",
  },
];

const violations = [];
for (const check of checks) {
  const absolute = join(root, check.path);
  const source = await readFile(absolute, "utf8");
  for (const marker of check.markers) {
    if (!source.includes(marker)) {
      violations.push(`${relative(root, absolute)}: faltando ${JSON.stringify(marker)} — ${check.reason}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Storefront UX guard falhou:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Storefront UX guard passed (${checks.length} superfícies críticas verificadas).`);
