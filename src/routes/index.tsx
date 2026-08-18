import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bike,
  Check,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Smartphone,
  Store,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { PricingSection } from "@/components/marketing/PricingSection";
import { Reveal } from "@/components/motion/Reveal";
import { listPublicPlans } from "@/lib/marketing.functions";

const description =
  "Cardápio digital, pedidos, cozinha, entregas e gestão em uma plataforma feita para o comércio local.";

export const Route = createFileRoute("/")({
  loader: () => listPublicPlans(),
  component: Home,
  head: () => ({
    meta: [
      { title: "Comandiva — operação digital para o comércio local" },
      { name: "description", content: description },
      { property: "og:title", content: "Comandiva — operação digital para o comércio local" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/brand/og-image-1200x630.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
  }),
});

type Feature = { icon: LucideIcon; title: string; text: string };

const features: Feature[] = [
  {
    icon: Smartphone,
    title: "Cardápio digital",
    text: "Catálogo otimizado para celular, com categorias, adicionais, variações e identidade da loja.",
  },
  {
    icon: ClipboardList,
    title: "Pedidos organizados",
    text: "Receba e acompanhe cada pedido em um fluxo único, sem depender de mensagens soltas.",
  },
  {
    icon: ChefHat,
    title: "Cozinha operacional",
    text: "Fila objetiva para produção, com prioridade visual e ações claras para a equipe.",
  },
  {
    icon: Bike,
    title: "Entregas próprias",
    text: "Cadastre entregadores da loja, distribua corridas e acompanhe coleta e conclusão.",
  },
  {
    icon: BarChart3,
    title: "Relatórios úteis",
    text: "Acompanhe a operação por período e tome decisões com base no que realmente aconteceu.",
  },
  {
    icon: ShieldCheck,
    title: "SaaS multi-loja",
    text: "Papéis, permissões, isolamento de dados, auditoria e administração central fazem parte da base.",
  },
];

const highlights: Feature[] = [
  { icon: LayoutDashboard, title: "Operação integrada", text: "Uma visão única do negócio" },
  { icon: ShieldCheck, title: "Isolamento por loja", text: "Dados separados por tenant" },
  { icon: CreditCard, title: "Modelo previsível", text: "Gestão sem comissão por pedido" },
  { icon: Zap, title: "Fluxo rápido", text: "Feito para a rotina operacional" },
];

const flow = [
  ["01", "Crie a loja", "Configure os dados essenciais da operação."],
  ["02", "Monte o cardápio", "Organize produtos, categorias, preços e adicionais."],
  ["03", "Receba pedidos", "O pedido entra organizado para atendimento e cozinha."],
  ["04", "Opere e entregue", "Equipe e entregadores trabalham no mesmo fluxo."],
] as const;

const segments = ["Restaurantes", "Lanchonetes", "Pizzarias", "Bares", "Mercados", "Conveniências"];

function Home() {
  const plans = Route.useLoaderData();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[#FFF6F1] text-[#1C1C1E] selection:bg-[#FF6A4D]/25">
      <header className="sticky top-0 z-50 border-b border-[#4B1D6D]/10 bg-[#FFF6F1]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[82px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Comandiva — início" className="shrink-0">
            <BrandLogo lockup="horizontal" className="h-11 w-auto sm:h-12" />
          </Link>

          <nav className="ml-8 hidden flex-1 items-center gap-1 lg:flex" aria-label="Navegação principal">
            {[
              ["#recursos", "Recursos"],
              ["#como-funciona", "Como funciona"],
              ["#negocios", "Para negócios"],
              ["#saas", "Plataforma"],
              ["#planos", "Planos"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#5F5563] transition hover:bg-white hover:text-[#4B1D6D]"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/entrar/loja"
              search={{ retorno: undefined }}
              className="hidden min-h-11 items-center rounded-xl px-4 text-sm font-bold text-[#4B1D6D] transition hover:bg-[#4B1D6D]/[.06] sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              to="/criar-loja"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF6A4D] px-4 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(255,106,77,.22)] transition hover:-translate-y-0.5 hover:bg-[#F15C40]"
            >
              Começar agora <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              className="inline-flex size-11 items-center justify-center rounded-xl border border-[#4B1D6D]/15 bg-white text-[#4B1D6D] lg:hidden"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t border-[#4B1D6D]/10 bg-[#FFF6F1] px-4 pb-5 pt-3 lg:hidden" aria-label="Navegação mobile">
            <div className="mx-auto grid max-w-7xl gap-1">
              {[
                ["#recursos", "Recursos"],
                ["#como-funciona", "Como funciona"],
                ["#negocios", "Para negócios"],
                ["#saas", "Plataforma"],
                ["#planos", "Planos"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="flex min-h-12 items-center rounded-xl px-4 font-semibold text-[#4B1D6D] hover:bg-white"
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <div className="pointer-events-none absolute -left-32 top-20 size-80 rounded-full bg-[#FF6A4D]/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-0 size-[34rem] rounded-full bg-[#8A7CA8]/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:url('/brand/comandiva-pattern.svg')] [background-size:480px_auto]" />

          <div className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#4B1D6D]/10 bg-white/80 px-3.5 py-2 text-xs font-extrabold text-[#4B1D6D] shadow-sm">
                  <span className="size-2 rounded-full bg-[#FF6A4D]" /> Plataforma para comércio local
                </span>
              </Reveal>

              <Reveal delay={60}>
                <h1 className="mt-7 text-balance font-display text-[clamp(3rem,7vw,6rem)] font-extrabold leading-[.94] tracking-[-.055em] text-[#1C1C1E]">
                  Venda mais.<br />Opere melhor.<br />
                  <span className="text-[#4B1D6D]">Cresça com controle.</span>
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-[#625966] sm:text-lg">
                  Cardápio digital, pedidos, cozinha, entregas e gestão em uma experiência única. Sua equipe trabalha com menos improviso e mais clareza.
                </p>
              </Reveal>

              <Reveal delay={180} className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/criar-loja"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#FF6A4D] px-7 text-sm font-black text-white shadow-[0_18px_42px_rgba(255,106,77,.24)] transition hover:-translate-y-0.5 hover:bg-[#F15C40]"
                >
                  Criar minha loja <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-[#4B1D6D]/15 bg-white px-7 text-sm font-bold text-[#4B1D6D] shadow-sm transition hover:border-[#4B1D6D]/25 hover:bg-[#F7F0F8]"
                >
                  Ver como funciona
                </a>
              </Reveal>

              <Reveal delay={230} className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#6E6472]">
                <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#FF6A4D]" /> Sem comissão por pedido</span>
                <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#FF6A4D]" /> Equipe própria</span>
                <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#FF6A4D]" /> Mobile-first</span>
              </Reveal>
            </div>

            <Reveal delay={100} className="relative mx-auto w-full max-w-[760px]">
              <div className="absolute -inset-8 rounded-[48px] bg-[#4B1D6D]/8 blur-3xl" />
              <div className="relative overflow-hidden rounded-[34px] border border-[#4B1D6D]/10 bg-white/70 p-3 shadow-[0_30px_80px_rgba(75,29,109,.14)] backdrop-blur-sm sm:p-4">
                <img
                  src="/brand/comandiva-hero-operations.webp"
                  alt="Comandiva conectando painel de gestão e operação mobile"
                  className="h-auto w-full rounded-[26px] object-cover"
                  loading="eager"
                />
              </div>
            </Reveal>
          </div>

          <div className="relative border-y border-[#4B1D6D]/10 bg-white/65 backdrop-blur-sm">
            <div className="mx-auto grid max-w-7xl px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
              {highlights.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4 border-[#4B1D6D]/10 px-5 py-7 lg:border-r lg:last:border-r-0">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#F1EAF4] text-[#4B1D6D]">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-[#2A2030]">{title}</p>
                    <p className="mt-1 text-xs text-[#7B707F]">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="recursos" className="relative overflow-hidden bg-white py-24 sm:py-28">
          <div className="pointer-events-none absolute -right-40 -top-40 size-[32rem] rounded-full bg-[#8A7CA8]/12 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#FF6A4D]">Tudo conectado</p>
              <h2 className="mt-4 text-balance font-display text-4xl font-extrabold tracking-[-.04em] text-[#271D2C] sm:text-5xl lg:text-6xl">
                Uma plataforma inteira para sua operação
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#706675]">
                Atendimento, cozinha, entrega e gestão compartilham a mesma linguagem visual e o mesmo fluxo operacional.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {features.map(({ icon: Icon, title, text }, index) => (
                <Reveal
                  as="article"
                  key={title}
                  delay={index * 45}
                  className="group rounded-[28px] border border-[#4B1D6D]/10 bg-[#FFF9F6] p-7 shadow-[0_12px_38px_rgba(75,29,109,.06)] transition duration-300 hover:-translate-y-1 hover:border-[#4B1D6D]/20 hover:shadow-[0_22px_55px_rgba(75,29,109,.10)]"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-[#F0E8F3] text-[#4B1D6D] transition group-hover:bg-[#FFE6DF] group-hover:text-[#D94F37]">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-6 text-lg font-extrabold text-[#2A2030]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#746A78]">{text}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#4B1D6D]">
                    Incluído na plataforma <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
                  </span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="relative overflow-hidden bg-[#4B1D6D] py-24 text-white sm:py-28">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:url('/brand/comandiva-pattern.svg')] [background-size:430px_auto]" />
          <div className="pointer-events-none absolute -right-20 top-0 size-[28rem] rounded-full bg-[#FF6A4D]/12 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#FFB09E]">Como funciona</p>
              <h2 className="mt-4 text-balance font-display text-4xl font-extrabold tracking-[-.04em] sm:text-5xl">
                Do primeiro produto cadastrado à entrega concluída
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {flow.map(([number, title, text], index) => (
                <Reveal
                  key={number}
                  delay={index * 60}
                  className="rounded-[26px] border border-white/12 bg-white/[.07] p-6 backdrop-blur-sm"
                >
                  <span className="text-sm font-black text-[#FF8068]">{number}</span>
                  <h3 className="mt-8 text-lg font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="negocios" className="bg-[#FFF6F1] py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <Reveal>
                <p className="text-xs font-black uppercase tracking-[.22em] text-[#FF6A4D]">Flexível para sua rotina</p>
                <h2 className="mt-4 text-balance font-display text-4xl font-extrabold tracking-[-.04em] text-[#291F2E] sm:text-5xl">
                  Um motor, diferentes tipos de negócio
                </h2>
                <p className="mt-5 max-w-lg leading-7 text-[#706675]">
                  A operação se adapta ao comércio local sem transformar cada segmento em um sistema separado.
                </p>
              </Reveal>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {segments.map((segment, index) => (
                  <Reveal
                    key={segment}
                    delay={index * 45}
                    className="rounded-2xl border border-[#4B1D6D]/10 bg-white p-5 shadow-[0_10px_28px_rgba(75,29,109,.05)]"
                  >
                    <Store className="size-5 text-[#4B1D6D]" />
                    <h3 className="mt-4 font-extrabold text-[#2B2130]">{segment}</h3>
                    <p className="mt-1.5 text-xs leading-5 text-[#776D7B]">Catálogo, pedidos e operação em um único ambiente.</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="saas" className="bg-white py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 overflow-hidden rounded-[36px] border border-[#4B1D6D]/10 bg-[#F8F0F5] p-6 shadow-[0_28px_75px_rgba(75,29,109,.09)] sm:p-10 lg:grid-cols-[1.08fr_.92fr] lg:p-12">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#4B1D6D] px-3.5 py-2 text-xs font-extrabold text-white">
                  <ShieldCheck className="size-3.5" /> Plataforma preparada para crescer
                </span>
                <h2 className="mt-6 text-balance font-display text-4xl font-extrabold tracking-[-.04em] text-[#281E2D] sm:text-5xl">
                  Gestão clara para quem está no balcão e para quem administra.
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-[#6F6573] sm:text-base">
                  Multi-loja, permissões, auditoria e administração central compõem a fundação técnica sem tirar simplicidade da rotina.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {["Multi-tenant", "RLS", "Permissões", "Auditoria", "Operação mobile"].map((item) => (
                    <span key={item} className="rounded-full border border-[#4B1D6D]/10 bg-white px-3 py-2 text-xs font-bold text-[#4B1D6D]">
                      {item}
                    </span>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={90} className="relative">
                <img
                  src="/brand/comandiva-dashboard-preview.webp"
                  alt="Painel de gestão Comandiva"
                  className="w-full rounded-[24px] border border-[#4B1D6D]/10 bg-white shadow-[0_20px_50px_rgba(75,29,109,.13)]"
                  loading="lazy"
                />
              </Reveal>
            </div>
          </div>
        </section>

        <PricingSection plans={plans} />

        <section className="bg-[#FFF6F1] px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-5xl overflow-hidden rounded-[36px] bg-[#4B1D6D] px-6 py-12 text-center text-white shadow-[0_28px_70px_rgba(75,29,109,.20)] sm:px-10 sm:py-16">
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#FFB09E]">Comandiva</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-extrabold tracking-[-.04em] sm:text-5xl">
              Sua operação merece uma interface à altura do seu negócio.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/66 sm:text-base">
              Configure sua loja, organize sua equipe e concentre a operação em uma plataforma única.
            </p>
            <Link
              to="/criar-loja"
              className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#FF6A4D] px-7 text-sm font-black text-white shadow-[0_16px_36px_rgba(255,106,77,.25)] transition hover:-translate-y-0.5 hover:bg-[#F15C40]"
            >
              Criar minha loja <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#321447] py-12 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-[1.35fr_.65fr_.65fr] lg:px-8">
          <div>
            <BrandLogo lockup="horizontal" tone="white" className="h-10 w-auto" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
              Tecnologia operacional para negócios locais venderem e trabalharem com mais organização.
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.15em] text-white/45">Produto</p>
            <div className="mt-4 grid gap-2.5 text-sm text-white/68">
              <a href="#recursos" className="hover:text-white">Recursos</a>
              <a href="#como-funciona" className="hover:text-white">Como funciona</a>
              <a href="#saas" className="hover:text-white">Plataforma</a>
              <a href="#planos" className="hover:text-white">Planos</a>
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.15em] text-white/45">Acessos</p>
            <div className="mt-4 grid gap-2.5 text-sm text-white/68">
              <Link to="/entrar/loja" search={{ retorno: undefined }} className="hover:text-white">Loja</Link>
              <Link to="/entrar/entregador" search={{ retorno: undefined }} className="hover:text-white">Entregador</Link>
              <Link to="/entrar/admin" search={{ retorno: undefined }} className="hover:text-white">Administração</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 px-4 pt-6 text-xs text-white/45 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Comandiva. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
