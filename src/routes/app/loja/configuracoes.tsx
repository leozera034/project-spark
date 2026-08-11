import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { Clock3, CreditCard, MapPin, Palette, Settings2, Store, Truck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { StoreConfigProvider, useStoreConfig } from "@/store-config/StoreConfigProvider";

const SECTIONS = [
  { to: "/app/loja/configuracoes/dados", label: "Dados da loja", icon: Store },
  { to: "/app/loja/configuracoes/identidade", label: "Identidade", icon: Palette },
  { to: "/app/loja/configuracoes/horarios", label: "Horários", icon: Clock3 },
  { to: "/app/loja/configuracoes/atendimento", label: "Atendimento", icon: Truck },
  { to: "/app/loja/configuracoes/bairros", label: "Bairros e taxas", icon: MapPin },
  { to: "/app/loja/configuracoes/pagamentos", label: "Pagamentos", icon: CreditCard },
] as const;

export const Route = createFileRoute("/app/loja/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações da loja | Pediu Aqui" },
      { name: "description", content: "Configure dados, identidade, horários, atendimento, bairros e formas de pagamento da sua loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <StoreConfigProvider><ConfiguracoesLayout /></StoreConfigProvider>,
});

function ConfiguracoesLayout() {
  const { stores, selectionRequired, setStoreId, isLoading, error, configuration, operational } = useStoreConfig();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (selectionRequired) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-[26px] border border-border/80 bg-card p-6 shadow-[0_16px_48px_rgba(4,24,30,.06)] sm:p-8">
          <div className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand"><Settings2 className="size-5" /></div>
          <h1 className="pa-display mt-5 text-2xl font-bold">Escolha a loja</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Sua conta tem acesso a mais de uma operação. Selecione qual deseja configurar.</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {stores.map((store) => <li key={store.id}><Button variant="outline" className="h-auto w-full justify-start rounded-2xl px-4 py-4 text-left" onClick={() => setStoreId(store.id)}><Store className="mr-3 size-4 text-brand" /><span className="font-extrabold">{store.name}</span></Button></li>)}
          </ul>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <section className="rounded-[26px] border border-border/80 bg-card p-5 shadow-[0_12px_36px_rgba(4,24,30,.05)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-brand">Preferências</p>
            <h1 className="pa-display mt-2 text-3xl font-bold tracking-tight">Configurações</h1>
            <p className="mt-2 text-sm text-muted-foreground">{isLoading ? "Carregando…" : (configuration?.store.name ?? "Sua loja")}</p>
          </div>
          {operational ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/80 bg-muted/30 px-4 py-3">
              <Badge variant={operational.is_open ? "default" : "secondary"}>{operational.is_open ? "Aberta agora" : "Fechada agora"}</Badge>
              <span className="text-xs font-medium text-muted-foreground">{operational.is_open ? operational.closes_at ? `Fecha às ${operational.closes_at}` : null : operational.next_open_at ? `Abre ${operational.next_open_day} às ${operational.next_open_at}` : "Sem horários configurados"}</span>
            </div>
          ) : null}
        </div>
      </section>

      <nav aria-label="Seções de configuração" className="rail mt-5 -mx-4 px-4 sm:-mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2 rounded-2xl border border-border/80 bg-card p-1.5 shadow-[0_8px_24px_rgba(4,24,30,.04)]">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = pathname.startsWith(section.to);
            return <li key={section.to}><Link to={section.to} className={cn("inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition", active ? "bg-carbon text-carbon-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" />{section.label}</Link></li>;
          })}
        </ul>
      </nav>

      <div className="mt-5">
        {error ? <Alert variant="destructive" className="rounded-2xl"><AlertTitle>Não foi possível carregar as configurações</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : isLoading ? <div className="rounded-[24px] border border-border/80 bg-card p-6"><div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-32 w-full" /></div></div> : <Outlet />}
      </div>
    </main>
  );
}
