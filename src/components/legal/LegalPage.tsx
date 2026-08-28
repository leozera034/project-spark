import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { BrandLogo } from "@/components/brand/BrandLogo";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/" aria-label="Voltar para a página inicial da Comandiva">
            <BrandLogo lockup="horizontal" className="h-9 w-auto" />
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 border-b border-border pb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Comandiva</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
        </div>
        <article className="space-y-10 text-[15px] leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_ul]:space-y-2">
          {children}
        </article>
      </main>
    </div>
  );
}
