import {
  Beef,
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
  className = "size-18 sm:size-22",
}: {
  segment: string | null | undefined;
  storeName: string;
  logoUrl?: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={storeName}
        className={`${className} shrink-0 rounded-2xl border-4 border-background object-cover shadow-e2 sm:rounded-3xl`}
      />
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
              : profile === "restaurante" || profile === "lanchonete" || profile === "pastelaria"
                ? UtensilsCrossed
                : Store;

  return (
    <div
      aria-label={`Ícone padrão de ${storeName}`}
      className={`${className} grid shrink-0 place-items-center rounded-2xl border-4 border-background bg-brand/10 text-brand shadow-e2 sm:rounded-3xl`}
    >
      <Icon className="size-[42%]" strokeWidth={2.1} />
    </div>
  );
}
