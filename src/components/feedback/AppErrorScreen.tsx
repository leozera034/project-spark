import { Link } from "@tanstack/react-router";
import { AlertTriangle, Home, RefreshCw, WifiOff } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

export type AppErrorKind = "network" | "session" | "stale_build" | "unexpected";

/**
 * Classificação da falha a partir do erro real. Não mascara nada:
 * apenas escolhe a explicação correta e a ação que resolve cada causa.
 */
export function classifyAppError(error: unknown): AppErrorKind {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  // Deploy novo com chunks antigos em cache: o navegador falha ao importar o módulo.
  if (
    normalized.includes("importing a module script failed") ||
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("error loading dynamically imported module") ||
    normalized.includes("'text/html' is not a valid javascript mime type")
  ) {
    return "stale_build";
  }
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed") ||
    normalized.includes("offline")
  ) {
    return "network";
  }
  if (
    normalized.includes("unauthorized") ||
    normalized.includes("jwt") ||
    normalized.includes("401") ||
    normalized.includes("sessão") ||
    normalized.includes("session")
  ) {
    return "session";
  }
  return "unexpected";
}

const COPY: Record<AppErrorKind, { title: string; body: string; action: string }> = {
  network: {
    title: "Sem conexão com a internet",
    body: "Não conseguimos falar com o servidor. Verifique sua rede e tente de novo — nada do que você fez foi perdido.",
    action: "Tentar de novo",
  },
  session: {
    title: "Sua sessão expirou",
    body: "Por segurança, encerramos o acesso após um período sem uso. Entre novamente para continuar de onde parou.",
    action: "Recarregar",
  },
  stale_build: {
    title: "Atualizando o aplicativo",
    body: "Uma versão nova do Pediu Aqui foi publicada e o seu navegador ainda tem a versão antiga em cache. Vamos recarregar para aplicar a atualização.",
    action: "Recarregar agora",
  },
  unexpected: {
    title: "Algo deu errado por aqui",
    body: "A falha foi registrada e a nossa equipe consegue investigar. Você pode tentar de novo ou voltar ao início.",
    action: "Tentar de novo",
  },
};

/**
 * Recarrega uma única vez quando a causa é build desatualizado.
 * O guarda em sessionStorage evita laço infinito de reload.
 */
export function recoverFromStaleBuild(): boolean {
  if (typeof window === "undefined") return false;
  const KEY = "pediu-aqui:stale-build-reload";
  try {
    if (window.sessionStorage.getItem(KEY)) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function AppErrorScreen({
  kind = "unexpected",
  onRetry,
  detail,
}: {
  kind?: AppErrorKind;
  onRetry?: () => void;
  detail?: string;
}) {
  const copy = COPY[kind];
  const Icon = kind === "network" ? WifiOff : kind === "stale_build" ? RefreshCw : AlertTriangle;

  return (
    <main
      id="conteudo"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-5 py-16"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand/12 blur-3xl"
      />
      <div className="relative w-full max-w-md text-center">
        <Link
          to="/"
          className="inline-flex rounded-lg"
          aria-label="Pediu Aqui — ir para a página inicial"
        >
          <BrandLogo lockup="horizontal" className="h-7 w-auto" />
        </Link>

        <div className="mt-10 inline-flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {copy.title}
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {copy.body}
        </p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            size="lg"
            variant="brand"
            className="w-full sm:w-auto"
            onClick={() => {
              if (onRetry) onRetry();
              else if (typeof window !== "undefined") window.location.reload();
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {copy.action}
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link to="/">
              <Home className="size-4" aria-hidden="true" />
              Ir para o início
            </Link>
          </Button>
        </div>

        {detail ? (
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Detalhes técnicos
            </summary>
            <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-border bg-surface-muted p-3 text-left text-[11px] leading-relaxed text-muted-foreground">
              {detail}
            </pre>
          </details>
        ) : null}
      </div>
    </main>
  );
}
