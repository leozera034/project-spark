import { Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Faixa fixa que identifica o ambiente fictício em todo o protótipo. */
export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 bg-carbon px-4 py-2 text-center text-xs font-medium text-carbon-foreground",
        className,
      )}
    >
      <FlaskConical aria-hidden="true" className="size-3.5 text-brand" />
      <span>Dados fictícios para demonstração. Nenhuma ação altera sistemas reais.</span>
    </div>
  );
}

/** Retorno discreto para a central de preview, presente em todos os ambientes. */
export function BackToPreview({ className }: { className?: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className={cn("gap-2", className)}>
      <Link to="/preview">
        <ArrowLeft aria-hidden="true" />
        Voltar ao preview
      </Link>
    </Button>
  );
}

export function DemoChip({ children }: { children: ReactNode }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {children}
    </Badge>
  );
}

/** Aviso curto de que a ação é apenas demonstrativa. */
export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border-strong bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
