import { Link, createFileRoute } from "@tanstack/react-router";

import type { StorefrontThemeProfile } from "@/storefront/default-banners";

export const Route = createFileRoute("/preview/wizard/")({
  head: () => ({
    meta: [
      { title: "Preview dos temas do Wizard | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WizardPreviewIndex,
});

const THEMES: Array<{ code: StorefrontThemeProfile; name: string; description: string }> = [
  { code: "pizzaria", name: "Pizzaria", description: "Vermelho/tomate com detalhes quentes." },
  { code: "hamburgueria", name: "Hamburgueria", description: "Marrom/âmbar com visual mais robusto." },
  { code: "acai", name: "Açaí", description: "Roxo açaí com contraste suave." },
  { code: "sorveteria", name: "Sorveteria", description: "Rosa e dourado sobre fundo claro." },
  { code: "restaurante", name: "Restaurante", description: "Vinho e dourado, mais premium." },
  { code: "lanchonete", name: "Lanchonete", description: "Tons quentes e convidativos." },
  { code: "pastelaria", name: "Pastelaria", description: "Dourado/laranja inspirado em frituras." },
  { code: "adega", name: "Adega", description: "Vinho profundo com champagne/dourado." },
  { code: "mercado", name: "Mercado", description: "Verde e dourado, sensação de frescor." },
  { code: "outros", name: "Outros / Neutro", description: "Fallback visual para qualquer outro negócio." },
];

function WizardPreviewIndex() {
  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6 md:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p className="text-sm font-extrabold uppercase tracking-[.14em] text-brand">Comandiva · área de teste</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Mockups isolados do wizard</h1>
          <p className="mt-3 text-muted-foreground">
            Abra cada tema em uma página separada. As páginas usam os mesmos fundos, logos e cores temáticas configurados para o cliente, mas não dependem de loja, pedido ou cadastro real.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((theme) => (
            <Link
              key={theme.code}
              to="/preview/wizard/$theme"
              params={{ theme: theme.code }}
              className="rounded-3xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
            >
              <p className="text-lg font-black">{theme.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{theme.description}</p>
              <p className="mt-4 text-sm font-extrabold text-brand">Abrir mockup →</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
