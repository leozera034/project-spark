/**
 * Pediu Aqui — componentes de marca.
 *
 * A geometria da marca vive apenas em tools/brand-geometry.mjs e e materializada
 * nos arquivos de public/brand por `npm run brand:generate`.
 * Estes componentes apenas referenciam esses arquivos. Nunca redesenhe o logo em JSX.
 */

import { cn } from "@/lib/utils";

export type BrandTone = "carbon" | "white" | "monochrome";
export type BrandLockup = "horizontal" | "stacked";

const LOCKUP_SRC: Record<BrandLockup, Record<BrandTone, string>> = {
  horizontal: {
    carbon: "/brand/logo-horizontal-carbon.svg",
    white: "/brand/logo-horizontal-white.svg",
    monochrome: "/brand/logo-horizontal-monochrome.svg",
  },
  stacked: {
    carbon: "/brand/logo-stacked-carbon.svg",
    white: "/brand/logo-stacked-white.svg",
    monochrome: "/brand/logo-stacked-monochrome.svg",
  },
};

const SYMBOL_SRC = {
  "carbon-teal": "/brand/symbol-carbon-teal.svg",
  carbon: "/brand/symbol-carbon.svg",
  teal: "/brand/symbol-teal.svg",
  white: "/brand/symbol-white.svg",
} as const;

export type BrandSymbolTone = keyof typeof SYMBOL_SRC;

/** Bloco completo simbolo + wordmark. Use em cabecalhos, rodapes e telas de acesso. */
export function BrandLogo({
  lockup = "horizontal",
  tone = "carbon",
  className,
}: {
  lockup?: BrandLockup;
  tone?: BrandTone;
  className?: string;
}) {
  return (
    <img
      src={LOCKUP_SRC[lockup][tone]}
      alt="Pediu Aqui"
      className={cn(lockup === "horizontal" ? "h-8 w-auto" : "h-20 w-auto", className)}
      draggable={false}
    />
  );
}

/** Somente o simbolo. Use em espacos reduzidos, avatares e icones de aplicativo. */
export function BrandSymbol({
  tone = "carbon-teal",
  className,
}: {
  tone?: BrandSymbolTone;
  className?: string;
}) {
  return (
    <img
      src={SYMBOL_SRC[tone]}
      alt="Pediu Aqui"
      className={cn("size-8", className)}
      draggable={false}
    />
  );
}

/** Wordmark isolado. Uso restrito a contextos onde o simbolo ja aparece. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/pediu-aqui-wordmark.svg"
      alt="Pediu Aqui"
      className={cn("h-6 w-auto", className)}
      draggable={false}
    />
  );
}
