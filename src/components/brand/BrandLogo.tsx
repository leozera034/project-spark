import { cn } from "@/lib/utils";

export type BrandFileTone = "carbon" | "white" | "monochrome";
export type BrandTone = "auto" | BrandFileTone;
export type BrandLockup = "horizontal" | "stacked";
export type BrandSymbolTone = "auto" | "carbon-teal" | "carbon" | "teal" | "white";

const BRAND_NAME = "Comandiva";
const GLOBAL_SYMBOL = "/brand/symbol-global-v3.svg";

/**
 * Wordmark tipográfico transitório da Comandiva.
 *
 * O lockup antigo "Pediu Aqui" não deve voltar para superfícies públicas.
 * Mantemos o componente estável enquanto a identidade visual definitiva é produzida.
 */
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
    <span
      aria-label={BRAND_NAME}
      data-no-dim
      className={cn(
        "inline-flex w-fit items-center font-display font-black leading-none tracking-[-0.045em] text-foreground",
        lockup === "horizontal" ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl",
        className,
      )}
    >
      {BRAND_NAME}
    </span>
  );
}

/** Símbolo isolado legado, sem texto, para espaços pequenos durante a transição de marca. */
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
      alt="Símbolo Comandiva"
      data-no-dim
      className={cn("size-10", className)}
      draggable={false}
    />
  );
}

/** Wordmark compacto para contextos onde o símbolo já aparece. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      aria-label={BRAND_NAME}
      data-no-dim
      className={cn(
        "inline-flex w-fit items-center font-display text-xl font-black leading-none tracking-[-0.045em] text-foreground",
        className,
      )}
    >
      {BRAND_NAME}
    </span>
  );
}
