import { cn } from "@/lib/utils";

export type BrandFileTone = "carbon" | "white" | "monochrome";
export type BrandTone = "auto" | BrandFileTone;
export type BrandLockup = "horizontal" | "stacked";

const LOCKUP_SRC: Record<BrandLockup, Record<BrandFileTone, string>> = {
  horizontal: {
    carbon: "/brand/logo-horizontal-v2.svg",
    white: "/brand/logo-horizontal-v2-white.svg",
    monochrome: "/brand/logo-horizontal-v2.svg",
  },
  stacked: {
    carbon: "/brand/logo-stacked-v2.svg",
    white: "/brand/logo-stacked-v2-white.svg",
    monochrome: "/brand/logo-stacked-v2.svg",
  },
};

const SYMBOL_SRC = {
  "carbon-teal": "/brand/symbol-v2.svg",
  carbon: "/brand/symbol-v2.svg",
  teal: "/brand/symbol-v2.svg",
  white: "/brand/symbol-v2.svg",
} as const;

export type BrandSymbolTone = keyof typeof SYMBOL_SRC | "auto";

/** Bloco completo simbolo + wordmark. Usado em cabecalhos, rodapes e telas de acesso. */
export function BrandLogo({
  lockup = "horizontal",
  tone = "auto",
  className,
}: {
  lockup?: BrandLockup;
  tone?: BrandTone;
  className?: string;
}) {
  const base = cn(lockup === "horizontal" ? "h-9 w-auto" : "h-24 w-auto", className);

  if (tone === "auto") {
    return (
      <>
        <img
          src={LOCKUP_SRC[lockup].carbon}
          alt="Pediu Aqui"
          data-no-dim
          className={cn(base, "dark:hidden")}
          draggable={false}
        />
        <img
          src={LOCKUP_SRC[lockup].white}
          alt=""
          aria-hidden="true"
          data-no-dim
          className={cn(base, "hidden dark:block")}
          draggable={false}
        />
      </>
    );
  }

  return (
    <img
      src={LOCKUP_SRC[lockup][tone]}
      alt="Pediu Aqui"
      data-no-dim
      className={base}
      draggable={false}
    />
  );
}

/** Simbolo isolado para avatar, app, sidebar e espacos compactos. */
export function BrandSymbol({
  tone = "auto",
  className,
}: {
  tone?: BrandSymbolTone;
  className?: string;
}) {
  const base = cn("size-9", className);
  const src = tone === "auto" ? SYMBOL_SRC["carbon-teal"] : SYMBOL_SRC[tone];
  return <img src={src} alt="Pediu Aqui" data-no-dim className={base} draggable={false} />;
}

/** Wordmark isolado para contextos em que o simbolo ja aparece. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/wordmark-v2.svg"
      alt="Pediu Aqui"
      data-no-dim
      className={cn("h-7 w-auto", className)}
      draggable={false}
    />
  );
}
