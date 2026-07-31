import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { cn } from "@/lib/utils";

/** Assinatura discreta do Pediu Aqui no rodapé das telas do cliente. */
export function StoreFooter() {
  return (
    <footer className="mt-12 border-t border-border px-4 py-6 text-center">
      <p className="text-xs text-muted-foreground">Tecnologia Pediu Aqui</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Dados fictícios para demonstração.
      </p>
    </footer>
  );
}

/** Cabeçalho compacto reutilizado nas etapas do pedido. */
export function StoreStepHeader({
  title,
  backTo,
  step,
  totalSteps,
}: {
  title: string;
  backTo: string;
  step?: number;
  totalSteps?: number;
}) {
  const { customer } = useDemo();
  const cartCount = customer.cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
        <Button asChild variant="ghost" size="iconTouch" aria-label="Voltar">
          <Link to={backTo}>
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
        <p className="flex-1 truncate text-base font-semibold text-foreground">{title}</p>
        {cartCount > 0 ? (
          <Button asChild variant="ghost" size="iconTouch" aria-label={`Carrinho com ${cartCount} itens`}>
            <Link to="/preview/cliente/carrinho" className="relative">
              <ShoppingBag aria-hidden="true" />
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
                {cartCount}
              </span>
            </Link>
          </Button>
        ) : null}
      </div>
      {typeof step === "number" && typeof totalSteps === "number" ? (
        <div className="mx-auto max-w-3xl px-3 pb-2">
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Etapa ${step} de ${totalSteps}`}
          >
            <div className="h-full bg-brand" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Etapa {step} de {totalSteps}
          </p>
        </div>
      ) : null}
    </header>
  );
}

export function StorePage({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("mx-auto max-w-3xl px-4 py-5", className)}>{children}</main>;
}

/** Barra de ação principal fixa no rodapé, com área de toque ampla. */
export function StickyAction({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}
