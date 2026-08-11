/**
 * Home pública do Pediu Aqui (produção).
 *
 * Regra de conteúdo: nada de métrica inventada, depoimento fictício ou
 * promessa não sustentada pelo produto. Os planos vêm da tabela real `plans`.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bike,
  Building2,
  ChefHat,
  ClipboardList,
  Coffee,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Pizza,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import { ProductMock } from "@/components/marketing/ProductMock";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Reveal } from "@/components/motion/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPublicPlans, type PublicPlan } from "@/lib/marketing.functions";
import { OG_IMAGE_PATH, absoluteUrl, getSiteOrigin } from "@/lib/site.functions";
import { normalizeStoreSlug } from "@/store-config/slug";

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => {
    const [origin, plans] = await Promise.all([getSiteOrigin(), listPublicPlans()]);
    return { origin, plans };
  },
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "";
    const ogImage = absoluteUrl(origin, OG_IMAGE_PATH);
    const canonical = absoluteUrl(origin, "/");
    const description =
      "Cardápio digital, painel de pedidos, modo cozinha, entrega com equipe própria e rastreio do cliente. Mensalidade fixa por loja, sem comissão sobre a sua clientela.";
    return {
      meta: [
        { title: "Pediu Aqui — seu negócio, mais pedidos, mais resultados" },
        { name: "description", content: description },
        { property: "og:title", content: "Pediu Aqui — seu negócio, mais pedidos, mais resultados" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Pediu Aqui — cardápio digital e pedidos" },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
        { name: "robots", content: "index,follow" },
      ],
      links: [{ rel: "canonical", href: canonical || "/" }],
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
                description,
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
    text: "Endereço próprio da loja, identidade visual aplicada, categorias, busca, variações, adicionais, pizza por sabores e venda por peso.",
  },
  {
    icon: ClipboardList,
    title: "Pedidos",
    text: "Filas operacionais com aceite, recusa e transições protegidas por controle de concorrência. Nada de pedido perdido em conversa.",
  },
  {
    icon: ChefHat,
    title: "Cozinha",
    text: "Projeção mínima para a produção: item, quantidade e tempo decorrido. Sem valor e sem dado pessoal na tela da bancada.",
  },
  {
    icon: Bike,
    title: "Entregas",
    text: "Entregadores da própria loja, atribuição manual, coleta, conclusão e registro de ocorrências no caminho.",
  },
  {
    icon: LayoutDashboard,
    title: "Relatórios",
    text: "Contador de entregas derivado do fato real de conclusão, com comparação por período. Operacional, sem dado financeiro.",
  },
  {
    icon: ShieldCheck,
    title: "Administração",
    text: "Ciclo de vida da loja, equipe com papéis, assinatura, auditoria de ações sensíveis e isolamento total entre lojas.",
  },
];

const flow = [
  { icon: Smartphone, title: "O cliente escolhe", text: "Abre o cardápio no celular, monta o item e confirma entrega ou retirada." },
  { icon: ClipboardList, title: "O pedido entra", text: "Cai na fila do painel com alerta sonoro para a equipe de atendimento." },
  { icon: ChefHat, title: "A cozinha prepara", text: "Modo cozinha mostra a fila com tempo decorrido e ações grandes de toque." },
  { icon: Bike, title: "O entregador recebe", text: "Atribuição manual, coleta confirmada e entrega concluída pelo celular." },
  { icon: MapPin, title: "O gestor acompanha", text: "Status em tempo quase real e rastreio seguro do lado do cliente." },
];

const segments = [
  { icon: UtensilsCrossed, title: "Restaurantes", text: "Cardápio por categorias, adicionais e observações do pedido." },
  { icon: ShoppingBasket, title: "Lanchonetes", text: "Combos, variações de tamanho e fluxo rápido de balcão." },
  { icon: Pizza, title: "Pizzarias", text: "Pizza por múltiplos sabores com regra de preço configurável." },
  { icon: Coffee, title: "Bares e cafés", text: "Retirada no local, comanda enxuta e operação de horário estendido." },
  { icon: Store, title: "Mercados e lojas", text: "Catálogo genérico com venda por peso fixo e bairros com taxa própria." },
  { icon: Building2, title: "Redes com filiais", text: "Cada loja com dados, equipe e cardápio isolados uma da outra." },
];

const proof = [
  { icon: ShieldCheck, title: "Isolamento verificado", text: "Cada consulta é filtrada por loja no banco, não apenas na tela." },
  { icon: BadgeCheck, title: "Preço calculado no servidor", text: "O navegador nunca soma valores: o total vem do servidor a cada mudança." },
  { icon: CreditCard, title: "Mensalidade fixa", text: "Você paga pelo uso da plataforma, não um percentual de cada venda." },
];

const faq = [
  {
    q: "Quanto tempo leva para colocar a loja no ar?",
    a: "O cadastro cria a loja e o acesso do responsável na mesma hora. Depois é montar o cardápio, definir horários, bairros e formas de pagamento — tudo dentro do painel, sem depender de suporte técnico.",
  },
  {
    q: "Preciso de aplicativo para o cliente pedir?",
    a: "Não. O cliente abre o endereço da sua loja no navegador, informa primeiro nome e telefone e finaliza o pedido. Não existe conta nem senha para o cliente.",
  },
  {
    q: "Como funciona o pagamento dos pedidos?",
    a: "Você configura as formas de pagamento aceitas pela loja e o pedido registra a escolha do cliente. O recebimento continua acontecendo entre a loja e o cliente, na entrega ou na retirada.",
  },
  {
    q: "Os entregadores são fornecidos pela plataforma?",
    a: "Não. A entrega é feita pela sua própria equipe. Você cadastra cada entregador, ele recebe acesso ao painel dele no celular e passa a ver apenas as entregas da sua loja.",
  },
  {
    q: "O cardápio aceita item com variação, adicional e peso?",
    a: "Sim. O produto pode ter variações (tamanhos), grupos de adicionais com mínimo e máximo, pizza com vários sabores e venda por peso fixo. As regras de preço são validadas no servidor.",
  },
  {
    q: "Meus dados ficam separados dos de outras lojas?",
    a: "Sim. O isolamento por loja é aplicado no próprio banco de dados, com políticas de acesso por linha e autorização por papel e ação.",
  },
];

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Home() {
  const { plans } = Route.useLoaderData();
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");

  function openStore(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeStoreSlug(slug);
    if (!normalized) return;
    void navigate({ to: "/loja/$slug", params: { slug: normalized } });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />

      <main id="conteudo">
        {/* ---------------------------------------------------------- hero */}
        <section className="relative isolate overflow-hidden bg-carbon text-carbon-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 -top-40 size-[36rem] rounded-full bg-brand/18 blur-[120px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-56 right-[-10rem] size-[34rem] rounded-full bg-brand/10 blur-[130px]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-28">
            <div>
              <Reveal as="span" className="inline-block">
                <Badge variant="brand">Plataforma para o comércio local</Badge>
              </Reveal>

              <Reveal
                as="h1"
                delay={70}
                className="mt-6 text-balance font-display text-[clamp(2.25rem,7.5vw,4.25rem)] font-extrabold leading-[1.02] tracking-tight"
              >
                Seu negócio, mais pedidos, mais resultados.
              </Reveal>

              <Reveal
                as="p"
                delay={140}
                className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-carbon-foreground/75 sm:text-lg"
              >
                Cardápio digital com a sua marca, pedidos organizados em fila, cozinha acompanhando
                a produção e entrega feita pela sua própria equipe — em uma plataforma só, com
                mensalidade fixa e sem comissão sobre a sua clientela.
              </Reveal>

              <Reveal delay={210} className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="brand" size="touch" className="w-full sm:w-auto">
                  <Link to="/criar-loja">
                    Criar minha loja
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="touch"
                  className="w-full border-carbon-foreground/25 bg-transparent text-carbon-foreground hover:bg-carbon-foreground/10 hover:text-carbon-foreground sm:w-auto"
                >
                  <a href="#operacao">Ver como funciona</a>
                </Button>
              </Reveal>

              <Reveal delay={280} className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  { title: "Configuração guiada", text: "Loja e acesso criados no cadastro." },
                  { title: "Operação da própria loja", text: "Sua equipe, seus entregadores." },
                  { title: "Gestão centralizada", text: "Pedidos, cozinha e entregas juntos." },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-carbon-foreground/12 bg-carbon-foreground/[0.04] p-4"
                  >
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-carbon-foreground/65">
                      {item.text}
                    </p>
                  </div>
                ))}
              </Reveal>
            </div>

            <Reveal delay={160} className="relative mx-auto w-full max-w-md pb-10 lg:pb-0">
              <ProductMock />
            </Reveal>
          </div>

          {/* abrir cardápio de uma loja existente */}
          <div className="relative border-t border-carbon-foreground/10 bg-carbon-foreground/[0.03]">
            <form
              onSubmit={openStore}
              className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:px-6"
            >
              <label
                htmlFor="slug-loja"
                className="text-sm font-semibold text-carbon-foreground/80 sm:shrink-0"
              >
                Já conhece a loja? Abra o cardápio dela:
              </label>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <Input
                  id="slug-loja"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="nome-da-loja"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="url"
                  enterKeyHint="go"
                  className="bg-background text-foreground sm:max-w-xs"
                />
                <Button type="submit" variant="brand" disabled={!normalizeStoreSlug(slug)}>
                  <Search className="size-4" />
                  Abrir cardápio
                </Button>
              </div>
            </form>
          </div>
        </section>

        {/* ----------------------------------------------------- recursos */}
        <Section id="recursos">
          <SectionHead
            eyebrow="Recursos"
            title="Uma plataforma inteira, do cardápio à porta do cliente"
            text="Cada ambiente foi desenhado para quem usa: quem vende, quem produz, quem entrega e quem gerencia."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Reveal
                as="article"
                key={feature.title}
                delay={index * 60}
                className="group rounded-2xl border border-border bg-card p-6 shadow-e1 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-e2"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------ operação */}
        <section id="operacao" className="border-y border-border bg-carbon text-carbon-foreground">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <Reveal as="p" className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Operação ponta a ponta
            </Reveal>
            <Reveal
              as="h2"
              delay={60}
              className="mt-4 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Do toque do cliente até a porta dele, sem etapa solta
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {flow.map((step, index) => (
                <Reveal
                  key={step.title}
                  delay={index * 70}
                  className="relative rounded-2xl border border-carbon-foreground/12 bg-carbon-foreground/[0.04] p-5"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                    <step.icon className="size-5" />
                  </span>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-brand">
                    Etapa {index + 1}
                  </p>
                  <h3 className="mt-1.5 font-display text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-carbon-foreground/65">
                    {step.text}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- segmentos */}
        <Section id="segmentos" muted>
          <SectionHead
            eyebrow="Para lojas"
            title="Feito para quem vende comida e conveniência no bairro"
            text="O catálogo é genérico por decisão de arquitetura: o mesmo motor atende cardápio de restaurante e prateleira de mercado."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {segments.map((segment, index) => (
              <Reveal
                as="article"
                key={segment.title}
                delay={index * 55}
                className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-e1"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight-soft text-highlight-soft-foreground">
                  <segment.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold">{segment.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {segment.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* --------------------------------------------- prova de valor */}
        <Section>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <SectionHead
                eyebrow="Por que confiar"
                title="Garantias de engenharia, não promessa de marketing"
                text="Não publicamos número de clientes nem depoimento: o que sustentamos aqui é o que está implementado na plataforma."
              />
              <div className="mt-10 space-y-4">
                {proof.map((item, index) => (
                  <Reveal
                    key={item.title}
                    delay={index * 70}
                    className="flex gap-4 rounded-2xl border border-border bg-card p-5"
                  >
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
                      <item.icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.text}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
            <Reveal delay={120} className="mx-auto w-full max-w-md lg:max-w-none">
              <ProductMock />
            </Reveal>
          </div>
        </Section>

        {/* -------------------------------------------------------- planos */}
        <Section id="planos" muted>
          <SectionHead
            eyebrow="Preços"
            title="Mensalidade fixa por loja"
            text="Você paga pelo uso da plataforma. O que a sua loja vende continua sendo inteiramente da sua loja."
          />

          {plans.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <p className="font-semibold">Os planos não puderam ser carregados agora</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Recarregue a página ou fale com a nossa equipe para receber os valores vigentes.
              </p>
            </div>
          ) : (
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {plans.map((plan: PublicPlan, index: number) => {
                const featured = index === 1;
                return (
                  <Reveal
                    as="article"
                    key={plan.code}
                    delay={index * 80}
                    className={
                      featured
                        ? "relative rounded-3xl border-2 border-brand bg-card p-7 shadow-e3"
                        : "relative rounded-3xl border border-border bg-card p-7 shadow-e1"
                    }
                  >
                    {featured ? (
                      <Badge variant="brand" className="absolute -top-3 left-7">
                        Mais escolhido
                      </Badge>
                    ) : null}
                    <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                    {plan.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                    ) : null}
                    <p className="mt-6 flex items-end gap-1.5">
                      <span className="font-display text-4xl font-extrabold tracking-tight">
                        {currency(plan.monthly_price)}
                      </span>
                      <span className="pb-1 text-sm text-muted-foreground">/mês</span>
                    </p>
                    <ul className="mt-6 space-y-3 text-sm">
                      <PlanLimit
                        label="pedidos por mês"
                        value={plan.max_orders_month}
                        unlimited="Pedidos sem limite de volume"
                      />
                      <PlanLimit
                        label="pessoas na equipe"
                        value={plan.max_team_members}
                        unlimited="Equipe sem limite de usuários"
                      />
                      <PlanLimit
                        label="entregadores cadastrados"
                        value={plan.max_couriers}
                        unlimited="Entregadores sem limite"
                      />
                      <PlanFeature>Cardápio digital, pedidos e modo cozinha</PlanFeature>
                      <PlanFeature>Rastreio do pedido para o cliente</PlanFeature>
                      <PlanFeature>Relatórios de entregas</PlanFeature>
                    </ul>
                    <Button
                      asChild
                      variant={featured ? "brand" : "outline"}
                      size="touch"
                      className="mt-8 w-full"
                    >
                      <Link to="/criar-loja">Começar com {plan.name}</Link>
                    </Button>
                  </Reveal>
                );
              })}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Condições comerciais, período de teste e forma de cobrança são confirmados na
            contratação da loja.
          </p>
        </Section>

        {/* -------------------------------------------------------- dúvidas */}
        <Section id="duvidas">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <SectionHead
              eyebrow="Dúvidas frequentes"
              title="O que as lojas perguntam antes de começar"
              text="Se a sua dúvida não estiver aqui, ela pode ser tratada durante a criação da loja."
            />
            <Reveal>
              <Accordion type="single" collapsible className="w-full">
                {faq.map((item, index) => (
                  <AccordionItem key={item.q} value={`faq-${index}`}>
                    <AccordionTrigger className="text-left font-semibold">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </Section>

        {/* ------------------------------------------------------ CTA final */}
        <section className="border-t border-border bg-carbon text-carbon-foreground">
          <div className="relative mx-auto max-w-4xl overflow-hidden px-4 py-20 text-center sm:px-6 sm:py-24">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-[110px]"
            />
            <Reveal
              as="h2"
              className="relative text-balance font-display text-3xl font-extrabold tracking-tight sm:text-5xl"
            >
              Coloque a sua loja para receber pedidos hoje
            </Reveal>
            <Reveal
              as="p"
              delay={80}
              className="relative mx-auto mt-5 max-w-xl text-pretty text-base text-carbon-foreground/70"
            >
              A criação da loja é guiada por etapas curtas. Ao final você já tem o endereço do seu
              cardápio e o acesso do responsável.
            </Reveal>
            <Reveal delay={150} className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="touch" className="w-full sm:w-auto">
                <Link to="/criar-loja">
                  Criar minha loja
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="touch"
                className="w-full border-carbon-foreground/25 bg-transparent text-carbon-foreground hover:bg-carbon-foreground/10 hover:text-carbon-foreground sm:w-auto"
              >
                <Link to="/entrar/loja">Já tenho conta</Link>
              </Button>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/* --------------------------------------------------------- primitivos */

function Section({
  id,
  muted = false,
  children,
}: {
  id?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={muted ? "border-y border-border bg-surface-muted" : "bg-background"}
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">{children}</div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-2xl">
      <Reveal as="p" className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
        {eyebrow}
      </Reveal>
      <Reveal
        as="h2"
        delay={60}
        className="mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl"
      >
        {title}
      </Reveal>
      <Reveal as="p" delay={110} className="mt-4 text-pretty text-muted-foreground">
        {text}
      </Reveal>
    </div>
  );
}

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

function PlanLimit({
  label,
  value,
  unlimited,
}: {
  label: string;
  value: number | null;
  unlimited: string;
}) {
  return (
    <PlanFeature>
      {value === null ? unlimited : `Até ${value.toLocaleString("pt-BR")} ${label}`}
    </PlanFeature>
  );
}
