import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bike,
  Bot,
  Check,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Mail,
  MapPinned,
  Megaphone,
  Menu,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Workflow,
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
  "Cardápio, pedidos, cozinha, entregas, CRM e automações em uma plataforma feita para o comércio local.";

export const Route = createFileRoute("/")({
  loader: () => listPublicPlans(),
  component: Home,
  head: () => ({
    meta: [
      { title: "Comandiva — operação, CRM e automação para o comércio local" },
      { name: "description", content: description },
      { property: "og:title", content: "Comandiva — operação, CRM e automação para o comércio local" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/brand/og-image-1200x630.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
  }),
});

type Feature = { icon: LucideIcon; title: string; text: string };
type ModuleStatus = "base" | "homologacao" | "implantacao";
type AutomationModule = {
  icon: LucideIcon;
  name: string;
  eyebrow: string;
  benefit: string;
  status: ModuleStatus;
};

const features: Feature[] = [
  {
    icon: Store,
    title: "Cardápio digital",
    text: "Catálogo mobile-first com categorias, adicionais, variações, identidade visual e operação por loja.",
  },
  {
    icon: ClipboardList,
    title: "Pedidos organizados",
    text: "Receba e acompanhe cada pedido em um fluxo único, sem depender de mensagens soltas ou planilhas paralelas.",
  },
  {
    icon: ChefHat,
    title: "Cozinha operacional",
    text: "Fila de produção objetiva, prioridade visual e ações claras para reduzir atraso e ruído na equipe.",
  },
  {
    icon: Bike,
    title: "Entregas próprias",
    text: "Cadastre entregadores, distribua corridas e acompanhe coleta, saída, ocorrências e conclusão.",
  },
  {
    icon: BarChart3,
    title: "CRM e crescimento",
    text: "Clientes, recorrência, segmentos e sinais de recompra conectados ao histórico real da operação.",
  },
  {
    icon: ShieldCheck,
    title: "SaaS multi-loja",
    text: "Papéis, permissões, isolamento de dados, auditoria e administração central fazem parte da fundação.",
  },
];

const highlights: Feature[] = [
  { icon: LayoutDashboard, title: "Operação integrada", text: "Uma visão única do negócio" },
  { icon: MessageCircle, title: "CRM + WhatsApp", text: "Relacionamento conectado à operação" },
  { icon: Workflow, title: "Automações modulares", text: "Ative recursos conforme crescer" },
  { icon: CreditCard, title: "Sem comissão por pedido", text: "Modelo SaaS previsível" },
];

const automationModules: AutomationModule[] = [
  {
    icon: MessageCircle,
    name: "WhatsApp Automático",
    eyebrow: "Atendimento e avisos",
    benefit: "Confirmações, status do pedido, campanhas e reativação com consentimento, templates e limites de uso.",
    status: "homologacao",
  },
  {
    icon: Bot,
    name: "Atendente IA",
    eyebrow: "Automação inteligente",
    benefit: "Apoio em dúvidas, vendas, triagem e respostas com contexto da loja, mantendo escalonamento para pessoas.",
    status: "implantacao",
  },
  {
    icon: BarChart3,
    name: "Growth Pro",
    eyebrow: "CRM e recompra",
    benefit: "Segmentos automáticos, clientes VIP, recorrentes e inativos para transformar histórico em próxima ação.",
    status: "base",
  },
  {
    icon: MapPinned,
    name: "Entrega Inteligente",
    eyebrow: "Logística",
    benefit: "Distância, ETA, roteirização e decisões de entrega conectadas a provedores de mapas sem prender o sistema a um único fornecedor.",
    status: "implantacao",
  },
  {
    icon: Star,
    name: "Reputação",
    eyebrow: "Relacionamento",
    benefit: "Pedir avaliações no momento certo, identificar clientes insatisfeitos e criar fluxos de recuperação.",
    status: "implantacao",
  },
  {
    icon: ReceiptText,
    name: "Fiscal",
    eyebrow: "Backoffice",
    benefit: "Camada preparada para emissão e acompanhamento fiscal por provedor homologado, sem misturar credenciais entre lojas.",
    status: "implantacao",
  },
  {
    icon: CreditCard,
    name: "Pagamentos",
    eyebrow: "Cobrança e recorrência",
    benefit: "Assinaturas, conciliação e automações financeiras com validação de provider, idempotência e webhooks.",
    status: "homologacao",
  },
  {
    icon: Megaphone,
    name: "Marketing Pro",
    eyebrow: "Campanhas",
    benefit: "Campanhas segmentadas, calendário e automações de relacionamento com consentimento e histórico por cliente.",
    status: "implantacao",
  },
  {
    icon: Sparkles,
    name: "Ads",
    eyebrow: "Aquisição",
    benefit: "Planejamento e acompanhamento de mídia paga conectado aos dados reais da operação e crescimento.",
    status: "implantacao",
  },
];

const flow = [
  ["01", "Crie a loja", "Configure os dados essenciais da operação."],
  ["02", "Monte o cardápio", "Organize produtos, categorias, preços e adicionais."],
  ["03", "Receba pedidos", "O pedido entra organizado para atendimento e cozinha."],
  ["04", "Automatize o crescimento", "CRM, comunicação e módulos entram conforme a operação evolui."],
] as const;

const segments = ["Restaurantes", "Lanchonetes", "Pizzarias", "Bares", "Mercados", "Conveniências"];

const integrationSignals = [
  { icon: ClipboardList, label: "CEP e CNPJ", detail: "cadastro mais rápido" },
  { icon: MessageCircle, label: "WhatsApp", detail: "assistido + automático" },
  { icon: CreditCard, label: "Pagamentos", detail: "recorrência e conciliação" },
  { icon: Bell, label: "Push", detail: "alertas operacionais" },
  { icon: Mail, label: "E-mail", detail: "transacional e lifecycle" },
  { icon: Bot, label: "IA", detail: "atendimento e automação" },
  { icon: MapPinned, label: "Mapas", detail: "rota, distância e ETA" },
  { icon: ReceiptText, label: "Fiscal", detail: "provedor desacoplado" },
];

function moduleStatus(status: ModuleStatus) {
  if (status === "base") return { label: "Já na base", className: "bg-[#E8F7EF] text-[#17663A]" };
  if (status === "homologacao") return { label: "Em homologação", className: "bg-[#FFF0DB] text-[#8A4A00]" };
  return { label: "Em implantação", className: "bg-[#F0EAF5] text-[#5C2A79]" };
}

function Home() {
  const plans = Route.useLoaderData();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    ["#recursos", "Recursos"],
    ["#automacoes", "Automações"],
    ["#como-funciona", "Como funciona"],
    ["#negocios", "Para negócios"],
    ["#planos", "Planos"],
  ] as const;

  return (
    <div className="min-h-dvh bg-[#FFF6F1] text-[#1C1C1E] selection:bg-[#FF6A4D]/25">
      <header className="sticky top-0 z-50 border-b border-[#4B1D6D]/10 bg-[#FFF6F1]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[82px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Comandiva — início" className="shrink-0">
            <BrandLogo lockup="horizontal" className="h-11 w-auto sm:h-12" />
          </Link>

          <nav className="ml-8 hidden flex-1 items-center gap-1 lg:flex" aria-label="Navegação principal">
            {navItems.map(([href, label]) => (
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
              {navItems.map(([href, label]) => (
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
                  <span className="size-2 rounded-full bg-[#FF6A4D]" /> Operação + CRM + automação
                </span>
              </Reveal>

              <Reveal delay={60}>
                <h1 className="mt-7 text-balance font-display text-[clamp(3rem,7vw,6rem)] font-extrabold leading-[.94] tracking-[-.055em] text-[#1C1C1E]">
                  Venda mais.<br />Opere melhor.<br />
                  <span className="text-[#4B1D6D]">Automatize o crescimento.</span>
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-[#625966] sm:text-lg">
                  Cardápio, pedidos, cozinha, entregas, CRM, WhatsApp e módulos inteligentes em uma plataforma única para o comércio local.
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
                  href="#automacoes"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#4B1D6D]/15 bg-white px-7 text-sm font-bold text-[#4B1D6D] shadow-sm transition hover:border-[#4B1D6D]/25 hover:bg-[#F7F0F8]"
                >
                  Ver automações <Workflow className="size-4" />
                </a>
              </Reveal>

              <Reveal delay={230} className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#6E6472]">
                <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#FF6A4D]" /> Sem comissão por pedido</span>
                <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#FF6A4D]" /> CRM conectado</span>
                <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#FF6A4D]" /> Módulos sob demanda</span>
              </Reveal>
            </div>

            <Reveal delay={100} className="relative mx-auto w-full max-w-[760px]">
              <div className="absolute -inset-8 rounded-[48px] bg-[#4B1D6D]/8 blur-3xl" />
              <div className="relative overflow-hidden rounded-[34px] border border-[#4B1D6D]/10 bg-white/70 p-3 shadow-[0_30px_80px_rgba(75,29,109,.14)] backdrop-blur-sm sm:p-4">
                <img
                  src="/brand/comandiva-hero-operations.webp"
                  alt="Comandiva conectando painel de gestão, operação e automações"
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
                O operacional primeiro. A inteligência por cima.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#706675]">
                O Comandiva organiza o trabalho diário e usa os mesmos dados para alimentar CRM, automações e novos módulos sem criar ilhas no sistema.
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
                    Base operacional <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
                  </span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="automacoes" className="relative overflow-hidden bg-[#281238] py-24 text-white sm:py-28">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:url('/brand/comandiva-pattern.svg')] [background-size:440px_auto]" />
          <div className="pointer-events-none absolute -left-28 top-24 size-[30rem] rounded-full bg-[#FF6A4D]/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-0 size-[32rem] rounded-full bg-[#8A7CA8]/20 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="max-w-4xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3.5 py-2 text-xs font-extrabold text-[#FFC2B4]">
                <Workflow className="size-3.5" /> Ecossistema Comandiva
              </span>
              <h2 className="mt-5 text-balance font-display text-4xl font-extrabold tracking-[-.04em] sm:text-5xl lg:text-6xl">
                Automações e módulos que fazem o trabalho pesado.
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-7 text-white/66">
                A plataforma cresce por módulos: você mantém uma operação simples e adiciona automação, inteligência e integrações conforme o negócio precisa.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {automationModules.map((module, index) => {
                const status = moduleStatus(module.status);
                const Icon = module.icon;
                return (
                  <Reveal
                    as="article"
                    key={module.name}
                    delay={index * 35}
                    className="group rounded-[28px] border border-white/10 bg-white/[.065] p-6 backdrop-blur-sm transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.09]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#FFC0B0]">
                        <Icon className="size-5" />
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-6 text-[11px] font-black uppercase tracking-[.14em] text-white/40">{module.eyebrow}</p>
                    <h3 className="mt-2 text-xl font-extrabold">{module.name}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/62">{module.benefit}</p>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className="mt-10 overflow-hidden rounded-[30px] border border-white/10 bg-white/[.055] p-6 sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF9C86]">Integrações por trás</p>
                  <h3 className="mt-3 font-display text-3xl font-extrabold tracking-[-.035em]">
                    Um conector pode mudar. Sua operação não precisa mudar junto.
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-white/60">
                    Cada integração entra com isolamento por loja, logs, timeout, retry, limites de uso e bloqueio de segurança. O Comandiva evita amarrar o produto a uma única API.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {integrationSignals.map(({ icon: Icon, label, detail }) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <Icon className="size-4 text-[#FFB09E]" />
                      <p className="mt-3 text-sm font-extrabold">{label}</p>
                      <p className="mt-1 text-xs text-white/45">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal className="mt-6 rounded-2xl border border-[#FFB09E]/15 bg-[#FF6A4D]/[.08] px-5 py-4 text-xs leading-5 text-white/58">
              <strong className="text-white">Status transparente:</strong> “Já na base” significa que a fundação funcional já existe; “Em homologação” indica integração sendo validada em ambiente de teste; “Em implantação” mostra módulos planejados no roadmap e ainda não vendidos como recurso pronto.
            </Reveal>
          </div>
        </section>

        <section id="como-funciona" className="relative overflow-hidden bg-[#4B1D6D] py-24 text-white sm:py-28">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:url('/brand/comandiva-pattern.svg')] [background-size:430px_auto]" />
          <div className="pointer-events-none absolute -right-20 top-0 size-[28rem] rounded-full bg-[#FF6A4D]/12 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#FFB09E]">Como funciona</p>
              <h2 className="mt-4 text-balance font-display text-4xl font-extrabold tracking-[-.04em] sm:text-5xl">
                Do primeiro produto cadastrado à operação que trabalha com você.
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
                  Um motor, diferentes tipos de negócio.
                </h2>
                <p className="mt-5 max-w-lg leading-7 text-[#706675]">
                  A operação se adapta ao comércio local sem transformar cada segmento em um sistema separado — e os módulos aproveitam os mesmos dados.
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
                    <p className="mt-1.5 text-xs leading-5 text-[#776D7B]">Catálogo, pedidos, CRM e operação em um único ambiente.</p>
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
                  Simples para a loja. Estruturado por baixo.
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-[#6F6573] sm:text-base">
                  Multi-loja, permissões, auditoria, medição de uso, filas de automação e administração central sustentam os módulos sem transformar a rotina em uma tela técnica.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {["Multi-tenant", "RLS", "Permissões", "Auditoria", "Usage limits", "Automation jobs", "Provider health"].map((item) => (
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
              Comece pela operação. Ative inteligência conforme crescer.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/66 sm:text-base">
              Uma plataforma para organizar a loja hoje e incorporar CRM, automações e integrações sem trocar de sistema amanhã.
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
              Tecnologia operacional, CRM e automação para negócios locais venderem e trabalharem com mais organização.
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.15em] text-white/45">Produto</p>
            <div className="mt-4 grid gap-2.5 text-sm text-white/68">
              <a href="#recursos" className="hover:text-white">Recursos</a>
              <a href="#automacoes" className="hover:text-white">Automações</a>
              <a href="#como-funciona" className="hover:text-white">Como funciona</a>
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
