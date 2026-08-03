/**
 * Home pública do Pediu Aqui (produção).
 * Nenhum dado fictício: apenas conteúdo institucional + entradas reais do produto.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BellRing,
  Bike,
  ChefHat,
  ClipboardList,
  MapPin,
  Search,
  ShieldCheck,
  Smartphone,
  Store,
  Timer,
} from "lucide-react";

import heroImage from "@/assets/home-hero.jpg";
import { BrandLogo, BrandSymbol } from "@/components/brand/BrandLogo";
import { Reveal } from "@/components/motion/Reveal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeStoreSlug } from "@/store-config/slug";
import { OG_IMAGE_PATH, absoluteUrl, getSiteOrigin } from "@/lib/site.functions";

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => ({ origin: await getSiteOrigin() }),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "";
    const ogImage = absoluteUrl(origin, OG_IMAGE_PATH);
    const canonical = absoluteUrl(origin, "/");
    return {
      meta: [
        { title: "Pediu Aqui — cardápio digital, pedidos e entrega própria" },
        {
          name: "description",
          content:
            "Monte seu cardápio digital, receba pedidos organizados, acompanhe a cozinha e entregue com a sua própria equipe. Sem comissão sobre a sua clientela.",
        },
        { property: "og:title", content: "Pediu Aqui — venda no seu próprio cardápio digital" },
        {
          property: "og:description",
          content:
            "Cardápio digital, painel de pedidos, modo cozinha, app do entregador e rastreio do cliente em uma só plataforma.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Pediu Aqui — cardápio digital e pedidos" },
        {
          name: "twitter:description",
          content:
            "Receba pedidos no seu nome, organize a cozinha e entregue com a sua equipe. Mensalidade fixa, sem comissão.",
        },
        { name: "twitter:image", content: ogImage },
        { name: "robots", content: "index,follow" },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                name: "Pediu Aqui",
                url: canonical || "/",
                logo: "/brand/apple-touch-icon-180x180.png",
              },
              {
                "@type": "SoftwareApplication",
                name: "Pediu Aqui",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web, Android",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "BRL",
                  description: "Teste inicial sem custo, mensalidade fixa por loja.",
                },
              },
            ],
          }),
        },
      ],
    };
  },
});

const pillars = [
  {
    icon: Store,
    title: "Seu endereço, sua marca",
    text: "Cardápio digital com o nome da loja, suas cores, seus produtos e suas taxas. Nada de vitrine dividida com concorrente.",
  },
  {
    icon: Smartphone,
    title: "Pedido em poucos toques",
    text: "O cliente pede com primeiro nome e telefone. Sem app, sem senha, sem cadastro — menos desistência no caminho.",
  },
  {
    icon: ClipboardList,
    title: "Painel de pedidos de verdade",
    text: "Filas operacionais, aceite, recusa e transições seguras com controle de concorrência por versão.",
  },
  {
    icon: ChefHat,
    title: "Modo cozinha legível",
    text: "Projeção mínima, tempo decorrido e ações grandes. Sem dado financeiro e sem dado pessoal na tela da produção.",
  },
  {
    icon: Bike,
    title: "Entrega com equipe própria",
    text: "Seus entregadores, seu controle. Cada um enxerga apenas as entregas da sua loja, do aceite à porta do cliente.",
  },
  {
    icon: MapPin,
    title: "Rastreio para o cliente",
    text: "Link de acompanhamento com token seguro: o cliente vê o andamento sem precisar ligar para a loja.",
  },
];

const steps = [
  { title: "Configure a loja", text: "Dados, horários, bairros, taxas, pedido mínimo e formas de pagamento." },
  { title: "Monte o cardápio", text: "Categorias, produtos, variações, adicionais, pizza por sabores e venda por peso." },
  { title: "Receba e produza", text: "Pedido cai no painel, cozinha acompanha e o alerta sonoro avisa a equipe." },
  { title: "Entregue e acompanhe", text: "Atribua o entregador, acompanhe a rota e conte apenas entregas concluídas." },
];

const plans = [
  {
    name: "Essencial",
    price: "R$ 99",
    highlight: false,
    features: [
      "Cardápio digital com domínio próprio da loja",
      "Painel de pedidos e modo cozinha",
      "Rastreio do pedido para o cliente",
      "1 usuário administrador",
    ],
  },
  {
    name: "Operação",
    price: "R$ 179",
    highlight: true,
    features: [
      "Tudo do Essencial",
      "Equipe com papéis (gerente, atendente, cozinha)",
      "Entregadores próprios e atribuição manual",
      "Relatórios de entregas e contador derivado",
    ],
  },
  {
    name: "Rede",
    price: "R$ 299",
    highlight: false,
    features: [
      "Tudo do Operação",
      "Múltiplas lojas com isolamento total de dados",
      "Alertas operacionais e notificações avançadas",
      "Suporte prioritário assistido",
    ],
  },
];

function Home() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");

  function openStore(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeStoreSlug(slug);
    if (!normalized) return;
    void navigate({ to: "/loja/$slug", params: { slug: normalized } });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <BrandLogo className="h-7 sm:h-8" />
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#recursos" className="text-muted-foreground transition-colors hover:text-foreground">
              Recursos
            </a>
            <a href="#como-funciona" className="text-muted-foreground transition-colors hover:text-foreground">
              Como funciona
            </a>
            <a href="#planos" className="text-muted-foreground transition-colors hover:text-foreground">
              Planos
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/entrar/entregador">Sou entregador</Link>
            </Button>
            <Button asChild variant="brand" size="sm">
              <Link to="/criar-loja">Criar minha loja</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="conteudo">
        <section className="relative overflow-hidden bg-carbon text-carbon-foreground">
          <img
            src={heroImage}
            alt="Hambúrguer, pizza, açaí e suco prontos para entrega"
            width={1600}
            height={1104}
            className="absolute inset-0 size-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-carbon via-carbon/85 to-carbon/20" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <Reveal as="span" className="inline-block">
              <Badge variant="brand">Feito para o comércio de bairro</Badge>
            </Reveal>
            <Reveal
              as="h1"
              delay={80}
              className="mt-6 max-w-3xl text-[clamp(2.1rem,7vw,3.9rem)] font-extrabold leading-[1.03] tracking-tight"
            >
              Seu cardápio online, seus pedidos, seus clientes.
            </Reveal>
            <Reveal as="p" delay={150} className="mt-6 max-w-2xl text-base opacity-85 sm:text-lg">
              Chega de anotar pedido no papel e perder venda por mensagem sem resposta. Monte o
              cardápio, receba os pedidos organizados, acompanhe a cozinha e entregue com a sua
              própria equipe — com mensalidade fixa e sem comissão sobre a sua clientela.
            </Reveal>

            <Reveal delay={220} className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild variant="brand" size="touch" className="w-full sm:w-auto">
                <Link to="/criar-loja">
                  Quero minha loja online
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="touch" className="w-full border-carbon-foreground/40 bg-transparent text-carbon-foreground hover:bg-carbon-foreground/10 hover:text-carbon-foreground sm:w-auto">
                <a href="#planos">Ver planos e mensalidade</a>
              </Button>
            </Reveal>

            <Reveal delay={300} className="mt-12 max-w-xl">
              <form onSubmit={openStore} className="rounded-xl border border-border/40 bg-background/95 p-4 text-foreground shadow-e2">
                <label htmlFor="slug-loja" className="text-sm font-semibold">
                  Já conhece a loja? Abra o cardápio dela
                </label>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="slug-loja"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    placeholder="nome-da-loja"
                    autoComplete="off"
                    inputMode="url"
                  />
                  <Button type="submit" disabled={!normalizeStoreSlug(slug)} className="gap-2">
                    <Search className="size-4" />
                    Abrir cardápio
                  </Button>
                </div>
              </form>
            </Reveal>
          </div>
        </section>

        <section id="recursos" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Uma plataforma inteira, do cardápio até a porta do cliente
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Cada ambiente foi desenhado para quem usa: quem vende, quem produz, quem entrega e quem
            compra.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pillars.map((pillar, index) => (
              <Reveal
                as="article"
                key={pillar.title}
                delay={index * 70}
                className="hover-lift rounded-xl border border-border bg-surface p-6 shadow-e1"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
                  <pillar.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{pillar.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="border-y border-border bg-surface-muted">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Como funciona</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-4">
              {steps.map((step, index) => (
                <Reveal as="li" key={step.title} delay={index * 80} className="rounded-xl bg-background p-6 shadow-e1">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-carbon text-sm font-bold text-carbon-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
                </Reveal>
              ))}
            </ol>
            <div className="mt-10 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Timer className="size-4 text-brand" /> Tempo decorrido em cada pedido
              </span>
              <span className="inline-flex items-center gap-2">
                <BellRing className="size-4 text-brand" /> Alerta sonoro para pedido sem resposta
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand" /> Isolamento total entre lojas
              </span>
            </div>
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Mensalidade fixa, sem comissão</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Você paga pela plataforma, não por pedido. O faturamento da sua venda continua inteiro
            com você.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {plans.map((plan, index) => (
              <Reveal
                as="article"
                key={plan.name}
                delay={index * 90}
                className={
                  plan.highlight
                    ? "relative rounded-2xl border-2 border-brand bg-surface p-7 shadow-e2"
                    : "rounded-2xl border border-border bg-surface p-7 shadow-e1"
                }
              >
                {plan.highlight ? (
                  <Badge variant="brand" className="absolute -top-3 left-7">
                    Mais escolhido
                  </Badge>
                ) : null}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-3 text-3xl font-extrabold tracking-tight">
                  {plan.price}
                  <span className="text-sm font-medium text-muted-foreground"> /mês por loja</span>
                </p>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <BrandSymbol tone="teal" className="mt-0.5 size-4 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.highlight ? "brand" : "outline"}
                  size="touch"
                  className="mt-7 w-full"
                >
                  <Link to="/criar-loja">Começar com o {plan.name}</Link>
                </Button>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Valores de referência da plataforma. O plano contratado de cada loja é validado no
            servidor e aparece no painel administrativo.
          </p>
        </section>

        <section className="border-t border-border bg-carbon text-carbon-foreground">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Pronto para receber o próximo pedido no seu nome?
              </h2>
              <p className="mt-2 max-w-xl text-sm opacity-80">
                Entre com a conta da sua loja e configure tudo em minutos.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="brand" size="touch">
                <Link to="/entrar/loja">Entrar na minha loja</Link>
              </Button>
              <Button asChild variant="outline" size="touch" className="border-carbon-foreground/40 bg-transparent text-carbon-foreground hover:bg-carbon-foreground/10 hover:text-carbon-foreground">
                <Link to="/entrar/entregador">Acesso do entregador</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div>
            <BrandLogo className="h-6" />
            <p className="mt-3 text-xs text-muted-foreground">
              A plataforma de pedidos do comércio de bairro.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Acessos</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/entrar/loja" className="transition-colors hover:text-foreground">
                  Painel da loja
                </Link>
              </li>
              <li>
                <Link to="/entrar/entregador" className="transition-colors hover:text-foreground">
                  App do entregador
                </Link>
              </li>
              <li>
                <Link to="/entrar/admin" className="transition-colors hover:text-foreground">
                  Administração da plataforma
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Plataforma</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#recursos" className="transition-colors hover:text-foreground">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#planos" className="transition-colors hover:text-foreground">
                  Planos
                </a>
              </li>
              <li>
                <Link to="/recuperar-acesso" className="transition-colors hover:text-foreground">
                  Recuperar acesso
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Suporte</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/design-system" className="transition-colors hover:text-foreground">
                  Identidade e design system
                </Link>
              </li>
              <li>
                <Link to="/sem-acesso" className="transition-colors hover:text-foreground">
                  Problemas de acesso
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          Pediu Aqui · {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
