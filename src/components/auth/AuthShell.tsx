import { Link } from "@tanstack/react-router";
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
  return (
    <main className="flex min-h-screen flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <Link to="/" className="mb-8 inline-flex" aria-label="Pediu Aqui, ir para o início">
          <BrandLogo lockup="horizontal" className="h-8 w-auto" />
        </Link>

        <h1
          className={
            tone === "operational"
              ? "text-3xl font-bold tracking-tight text-foreground"
              : "text-2xl font-semibold tracking-tight text-foreground"
          }
        >
          {title}
        </h1>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}

        <div className="mt-8">{children}</div>

        {footer ? <div className="mt-8 text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </main>
  );
}
