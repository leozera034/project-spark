import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bike,
  Check,
  ChevronRight,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Menu,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Reveal } from "@/components/motion/Reveal";

const description =
  "Cardápio digital, pedidos, cozinha, entregas e gestão em uma plataforma feita para o comércio local.";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Pediu Aqui — operação digital para o comércio local" },
      { name: "description", content: description },
      { property: "og:title", content: "Pediu Aqui — operação digital para o comércio local" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/brand/og-image-1200x630.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
  }),
});

type Feature = { icon: LucideIcon; title: string; text: string };
type IconLabel = { icon: LucideIcon; label: string };
type OrderPreview = { icon: LucideIcon; title: string; status: string };

const features: Feature[] = [
  { icon: Smartphone, title: "Cardápio digital", text: "Catálogo otimizado para celular, com categorias, adicionais, variações e identidade da loja." },
  { icon: ClipboardList, title: "Pedidos organizados", text: "Receba, aceite e acompanhe cada pedido em um fluxo único, sem depender de mensagens soltas." },
  { icon: ChefHat, title: "Cozinha operacional", text: "Fila objetiva para produção, com prioridade visual e ações grandes para a equipe trabalhar rápido." },
  { icon: Bike, title: "Entregas próprias", text: "Cadastre entregadores da loja, distribua corridas e acompanhe coleta e conclusão." },
  { icon: BarChart3, title: "Relatórios úteis", text: "Acompanhe a operação por período e tome decisões com base no que realmente aconteceu." },
  { icon: ShieldCheck, title: "SaaS multi-loja", text: "Papéis, permissões, isolamento de dados, auditoria e administração central fazem parte da base." },
];

const platformHighlights: Feature[] = [
  { icon: LayoutDashboard, title: "Operação integrada", text: "Uma visão única do negócio" },
  { icon: ShieldCheck, title: "Isolamento por loja", text: "Dados separados no banco" },
  { icon: CreditCard, title: "Mensalidade fixa", text: "Sem percentual sobre vendas" },
  { icon: Zap, title: "Fluxo rápido", text: "Feito para rotina operacional" },
];

const flow = [
  ["01", "Crie a loja", "Cadastre a operação e configure os dados essenciais."],
  ["02", "Monte o cardápio", "Organize produtos, preços, categorias e adicionais."],
  ["03", "Receba pedidos", "O cliente compra pelo celular e a equipe recebe tudo organizado."],
  ["04", "Opere e entregue", "Cozinha, atendimento e entregadores trabalham no mesmo fluxo."],
] as const;

const segments = ["Restaurantes", "Lanchonetes", "Pizzarias", "Bares", "Mercados", "Conveniências"];

const phoneTabs: IconLabel[] = [
  { icon: ClipboardList, label: "Pedidos" },
  { icon: ChefHat, label: "Cozinha" },
  { icon: Bike, label: "Entrega" },
];

const phoneOrders: OrderPreview[] = [
  { icon: ShoppingBag, title: "Pedido #1842", status: "Preparando" },
  { icon: PackageCheck, title: "Pedido #1841", status: "Pronto" },
  { icon: Bike, title: "Pedido #1840", status: "Em rota" },
];

const phoneNav: LucideIcon[] = [LayoutDashboard, ClipboardList, UtensilsCrossed, MapPin];

function Home() {
  return (
    <div className="min-h-dvh bg-[#06030d] text-white selection:bg-violet-500/40">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[.07] bg-[#06030d]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Pediu Aqui" className="shrink-0">
            <BrandLogo lockup="horizontal" className="h-7 w-auto brightness-0 invert" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-white/60 lg:flex">
            <a href="#recursos" className="transition hover:text-white">Recursos</a>
            <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
            <a href="#negocios" className="transition hover:text-white">Para negócios</a>
            <a href="#saas" className="transition hover:text-white">Plataforma</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/entrar/loja" search={{ retorno: undefined }} className="hidden min-h-10 items-center rounded-xl px-4 text-sm font-bold text-white/70 transition hover:bg-white/[.06] hover:text-white sm:inline-flex">Entrar</Link>
            <Link to="/criar-loja" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-extrabold text-white shadow-[0_12px_45px_rgba(124,58,237,.35)] transition hover:-translate-y-0.5 hover:brightness-110">Começar agora <ArrowRight className="size-4" /></Link>
            <button type="button" aria-label="Menu" className="inline-flex size-11 items-center justify-center rounded-xl border border-white/10 text-white/70 lg:hidden"><Menu className="size-5" /></button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden pt-[72px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_24%,rgba(139,92,246,.28),transparent_28%),radial-gradient(circle_at_18%_18%,rgba(217,70,239,.14),transparent_26%),linear-gradient(180deg,#080313_0%,#06030d_100%)]" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:54px_54px]" />
          <div className="relative mx-auto grid min-h-[790px] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.92fr_1.08fr] lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Reveal><span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3.5 py-2 text-xs font-extrabold text-violet-200 shadow-[inset_0_0_20px_rgba(124,58,237,.08)]"><Sparkles className="size-3.5" /> Plataforma completa para comércio local</span></Reveal>
              <Reveal delay={60}><h1 className="mt-7 text-balance font-display text-[clamp(3.1rem,7.6vw,6.6rem)] font-black leading-[.9] tracking-[-.055em]">Venda mais.<br />Opere melhor.<br /><span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-purple-300 bg-clip-text text-transparent">Cresça com controle.</span></h1></Reveal>
              <Reveal delay={120}><p className="mt-7 max-w-xl text-pretty text-base leading-7 text-white/60 sm:text-lg">Cardápio digital, pedidos, cozinha, entregas e gestão em uma experiência única. Menos improviso para sua equipe e uma operação mais profissional para sua loja.</p></Reveal>
              <Reveal delay={180} className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to="/criar-loja" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-7 text-sm font-black text-white shadow-[0_18px_55px_rgba(124,58,237,.38)] transition hover:-translate-y-0.5 hover:brightness-110">Criar minha loja <ArrowRight className="size-4" /></Link>
                <a href="#como-funciona" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/13 bg-white/[.035] px-7 text-sm font-bold text-white transition hover:bg-white/[.075]">Ver como funciona <ChevronRight className="size-4" /></a>
              </Reveal>
              <Reveal delay={230} className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/50">
                <span className="inline-flex items-center gap-2"><Check className="size-4 text-violet-400" /> Sem comissão por pedido</span>
                <span className="inline-flex items-center gap-2"><Check className="size-4 text-violet-400" /> Equipe própria</span>
                <span className="inline-flex items-center gap-2"><Check className="size-4 text-violet-400" /> Mobile-first</span>
              </Reveal>
            </div>
            <Reveal delay={120} className="relative mx-auto w-full max-w-[680px]">
              <div className="absolute -inset-14 rounded-full bg-violet-600/15 blur-3xl" />
              <div className="relative grid gap-5 lg:grid-cols-[1fr_.72fr]">
                <PhoneMock />
                <div className="hidden flex-col justify-center gap-4 lg:flex">
                  <FloatingCard icon={PackageCheck} label="Pedidos" value="Fluxo organizado" />
                  <FloatingCard icon={ChefHat} label="Cozinha" value="Fila em tempo real" />
                  <FloatingCard icon={Bike} label="Entrega" value="Equipe conectada" />
                </div>
              </div>
            </Reveal>
          </div>
          <div className="relative border-y border-white/[.07] bg-white/[.025]">
            <div className="mx-auto grid max-w-7xl gap-px px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
              {platformHighlights.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4 border-white/[.07] px-5 py-7 sm:border-r">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><Icon className="size-5" /></span>
                  <div><p className="text-sm font-extrabold">{title}</p><p className="mt-1 text-xs text-white/42">{text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="recursos" className="relative overflow-hidden bg-[#f7f5fb] py-24 text-[#130b20] sm:py-30">
          <div className="absolute right-[-12rem] top-[-10rem] size-[30rem] rounded-full bg-violet-300/20 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center"><p className="text-xs font-black uppercase tracking-[.22em] text-violet-600">Tudo conectado</p><h2 className="mt-4 text-balance font-display text-4xl font-black tracking-[-.04em] sm:text-5xl lg:text-6xl">Uma plataforma inteira para sua operação</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Cada ambiente foi desenhado para quem realmente usa: atendimento, cozinha, entrega e gestão.</p></Reveal>
            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {features.map(({ icon: Icon, title, text }, index) => (
                <Reveal as="article" key={title} delay={index * 45} className="group rounded-[28px] border border-violet-950/[.08] bg-white p-7 shadow-[0_14px_50px_rgba(41,19,67,.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_70px_rgba(91,33,182,.13)]">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-700 transition group-hover:scale-105"><Icon className="size-5" /></span>
                  <h3 className="mt-6 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p><span className="mt-6 inline-flex items-center gap-1.5 text-sm font-extrabold text-violet-700">Incluído na plataforma <ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="relative overflow-hidden bg-[#090412] py-24 sm:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,.16),transparent_34%)]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.22em] text-violet-400">Como funciona</p><h2 className="mt-4 text-balance font-display text-4xl font-black tracking-[-.04em] sm:text-5xl">Do primeiro produto cadastrado à entrega concluída</h2></Reveal>
            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {flow.map(([number, title, text], index) => (
                <Reveal key={number} delay={index * 60} className="relative overflow-hidden rounded-[26px] border border-violet-300/10 bg-white/[.035] p-6">
                  <div className="absolute -right-8 -top-8 size-28 rounded-full bg-violet-500/10 blur-2xl" /><span className="relative text-sm font-black text-violet-400">{number}</span><h3 className="relative mt-8 text-lg font-black">{title}</h3><p className="relative mt-2 text-sm leading-6 text-white/48">{text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="negocios" className="bg-[#f7f5fb] py-24 text-[#130b20] sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
              <Reveal><p className="text-xs font-black uppercase tracking-[.22em] text-violet-600">Flexível para sua rotina</p><h2 className="mt-4 text-balance font-display text-4xl font-black tracking-[-.04em] sm:text-5xl">Um motor, diferentes tipos de negócio</h2><p className="mt-5 max-w-lg leading-7 text-slate-600">O catálogo e a operação foram construídos para se adaptar ao comércio local sem transformar cada segmento em um sistema separado.</p></Reveal>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {segments.map((segment, index) => (
                  <Reveal key={segment} delay={index * 45} className="rounded-2xl border border-violet-950/[.08] bg-white p-5 shadow-[0_10px_35px_rgba(41,19,67,.05)]"><Store className="size-5 text-violet-600" /><h3 className="mt-4 font-black">{segment}</h3><p className="mt-1.5 text-xs leading-5 text-slate-500">Catálogo, pedidos e operação em um único ambiente.</p></Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="saas" className="relative overflow-hidden bg-[#06030d] py-24 sm:py-28">
          <div className="absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/18 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[36px] border border-violet-300/10 bg-gradient-to-br from-violet-950/60 via-[#10071e] to-[#090410] p-7 shadow-[0_40px_110px_rgba(88,28,135,.18)] sm:p-12 lg:grid lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-12">
              <Reveal><span className="inline-flex items-center gap-2 rounded-full bg-violet-400/10 px-3 py-1.5 text-xs font-extrabold text-violet-200"><ShieldCheck className="size-3.5" /> SaaS preparado para crescer</span><h2 className="mt-6 text-balance font-display text-4xl font-black tracking-[-.04em] sm:text-5xl">Sua operação profissional sem depender de improviso.</h2><p className="mt-5 max-w-2xl text-sm leading-7 text-white/52 sm:text-base">Multi-loja, permissões, auditoria, administração central, testes automatizados e monitoramento fazem parte da fundação técnica do produto.</p><div className="mt-8 flex flex-wrap gap-3">{["Multi-tenant", "RLS", "Quality Gate", "Smoke tests", "Observabilidade"].map((item) => <span key={item} className="rounded-full border border-violet-300/12 bg-white/[.035] px-3 py-2 text-xs font-bold text-white/65">{item}</span>)}</div></Reveal>
              <Reveal delay={100} className="mt-10 rounded-[28px] border border-violet-300/12 bg-black/20 p-6 lg:mt-0"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-400">Próximo passo</p><h3 className="mt-4 text-2xl font-black">Coloque sua loja no ar.</h3><p className="mt-3 text-sm leading-6 text-white/48">Crie a estrutura principal e configure cardápio, equipe, bairros e formas de pagamento dentro do painel.</p><Link to="/criar-loja" className="mt-7 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 text-sm font-black shadow-[0_14px_45px_rgba(124,58,237,.3)] transition hover:brightness-110 sm:w-auto">Criar minha loja <ArrowRight className="size-4" /></Link></Reveal>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[.07] bg-[#06030d] py-12">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-[1.35fr_.65fr_.65fr] lg:px-8">
          <div><BrandLogo lockup="horizontal" className="h-7 w-auto brightness-0 invert" /><p className="mt-4 max-w-sm text-sm leading-6 text-white/42">Tecnologia operacional para negócios locais venderem e trabalharem com mais organização.</p></div>
          <div><p className="text-xs font-black uppercase tracking-[.15em] text-white/30">Produto</p><div className="mt-4 grid gap-2.5 text-sm text-white/52"><a href="#recursos" className="hover:text-white">Recursos</a><a href="#como-funciona" className="hover:text-white">Como funciona</a><a href="#saas" className="hover:text-white">Plataforma</a></div></div>
          <div><p className="text-xs font-black uppercase tracking-[.15em] text-white/30">Acessos</p><div className="mt-4 grid gap-2.5 text-sm text-white/52"><Link to="/entrar/loja" search={{ retorno: undefined }} className="hover:text-white">Loja</Link><Link to="/entrar/entregador" search={{ retorno: undefined }} className="hover:text-white">Entregador</Link><Link to="/entrar/admin" search={{ retorno: undefined }} className="hover:text-white">Administração</Link></div></div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-white/[.06] px-4 pt-6 text-xs text-white/28 sm:px-6 lg:px-8">© {new Date().getFullYear()} Pediu Aqui. Todos os direitos reservados.</div>
      </footer>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="mx-auto w-full max-w-[380px] rotate-[2deg] rounded-[44px] border border-white/15 bg-[#0f0919] p-2.5 shadow-[0_35px_100px_rgba(0,0,0,.55),0_0_80px_rgba(124,58,237,.18)]">
      <div className="overflow-hidden rounded-[36px] border border-white/[.08] bg-[#0a0611]">
        <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4"><BrandLogo lockup="horizontal" className="h-5 w-auto brightness-0 invert" /><span className="rounded-full bg-violet-500/12 px-2.5 py-1 text-[10px] font-black text-violet-300">LOJA ABERTA</span></div>
        <div className="p-4">
          <div className="rounded-2xl border border-violet-400/12 bg-gradient-to-br from-violet-950/70 to-fuchsia-950/30 p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-300">Painel da loja</p><p className="mt-2 text-lg font-black">Operação em andamento</p><p className="mt-1 text-xs text-white/45">Pedidos, cozinha e entregas no mesmo fluxo.</p></div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {phoneTabs.map(({ icon: Icon, label }) => <div key={label} className="rounded-xl border border-white/[.07] bg-white/[.035] p-3 text-center"><Icon className="mx-auto size-4 text-violet-400" /><p className="mt-2 text-[10px] font-bold text-white/60">{label}</p></div>)}
          </div>
          <div className="mt-4 space-y-2.5">
            {phoneOrders.map(({ icon: Icon, title, status }, index) => <div key={title} className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3.5"><span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{title}</p><p className="mt-0.5 text-[10px] text-white/36">Fluxo operacional</p></div><span className={index === 0 ? "text-[10px] font-black text-amber-300" : "text-[10px] font-black text-violet-300"}>{status}</span></div>)}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border border-white/[.07] bg-black/20 p-2">
            {phoneNav.map((Icon, index) => <span key={index} className={index === 0 ? "flex h-10 items-center justify-center rounded-xl bg-violet-600 text-white" : "flex h-10 items-center justify-center rounded-xl text-white/35"}><Icon className="size-4" /></span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-[22px] border border-violet-300/12 bg-[#10091a]/90 p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)] backdrop-blur-xl"><span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/12 text-violet-300"><Icon className="size-4" /></span><p className="mt-3 text-[10px] font-black uppercase tracking-[.14em] text-white/30">{label}</p><p className="mt-1 text-sm font-extrabold text-white/78">{value}</p></div>;
}
