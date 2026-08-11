import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo, BrandSymbol } from "@/components/brand/BrandLogo";

export function AuthShell({
  title,
  description,
  children,
  footer,
  tone = "calm",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  tone?: "calm" | "operational";
}) {
  return (
    <main className="min-h-svh bg-carbon text-carbon-foreground lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
      <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:min-h-svh lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-28 -top-24 size-[32rem] rounded-full bg-brand/15 blur-3xl" />
          <div className="absolute bottom-[-10rem] right-[-7rem] size-[30rem] rounded-full bg-brand/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:42px_42px]" />
        </div>

        <Link to="/" className="relative inline-flex w-fit" aria-label="Pediu Aqui, ir para o início">
          <BrandLogo lockup="horizontal" className="h-9 w-auto" />
        </Link>

        <div className="relative max-w-xl py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
            <Sparkles className="size-3.5" />
            Operação simples, ponta a ponta
          </span>
          <h2 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight xl:text-5xl">
            Tudo que sua operação precisa, sem virar uma bagunça.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-carbon-foreground/65">
            Cardápio, pedidos, cozinha, entrega e gestão em uma experiência única, pensada para o
            ritmo real do comércio local.
          </p>

          <div className="mt-8 grid gap-3 text-sm text-carbon-foreground/75 sm:grid-cols-2">
            <span className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
              <CheckCircle2 className="size-4 text-brand" />
              Fluxos objetivos
            </span>
            <span className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
              <ShieldCheck className="size-4 text-brand" />
              Dados isolados por loja
            </span>
          </div>
        </div>

        <p className="relative text-xs text-carbon-foreground/40">
          Pediu Aqui · tecnologia para operação própria da loja
        </p>
      </section>

      <section className="relative flex min-h-svh flex-col bg-background text-foreground">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--color-brand)_12%,transparent),transparent_62%)]" />
        <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:justify-center lg:px-10 lg:py-12">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" className="inline-flex" aria-label="Pediu Aqui, ir para o início">
              <BrandLogo lockup="horizontal" className="h-8 w-auto" />
            </Link>
            <Link
              to="/"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-background/80 text-muted-foreground shadow-e1 backdrop-blur-sm transition-colors hover:text-foreground"
              aria-label="Voltar ao início"
            >
              <ArrowLeft className="size-4" />
            </Link>
          </div>

          <div className="panel-raised w-full p-5 sm:p-7 lg:p-8">
            <div className="mb-7 flex items-start gap-3">
              <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground sm:flex">
                <BrandSymbol className="size-6" />
              </div>
              <div className="min-w-0">
                <h1
                  className={
                    tone === "operational"
                      ? "text-3xl font-bold leading-tight tracking-tight text-foreground"
                      : "text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
                  }
                >
                  {title}
                </h1>
                {description ? (
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
                ) : null}
              </div>
            </div>

            <div>{children}</div>
          </div>

          {footer ? (
            <div className="mt-6 px-1 text-center text-sm leading-6 text-muted-foreground">{footer}</div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
