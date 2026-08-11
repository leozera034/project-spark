import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bike,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  LayoutDashboard,
  MenuSquare,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  [MenuSquare, "Cardápio digital", "Produtos, adicionais, categorias, fotos, disponibilidade e preços em um catálogo rápido para o cliente."],
  [ShoppingBag, "Pedidos organizados", "Chega de pedido perdido em conversa. Receba, confirme e acompanhe tudo em um fluxo único."],
  [UtensilsCrossed, "Cozinha em tempo real", "Uma visão operacional objetiva para preparar, priorizar e liberar pedidos sem ruído."],
  [Bike, "Gestão de entregas", "Distribua entregas, acompanhe o andamento e mantenha o time alinhado em cada etapa."],
  [BarChart3, "Relatórios úteis", "Acompanhe volume, ticket e desempenho sem precisar transformar sua operação em uma planilha."],
  [CreditCard, "Gestão da plataforma", "Planos, assinaturas e saúde da operação com administração centralizada."],
] as const;

const segments = [
  ["Restaurantes", "Operação completa do salão digital à cozinha."],
  ["Lanchonetes", "Velocidade para alto volume e pedidos recorrentes."],
  ["Pizzarias", "Cardápio com variações e adicionais sem confusão."],
  ["Bares", "Pedidos simples, entrega local e operação noturna."],
  ["Mercados", "Catálogo amplo com experiência de compra objetiva."],
] as const;

export function GlobalLanding() {
  return (
    <main className="pa-marketing min-h-screen overflow-x-hidden bg-[#071318] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#071318]/82 backdrop-blur-xl">
        <div className="pa-shell flex h-18 items-center justify-between gap-5">
          <Link to="/" aria-label="Pediu Aqui" className="shrink-0">
            <BrandLogo lockup="horizontal" className="h-7 w-auto brightness-0 invert" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-white/68 lg:flex">
            <a href="#recursos" className="transition hover:text-white">Recursos</a>
            <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
            <a href="#negocios" className="transition hover:text-white">Para negócios</a>
            <a href="#planos" className="transition hover:text-white">Planos</a>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><ThemeToggle /></div>
            <Link to="/entrar/loja" className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-white/6 hover:text-white sm:inline-flex">Entrar</Link>
            <Link to="/criar-loja" className="inline-flex items-center gap-2 rounded-xl bg-[#12d8c1] px-4 py-2.5 text-sm font-extrabold text-[#071318] shadow-[0_10px_36px_rgba(18,216,193,.22)] transition hover:-translate-y-.5 hover:bg-[#58ead9]">
              Começar agora <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="pa-grid-bg relative min-h-[820px] pt-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(18,216,193,.16),transparent_27%),radial-gradient(circle_at_14%_12%,rgba(18,216,193,.09),transparent_24%)]" />
        <div className="pa-shell relative grid items-center gap-14 py-20 lg:grid-cols-[.92fr_1.08fr] lg:py-28">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#12d8c1]/20 bg-[#12d8c1]/8 px-3 py-1.5 text-xs font-bold text-[#8ff5e9]">
              <Sparkles className="size-3.5" /> Feito para comércio local que quer crescer
            </div>
            <h1 className="pa-display text-[clamp(3.2rem,7vw,6.3rem)] font-bold leading-[.94]">
              Seu negócio,<br />mais pedidos,<br /><span className="text-[#12d8c1]">mais resultado.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[1.05rem] leading-7 text-white/66 sm:text-lg">
              Cardápio online, pedidos, cozinha, entregas e gestão em uma experiência única. Menos improviso na operação, mais clareza para vender.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/criar-loja" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#12d8c1] px-6 text-sm font-extrabold text-[#071318] transition hover:-translate-y-0.5 hover:bg-[#58ead9]">
                Criar minha loja <ArrowRight className="size-4" />
              </Link>
              <a href="#como-funciona" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/4 px-6 text-sm font-bold text-white transition hover:bg-white/8">
                Ver como funciona <ChevronRight className="size-4" />
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/55">
              <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#12d8c1]" /> Configuração guiada</span>
              <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#12d8c1]" /> Mobile-first</span>
              <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#12d8c1]" /> Suporte em português</span>
            </div>
          </div>

          <ProductVisual />
        </div>
      </section>

      <section id="recursos" className="bg-[#f7f5f0] py-24 text-[#071318] sm:py-30">
        <div className="pa-shell">
          <div className="mx-auto max-w-720px text-center">
            <p className="pa-eyebrow">Tudo em um só fluxo</p>
            <h2 className="pa-display mt-3 text-4xl font-bold sm:text-5xl">Uma plataforma inteira para gerenciar seu negócio</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#536166]">Do primeiro clique do cliente à entrega concluída. As áreas conversam entre si para a operação não depender de memória, papel ou mensagens soltas.</p>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map(([Icon, title, copy]) => (
              <article key={title} className="group rounded-[24px] border border-[#10272f]/9 bg-white p-7 shadow-[0_10px_40px_rgba(7,19,24,.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(7,19,24,.09)]">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-[#12d8c1]/10 text-[#0d9f91]"><Icon className="size-5" /></div>
                <h3 className="mt-6 text-lg font-extrabold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#667278]">{copy}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-[#0d9f91]">Conhecer recurso <ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-white/7 bg-[#0a1b21] py-16">
        <div className="pa-shell grid gap-5 md:grid-cols-4">
          {[
            ["01", "Crie a loja", "Cadastre a operação e personalize as informações principais."],
            ["02", "Monte o cardápio", "Organize categorias, produtos, preços e adicionais."],
            ["03", "Receba pedidos", "Cliente compra pelo celular e a equipe recebe tudo organizado."],
            ["04", "Opere e acompanhe", "Cozinha, entrega e relatórios trabalham no mesmo fluxo."],
          ].map(([n, title, copy]) => (
            <div key={n} className="rounded-3xl border border-white/8 bg-white/[.025] p-6">
              <span className="text-sm font-black text-[#12d8c1]">{n}</span>
              <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/52">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="negocios" className="bg-[#071318] py-24 sm:py-30">
        <div className="pa-shell">
          <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
            <div>
              <p className="pa-eyebrow">Flexível de verdade</p>
              <h2 className="pa-display mt-3 text-4xl font-bold sm:text-5xl">Feito para diferentes operações locais</h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-white/56">A base é a mesma, mas a experiência precisa funcionar para negócios com ritmos e catálogos diferentes.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {segments.map(([title, copy]) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-white/[.035] p-5">
                  <Store className="size-5 text-[#12d8c1]" />
                  <h3 className="mt-4 font-extrabold">{title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-white/48">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="planos" className="bg-[#f7f5f0] py-24 text-[#071318]">
        <div className="pa-shell">
          <div className="overflow-hidden rounded-[34px] bg-[#0b1c22] px-6 py-12 text-white shadow-[0_35px_90px_rgba(7,19,24,.18)] sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#12d8c1]/10 px-3 py-1.5 text-xs font-bold text-[#8ff5e9]"><Zap className="size-3.5" /> Próximo passo</span>
              <h2 className="pa-display mt-5 text-4xl font-bold sm:text-5xl">Transforme a operação antes de aumentar a complexidade.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">Comece com uma estrutura organizada e cresça sobre uma base que já conecta vendas, operação e entrega.</p>
            </div>
            <div className="mt-8 flex shrink-0 flex-col gap-3 lg:mt-0">
              <Link to="/criar-loja" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#12d8c1] px-7 text-sm font-extrabold text-[#071318] transition hover:bg-[#58ead9]">Começar agora <ArrowRight className="size-4" /></Link>
              <Link to="/entrar/loja" className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-white/14 px-7 text-sm font-bold text-white/78 transition hover:bg-white/6">Já tenho acesso</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/7 bg-[#071318] py-12">
        <div className="pa-shell grid gap-10 md:grid-cols-[1.3fr_.7fr_.7fr]">
          <div>
            <BrandLogo lockup="horizontal" className="h-7 w-auto brightness-0 invert" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/46">Uma operação mais organizada para negócios locais venderem com presença digital própria.</p>
          </div>
          <div><p className="text-xs font-black uppercase tracking-wider text-white/38">Produto</p><div className="mt-4 grid gap-2 text-sm text-white/58"><a href="#recursos">Recursos</a><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a></div></div>
          <div><p className="text-xs font-black uppercase tracking-wider text-white/38">Acesso</p><div className="mt-4 grid gap-2 text-sm text-white/58"><Link to="/entrar/loja">Loja</Link><Link to="/entrar/entregador">Entregador</Link><Link to="/entrar/admin">Administração</Link></div></div>
        </div>
        <div className="pa-shell mt-10 border-t border-white/7 pt-6 text-xs text-white/32">© {new Date().getFullYear()} Pediu Aqui. Todos os direitos reservados.</div>
      </footer>
    </main>
  );
}

function ProductVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[720px]">
      <div className="absolute -inset-10 rounded-full bg-[#12d8c1]/10 blur-3xl" />
      <div className="relative rounded-[30px] border border-white/10 bg-[#0b1c22] p-3 shadow-[0_38px_100px_rgba(0,0,0,.38)]">
        <div className="rounded-[22px] border border-white/8 bg-[#0d2128] p-4 sm:p-6">
          <div className="flex items-center justify-between border-b border-white/7 pb-4"><div><p className="text-xs text-white/38">Visão geral</p><p className="mt-1 font-bold">Operação Sabor Central</p></div><div className="rounded-xl bg-[#12d8c1] px-3 py-2 text-xs font-black text-[#071318]">Novo pedido</div></div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Pedidos hoje","128"],["Faturamento","R$ 2,6k"],["Em produção","8"],["Entregas","14"]].map(([l,v])=><div key={l} className="rounded-2xl border border-white/7 bg-white/[.025] p-4"><p className="text-[10px] uppercase tracking-wider text-white/34">{l}</p><p className="mt-2 text-lg font-extrabold">{v}</p><p className="mt-1 text-[10px] font-bold text-[#12d8c1]">operação ativa</p></div>)}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-2xl border border-white/7 bg-white/[.025] p-5"><div className="flex items-center justify-between"><p className="text-sm font-bold">Pedidos nas últimas horas</p><BarChart3 className="size-4 text-[#12d8c1]" /></div><div className="mt-8 flex h-28 items-end gap-2">{[28,45,36,65,54,78,62,86,74,96,81,100].map((h,i)=><span key={i} className="flex-1 rounded-t bg-[#12d8c1]/70" style={{height:`${h}%`}} />)}</div></div>
            <div className="rounded-2xl border border-white/7 bg-white/[.025] p-5"><p className="text-sm font-bold">Fila operacional</p><div className="mt-4 space-y-3">{[[PackageCheck,"#1842","Preparando"],[Bike,"#1841","Em rota"],[Clock3,"#1840","Aguardando"]].map(([Icon,n,s])=><div key={String(n)} className="flex items-center gap-3 rounded-xl bg-white/[.035] p-3"><div className="grid size-9 place-items-center rounded-xl bg-[#12d8c1]/10 text-[#12d8c1]"><Icon className="size-4" /></div><div><p className="text-xs font-extrabold">{n}</p><p className="text-[10px] text-white/38">{s}</p></div></div>)}</div></div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-8 -left-3 hidden w-52 rounded-[26px] border border-white/10 bg-[#0b1c22] p-3 shadow-[0_25px_70px_rgba(0,0,0,.42)] sm:block lg:-left-14">
        <div className="rounded-[18px] bg-[#f7f5f0] p-3 text-[#071318]"><div className="flex items-center justify-between"><p className="text-[10px] font-black">Cardápio</p><ShoppingBag className="size-3.5" /></div><div className="mt-3 rounded-xl bg-white p-3"><div className="h-16 rounded-lg bg-gradient-to-br from-[#12d8c1]/20 to-[#071318]/8"/><p className="mt-2 text-[10px] font-extrabold">Burger da casa</p><p className="mt-1 text-[9px] text-[#5d686c]">R$ 28,00</p></div></div>
      </div>
      <div className="absolute -right-3 top-18 hidden space-y-2 lg:block xl:-right-10">{[[LayoutDashboard,"Painel integrado"],[ShieldCheck,"Operação segura"],[Zap,"Fluxo rápido"]].map(([Icon,t])=><div key={String(t)} className="pa-glass flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold"><Icon className="size-4 text-[#12d8c1]" />{t}</div>)}</div>
    </div>
  );
}
