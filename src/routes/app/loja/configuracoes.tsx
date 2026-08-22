import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreConfigProvider, useStoreConfig } from "@/store-config/StoreConfigProvider";

export const Route = createFileRoute("/app/loja/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações da loja | Comandiva" },
      {
        name: "description",
        content: "Configure dados, operação, entrega, pagamentos e conta da sua loja.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <StoreConfigProvider>
      <ConfiguracoesLayout />
    </StoreConfigProvider>
  ),
});

function ConfiguracoesLayout() {
  const { stores, selectionRequired, setStoreId, isLoading, error, configuration, operational } = useStoreConfig();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRoot = pathname === "/app/loja/configuracoes" || pathname === "/app/loja/configuracoes/";

  if (selectionRequired) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <h1 className="text-xl font-semibold text-foreground">Escolha a loja</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sua conta tem acesso a mais de uma loja. Selecione qual deseja configurar.</p>
        <ul className="mt-6 space-y-2">
          {stores.map((store) => (
            <li key={store.id}>
              <Button variant="outline" className="h-auto w-full justify-start py-4 text-left" onClick={() => setStoreId(store.id)}>
                <span className="font-medium">{store.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {!isRoot ? (
            <Link to="/app/loja/configuracoes" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Todas as configurações
            </Link>
          ) : null}
          <h1 className="font-display text-3xl font-black tracking-tight text-foreground">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isLoading ? "Carregando…" : (configuration?.store.name ?? "Sua loja")}</p>
        </div>
        {operational ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Badge variant={operational.is_open ? "success" : "secondary"}>{operational.is_open ? "Aberta agora" : "Fechada agora"}</Badge>
            <span className="text-xs text-muted-foreground">
              {operational.is_open
                ? operational.closes_at ? `Fecha às ${operational.closes_at}` : null
                : operational.next_open_at ? `Abre ${operational.next_open_day} às ${operational.next_open_at}` : "Sem horários configurados"}
            </span>
          </div>
        ) : null}
      </header>

      <div className="mt-6">
        {error ? (
          <Alert variant="destructive"><AlertTitle>Não foi possível carregar as configurações</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
        ) : isLoading ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-32 w-full" /></div>
        ) : (
          <Outlet />
        )}
      </div>
    </main>
  );
}
