import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Estado vazio amigável: explica o que aconteceu e oferece o próximo passo.
 * Usado no lugar de listas em branco em toda a aplicação.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  size = "default",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: "default" | "compact";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "reveal flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface-muted/50 text-center",
        size === "compact" ? "px-4 py-6" : "px-6 py-10 sm:py-12",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border/60",
          size === "compact" ? "size-9" : "size-12",
        )}
      >
        <Icon className={size === "compact" ? "size-4" : "size-5"} aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
