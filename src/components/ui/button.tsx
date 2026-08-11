import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-[-0.01em] cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-[background-color,border-color,color,box-shadow,transform] duration-200",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-e1 hover:bg-primary/92 hover:shadow-e2 active:shadow-e1",
        brand:
          "bg-brand text-brand-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--color-brand)_70%,transparent)] hover:bg-brand-strong hover:shadow-e2",
        brandSoft:
          "border border-brand/15 bg-brand-soft text-brand-soft-foreground hover:border-brand/25 hover:bg-brand-soft/80",
        destructive:
          "bg-destructive text-destructive-foreground shadow-e1 hover:bg-destructive/90 hover:shadow-e2",
        outline:
          "border border-border-strong/80 bg-background/80 text-foreground shadow-e1 backdrop-blur-sm hover:border-brand/30 hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border border-border/70 bg-secondary text-secondary-foreground shadow-e1 hover:bg-secondary/75",
        ghost:
          "text-muted-foreground hover:bg-accent/80 hover:text-foreground",
        link: "rounded-none px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 min-h-11 px-4 py-2",
        sm: "h-9 min-h-9 rounded-lg px-3 text-xs",
        lg: "h-12 min-h-12 rounded-xl px-6 text-[0.95rem] sm:px-8",
        /** Alvo de toque minimo de 48px para uso em campo e por publico idoso. */
        touch: "h-12 min-h-12 rounded-xl px-6 text-base",
        icon: "size-11 rounded-xl",
        iconTouch: "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Mostra spinner, bloqueia cliques repetidos e anuncia a acao em curso. */
  loading?: boolean;
  /** Texto anunciado a leitores de tela enquanto a acao roda. */
  loadingLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingLabel = "Processando",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            <span className="sr-only">{loadingLabel}</span>
          </>
        ) : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
