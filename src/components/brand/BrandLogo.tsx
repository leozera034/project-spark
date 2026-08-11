import { cn } from "@/lib/utils";

export type BrandFileTone = "carbon" | "white" | "monochrome";
export type BrandTone = "auto" | BrandFileTone;
export type BrandLockup = "horizontal" | "stacked";
export type BrandSymbolTone = "auto" | "carbon-teal" | "carbon" | "teal" | "white";

const GLOBAL_LOGO = "/brand/logo-global-v3.svg";
const GLOBAL_SYMBOL = "/brand/symbol-global-v3.svg";

/** Identidade principal do Pediu Aqui. A v3 foi desenhada para funcionar em todas as superficies do SaaS. */
export function BrandLogo({
  lockup = "horizontal",
  tone: _tone = "auto",
  className,
}: {
  lockup?: BrandLockup;
  tone?: BrandTone;
  className?: string;
}) {
  return (
    <img
      src={GLOBAL_LOGO}
      alt="Pediu Aqui"
      data-no-dim
      className={cn(lockup === "horizontal" ? "h-10 w-auto" : "h-24 w-auto", className)}
      draggable={false}
    />
  );
}

/** Simbolo isolado para app, favicon visual, sidebar, avatar e espacos compactos. */
export function BrandSymbol({
  tone: _tone = "auto",
  className,
}: {
  tone?: BrandSymbolTone;
  className?: string;
}) {
  return (
    <img
      src={GLOBAL_SYMBOL}
      alt="Pediu Aqui"
      data-no-dim
      className={cn("size-10", className)}
      draggable={false}
    />
  );
}

/** Wordmark compacto. Usa o lockup global para manter a marca consistente. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <img
      src={GLOBAL_LOGO}
      alt="Pediu Aqui"
      data-no-dim
      className={cn("h-8 w-auto", className)}
      draggable={false}
    />
  );
}
