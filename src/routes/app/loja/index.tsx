import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Bike,
  ChefHat,
  ChevronRight,
  ClipboardList,
  Settings,
  ShoppingBag,
  Store,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/loja/")({
  head: () => ({
    meta: [
      { title: "Painel da loja | Pediu Aqui" },
      { name: "description", content: "Área autenticada da equipe da loja no Pediu Aqui." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreHome,
});

const shortcuts = [
  { to: "/app/loja/pedidos", icon: ClipboardList, title: "Pedidos", copy: "Acompanhe a fila e confirme novas vendas.", accent: true },
  { to: "/app/loja/cozinha", icon: ChefHat, title: "Cozinha", copy: "Organize preparo, prioridade e liberação." },
  { to: "/app/loja/entregadores", icon: Bike, title: "Entregadores", copy: "Equipe, disponibilidade e histórico." },
  { to: "/app/loja/cardapio", icon: ShoppingBag, title: "Cardápio", copy: "Categorias, produtos, preços e adicionais." },
  { to: "/app/loja/relatorios", icon: UtensilsCrossed, title: "Relatórios", copy: "Visão do movimento e da operação." },
  { to: "/app/loja/configuracoes/dados", icon: Settings, title: "Configurações", copy: "Dados, funcionamento e preferências." },
] as const;

function StoreHome() {
  const { authContext } = useAuth();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <section className="overflow-hidden rounded-[30px] border border-border/80 bg-carbon px-5 py-7 text-carbon-foreground shadow-e2 sm:px-8 sm:py-9 lg:flex lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-black text-brand">
            <Store className="size-3.5" /> Central da operação
          </div>
          <h1 className="pa-display mt-5 text-3xl font-bold leading-tight sm:text-4xl">
            Olá, {authContext?.full_name ?? "equipe"}.<br />O negócio inteiro começa daqui.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-carbon-foreground/55 sm:text-base">
            Use os atalhos abaixo para tocar pedidos, cozinha, entregadores e cardápio sem perder contexto entre as áreas.
          </p>
        </div>
        <div className="mt-7 grid shrink-0 grid-cols-2 gap-3 lg:mt-0 lg:w-[330px]">
          <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4">
            <p className="text-[10px] font-black uppercase tracking-[.12em] text-carbon-foreground/35">Ambiente</p>
            <p className="mt-2 text-sm font-extrabold">Loja</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4">
            <p className="text-[10px] font-black uppercase tracking-[.12em] text-carbon-foreground/35">Acesso</p>
            <p className="mt-2 truncate text-sm font-extrabold">{authContext?.roles.join(", ") || "Equipe"}</p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-brand">Acesso rápido</p>
            <h2 className="pa-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">O que você precisa fazer agora?</h2>
          </div>
          <Button asChild variant="outline" className="w-fit rounded-xl">
            <Link to="/app/loja/pedidos">Abrir fila de pedidos <ArrowRight className="size-4" /></Link>
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map(({ to, icon: Icon, title, copy, accent }) => (
            <Link
              key={to}
              to={to}
              className={`group relative overflow-hidden rounded-[24px] border p-6 shadow-[0_10px_32px_rgba(5,25,31,.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(5,25,31,.09)] ${accent ? "border-brand/25 bg-brand/8" : "border-border/80 bg-card"}`}
            >
              <div className={`grid size-11 place-items-center rounded-2xl ${accent ? "bg-brand text-brand-foreground" : "bg-brand/10 text-brand"}`}><Icon className="size-5" /></div>
              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{copy}</p>
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-brand" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[24px] border border-border/80 bg-card p-6">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-brand/10 text-brand"><Users className="size-5" /></div><div><h3 className="font-extrabold">Equipe alinhada</h3><p className="text-sm text-muted-foreground">Cada pessoa entra no ambiente correto e vê o que precisa operar.</p></div></div>
        </div>
        <div className="rounded-[24px] border border-border/80 bg-card p-6">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-brand/10 text-brand"><Store className="size-5" /></div><div><h3 className="font-extrabold">Seu negócio, seu fluxo</h3><p className="text-sm text-muted-foreground">A operação continua pertencendo à loja.</p></div></div>
        </div>
      </section>
    </main>
  );
}
