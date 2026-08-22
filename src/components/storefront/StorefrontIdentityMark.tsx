import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Beef,
  Coffee,
  IceCreamBowl,
  Pizza,
  ShoppingBasket,
  Star,
  Store,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import { getPublicStoreReviewSummary } from "@/lib/storefront-review-summary.functions";
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
  const params = useParams({ strict: false }) as { slug?: string };
  const reviewFn = useServerFn(getPublicStoreReviewSummary);
  const reviews = useQuery({
    queryKey: ["storefront", params.slug, "review-summary"],
    queryFn: () => reviewFn({ data: { slug: params.slug! } }),
    enabled: Boolean(params.slug),
    staleTime: 60_000,
  });
  const summary = reviews.data;
  const showRating = Boolean(summary && summary.total > 0 && summary.averageRating > 0);
  const shellClass = `${className} grid shrink-0 place-items-center overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_14px_34px_rgba(44,24,15,.13)]`;

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
    <div className="relative w-fit shrink-0">
      {logoUrl ? (
        <div className={shellClass}>
          <img src={logoUrl} alt={storeName} className="size-full object-contain p-3.5" />
        </div>
      ) : (
        <div aria-label={`Ícone padrão de ${storeName}`} className={`${shellClass} text-brand`}>
          <Icon className="size-[44%]" strokeWidth={2.15} />
        </div>
      )}

      {showRating ? (
        <span
          className="absolute -bottom-2 -right-3 inline-flex min-h-8 items-center gap-1 rounded-full border border-black/8 bg-white px-2.5 py-1 text-xs font-black text-foreground shadow-[0_7px_18px_rgba(44,24,15,.14)]"
          aria-label={`${summary?.averageRating.toFixed(1)} estrelas em ${summary?.total} avaliações verificadas`}
          title={`${summary?.total} avaliações de pedidos verificados`}
        >
          <Star className="size-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
          {summary?.averageRating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          <span className="font-semibold text-muted-foreground">({summary?.total})</span>
        </span>
      ) : null}
    </div>
  );
}
