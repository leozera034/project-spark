import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { StoreConfigProvider, useStoreConfig } from "@/store-config/StoreConfigProvider";

const SECTIONS = [
  { to: "/app/loja/configuracoes/dados", label: "Dados da loja" },
  { to: "/app/loja/configuracoes/identidade", label: "Identidade" },
  { to: "/app/loja/configuracoes/horarios", label: "Horários" },
  { to: "/app/loja/configuracoes/atendimento", label: "Atendimento" },
  { to: "/app/loja/configuracoes/bairros", label: "Bairros e taxas" },
  { to: "/app/loja/configuracoes/pagamentos", label: "Pagamentos" },
] as const;

export const Route = createFileRoute("/app/loja/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações da loja | Pediu Aqui" },
      {
        name: "description",
        content:
          "Configure dados, identidade, horários, atendimento, bairros e formas de pagamento da sua loja.",
      },
      { property: "og:title", content: "Configurações da loja | Pediu Aqui" },
      {
        property: "og:description",
        content: "Área de configuração da loja no Pediu Aqui.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const { stores, selectionRequired, setStoreId, isLoading, error, configuration, operational } =
    useStoreConfig();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (selectionRequired) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <h1 className="text-xl font-semibold text-foreground">Escolha a loja</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta tem acesso a mais de uma loja. Selecione qual deseja configurar.
        </p>
        <ul className="mt-6 space-y-2">
          {stores.map((store) => (
            <li key={store.id}>
              <Button
                variant="outline"
                className="h-auto w-full justify-start py-4 text-left"
                onClick={() => setStoreId(store.id)}
              >
                <span className="font-medium">{store.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : (configuration?.store.name ?? "Sua loja")}
          </p>
        </div>
        {operational ? (
          <div className="flex items-center gap-2">
            <Badge variant={operational.is_open ? "default" : "secondary"}>
              {operational.is_open ? "Aberta agora" : "Fechada agora"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {operational.is_open
                ? operational.closes_at
                  ? `Fecha às ${operational.closes_at}`
                  : null
                : operational.next_open_at
                  ? `Abre ${operational.next_open_day} às ${operational.next_open_at}`
                  : "Sem horários configurados"}
            </span>
          </div>
        ) : null}
      </header>

      <nav aria-label="Seções de configuração" className="mt-6 -mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-2 border-b border-border pb-px">
          {SECTIONS.map((section) => {
            const active = pathname.startsWith(section.to);
            return (
              <li key={section.to}>
                <Link
                  to={section.to}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-t-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar as configurações</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </main>
  );
}
