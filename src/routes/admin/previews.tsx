import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Eye, MonitorSmartphone, Store } from "lucide-react";

export const Route = createFileRoute("/admin/previews")({
  component: AdminPreviewsPage,
});

const PREVIEWS = [
  {
    title: "Wizard do cliente",
    description: "Confira fundo, logo, contraste, formulário e responsividade de todos os temas antes de chegar ao cliente.",
    href: "/preview/wizard/",
    icon: MonitorSmartphone,
  },
  {
    title: "Cardápio da loja",
    description: "Confira banner, identidade padrão, categorias, cards de produto e paleta dos modelos predefinidos.",
    href: "/preview/cardapio/",
    icon: Store,
  },
] as const;

function AdminPreviewsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-7">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.1em] text-muted-foreground">
          <Eye className="size-3.5" /> QA visual
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Previews permanentes</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Esta área é o ponto de controle visual do SaaS. Os previews usam os mesmos assets e regras de tema do produto, mas não alteram lojas reais nem criam pedidos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PREVIEWS.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-3xl border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-e2 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-extrabold">{item.title}</h2>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground transition group-hover:text-brand" />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  <p className="mt-4 text-sm font-bold text-brand">Abrir preview completo →</p>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <section className="mt-6 rounded-3xl border bg-muted/25 p-5 sm:p-6">
        <h2 className="font-extrabold">Regra de identidade visual das lojas</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A logo da loja é propriedade da identidade do lojista e nunca deve ser inventada pelo Comandiva. Quando não houver logo cadastrada, usamos somente um ícone neutro e padronizado da categoria. Assim que o lojista enviar a própria logo, o ícone padrão deixa de aparecer automaticamente.
        </p>
      </section>
    </main>
  );
}
