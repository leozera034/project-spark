import { Link } from "@tanstack/react-router";
import { ArrowLeft, Compass, Home } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

/** Página 404 global da Comandiva. */
export function NotFoundPage() {
  return (
    <main
      id="conteudo"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-5 py-16"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"
      />

      <div className="rise-in relative w-full max-w-lg text-center">
        <div>
          <Link
            to="/"
            className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Comandiva — ir para a página inicial"
          >
            <BrandLogo lockup="horizontal" className="h-7 w-auto" />
          </Link>
        </div>

        <div className="mt-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Erro 404
          </p>
        </div>

        <h1 className="mt-5 text-[clamp(2.5rem,10vw,4.5rem)] font-bold leading-none tracking-tight text-foreground">
          Página não encontrada
        </h1>

        <p className="mx-auto mt-4 max-w-md text-pretty text-base text-muted-foreground">
          O endereço que você abriu não existe, mudou de lugar ou o link está incompleto.
          Se era o link de uma loja, confira se ele foi copiado por inteiro.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
            <Link to="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              Voltar à página inicial
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar à página anterior
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Se o problema continuar, volte ao início e abra a loja novamente.
        </p>
      </div>
    </main>
  );
}
