import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Indicador de atividade padrão do app. Sempre acompanhado de texto
 * acessível para que leitores de tela anunciem o carregamento.
 */
export function Spinner({
  className,
  label = "Carregando",
  showLabel = false,
}: {
  className?: string;
  label?: string;
  showLabel?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />
      <span className={showLabel ? "text-sm text-muted-foreground" : "sr-only"}>{label}</span>
    </span>
  );
}
