import { RotateCcw, TriangleAlert, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorKind = "network" | "unexpected";

const KIND_COPY: Record<ErrorKind, { title: string; description: string; icon: typeof TriangleAlert }> = {
  network: {
    title: "Sem conexão com a internet",
    description: "Verifique sua rede e tente novamente. Seus dados carregados continuam visíveis.",
    icon: WifiOff,
  },
  unexpected: {
    title: "Não foi possível carregar",
    description: "Algo saiu do esperado por aqui. Tente novamente em instantes.",
    icon: TriangleAlert,
  },
};

/**
 * Estado de erro amigável, sem jargão técnico e sempre com uma saída:
 * tentar de novo. Nunca deixamos a tela em branco quando algo falha.
 *
 * `kind` diferencia falha de rede (mensagem específica) de falha inesperada.
 */
export function ErrorState({
  kind = "unexpected",
  title,
  description,
  onRetry,
  retryLabel = "Tentar novamente",
  retrying = false,
  className,
}: {
  kind?: ErrorKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  className?: string;
}) {
  const copy = KIND_COPY[kind];
  const Icon = copy.icon;

  return (
    <div
      role="alert"
      className={cn(
        "reveal flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger-soft px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-background text-danger shadow-sm ring-1 ring-danger/20">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title ?? copy.title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description ?? copy.description}
        </p>
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
