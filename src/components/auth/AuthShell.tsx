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
    <main className="relative min-h-dvh overflow-hidden bg-[#FFF6F1] text-[#1C1C1E] lg:grid lg:grid-cols-[1.04fr_.96fr]">
      <div className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_16%_12%,rgba(255,106,77,.19),transparent_26rem),linear-gradient(145deg,#4B1D6D_0%,#35114F_100%)] px-12 py-12 text-[#FFF6F1] lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="pointer-events-none absolute -bottom-36 -right-28 size-[30rem] rounded-full border border-[#FF6A4D]/20" />
        <div className="pointer-events-none absolute -bottom-20 -right-8 size-[20rem] rounded-full border border-[#8A7CA8]/20" />

        <BrandLogo lockup="horizontal" tone="white" className="relative h-11 w-auto" />

        <div className="relative grid items-center gap-10 xl:grid-cols-[1fr_.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.08] px-3.5 py-2 text-xs font-extrabold text-[#FFD1C7]">
              <Sparkles className="size-3.5" /> Operação digital profissional
            </span>
            <h2 className="mt-6 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-[-.035em]">
              Tudo que sua loja precisa, perto de você.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/68">
              Cardápio, pedidos, cozinha, entregas e administração conectados em uma experiência simples e rápida.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-white/72">
              <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#FF8D76]" /> Acesso por perfil e função</span>
              <span className="inline-flex items-center gap-2"><Check className="size-4 text-[#FF8D76]" /> Dados isolados por loja</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-[#FF8D76]" /> Segurança aplicada no banco</span>
            </div>
          </div>
          <img
            src="/brand/comandiva-symbol.png"
            alt="Símbolo Comandiva"
            className="mx-auto w-full max-w-[260px] opacity-95 drop-shadow-[0_28px_70px_rgba(0,0,0,.22)]"
          />
        </div>

        <p className="relative text-xs text-white/42">© {new Date().getFullYear()} Comandiva</p>
      </div>

      <div
        className="relative flex min-h-dvh flex-col overflow-y-auto bg-[radial-gradient(circle_at_90%_4%,rgba(138,124,168,.13),transparent_22rem),#FFF6F1] px-4 py-8 sm:px-6 lg:px-12"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[#FF6A4D]/10 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-4">
          <div className="mb-7 flex items-center justify-between lg:hidden">
            <Link to="/" className="inline-flex" aria-label="Comandiva, ir para o início">
              <BrandLogo lockup="horizontal" className="h-10 w-auto" />
            </Link>
          </div>

          <Link
            to="/"
            className="mb-6 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-[#6F6376] underline-offset-4 transition hover:text-[#4B1D6D] hover:underline focus-visible:ring-2 focus-visible:ring-[#FF6A4D] focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao início
          </Link>

          {badge ? (
            <span className="mb-4 inline-flex w-fit items-center rounded-full border border-[#4B1D6D]/10 bg-[#4B1D6D]/[.07] px-3 py-1.5 text-xs font-extrabold text-[#4B1D6D]">
              {badge}
            </span>
          ) : null}

          <h1 className={cn("font-display tracking-tight text-[#4B1D6D]", tone === "operational" ? "text-3xl font-extrabold" : "text-3xl font-extrabold")}>{title}</h1>
          {description ? <p className="mt-2 text-sm leading-6 text-[#6F6376]">{description}</p> : null}

          <div className="mt-8 rounded-[28px] border border-[#4B1D6D]/10 bg-white p-6 shadow-[0_24px_70px_rgba(75,29,109,.10)] sm:p-7">
            {children}
          </div>

          {footer ? <div className="mt-8 text-sm text-[#786D7B]">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
