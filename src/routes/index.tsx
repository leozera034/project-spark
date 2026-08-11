import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Bike,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import { ProductMock } from "@/components/marketing/ProductMock";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Reveal } from "@/components/motion/Reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const description =
  "Cardápio digital, pedidos, cozinha, entregas e gestão em uma plataforma feita para o comércio local.";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Pediu Aqui — seu negócio, mais pedidos, mais resultados" },
      { name: "description", content: description },
      { property: "og:title", content: "Pediu Aqui — seu negócio, mais pedidos, mais resultados" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/brand/og-image-1200x630.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
  }),
});

const features = [
  {
    icon: Smartphone,
    title: "Cardápio digital",
    text: "Catálogo rápido, organizado e preparado para vender bem no celular.",
  },
  {
    icon: ClipboardList,
    title: "Pedidos organizados",
    text: "A operação acompanha cada pedido em um fluxo único, sem depender de conversa solta.",
  },
  {
    icon: ChefHat,
    title: "Cozinha operacional",
    text: "Fila de produção objetiva, com prioridade visual e ações rápidas para a equipe.",
  },
  {
    icon: Bike,
    title: "Entregas da própria loja",
    text: "Cadastre seus entregadores, distribua entregas e acompanhe cada etapa.",
  },
  {
    icon: LayoutDashboard,
    title: "Gestão centralizada",
    text: "Painel, relatórios e operação conectados para reduzir improviso no dia a dia.",
  },
  {
    icon: ShieldCheck,
    title: "Base segura",
    text: "Papéis, permissões e isolamento entre lojas fazem parte da arquitetura do produto.",
  },
] as const;

const steps = [
  ["01", "Crie sua loja", "Cadastre a operação e configure os dados principais."],
  ["02", "Monte o cardápio", "Organize produtos, categorias, preços e adicionais."],
  ["03", "Receba pedidos", "O cliente compra pelo celular e a equipe recebe tudo organizado."],
  ["04", "Opere e acompanhe", "Cozinha, entrega e gestão trabalham no mesmo fluxo."],
] as const;

function Home() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />

      <main id="conteudo">
        <section className="relative isolate overflow-hidden bg-carbon text-carbon-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 -top-40 size-[38rem] rounded-full bg-brand/20 blur-[130px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-56 right-[-12rem] size-[38rem] rounded-full bg-brand/10 blur-[140px]"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.02fr_.98fr] lg:gap-16 lg:py-28">
            <div>
              <Reveal as="span" className="inline-block">
                <Badge variant="brand">Plataforma para comércio local</Badge>
              </Reveal>

              <Reveal
                as="h1"
                delay={70}
                className="mt-6 max-w-3xl text-balance font-display text-[clamp(2.7rem,7vw,5.4rem)] font-extrabold leading-[.98] tracking-tight"
              >
                Seu negócio, mais pedidos, <span className="text-brand">mais resultado.</span>
              </Reveal>

              <Reveal
                as="p"
                delay={130}
                className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-carbon-foreground/70 sm:text-lg"
              >
                Cardápio digital, pedidos, cozinha, entregas e gestão em uma experiência única.
                Menos improviso na operação e mais clareza para vender.
              </Reveal>

              <Reveal delay={190} className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="brand" size="touch" className="w-full sm:w-auto">
                  <Link to="/criar-loja">
                    Criar minha loja <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="touch"
                  className="w-full border-carbon-foreground/20 bg-transparent text-carbon-foreground hover:bg-carbon-foreground/10 hover:text-carbon-foreground sm:w-auto"
                >
                  <a href="#recursos">Conhecer a plataforma</a>
                </Button>
              </Reveal>

              <Reveal delay={250} className="mt-9 grid gap-3 sm:grid-cols-3">
                {[
                  [BadgeCheck, "Configuração guiada"],
                  [Store, "Operação da sua loja"],
                  [ShieldCheck, "Arquitetura segura"],
                ].map(([Icon, label]) => (
                  <div
                    key={String(label)}
                    className="flex items-center gap-2 rounded-xl border border-carbon-foreground/10 bg-carbon-foreground/[.035] px-3 py-3 text-xs font-semibold text-carbon-foreground/70"
                  >
                    <Icon className="size-4 text-brand" /> {label}
                  </div>
                ))}
              </Reveal>
            </div>

            <Reveal delay={150} className="mx-auto w-full max-w-lg">
              <ProductMock />
            </Reveal>
          </div>
        </section>

        <section id="recursos" className="bg-background py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Tudo em um só fluxo</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-5xl">
                Uma plataforma inteira para gerenciar seu negócio
              </h2>
              <p className="mt-4 text-muted-foreground">
                Do primeiro clique do cliente à entrega concluída, cada área conversa com a próxima.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature, index) => (
                <Reveal
                  as="article"
                  key={feature.title}
                  delay={index * 50}
                  className="rounded-2xl border border-border bg-card p-6 shadow-e1 transition hover:-translate-y-0.5 hover:shadow-e2"
                >
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
                    <feature.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-carbon py-20 text-carbon-foreground sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Como funciona</p>
              <h2 className="mt-4 max-w-2xl text-balance font-display text-3xl font-bold sm:text-4xl">
                Uma operação conectada do cardápio à entrega
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {steps.map(([number, title, text], index) => (
                <Reveal
                  key={number}
                  delay={index * 60}
                  className="rounded-2xl border border-carbon-foreground/10 bg-carbon-foreground/[.035] p-5"
                >
                  <span className="text-sm font-bold text-brand">{number}</span>
                  <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-carbon-foreground/60">{text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface-muted py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_.9fr] lg:items-center">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Pensado para operar</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-bold sm:text-5xl">
                Mais software de operação. Menos remendo no dia a dia.
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
                O Pediu Aqui conecta quem vende, quem prepara, quem entrega e quem administra sem
                transformar cada etapa em uma ferramenta diferente.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {[ShoppingBag, UtensilsCrossed, Bike, CreditCard].map((Icon, index) => (
                  <span key={index} className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card text-brand shadow-e1">
                    <Icon className="size-5" />
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={100} className="rounded-3xl border border-border bg-card p-7 shadow-e2">
              <p className="text-sm font-semibold text-brand">Pronto para começar</p>
              <h3 className="mt-3 font-display text-2xl font-bold">Crie sua loja e monte sua operação.</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Comece pela estrutura principal e evolua o cardápio, a equipe e as entregas conforme sua rotina.
              </p>
              <Button asChild variant="brand" size="touch" className="mt-7 w-full sm:w-auto">
                <Link to="/criar-loja">Começar agora <ArrowRight className="size-4" /></Link>
              </Button>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
