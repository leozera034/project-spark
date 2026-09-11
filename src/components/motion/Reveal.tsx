/**
 * Reveal — entrada suave de secoes e cards conforme entram na viewport.
 *
 * - Usa IntersectionObserver (sem custo de scroll listener).
 * - Revela uma unica vez por elemento e depois desconecta o observer.
 * - Respeita prefers-reduced-motion: o conteudo aparece imediatamente.
 * - Seguro em SSR: o markup ja sai renderizado, apenas a opacidade e animada.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  /** Margem inferior para antecipar a revelacao. Padrao: -10% da viewport. */
  rootMargin?: string;
  threshold?: number;
}) {
  const ref = React.useRef<T | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setRevealed(true));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        }
      },
      {
        rootMargin: options?.rootMargin ?? "0px 0px -10% 0px",
        threshold: options?.threshold ?? 0.05,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options?.rootMargin, options?.threshold]);

  return { ref, revealed };
}

type RevealProps<E extends React.ElementType> = {
  as?: E;
  /** Atraso em ms para compor escadinhas (stagger) entre itens irmaos. */
  delay?: number;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<E>, "as" | "className" | "children">;

export function Reveal<E extends React.ElementType = "div">({
  as,
  delay = 0,
  className,
  children,
  ...rest
}: RevealProps<E>) {
  const Comp = (as ?? "div") as React.ElementType;
  const { ref, revealed } = useReveal<HTMLElement>();

  return (
    <Comp
      ref={ref}
      data-revealed={revealed ? "true" : "false"}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={cn("reveal", className)}
      {...rest}
    >
      {children}
    </Comp>
  );
}
