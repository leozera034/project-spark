import { Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";

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
  const operational = tone === "operational";

  return (
    <main className="pa-auth">
      <section className="pa-auth-visual">
        <Link to="/" className="relative z-10 inline-flex w-fit" aria-label="Pediu Aqui, ir para o início">
          <BrandLogo lockup="horizontal" className="h-8 w-auto brightness-0 invert" />
        </Link>

        <div className="pa-auth-copy py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#12d8c1]/20 bg-[#12d8c1]/8 px-3 py-1.5 text-xs font-extrabold text-[#8ff5e9]">
            {operational ? <Zap className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {operational ? "Acesso operacional" : "Sua operação em um só lugar"}
          </div>
          <h2 className="pa-display mt-6 max-w-xl text-4xl font-bold leading-[1.02] sm:text-5xl">
            Menos ruído na rotina.<br /><span className="text-[#12d8c1]">Mais controle no negócio.</span>
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-6 text-white/55 sm:text-base">
            Entre para acompanhar pedidos, equipe, cozinha, entregas e indicadores em uma experiência construída para funcionar bem no celular e no computador.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              [ShieldCheck, "Acesso protegido"],
              [BadgeCheck, "Papéis e permissões"],
              [Zap, "Operação rápida"],
            ].map(([Icon, label]) => (
              <div key={String(label)} className="rounded-2xl border border-white/8 bg-white/[.035] p-4">
                <Icon className="size-4 text-[#12d8c1]" />
                <p className="mt-3 text-xs font-bold text-white/72">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/30">Pediu Aqui · plataforma para comércio local</p>
      </section>

      <section className="pa-auth-cardwrap">
        <div className="pa-auth-card">
          <Link to="/" className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-[#667278] transition hover:text-[#071318] lg:hidden">
            <ArrowLeft className="size-4" /> Voltar para o início
          </Link>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#0d9f91]">Acesso seguro</p>
          <h1 className="pa-display mt-3 text-3xl font-bold tracking-tight text-[#071318]">{title}</h1>
          {description ? <p className="mt-2 text-sm leading-6 text-[#667278]">{description}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 border-t border-[#071318]/8 pt-6 text-sm text-[#667278]">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
