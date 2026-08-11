import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Blocos de esqueleto reaproveitáveis. Todos anunciam o carregamento para
 * leitores de tela e imitam a forma final do conteúdo, evitando saltos.
 */
export function SkeletonScreen({
  label = "Carregando conteúdo",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function ListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <SkeletonScreen className={cn("space-y-3", className)} label="Carregando lista">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl border border-border p-4">
          <Skeleton className="size-14 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      ))}
    </SkeletonScreen>
  );
}

export function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <SkeletonScreen className={cn("space-y-4", className)} label="Carregando formulário">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
    </SkeletonScreen>
  );
}

/** Esqueleto da vitrine pública, espelhando cabeçalho, busca e cards. */
export function StorefrontSkeleton() {
  return (
    <SkeletonScreen label="Carregando cardápio" className="min-h-svh bg-background">
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Skeleton className="size-14 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-4">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="size-20 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

/** Esqueleto do dashboard operacional: KPIs + lista recente. */
export function DashboardSkeleton() {
  return (
    <SkeletonScreen label="Carregando visão geral" className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-border p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-xl border border-border p-4">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

/** Esqueleto das colunas do modo cozinha, com altura estável dos cartões. */
export function KitchenSkeleton() {
  return (
    <SkeletonScreen label="Carregando cozinha" className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, col) => (
        <div key={col} className="space-y-4 rounded-xl border border-border p-4">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-56 rounded-xl border border-border p-4">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
              <Skeleton className="mt-6 h-12 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ))}
    </SkeletonScreen>
  );
}
