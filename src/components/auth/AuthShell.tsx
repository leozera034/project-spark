import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ShieldCheck, Sparkles } from "lucide-react";
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
    <main className="flex min-h-dvh flex-col bg-[#fbfaff] lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#07030f] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_34%,rgba(124,58,237,.28),transparent_30%),radial-gradient(circle_at_88%_80%,rgba(217,70,239,.16),transparent_28%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:52px_52px]" />

        <div className="relative z-10">
          <BrandLogo lockup="horizontal" tone="white" className="h-8 w-auto" />
        </div>

        <div className="relative z-10 max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/10 px-3 py-1.5 text-xs font-extrabold text-violet-200">
            <Sparkles className="size-3.5" /> Operação digital profissional
          </span>
          <h2 className="mt-6 text-balance font-display text-4xl font-black leading-[1.02] tracking-[-.04em]">
            Toda a operação da sua loja, em um só lugar.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/56">
            Cardápio, pedidos, cozinha, entregas e administração conectados em uma experiência feita para a rotina real.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-white/58">
            <span className="inline-flex items-center gap-2"><Check className="size-4 text-violet-400" /> Acesso por perfil e função</span>
            <span className="inline-flex items-center gap-2"><Check className="size-4 text-violet-400" /> Dados isolados por loja</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-violet-400" /> Segurança aplicada no banco</span>
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/32">© {new Date().getFullYear()} Pediu Aqui</p>
      </div>

      <div
        className="relative flex min-h-dvh flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-6 lg:px-12"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet-200/35 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-4">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link to="/" className="inline-flex" aria-label="Pediu Aqui, ir para o início">
              <BrandLogo lockup="horizontal" className="h-7 w-auto" />
            </Link>
          </div>

          <Link
            to="/"
            className="mb-6 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm text-slate-500 underline-offset-4 hover:text-violet-700 hover:underline focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao início
          </Link>

          {badge ? (
            <span className="mb-4 inline-flex w-fit items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-700">
              {badge}
            </span>
          ) : null}

          <h1
            className={cn(
              "font-display tracking-tight text-[#160c25]",
              tone === "operational" ? "text-3xl font-black" : "text-3xl font-black",
            )}
          >
            {title}
          </h1>
          {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}

          <div className="mt-8 rounded-[26px] border border-violet-950/[.07] bg-white p-6 shadow-[0_24px_70px_rgba(76,29,149,.08)] sm:p-7">
            {children}
          </div>

          {footer ? <div className="mt-8 text-sm text-slate-500">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
