import { cn } from "@/lib/utils";

export type BrandFileTone = "carbon" | "white" | "monochrome";
export type BrandTone = "auto" | BrandFileTone;
export type BrandLockup = "horizontal" | "stacked";
export type BrandSymbolTone = "auto" | "carbon-teal" | "carbon" | "teal" | "white";

const UI_LOGO = "/brand/logo-ui-v4.svg";
const GLOBAL_SYMBOL = "/brand/symbol-global-v3.svg";

/** Lockup compacto e legível para header, sidebar, autenticação e telas operacionais. */
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
      src={UI_LOGO}
      alt="Pediu Aqui"
      data-no-dim
      className={cn(lockup === "horizontal" ? "h-10 w-auto" : "h-24 w-auto", className)}
      draggable={false}
    />
  );
}

/** Símbolo isolado para app, avatar, sidebar compacta e espaços pequenos. */
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

/** Wordmark compacto para contextos onde o símbolo já aparece. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <img
      src={UI_LOGO}
      alt="Pediu Aqui"
      data-no-dim
      className={cn("h-8 w-auto", className)}
      draggable={false}
    />
  );
}
