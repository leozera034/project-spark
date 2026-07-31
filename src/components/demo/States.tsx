import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
      <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="mt-3 text-base font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = "Não conseguimos carregar esta parte",
  description = "Tente novamente em alguns instantes. Se continuar, avise a loja.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-2 rounded-xl border border-danger-soft bg-danger-soft px-4 py-4"
    >
      <div className="flex items-center gap-2 text-danger">
        <AlertTriangle aria-hidden="true" className="size-4" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="text-sm text-foreground/80">{description}</p>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}

export function OfflineState() {
  return (
    <div role="status" className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-4 py-3">
      <WifiOff aria-hidden="true" className="size-4 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Sem conexão no momento. As informações voltam assim que a internet retornar.
      </p>
    </div>
  );
}

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
