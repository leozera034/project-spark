import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
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
  badge?: string;
}) {
  return (
    <main
      data-ui-release="comandiva-auth-redesign-2026-08-20-v2"
      className="relative min-h-dvh overflow-hidden bg-[#FCFAF8] text-[#17131C] lg:grid lg:grid-cols-[.9fr_1.1fr]"
    >
      <aside className="relative hidden overflow-hidden border-r border-[#EAE5ED] bg-[#F7F2F8] px-12 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute -left-24 top-24 size-80 rounded-full bg-[#55207A]/8 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-12 size-72 rounded-full bg-[#FF681F]/10 blur-3xl" />
        <div className="pointer-events-none absolute right-[-9rem] top-[-9rem] size-[28rem] rounded-full border border-[#FF681F]/10" />
        <div className="pointer-events-none absolute right-[-5rem] top-[-5rem] size-[20rem] rounded-full border border-[#55207A]/8" />

        <Link to="/" className="relative inline-flex w-fit" aria-label="Comandiva, ir para o início">
          <BrandLogo lockup="horizontal" className="h-10 w-auto" />
        </Link>

        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#55207A]/10 bg-white px-3.5 py-2 text-xs font-extrabold text-[#55207A] shadow-sm">
            <Sparkles className="size-3.5 text-[#FF681F]" /> Operação simples por fora
          </span>
          <h2 className="mt-6 text-balance font-display text-5xl font-extrabold leading-[1.02] tracking-[-.045em] text-[#1B0D2C]">
            Cardápio, pedidos, cozinha e entregas conectados.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#69626E]">
            Entre para acompanhar sua loja em uma experiência clara, rápida e feita para a rotina do comércio local.
          </p>
          <div className="mt-8 grid gap-3 text-sm font-semibold text-[#55207A]">
            {[
              "Pedidos organizados em um só fluxo",
              "Equipe acompanhando a mesma operação",
              "Informações da loja fáceis de encontrar",
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-full bg-[#FFF0E8] text-[#FF681F]">
                  <Check className="size-3.5" />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-[#8B828E]">© {new Date().getFullYear()} Comandiva</p>
      </aside>

      <section
        className="relative flex min-h-dvh flex-col overflow-y-auto bg-[radial-gradient(circle_at_100%_0%,rgba(255,104,31,.08),transparent_23rem),radial-gradient(circle_at_0%_100%,rgba(85,32,122,.06),transparent_22rem),#FCFAF8] px-4 sm:px-6 lg:px-12 xl:px-16"
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="pointer-events-none absolute right-[-8rem] top-[-8rem] size-[24rem] rounded-full border border-[#FF681F]/8" />
        <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-3 sm:py-8">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" className="inline-flex" aria-label="Comandiva, ir para o início">
              <BrandLogo lockup="horizontal" className="h-9 w-auto sm:h-10" />
            </Link>
          </div>

          <Link
            to="/"
            className="mb-7 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl px-1 text-sm font-extrabold text-[#55207A] transition hover:text-[#431861] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF681F]/40"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao início
          </Link>

          {badge ? (
            <span className="mb-5 inline-flex w-fit items-center rounded-full border border-[#55207A]/12 bg-[#F2EAF5] px-3.5 py-2 text-xs font-extrabold text-[#55207A] shadow-sm">
              {badge}
            </span>
          ) : null}

          <h1
            className={cn(
              "font-display font-extrabold tracking-[-.045em] text-[#55207A]",
              tone === "operational" ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-md text-base leading-7 text-[#69626E] sm:text-lg">{description}</p>
          ) : null}

          <div className="mt-8 rounded-[26px] border border-[#EAE5ED] bg-white p-5 shadow-[0_18px_55px_rgba(27,13,44,.08)] sm:p-7">
            {children}
          </div>

          {footer ? <div className="mt-7 text-sm text-[#69626E]">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
