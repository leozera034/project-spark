import { cn } from "@/lib/utils";

export type BrandFileTone = "carbon" | "white" | "monochrome";
export type BrandTone = "auto" | BrandFileTone;
export type BrandLockup = "horizontal" | "stacked";
export type BrandSymbolTone = "auto" | "carbon-teal" | "carbon" | "teal" | "white";

const BRAND_NAME = "Comandiva";
const HORIZONTAL_LOGO = "/brand/comandiva-logo-horizontal.png";
const STACKED_LOGO = "/brand/comandiva-logo-stacked.png";
const SYMBOL = "/brand/comandiva-symbol.png";
const WORDMARK = "/brand/comandiva-wordmark.png";

function shouldRenderMonochrome(tone: BrandTone | BrandSymbolTone, className?: string) {
  return tone === "white" || tone === "monochrome" || /(?:^|\s)(?:brightness-0|invert)(?:\s|$)/.test(className ?? "");
}

/** Logo oficial da Comandiva. */
export function BrandLogo({
  lockup = "horizontal",
  tone = "auto",
  className,
}: {
  lockup?: BrandLockup;
  tone?: BrandTone;
  className?: string;
}) {
  const monochrome = shouldRenderMonochrome(tone, className);

  return (
    <img
      src={lockup === "stacked" ? STACKED_LOGO : HORIZONTAL_LOGO}
      alt={BRAND_NAME}
      data-no-dim
      className={cn(
        "block object-contain",
        lockup === "horizontal" ? "h-8 w-auto" : "h-24 w-auto",
        monochrome && "brightness-0 invert",
        className,
      )}
      draggable={false}
    />
  );
}

/** Símbolo oficial isolado da Comandiva para favicons, avatares e espaços compactos. */
export function BrandSymbol({
  tone = "auto",
  className,
}: {
  tone?: BrandSymbolTone;
  className?: string;
}) {
  const monochrome = shouldRenderMonochrome(tone, className);

  return (
    <img
      src={SYMBOL}
      alt="Símbolo Comandiva"
      data-no-dim
      className={cn("size-10 object-contain", monochrome && "brightness-0 invert", className)}
      draggable={false}
    />
  );
}

/** Wordmark oficial para contextos onde o símbolo já aparece separado. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <img
      src={WORDMARK}
      alt={BRAND_NAME}
      data-no-dim
      className={cn("h-7 w-auto object-contain", className)}
      draggable={false}
    />
  );
}
