import type { PublicCatalog, PublicProductCard } from "@/lib/storefront.server";
import type { PublicExperienceProfile } from "@/lib/storefront-experience.server";

export type StorefrontExperienceMode = "guided" | "catalog" | "menu";

export type StorefrontExperience = {
  mode: StorefrontExperienceMode;
  eyebrow: string;
  prompt: string;
  description: string;
  searchPlaceholder: string;
  guidedProducts: PublicProductCard[];
  searchFirst: boolean;
  emphasizeCategories: boolean;
};

function enabled(source: Record<string, unknown> | undefined, key: string): boolean {
  return source?.[key] === true;
}

function hasAny(source: Record<string, unknown> | undefined, keys: string[]): boolean {
  return keys.some((key) => enabled(source, key));
}

function productIsGuided(product: PublicProductCard): boolean {
  if (["buildable", "combo", "multi_flavor", "flavors"].includes(product.product_type)) return true;
  return hasAny(product.capabilities, [
    "multi_flavor",
    "included_choices",
    "combo_steps",
    "buildable",
    "flavors",
    "proteins",
    "sides",
    "creams",
    "toppings",
  ]);
}

export function deriveStorefrontExperience(
  profile: PublicExperienceProfile | null | undefined,
  catalog: PublicCatalog,
): StorefrontExperience {
  const defaults = profile?.default_capabilities ?? {};
  const guidedProducts = catalog.products.filter(productIsGuided).slice(0, 8);

  const catalogSignals = catalog.products.filter(
    (product) =>
      product.sale_mode === "measured" ||
      product.stock_quantity !== null ||
      hasAny(product.capabilities, ["stock", "measured", "packages", "volume", "variants", "kits"]),
  ).length;

  const guidedSignals = guidedProducts.length +
    (hasAny(defaults, ["multi_flavor", "included_choices", "buildable", "combos", "flavors", "proteins", "sides"]) ? 2 : 0);
  const browseSignals = catalogSignals +
    (hasAny(defaults, ["stock", "measured", "packages", "volume", "variants", "kits", "simple"]) ? 2 : 0);

  if (guidedSignals >= 2 && guidedSignals >= browseSignals) {
    return {
      mode: "guided",
      eyebrow: "Feito do seu jeito",
      prompt: "Monte exatamente como você gosta",
      description: "Escolha tamanhos, sabores, complementos e combinações com orientação em cada etapa.",
      searchPlaceholder: "Buscar pratos, sabores ou combos",
      guidedProducts,
      searchFirst: false,
      emphasizeCategories: true,
    };
  }

  if (browseSignals >= 2) {
    return {
      mode: "catalog",
      eyebrow: "Encontre rápido",
      prompt: "Tudo organizado para você achar em segundos",
      description: "Busca em destaque, categorias objetivas, disponibilidade e variações sem complicação.",
      searchPlaceholder: "Buscar produto, marca ou categoria",
      guidedProducts: [],
      searchFirst: true,
      emphasizeCategories: false,
    };
  }

  return {
    mode: "menu",
    eyebrow: "Peça do seu jeito",
    prompt: "Escolha seus favoritos",
    description: "Navegue pelas categorias, veja os destaques e personalize quando quiser.",
    searchPlaceholder: "Buscar no cardápio",
    guidedProducts,
    searchFirst: false,
    emphasizeCategories: true,
  };
}
