import { createFileRoute, Link } from "@tanstack/react-router";

import { BrandLogo, BrandSymbol } from "@/components/brand/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Pediu Aqui — cardápio digital e pedidos para o comércio local" },
      {
        name: "description",
        content:
          "Pediu Aqui é a plataforma de cardápio digital, pedidos e entregas para o comércio local. Cada loja com seu próprio espaço, seus produtos e seus entregadores.",
      },
      { property: "og:title", content: "Pediu Aqui — cardápio digital e pedidos" },
      {
        property: "og:description",
        content:
          "Cardápio digital, pedidos e entregas para o comércio local, com isolamento total por loja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const pillars = [
  {
    title: "Cardápio digital próprio",
    text: "Cada loja tem seu endereço, seus produtos, suas variações e suas regras de entrega.",
  },
  {
    title: "Pedido sem cadastro",
    text: "O cliente informa apenas o primeiro nome e o telefone. Sem senha, sem e-mail, sem atrito.",
  },
  {
    title: "Entrega da propria loja",
    text: "Os entregadores pertencem à loja e enxergam somente as entregas dela.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <BrandLogo className="h-7 sm:h-8" />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/design-system">Design system</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <section className="bg-carbon text-carbon-foreground">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
            <Badge variant="brand">Fase 02 · identidade visual</Badge>
            <h1 className="mt-6 max-w-3xl text-[clamp(2rem,7vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight">
              O pedido do bairro, organizado de ponta a ponta.
            </h1>
            <p className="mt-6 max-w-2xl text-base opacity-80 sm:text-lg">
              Pediu Aqui é a plataforma de cardápio digital, pedidos e entregas do comércio local.
              Cada loja opera isolada, com seus produtos, seus clientes e seus entregadores.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
              <Button asChild variant="brand" size="touch" className="w-full sm:w-auto">
                <Link to="/design-system">Ver o design system</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-xl border border-border bg-surface p-6 shadow-e1"
              >
                <BrandSymbol tone="teal" className="size-8" />
                <h2 className="mt-5 text-lg font-semibold">{pillar.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{pillar.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
          <BrandLogo tone="monochrome" className="h-6 opacity-70" />
          <p className="text-xs text-muted-foreground">Pediu Aqui · plataforma para o comércio local</p>
        </div>
      </footer>
    </div>
  );
}
