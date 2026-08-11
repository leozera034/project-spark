import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";
import type { CourierPresence } from "@/store/couriers/courier.types";

/**
 * Pílula grande de status online/offline do entregador, inequívoca à distância.
 */
export function PresenceBadge({
  presence,
  className,
}: {
  presence: CourierPresence;
  className?: string;
}) {
  const isOnline = presence === "online";
  const isWeak = presence === "sem_sinal";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider",
        isOnline && "bg-success-soft text-success-foreground",
        isWeak && "bg-warning-soft text-warning-foreground",
        !isOnline && !isWeak && "bg-surface-muted text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          isOnline && "bg-success",
          isWeak && "bg-warning animate-pulse motion-reduce:animate-none",
          !isOnline && !isWeak && "bg-muted-foreground/40",
        )}
      />
      {isOnline ? "Online" : isWeak ? "Sinal fraco" : "Offline"}
    </div>
  );
}

export function ConnectivityChip({ isOnline }: { isOnline: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
        isOnline ? "bg-surface-muted text-muted-foreground" : "bg-danger-soft text-danger-foreground",
      )}
    >
      {isOnline ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
      {isOnline ? "Conectado" : "Sem internet"}
    </div>
  );
}
