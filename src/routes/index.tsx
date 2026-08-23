import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bike,
  Check,
  ChefHat,
  ClipboardList,
  Menu,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { PricingSection } from "@/components/marketing/PricingSection";
import { Reveal } from "@/components/motion/Reveal";
import { listPublicPlans } from "@/lib/marketing.functions";
import { cn } from "@/lib/utils";

const description =
  "Venda pelo seu cardápio e organize pedidos, cozinha, entregas e clientes em um só lugar com a Comandiva.";

export const Route = createFileRoute("/")({
  loader: () => listPublicPlans(),
  component: Home,
  head: () => ({
    meta: [
      { title: "Comandiva — cardápio, pedidos, cozinha e entregas em um só lugar" },
      { name: "description", content: description },
      {
        property: "og:title",
        content: "Comandiva — cardápio, pedidos, cozinha e entregas em um só lugar",
      },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/brand/og-image-1200x630.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
  }),
});

type Feature = {
  icon: LucideIcon;
  title: string;
  text: string;
};

type ProductDemo = {
  eyebrow: string;
  title: string;
  text: string;
  bullets: string[];
  imageTitle: string;
  imageNote: string;
};

const painPoints: Feature[] = [
  {
    icon: MessageCircle,
    title: "Pedidos espalhados",
    text: "WhatsApp, papel e conversa solta fazem pedido se perder e obrigam a equipe a conferir tudo duas vezes.",
  },
  {
    icon: ChefHat,
    title: "Produção sem visão",
    text: "A cozinha precisa saber o que entrou, o que está atrasado e o que já pode sair sem depender de gritos ou recados.",
  },
  {
    icon: Bike,
    title: "Entrega sem controle",
    text: "Quando pedido, entregador e status ficam separados, a loja perde tempo tentando descobrir o que aconteceu.",
  },
];

const coreFeatures: Feature[] = [
  {
    icon: Store,
    title: "Cardápio digital",
    text: "Organize categorias, produtos, preços, variações e adicionais e tenha seu próprio link de pedidos.",
  },
  {
    icon: ClipboardList,
    title: "Pedidos e cozinha",
    text: "Acompanhe o que entrou, o que está em produção e o que já ficou pronto em um fluxo único.",
  },
  {
    icon: Bike,
    title: "Entregadores",
    text: "Cadastre sua equipe de entrega e conecte o andamento de cada pedido à operação da loja.",
  },
  {
    icon: TrendingUp,
    title: "Clientes e resultados",
    text: "Veja quem compra, quem volta, quem ficou inativo e como a operação está performando.",
  },
];

const flow = [
  ["01", "Cliente faz o pedido", "O pedido nasce no cardápio da própria loja."],
  ["02", "Loja recebe organizado", "Informações entram em um único fluxo operacional."],
  ["03", "Cozinha acompanha", "A equipe vê o que preparar e o que já está pronto."],
  ["04", "Entrega segue o fluxo", "Pedido e entregador continuam conectados à operação."],
  ["05", "Histórico vira informação", "Os dados ajudam a entender clientes e resultados."],
] as const;

const productDemos: ProductDemo[] = [
  {
    eyebrow: "Visão da operação",
    title: "Entenda o que está acontecendo sem montar planilha.",
    text: "A visão geral deve mostrar somente os números que ajudam o lojista a agir: pedidos, faturamento, ticket e andamento da operação.",
    bullets: ["Pedidos e faturamento", "Status da operação", "Indicadores fáceis de ler"],
    imageTitle: "IMAGEM A INSERIR — VISÃO GERAL DO PAINEL",
    imageNote:
      "Usar print real do Comandiva em desktop, com faturamento, pedidos, ticket médio e pedidos em andamento legíveis.",
  },
  {
    eyebrow: "Pedidos e produção",
    title: "Do pedido recebido à cozinha, sem informação duplicada.",
    text: "O pedido deve avançar por etapas claras para que atendimento e produção enxerguem a mesma informação.",
    bullets: ["Fila de pedidos", "Status claros", "Tela de cozinha em destaque"],
    imageTitle: "IMAGEM A INSERIR — PEDIDOS + COZINHA",
    imageNote:
      "Usar composição com dois prints reais: gestão de pedidos e tela de cozinha. Nada de mockup minúsculo.",
  },
  {
    eyebrow: "Cardápio e entrega",
    title: "Venda no seu próprio cardápio e mantenha a entrega conectada.",
    text: "O cliente compra em uma experiência da loja, enquanto a equipe gerencia produtos, adicionais, pedidos e entregadores no mesmo sistema.",
    bullets: ["Cardápio mobile", "Adicionais e variações", "Entregadores próprios"],
    imageTitle: "IMAGEM A INSERIR — CARDÁPIO MOBILE + ENTREGAS",
    imageNote:
      "Usar print real do cardápio no celular ao lado de uma tela real de entregas/entregadores. Sem banco de imagens.",
  },
];

const faqs = [
  {
    question: "Posso começar sem pagar?",
    answer:
      "Sim. O Comandiva possui plano gratuito com limites próprios. Você pode criar a loja e começar sem contratar um plano pago imediatamente.",
  },
  {
    question: "Preciso saber mexer com tecnologia?",
    answer:
      "Não. A experiência é pensada para quem administra uma loja. Termos técnicos e configurações de infraestrutura ficam fora do caminho da operação do dia a dia.",
  },
  {
    question: "Posso usar meus próprios entregadores?",
    answer:
      "Sim. O Comandiva possui estrutura para cadastrar entregadores e conectar a operação de entrega aos pedidos da loja.",
  },
  {
    question: "Como funcionam os planos?",
    answer:
      "Cada plano define limites de pedidos, equipe, entregadores e recursos. Os valores e limites exibidos nesta página vêm do catálogo comercial atual do Comandiva.",
  },
  {
    question: "O WhatsApp automático já está liberado?",
    answer:
      "Ainda não como recurso geral de produção. A automação de WhatsApp está em homologação e só deve ser anunciada como disponível depois da validação operacional.",
  },
  {
    question: "O que já está disponível hoje?",
    answer:
      "A base atual inclui cardápio, pedidos, cozinha, operação com entregadores, relatórios, planos e recursos de clientes e crescimento. Recursos futuros aparecem separados por status.",
  },
] as const;

function ImagePlaceholder({
  title,
  note,
  className,
}: {
  title: string;
  note: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-72 w-full items-center justify-center rounded-[28px] border-2 border-dashed border-[#55207A]/20 bg-white p-6 text-center sm:min-h-80 sm:p-10",
        className,
      )}
    >
      <div className="max-w-xl">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF681F]">Placeholder de imagem</p>
        <p className="mt-3 font-display text-xl font-extrabold tracking-[-.025em] text-[#1B0D2C] sm:text-2xl">
          {title}
        </p>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#69626E]">{note}</p>
      </div>
    </div>
  );
}

function Home() {
  const plans = Route.useLoaderData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMobileCta, setShowMobileCta] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowMobileCta(!entry.isIntersecting),
      { threshold: 0.12 },
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const navItems = [
    ["#produto", "Produto"],
    ["#como-funciona", "Como funciona"],
    ["#recursos", "Recursos"],
    ["#planos", "Planos"],
    ["#duvidas", "Dúvidas"],
  ] as const;

  return (
    <div className="min-h-dvh bg-[#FCFAF8] pb-[calc(4.75rem+env(safe-area-inset-bottom))] text-[#17131C] selection:bg-[#FF681F]/20 sm:pb-0">
      <header className="sticky top-0 z-50 border-b border-[#1B0D2C]/8 bg-[#FCFAF8]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Comandiva — início" className="shrink-0">
            <BrandLogo lockup="horizontal" className="h-9 w-auto sm:h-10" />
          </Link>

          <nav className="ml-8 hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="Navegação principal">
            {navItems.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#69626E] transition hover:bg-white hover:text-[#55207A]"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/entrar/loja"
              search={{ retorno: undefined }}
              className="hidden min-h-11 items-center rounded-xl px-4 text-sm font-bold text-[#55207A] transition hover:bg-[#55207A]/[.06] sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              to="/criar-loja"
              className="hidden min-h-11 items-center gap-2 rounded-[14px] bg-[#FF681F] px-5 text-sm font-extrabold text-white shadow-[0_10px_28px_rgba(255,104,31,.20)] transition hover:-translate-y-0.5 hover:bg-[#E95612] sm:inline-flex"
            >
              Criar minha loja grátis <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              className="inline-flex size-11 items-center justify-center rounded-xl border border-[#55207A]/15 bg-white text-[#55207A] lg:hidden"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t border-[#1B0D2C]/8 bg-[#FCFAF8] px-4 pb-5 pt-3 lg:hidden" aria-label="Navegação mobile">
            <div className="mx-auto grid max-w-[1240px] gap-1">
              {navItems.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="flex min-h-12 items-center rounded-xl px-4 font-semibold text-[#55207A] hover:bg-white"
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
              <Link
                to="/entrar/loja"
                search={{ retorno: undefined }}
                className="flex min-h-12 items-center rounded-xl px-4 font-semibold text-[#55207A] hover:bg-white sm:hidden"
                onClick={() => setMenuOpen(false)}
              >
                Entrar
              </Link>
              <Link
                to="/criar-loja"
                className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#FF681F] px-5 text-sm font-extrabold text-white sm:hidden"
                onClick={() => setMenuOpen(false)}
              >
                Criar minha loja grátis
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

      <main>
        <section ref={heroRef} id="produto" className="relative overflow-hidden border-b border-[#1B0D2C]/6">
          <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[.92fr_1.08fr] lg:gap-14 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#55207A]/10 bg-white px-3.5 py-2 text-xs font-extrabold text-[#55207A] shadow-sm">
                  <Store className="size-3.5" /> Para restaurantes e comércio local
                </span>
              </Reveal>

              <Reveal delay={60}>
                <h1 className="mt-6 text-balance font-display text-[clamp(2.5rem,6vw,4.25rem)] font-extrabold leading-[.99] tracking-[-.055em] text-[#17131C]">
                  Venda pelo seu cardápio e organize pedidos, cozinha e entregas em um só lugar.
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-[#69626E] sm:text-lg sm:leading-8">
                  Comandiva reúne a operação da sua loja em um único sistema — do pedido do cliente ao acompanhamento da entrega, com dados para você vender novamente.
                </p>
              </Reveal>

              <Reveal delay={180} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/criar-loja"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[14px] bg-[#FF681F] px-7 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,104,31,.22)] transition hover:-translate-y-0.5 hover:bg-[#E95612]"
                >
                  Criar minha loja grátis <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#demonstracao"
                  className="inline-flex min-h-14 items-center justify-center rounded-[14px] border border-[#55207A]/15 bg-white px-7 text-sm font-bold text-[#55207A] transition hover:border-[#55207A]/30 hover:bg-[#F6F1F8]"
                >
                  Ver o sistema funcionando
                </a>
              </Reveal>

              <Reveal delay={220} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#69626E]">
                <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-[#188653]" /> Comece grátis</span>
                <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-[#188653]" /> Sem cartão no plano gratuito</span>
                <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-[#188653]" /> Feito para comércio local</span>
              </Reveal>
            </div>

            <Reveal delay={120}>
              <ImagePlaceholder
                className="min-h-[390px] lg:min-h-[500px]"
                title="IMAGEM A INSERIR — HERO DO PRODUTO"
                note="Criar uma composição de alta fidelidade com dashboard real do Comandiva em desktop + cardápio real no celular. Interfaces grandes, legíveis e sem recortes ruins."
              />
            </Reveal>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF681F]">O problema é simples</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-[-.04em] text-[#1B0D2C] sm:text-4xl lg:text-5xl">
                Sua loja não precisa de cinco ferramentas para atender um pedido.
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {painPoints.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.title} delay={index * 60}>
                    <article className="h-full rounded-[20px] border border-[#EAE5ED] bg-[#FCFAF8] p-6 sm:p-7">
                      <div className="flex size-11 items-center justify-center rounded-[14px] bg-[#F6F1F8] text-[#55207A]">
                        <Icon className="size-5" />
                      </div>
                      <h3 className="mt-5 font-display text-xl font-extrabold tracking-[-.025em] text-[#17131C]">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#69626E]">{item.text}</p>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="border-y border-[#1B0D2C]/6 bg-[#1B0D2C] py-20 text-white sm:py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <Reveal className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF9A68]">Tudo conectado</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-[-.04em] sm:text-4xl lg:text-5xl">
                O pedido entra uma vez. A equipe inteira acompanha.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/68">
                O Comandiva conecta as etapas da operação sem obrigar o lojista a entender a tecnologia que existe por trás.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-3 lg:grid-cols-5">
              {flow.map(([number, title, text], index) => (
                <Reveal key={number} delay={index * 45}>
                  <article className="h-full rounded-[18px] border border-white/10 bg-white/[.055] p-5">
                    <span className="font-display text-sm font-black text-[#FF9A68]">{number}</span>
                    <h3 className="mt-4 font-display text-lg font-extrabold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/62">{text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="recursos" className="bg-[#FCFAF8] py-20 sm:py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF681F]">Recursos principais</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-[-.04em] text-[#1B0D2C] sm:text-4xl lg:text-5xl">
                O essencial para operar melhor todos os dias.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#69626E]">
                Menos lista de funcionalidades. Mais clareza sobre o que cada parte do sistema resolve na rotina da loja.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {coreFeatures.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.title} delay={index * 55}>
                    <article className="flex h-full gap-4 rounded-[22px] border border-[#EAE5ED] bg-white p-6 shadow-[0_10px_30px_rgba(27,13,44,.035)] sm:p-7">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[#F6F1F8] text-[#55207A]">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-extrabold tracking-[-.025em] text-[#17131C]">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[#69626E]">{item.text}</p>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="demonstracao" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF681F]">Demonstração real</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-[-.04em] text-[#1B0D2C] sm:text-4xl lg:text-5xl">
                Veja o Comandiva funcionando, não apenas uma lista de recursos.
              </h2>
            </Reveal>

            <div className="mt-12 space-y-16 sm:mt-16 sm:space-y-20">
              {productDemos.map((demo, index) => (
                <div
                  key={demo.title}
                  className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
                >
                  <Reveal className={cn(index % 2 === 1 && "lg:order-2")}>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.18em] text-[#55207A]">{demo.eyebrow}</p>
                      <h3 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-[-.04em] text-[#17131C] sm:text-4xl">
                        {demo.title}
                      </h3>
                      <p className="mt-4 text-base leading-7 text-[#69626E]">{demo.text}</p>
                      <ul className="mt-6 space-y-3">
                        {demo.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-center gap-2.5 text-sm font-semibold text-[#342D39]">
                            <span className="flex size-6 items-center justify-center rounded-full bg-[#EAF6EF] text-[#188653]">
                              <Check className="size-3.5" />
                            </span>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                  <Reveal delay={70} className={cn(index % 2 === 1 && "lg:order-1")}>
                    <ImagePlaceholder title={demo.imageTitle} note={demo.imageNote} />
                  </Reveal>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#1B0D2C]/6 bg-[#F6F1F8] py-20 sm:py-24">
          <div className="mx-auto grid max-w-[1240px] items-center gap-8 px-4 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:gap-14 lg:px-8">
            <Reveal>
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF681F]">Clientes e recompra</p>
                <h2 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-[-.04em] text-[#1B0D2C] sm:text-4xl lg:text-5xl">
                  Não deixe o relacionamento acabar depois da entrega.
                </h2>
                <p className="mt-5 text-base leading-7 text-[#69626E]">
                  O histórico dos pedidos ajuda a identificar clientes recorrentes, VIP e inativos sem exigir que o lojista monte uma planilha de clientes.
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {["Recorrentes", "Clientes VIP", "Clientes inativos"].map((label) => (
                    <div key={label} className="rounded-[16px] border border-[#55207A]/10 bg-white px-4 py-4 text-sm font-bold text-[#55207A]">
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={70}>
              <ImagePlaceholder
                title="IMAGEM A INSERIR — CLIENTES E RECOMPRA"
                note="Usar print real da área de crescimento/clientes mostrando segmentos como novos, recorrentes, VIP e inativos. Evitar qualquer número inventado."
              />
            </Reveal>
          </div>
        </section>

        <section id="automacoes" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF681F]">Automações com status claro</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-[-.04em] text-[#1B0D2C] sm:text-4xl lg:text-5xl">
                O que já existe fica separado do que ainda está sendo validado.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#69626E]">
                Recursos futuros não são apresentados como se já estivessem disponíveis para todos.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              <article className="rounded-[22px] border border-[#188653]/15 bg-[#F4FBF7] p-6 sm:p-7">
                <span className="inline-flex rounded-full bg-[#DFF3E8] px-3 py-1.5 text-xs font-black uppercase tracking-[.1em] text-[#17663A]">Disponível agora</span>
                <h3 className="mt-5 font-display text-xl font-extrabold text-[#17131C]">Clientes e sinais de recompra</h3>
                <p className="mt-2 text-sm leading-6 text-[#69626E]">Segmentação por histórico de pedidos, clientes recorrentes, VIP e inativos conectados aos dados reais da loja.</p>
              </article>

              <article className="rounded-[22px] border border-[#B96A09]/15 bg-[#FFF9EF] p-6 sm:p-7">
                <span className="inline-flex rounded-full bg-[#FCEBCB] px-3 py-1.5 text-xs font-black uppercase tracking-[.1em] text-[#8A4A00]">Em homologação</span>
                <h3 className="mt-5 font-display text-xl font-extrabold text-[#17131C]">WhatsApp automático</h3>
                <p className="mt-2 text-sm leading-6 text-[#69626E]">A infraestrutura está sendo validada antes de o recurso ser anunciado como disponível para uso geral.</p>
              </article>

              <article className="rounded-[22px] border border-[#55207A]/12 bg-[#F8F5FA] p-6 sm:p-7">
                <span className="inline-flex rounded-full bg-[#ECE4F1] px-3 py-1.5 text-xs font-black uppercase tracking-[.1em] text-[#55207A]">Em implementação</span>
                <h3 className="mt-5 font-display text-xl font-extrabold text-[#17131C]">Novos módulos</h3>
                <p className="mt-2 text-sm leading-6 text-[#69626E]">Atendente com IA, entrega inteligente, reputação, fiscal e novas automações continuam fora da promessa principal até validação.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="border-y border-[#1B0D2C]/6 bg-[#FCFAF8] py-10">
          <div className="mx-auto max-w-[1240px] px-4 text-center sm:px-6 lg:px-8">
            <p className="text-sm font-bold text-[#69626E]">Feito para</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["Restaurantes", "Pizzarias", "Lanchonetes", "Bares", "Mercados", "Conveniências"].map((segment) => (
                <span key={segment} className="rounded-full border border-[#EAE5ED] bg-white px-4 py-2 text-sm font-semibold text-[#55207A]">
                  {segment}
                </span>
              ))}
            </div>
          </div>
        </section>

        <PricingSection plans={plans} />

        <section id="duvidas" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF681F]">Dúvidas frequentes</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-[-.04em] text-[#1B0D2C] sm:text-4xl lg:text-5xl">
                Antes de criar sua loja.
              </h2>
            </Reveal>

            <div className="mt-10 divide-y divide-[#EAE5ED] overflow-hidden rounded-[22px] border border-[#EAE5ED] bg-[#FCFAF8]">
              {faqs.map((faq) => (
                <details key={faq.question} className="group bg-white px-5 py-1 sm:px-6">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-base font-extrabold text-[#17131C] marker:hidden sm:text-lg">
                    {faq.question}
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F6F1F8] text-lg font-bold text-[#55207A] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="max-w-2xl pb-5 pr-10 text-sm leading-6 text-[#69626E]">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#1B0D2C] py-16 text-white sm:py-20">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <PackageCheck className="mx-auto size-10 text-[#FF8C52]" />
              <h2 className="mt-5 text-balance font-display text-3xl font-extrabold tracking-[-.04em] sm:text-4xl lg:text-5xl">
                Comece com o que sua loja precisa hoje.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/68">
                Crie sua loja, configure o cardápio e centralize seus pedidos no Comandiva.
              </p>
              <Link
                to="/criar-loja"
                className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-[14px] bg-[#FF681F] px-7 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#E95612]"
              >
                Criar minha loja grátis <ArrowRight className="size-4" />
              </Link>
              <p className="mt-3 text-xs text-white/50">Sem compromisso no plano gratuito.</p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="bg-[#12091D] text-white/70">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <BrandLogo lockup="horizontal" tone="white" className="h-9 w-auto" />
            <p className="mt-3 max-w-md text-sm leading-6 text-white/50">Cardápio, pedidos, cozinha, entregas e clientes em um só lugar.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold" aria-label="Rodapé">
            <a href="#produto" className="hover:text-white">Produto</a>
            <a href="#recursos" className="hover:text-white">Recursos</a>
            <a href="#planos" className="hover:text-white">Planos</a>
            <a href="#duvidas" className="hover:text-white">Dúvidas</a>
            <Link to="/entrar/loja" search={{ retorno: undefined }} className="hover:text-white">Entrar</Link>
          </nav>
        </div>
      </footer>

      {showMobileCta ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1B0D2C]/10 bg-white/95 p-3 backdrop-blur-xl sm:hidden"
          style={{ paddingBottom: "calc(.75rem + env(safe-area-inset-bottom))" }}
        >
          <Link
            to="/criar-loja"
            className="mx-auto flex min-h-12 max-w-lg items-center justify-center gap-2 rounded-[14px] bg-[#FF681F] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(255,104,31,.24)]"
          >
            Criar minha loja grátis <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
