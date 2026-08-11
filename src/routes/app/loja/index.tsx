import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bike,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/loja/")({
  head: () => ({
    meta: [
      { title: "Painel da loja | Pediu Aqui" },
      { name: "description", content: "Área autenticada da equipe da loja no Pediu Aqui." },
      { property: "og:title", content: "Painel da loja | Pediu Aqui" },
      { property: "og:description", content: "Área autenticada da equipe da loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreHome,
});

const modules = [
  {
    title: "Pedidos",
    description: "Receba, aceite e acompanhe o fluxo operacional da loja.",
    to: "/app/loja/pedidos",
    icon: ClipboardList,
    accent: "bg-info-soft text-info",
  },
  {
    title: "Cozinha",
    description: "Abra o modo produção para acompanhar preparo e tempo.",
    to: "/app/loja/cozinha",
    icon: ChefHat,
    accent: "bg-warning-soft text-warning",
  },
  {
    title: "Cardápio",
    description: "Gerencie categorias, produtos, variações e adicionais.",
    to: "/app/loja/cardapio",
    icon: UtensilsCrossed,
    accent: "bg-brand-soft text-brand-soft-foreground",
  },
  {
    title: "Entregadores",
    description: "Cadastre e acompanhe a equipe responsável pelas entregas.",
    to: "/app/loja/entregadores",
    icon: Bike,
    accent: "bg-success-soft text-success",
  },
  {
    title: "Relatórios",
    description: "Consulte entregas concluídas e dados derivados da operação.",
    to: "/app/loja/relatorios/entregas",
    icon: BarChart3,
    accent: "bg-highlight-soft text-highlight-soft-foreground",
  },
  {
    title: "Configurações",
    description: "Dados da loja, atendimento, horários, bairros e pagamentos.",
    to: "/app/loja/configuracoes",
    icon: Settings,
    accent: "bg-muted text-muted-foreground",
  },
] as const;

function StoreHome() {
  const { authContext } = useAuth();
  const roles = authContext?.roles ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-carbon px-5 py-7 text-carbon-foreground shadow-e2 sm:px-7 sm:py-8 lg:px-9">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-brand/14 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-brand/8 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="border border-brand/20 bg-brand/10 text-brand hover:bg-brand/10">
              <Sparkles className="mr-1.5 size-3.5" />
              Visão geral da operação
            </Badge>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Olá, {authContext?.full_name ?? "equipe"}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-carbon-foreground/55 sm:text-base">
              Use este painel como ponto de partida para pedidos, produção, cardápio, entregas e configuração da loja.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-carbon-foreground/45">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Ambiente: Loja</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              {roles.length ? roles.join(" · ") : "Acesso da equipe"}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">Atalhos</p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight">Sua operação em um só lugar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Entre direto no módulo que precisa usar agora.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link to="/app/loja/configuracoes/dados">
              Revisar dados da loja
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ title, description, to, icon: Icon, accent }) => (
            <Link
              key={to}
              to={to as never}
              className="group rounded-2xl border border-border bg-surface p-5 shadow-e1 transition-all hover:-translate-y-1 hover:border-brand/25 hover:shadow-e2 sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <span className={`flex size-11 items-center justify-center rounded-xl ${accent}`}>
                  <Icon className="size-5" />
                </span>
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                  <ArrowRight className="size-4" />
                </span>
              </div>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-e1 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
              <LayoutDashboard className="size-5" />
            </span>
            <div>
              <h2 className="font-bold">Fluxo recomendado do dia</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Uma sequência simples para manter a operação organizada.</p>
            </div>
          </div>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["1", "Confira pedidos", "Veja a fila e responda novos pedidos."],
              ["2", "Acompanhe a cozinha", "Mantenha produção e status sincronizados."],
              ["3", "Organize entregas", "Atribua os pedidos prontos à equipe."],
              ["4", "Revise o fechamento", "Consulte os dados operacionais disponíveis."],
            ].map(([number, title, text]) => (
              <li key={number} className="rounded-xl border border-border bg-background/70 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-carbon text-xs font-bold text-carbon-foreground">{number}</span>
                  <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-e1 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand">Configuração</p>
          <h2 className="mt-2 text-xl font-bold">Mantenha a loja pronta para vender</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Horários, bairros, formas de pagamento e identidade visual afetam diretamente a experiência do cliente.
          </p>
          <div className="mt-5 space-y-2">
            {[
              ["Dados da loja", "/app/loja/configuracoes/dados"],
              ["Horários", "/app/loja/configuracoes/horarios"],
              ["Atendimento", "/app/loja/configuracoes/atendimento"],
              ["Pagamentos", "/app/loja/configuracoes/pagamentos"],
            ].map(([label, to]) => (
              <Link key={to} to={to as never} className="flex items-center justify-between rounded-xl border border-border px-3.5 py-3 text-sm font-semibold transition-colors hover:border-brand/25 hover:bg-brand-soft/40">
                {label}
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
