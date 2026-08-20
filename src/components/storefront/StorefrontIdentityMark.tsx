import {
  Beef,
  Coffee,
  IceCreamBowl,
  Pizza,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import { resolveStorefrontThemeProfile } from "@/storefront/default-banners";

export function StorefrontIdentityMark({
  segment,
  storeName,
  logoUrl,
  className = "size-[92px] sm:size-[104px]",
}: {
  segment: string | null | undefined;
  storeName: string;
  logoUrl?: string | null;
  className?: string;
}) {
  const shellClass = `${className} grid shrink-0 place-items-center overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_14px_34px_rgba(44,24,15,.13)]`;

  if (logoUrl) {
    return (
      <div className={shellClass}>
        <img
          src={logoUrl}
          alt={storeName}
          className="size-full object-contain p-3.5"
        />
      </div>
    );
  }

  const profile = resolveStorefrontThemeProfile(segment);
  const Icon =
    profile === "pizzaria"
      ? Pizza
      : profile === "hamburgueria"
        ? Beef
        : profile === "acai" || profile === "sorveteria"
          ? IceCreamBowl
          : profile === "adega"
            ? Wine
            : profile === "mercado"
              ? ShoppingBasket
              : profile === "lanchonete"
                ? Coffee
                : profile === "restaurante" || profile === "pastelaria"
                  ? UtensilsCrossed
                  : Store;

  return (
    <div aria-label={`Ícone padrão de ${storeName}`} className={`${shellClass} text-brand`}>
      <Icon className="size-[44%]" strokeWidth={2.15} />
    </div>
  );
}
