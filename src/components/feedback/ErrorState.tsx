import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Estado de erro amigável, sem jargão técnico e sempre com uma saída:
 * tentar de novo. Nunca deixamos a tela em branco quando algo falha.
 */
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
        "reveal flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-background text-destructive shadow-sm">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} loading={retrying}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
