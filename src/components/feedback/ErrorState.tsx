import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Estado de erro compartilhado: claro, acionável e consistente em todo o produto. */
export function ErrorState({
  title = "Não foi possível carregar",
  description = "Algo saiu do esperado por aqui. Tente novamente em instantes.",
  onRetry,
  retryLabel = "Tentar novamente",
  retrying = false,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "reveal flex flex-col items-center justify-center gap-4 rounded-[24px] border border-destructive/18 bg-card px-6 py-10 text-center shadow-[0_14px_40px_rgba(5,25,31,.055)]",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <p className="pa-display text-base font-bold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-1 rounded-xl" onClick={onRetry} loading={retrying}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
