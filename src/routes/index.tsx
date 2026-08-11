/**
 * Home pública do Pediu Aqui.
 * Conteúdo comercial sem métricas, clientes ou depoimentos fictícios.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Beer,
  Bike,
  Check,
  ChefHat,
  ChevronRight,
  ClipboardList,
  Clock3,
  Coffee,
  CreditCard,
  Headphones,
  LayoutDashboard,
  MapPin,
  Menu,
  PackageCheck,
  Pizza,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Store,
  UtensilsCrossed,
  X,
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => ({ origin: await getSiteOrigin() }),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "";
    const ogImage = absoluteUrl(origin, OG_IMAGE_PATH);
    const canonical = absoluteUrl(origin, "/");
    return {
      meta: [
        { title: "Pediu Aqui — cardápio digital, pedidos, cozinha e entrega própria" },
        {
          name: "description",
          content:
            "Organize cardápio, pedidos, cozinha, entregadores e acompanhamento do cliente em uma só plataforma para a operação da sua loja.",
        },
        { property: "og:title", content: "Pediu Aqui — seu negócio, mais organizado" },
        {
          property: "og:description",
          content:
            "Cardápio digital, pedidos, cozinha, entrega própria e gestão em uma experiência única.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Pediu Aqui — cardápio digital e operação de pedidos" },
        {
          name: "twitter:description",
          content: "Venda pelo seu cardápio e organize a operação da loja do pedido à entrega.",
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
                operatingSystem: "Web",
              },
            ],
          }),
        },
      ],
    };
  },
});

const features = [
  {
    icon: Smartphone,
    title: "Cardápio digital",
    text: "Produtos, categorias, variações e adicionais em uma experiência feita para celular.",
  },
  {
    icon: ClipboardList,
    title: "Pedidos organizados",
    text: "A operação recebe, acompanha e move cada pedido com estados claros e ações seguras.",
  },
  {
    icon: ChefHat,
    title: "Modo cozinha",
    text: "Uma tela operacional para produção, com prioridade visual e ações grandes para tablet.",
  },
  {
    icon: Bike,
    title: "Entrega própria",
    text: "Atribua entregas à sua equipe e acompanhe o fluxo sem misturar dados entre lojas.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    text: "Consulte o que realmente aconteceu na operação usando dados do próprio sistema.",
  },
  {
    icon: LayoutDashboard,
    title: "Gestão centralizada",
    text: "Configurações, equipe, atendimento, pagamentos e operação em um único ambiente.",
  },
];

const workflow = [
  { icon: ShoppingBasket, label: "Cliente escolhe", text: "Cardápio rápido e responsivo" },
  { icon: ClipboardList, label: "Pedido entra", text: "Fila operacional organizada" },
  { icon: ChefHat, label: "Cozinha prepara", text: "Status e tempo visíveis" },
  { icon: Bike, label: "Equipe entrega", text: "Atribuição e acompanhamento" },
  { icon: PackageCheck, label: "Cliente acompanha", text: "Rastreio sem criar conta" },
];

const segments = [
  { icon: UtensilsCrossed, title: "Restaurantes", text: "Cardápio completo, cozinha e entrega." },
  { icon: Coffee, title: "Lanchonetes", text: "Pedido rápido e adicionais bem organizados." },
  { icon: Pizza, title: "Pizzarias", text: "Variações e composição de produtos complexos." },
  { icon: Beer, title: "Bares", text: "Operação simples para itens, combos e entrega." },
  { icon: Store, title: "Comércio local", text: "Catálogo, atendimento e operação própria." },
];

const plans = [
  {
    name: "Essencial",
    price: "R$ 99",
    description: "Para colocar a loja online e organizar o pedido do cliente até a cozinha.",
    highlight: false,
    features: [
      "Cardápio digital",
      "Painel de pedidos",
      "Modo cozinha",
      "Acompanhamento do pedido",
    ],
  },
  {
    name: "Operação",
    price: "R$ 179",
    description: "Para quem também organiza equipe própria e fluxo de entregas.",
    highlight: true,
    features: [
      "Tudo do Essencial",
      "Papéis para equipe",
      "Entregadores próprios",
      "Relatórios operacionais",
    ],
  },
  {
    name: "Rede",
    price: "R$ 299",
    description: "Para operações que precisam administrar mais de uma unidade com isolamento de dados.",
    highlight: false,
    features: [
      "Tudo do Operação",
      "Múltiplas lojas",
      "Gestão centralizada",
      "Suporte prioritário",
    ],
  },
];

const faqs = [
  {
    q: "O cliente precisa baixar aplicativo?",
    a: "Não. O cardápio público funciona pela web e foi pensado para uso direto no celular.",
  },
  {
    q: "A entrega é feita por entregadores do Pediu Aqui?",
    a: "Não. O fluxo atual é para a própria loja organizar e operar sua equipe de entregadores.",
  },
  {
    q: "Consigo separar a tela da cozinha do restante do painel?",
    a: "Sim. O sistema possui um modo específico de cozinha, com foco na produção e sem expor informações desnecessárias para esse ambiente.",
  },
  {
    q: "O cliente consegue acompanhar o pedido?",
    a: "Sim. Depois do envio, o pedido pode ser acompanhado por um link seguro de rastreio sem exigir conta ou senha do cliente.",
  },
  {
    q: "Posso configurar horários, bairros e formas de pagamento?",
    a: "Sim. A loja possui áreas de configuração para atendimento, horários, regiões atendidas e formas de pagamento suportadas pela operação.",
  },
];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[670px] select-none" aria-label="Prévia da interface do Pediu Aqui">
      <div className="absolute -inset-8 rounded-[3rem] bg-brand/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.8rem] border border-white/12 bg-[#11191c]/95 p-2 shadow-[0_40px_120px_-42px_rgba(0,0,0,0.9)] ring-1 ring-white/5">
        <div className="rounded-[1.35rem] border border-white/8 bg-[#0d1417] p-3 sm:p-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <BrandSymbol className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Painel da loja</p>
                <p className="text-[9px] text-white/35">Operação em tempo real</p>
              </div>
            </div>
            <span className="rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[9px] font-semibold text-brand">
              Operação ativa
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.78fr]">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {["Novos", "Em preparo", "Prontos"].map((label, index) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                    <p className="text-[8px] uppercase tracking-wider text-white/35">{label}</p>
                    <div className="mt-2 flex items-end gap-1">
                      <div className={cn("h-2 rounded-full", index === 0 ? "w-9 bg-brand" : "w-6 bg-white/16")} />
                      <div className="h-2 w-3 rounded-full bg-white/8" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-white">Fluxo de pedidos</p>
                  <p className="text-[8px] text-white/30">Hoje</p>
                </div>
                <div className="mt-5 flex h-28 items-end gap-1.5">
                  {[20, 36, 28, 54, 43, 67, 56, 76, 61, 82, 72, 88].map((height, index) => (
                    <div key={index} className="flex-1 rounded-t-sm bg-brand/20" style={{ height: `${height}%` }}>
                      <div className="h-full rounded-t-sm bg-gradient-to-t from-brand/20 to-brand/75" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-white">Pedidos recentes</p>
                <span className="size-1.5 rounded-full bg-brand shadow-[0_0_12px_var(--color-brand)]" />
              </div>
              <div className="mt-3 space-y-2">
                {[
                  ["Pedido recebido", "Aguardando aceite", "Novo"],
                  ["Pedido confirmado", "Enviado à cozinha", "Produção"],
                  ["Pedido pronto", "Aguardando entrega", "Pronto"],
                ].map(([title, text, status]) => (
                  <div key={title} className="rounded-lg border border-white/7 bg-white/[0.03] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-semibold text-white/85">{title}</p>
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[7px] font-semibold text-brand">{status}</span>
                    </div>
                    <p className="mt-1 text-[8px] text-white/30">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-10 -left-3 w-[145px] rounded-[2rem] border border-white/12 bg-[#0a1113] p-2 shadow-2xl sm:-left-10 sm:w-[180px]">
        <div className="rounded-[1.55rem] border border-white/8 bg-[#f7f4ef] p-2 text-[#101719]">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-[#101719]/15" />
          <div className="rounded-xl bg-[#101719] p-2.5 text-white">
            <p className="text-[7px] text-white/50">Cardápio digital</p>
            <p className="mt-0.5 text-[9px] font-semibold">Sua loja, sua marca</p>
          </div>
          <div className="mt-2 space-y-1.5">
            {["Destaques", "Mais pedidos", "Bebidas"].map((item, index) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-black/6 bg-white p-2">
                <div className={cn("size-7 rounded-md", index === 0 ? "bg-brand/20" : "bg-black/5")} />
                <div className="min-w-0 flex-1">
                  <div className="h-1.5 w-3/4 rounded-full bg-black/15" />
                  <div className="mt-1 h-1 w-1/2 rounded-full bg-black/7" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function openStore(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeStoreSlug(slug);
    if (!normalized) return;
    void navigate({ to: "/loja/$slug", params: { slug: normalized } });
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#081013]/82 text-white backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
          <Link to="/" className="inline-flex shrink-0" aria-label="Pediu Aqui">
            <BrandLogo className="h-7 w-auto sm:h-8" />
          </Link>

          <nav className="hidden items-center gap-7 text-xs font-semibold text-white/55 lg:flex" aria-label="Navegação principal">
            <a href="#recursos" className="transition-colors hover:text-brand">Recursos</a>
            <a href="#como-funciona" className="transition-colors hover:text-brand">Como funciona</a>
            <a href="#segmentos" className="transition-colors hover:text-brand">Para lojas</a>
            <a href="#planos" className="transition-colors hover:text-brand">Planos</a>
            <a href="#faq" className="transition-colors hover:text-brand">Dúvidas</a>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><ThemeToggle /></div>
            <Button asChild variant="ghost" size="sm" className="hidden text-white/70 hover:bg-white/8 hover:text-white md:inline-flex">
              <Link to="/entrar/loja">Entrar</Link>
            </Button>
            <Button asChild variant="brand" size="sm" className="hidden sm:inline-flex">
              <Link to="/criar-loja">Começar agora</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/8 hover:text-white lg:hidden"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-white/8 bg-[#081013]/96 px-4 pb-5 pt-3 backdrop-blur-2xl lg:hidden">
            <nav className="mx-auto grid max-w-7xl gap-1 text-sm font-semibold text-white/70">
              {[
                ["Recursos", "#recursos"],
                ["Como funciona", "#como-funciona"],
                ["Para lojas", "#segmentos"],
                ["Planos", "#planos"],
                ["Dúvidas", "#faq"],
              ].map(([label, href]) => (
                <a key={href} href={href} className="rounded-xl px-3 py-3 hover:bg-white/6 hover:text-white" onClick={() => setMenuOpen(false)}>
                  {label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="border-white/15 bg-white/[0.03] text-white hover:bg-white/8 hover:text-white">
                  <Link to="/entrar/loja">Entrar</Link>
                </Button>
                <Button asChild variant="brand"><Link to="/criar-loja">Criar loja</Link></Button>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="conteudo">
        <section className="relative overflow-hidden bg-[#081013] pb-24 pt-28 text-white sm:pb-32 sm:pt-36 lg:min-h-[760px] lg:pb-28 lg:pt-40">
          <img src={heroImage} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover opacity-[0.16]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#081013_0%,rgba(8,16,19,0.92)_46%,rgba(8,16,19,0.55)_100%)]" />
          <div className="absolute left-[18%] top-24 size-[28rem] rounded-full bg-brand/10 blur-[120px]" />
          <div className="absolute right-[-8rem] top-10 size-[32rem] rounded-full bg-brand/8 blur-[140px]" />
          <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:48px_48px]" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div className="max-w-2xl">
              <Reveal as="span" className="inline-flex">
                <Badge className="border border-brand/20 bg-brand/10 text-brand hover:bg-brand/10">
                  <Sparkles className="mr-1.5 size-3.5" />
                  Plataforma para operação própria da loja
                </Badge>
              </Reveal>
              <Reveal as="h1" delay={70} className="mt-6 text-[clamp(2.7rem,8vw,5.6rem)] font-bold leading-[0.96] tracking-[-0.045em]">
                Seu negócio,
                <br />
                mais pedidos,
                <br />
                <span className="text-brand">mais resultados.</span>
              </Reveal>
              <Reveal as="p" delay={140} className="mt-7 max-w-xl text-base leading-7 text-white/62 sm:text-lg sm:leading-8">
                Cardápio digital, pedidos organizados, cozinha, entregadores e acompanhamento do
                cliente em uma experiência única para a sua operação.
              </Reveal>

              <Reveal delay={210} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild variant="brand" size="touch" className="w-full sm:w-auto">
                  <Link to="/criar-loja">
                    Criar minha loja
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="touch" className="w-full border-white/15 bg-white/[0.03] text-white hover:border-white/25 hover:bg-white/8 hover:text-white sm:w-auto">
                  <a href="#como-funciona">Ver como funciona</a>
                </Button>
              </Reveal>

              <Reveal delay={280} className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
                <span className="inline-flex items-center gap-2"><Check className="size-3.5 text-brand" /> Uso direto no navegador</span>
                <span className="inline-flex items-center gap-2"><Check className="size-3.5 text-brand" /> Equipe própria da loja</span>
                <span className="inline-flex items-center gap-2"><Check className="size-3.5 text-brand" /> Multi-loja isolado</span>
              </Reveal>
            </div>

            <Reveal delay={180} className="relative pb-8 pt-6 sm:px-8 lg:px-0">
              <ProductPreview />
            </Reveal>
          </div>
        </section>

        <section className="border-b border-border bg-background">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 text-xs text-muted-foreground sm:grid-cols-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3"><ShieldCheck className="size-4 text-brand" /><span>Autorização e isolamento por loja</span></div>
            <div className="flex items-center gap-3"><Clock3 className="size-4 text-brand" /><span>Fluxos operacionais com estados claros</span></div>
            <div className="flex items-center gap-3"><Headphones className="size-4 text-brand" /><span>Gestão centralizada da operação</span></div>
          </div>
        </section>

        <section id="recursos" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Tudo em um só fluxo</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Uma plataforma inteira, do cardápio à porta do cliente</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Cada ambiente existe para uma função específica da operação, sem transformar o painel em uma coleção de telas desconectadas.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Reveal key={feature.title} as="article" delay={index * 55} className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-e1 transition-all hover:-translate-y-1 hover:border-brand/25 hover:shadow-e2 sm:p-7">
                <div className="absolute right-0 top-0 size-28 rounded-full bg-brand/0 blur-2xl transition-colors group-hover:bg-brand/8" />
                <span className="relative inline-flex size-11 items-center justify-center rounded-xl border border-brand/12 bg-brand-soft text-brand-soft-foreground">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="relative mt-5 text-lg font-bold">{feature.title}</h3>
                <p className="relative mt-2 text-sm leading-6 text-muted-foreground">{feature.text}</p>
                <span className="relative mt-5 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                  Integrado ao fluxo <ChevronRight className="size-3.5" />
                </span>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="overflow-hidden bg-carbon text-carbon-foreground">
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
            <div className="absolute -right-20 top-10 size-80 rounded-full bg-brand/8 blur-3xl" />
            <div className="relative grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Operação ponta a ponta</p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Um pedido. Um fluxo. Uma equipe alinhada.</h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-carbon-foreground/55">
                  O sistema conecta a experiência do cliente à rotina da loja, sem depender de planilhas, mensagens paralelas ou telas sem contexto.
                </p>
                <Button asChild variant="brand" className="mt-8"><Link to="/criar-loja">Conhecer o produto <ArrowRight className="size-4" /></Link></Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-5 lg:gap-2">
                {workflow.map((step, index) => (
                  <Reveal key={step.label} delay={index * 70} className="relative rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-3 lg:min-h-48 lg:p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-brand/12 text-brand"><step.icon className="size-4" /></span>
                      <span className="text-[10px] font-bold text-white/20">0{index + 1}</span>
                    </div>
                    <h3 className="mt-5 text-sm font-bold text-white">{step.label}</h3>
                    <p className="mt-2 text-xs leading-5 text-white/42">{step.text}</p>
                    {index < workflow.length - 1 ? <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-brand/50 sm:block" /> : null}
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="segmentos" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Para o comércio local</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Estrutura flexível para diferentes operações</h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
                O núcleo do produto atende operações que precisam vender por catálogo, organizar produção e controlar a própria entrega.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {segments.map((segment) => (
                <article key={segment.title} className="hover-lift rounded-2xl border border-border bg-surface p-5 shadow-e1">
                  <segment.icon className="size-5 text-brand" />
                  <h3 className="mt-4 font-bold">{segment.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{segment.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface-muted/55">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
            <div className="rounded-[2rem] bg-carbon p-6 text-carbon-foreground shadow-e3 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <CreditCard className="size-5 text-brand" />
                  <h3 className="mt-4 font-bold">Controle da operação</h3>
                  <p className="mt-2 text-sm leading-6 text-white/48">Configurações, pagamentos e atendimento ficam organizados no ambiente da loja.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <MapPin className="size-5 text-brand" />
                  <h3 className="mt-4 font-bold">Atendimento configurável</h3>
                  <p className="mt-2 text-sm leading-6 text-white/48">Horários, bairros atendidos e regras de entrega fazem parte da configuração operacional.</p>
                </div>
              </div>
              <form onSubmit={openStore} className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <label htmlFor="slug-loja" className="text-sm font-bold text-white">Já conhece uma loja?</label>
                <p className="mt-1 text-xs text-white/40">Abra o cardápio pelo endereço público dela.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Input id="slug-loja" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="nome-da-loja" autoComplete="off" inputMode="url" className="border-white/12 bg-black/20 text-white placeholder:text-white/25" />
                  <Button type="submit" variant="brand" disabled={!normalizeStoreSlug(slug)} className="shrink-0"><Search className="size-4" /> Abrir cardápio</Button>
                </div>
              </form>
            </div>

            <div className="flex flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Pronto para operar</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Menos improviso. Mais clareza no dia a dia.</h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                O Pediu Aqui foi estruturado para concentrar as etapas que normalmente ficam espalhadas entre papel, mensagens e telas diferentes.
              </p>
              <div className="mt-7 space-y-3 text-sm">
                {["Fluxo operacional por status", "Ambientes separados por função", "Experiência mobile-first para cliente e entregador", "Gestão e auditoria no painel administrativo"].map((item) => (
                  <div key={item} className="flex items-center gap-3"><span className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-brand-soft-foreground"><Check className="size-3.5" /></span><span>{item}</span></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Planos</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Escolha a estrutura da sua operação</h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">Planos por loja, com recursos crescentes conforme a complexidade da operação.</p>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className={cn("relative rounded-[1.75rem] border p-6 shadow-e1 sm:p-7", plan.highlight ? "border-brand/40 bg-carbon text-carbon-foreground shadow-e3" : "border-border bg-surface")}>
                {plan.highlight ? <span className="absolute right-5 top-5 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold text-brand-foreground">Mais completo</span> : null}
                <p className={cn("text-xs font-bold uppercase tracking-[0.15em]", plan.highlight ? "text-brand" : "text-muted-foreground")}>{plan.name}</p>
                <div className="mt-5 flex items-end gap-1.5"><span className="text-4xl font-bold tracking-tight">{plan.price}</span><span className={cn("pb-1 text-xs", plan.highlight ? "text-white/40" : "text-muted-foreground")}>/mês</span></div>
                <p className={cn("mt-4 min-h-16 text-sm leading-6", plan.highlight ? "text-white/48" : "text-muted-foreground")}>{plan.description}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand" /><span>{feature}</span></li>)}
                </ul>
                <Button asChild variant={plan.highlight ? "brand" : "outline"} className="mt-8 w-full"><Link to="/criar-loja">Criar minha loja</Link></Button>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="border-t border-border bg-surface-muted/45">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Dúvidas frequentes</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">O essencial antes de começar</h2>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">Respostas diretas sobre como a operação funciona hoje.</p>
            </div>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <details key={faq.q} className="group rounded-2xl border border-border bg-background p-5 shadow-e1 open:border-brand/20">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold marker:hidden">
                    {faq.q}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform group-open:rotate-90"><ChevronRight className="size-4" /></span>
                  </summary>
                  <p className="mt-4 pr-8 text-sm leading-6 text-muted-foreground">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-carbon text-carbon-foreground">
          <div className="relative mx-auto max-w-7xl overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
            <div className="absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/8 blur-3xl" />
            <div className="relative mx-auto max-w-3xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Pediu Aqui</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Sua operação pode ser mais simples de acompanhar.</h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/50">Crie a estrutura da sua loja e centralize o fluxo do pedido em uma experiência feita para a rotina real da equipe.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild variant="brand" size="touch"><Link to="/criar-loja">Começar agora <ArrowRight className="size-4" /></Link></Button>
                <Button asChild variant="outline" size="touch" className="border-white/15 bg-white/[0.03] text-white hover:bg-white/8 hover:text-white"><Link to="/entrar/loja">Já tenho acesso</Link></Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 bg-[#060c0e] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
            <div className="max-w-sm">
              <BrandLogo className="h-8 w-auto" />
              <p className="mt-4 text-sm leading-6 text-white/38">Cardápio, pedidos, cozinha, entrega própria e gestão em uma experiência única.</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/35">Produto</p>
              <div className="mt-4 space-y-3 text-sm text-white/55"><a href="#recursos" className="block hover:text-brand">Recursos</a><a href="#como-funciona" className="block hover:text-brand">Como funciona</a><a href="#planos" className="block hover:text-brand">Planos</a></div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/35">Acessos</p>
              <div className="mt-4 space-y-3 text-sm text-white/55"><Link to="/entrar/loja" className="block hover:text-brand">Equipe da loja</Link><Link to="/entrar/entregador" className="block hover:text-brand">Entregador</Link><Link to="/criar-loja" className="block hover:text-brand">Criar loja</Link></div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/35">Ajuda</p>
              <div className="mt-4 space-y-3 text-sm text-white/55"><a href="#faq" className="block hover:text-brand">Dúvidas frequentes</a><Link to="/recuperar-acesso" className="block hover:text-brand">Recuperar acesso</Link></div>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-white/8 pt-6 text-xs text-white/25 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Pediu Aqui.</p>
            <p>Feito para a operação própria do comércio local.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
