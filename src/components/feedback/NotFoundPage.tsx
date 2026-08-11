import { Link } from "@tanstack/react-router";
import { ArrowLeft, Compass, Home } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main id="conteudo" className="pa-error">
      <section className="pa-error-card relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[#12d8c1]/10 blur-3xl" />
        <div className="relative">
          <Link to="/" className="inline-flex" aria-label="Pediu Aqui — ir para a página inicial">
            <BrandLogo lockup="horizontal" className="h-7 w-auto brightness-0 invert" />
          </Link>
          <div className="mx-auto mt-9 grid size-13 place-items-center rounded-2xl border border-white/8 bg-white/5 text-[#12d8c1]">
            <Compass className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-[#8ff5e9]">Erro 404</p>
          <h1 className="pa-display mt-3 text-4xl font-bold sm:text-5xl">Este caminho não existe.</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/56">
            O endereço pode ter mudado ou o link pode estar incompleto. Você pode voltar ao início ou retornar para a tela anterior.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-2xl bg-[#12d8c1] font-extrabold text-[#071318] hover:bg-[#58ead9]">
              <Link to="/"><Home className="size-4" /> Ir para o início</Link>
            </Button>
            <Button type="button" variant="outline" size="lg" className="rounded-2xl border-white/13 bg-white/4 text-white hover:bg-white/8 hover:text-white" onClick={() => { if (typeof window !== "undefined" && window.history.length > 1) window.history.back(); }}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
