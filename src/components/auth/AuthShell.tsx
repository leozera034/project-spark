import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AuthShell({
  title,
  description,
  children,
  footer,
  tone = "calm",
  badge,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  tone?: "calm" | "operational";
  /** Rótulo do ambiente sendo acessado (loja, entregador, administração). */
  badge?: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-2">
      {/* Painel de marca — visível apenas em telas maiores */}
      <div className="relative hidden overflow-hidden bg-carbon px-12 py-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/3 size-[28rem] rounded-full bg-brand/25 blur-[110px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-16 size-[22rem] rounded-full bg-brand/15 blur-[100px]"
        />
        <div className="relative z-10">
          <BrandLogo lockup="horizontal" tone="white" className="h-8 w-auto" />
        </div>
        <div className="relative z-10 max-w-md space-y-4">
          <p className="font-display text-3xl font-semibold tracking-tight text-carbon-foreground">
            Toda a operação da sua loja, em um só lugar.
          </p>
          <p className="text-base text-carbon-foreground/70">
            Cardápio, pedidos, cozinha e entregas conectados em tempo real.
          </p>
        </div>
        <p className="relative z-10 text-xs text-carbon-foreground/50">
          © {new Date().getFullYear()} Pediu Aqui
        </p>
      </div>

      {/* Coluna de conteúdo */}
      <div
        className="flex min-h-dvh flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-6 lg:px-12"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-4">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link to="/" className="inline-flex" aria-label="Pediu Aqui, ir para o início">
              <BrandLogo lockup="horizontal" className="h-7 w-auto" />
            </Link>
          </div>

          <Link
            to="/"
            className="mb-6 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao início
          </Link>

          {badge ? (
            <Badge variant="brandSoft" className="mb-4 w-fit">
              {badge}
            </Badge>
          ) : null}

          <h1
            className={cn(
              "font-display tracking-tight text-foreground",
              tone === "operational" ? "text-3xl font-bold" : "text-2xl font-semibold",
            )}
          >
            {title}
          </h1>
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-8 text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
