export type StorefrontThemeProfile =
  | "pizzaria"
  | "hamburgueria"
  | "acai"
  | "sorveteria"
  | "restaurante"
  | "lanchonete"
  | "pastelaria"
  | "adega"
  | "mercado"
  | "outros";

export const DEFAULT_STORE_BANNERS: Record<StorefrontThemeProfile, string> = {
  pizzaria: "/storefront/banners/pizzaria.png",
  hamburgueria: "/storefront/banners/hamburgueria.png",
  acai: "/storefront/banners/acai.png",
  sorveteria: "/storefront/banners/sorveteria.png",
  restaurante: "/storefront/banners/restaurante.png",
  lanchonete: "/storefront/banners/lanchonete.png",
  pastelaria: "/storefront/banners/pastelaria.png",
  adega: "/storefront/banners/adega.png",
  mercado: "/storefront/banners/mercado.png",
  outros: "/storefront/banners/outros.svg",
};

export const DEFAULT_WIZARD_MOBILE_BACKGROUNDS: Record<StorefrontThemeProfile, string> = {
  pizzaria: "/storefront/wizard/mobile/pizzaria.png",
  hamburgueria: "/storefront/wizard/mobile/hamburgueria.png",
  acai: "/storefront/wizard/mobile/acai.png",
  sorveteria: "/storefront/wizard/mobile/sorveteria.png",
  restaurante: "/storefront/wizard/mobile/restaurante.png",
  // O lote mobile enviado não trouxe uma arte exclusiva de lanchonete.
  // Até existir uma própria, usa o neutro para evitar tema incorreto.
  lanchonete: "/storefront/wizard/mobile/outros.png",
  pastelaria: "/storefront/wizard/mobile/pastelaria.png",
  adega: "/storefront/wizard/mobile/adega.png",
  mercado: "/storefront/wizard/mobile/mercado.png",
  outros: "/storefront/wizard/mobile/outros.png",
};

const SEGMENT_TO_PROFILE: Record<string, StorefrontThemeProfile> = {
  pizzaria: "pizzaria",
  hamburgueria: "hamburgueria",
  hamburguer: "hamburgueria",
  hamburgeria: "hamburgueria",
  acai: "acai",
  açaí: "acai",
  sorveteria: "sorveteria",
  restaurante: "restaurante",
  marmitaria: "restaurante",
  "marmitaria / restaurante": "restaurante",
  lanchonete: "lanchonete",
  pastelaria: "pastelaria",
  adega: "adega",
  bebidas: "adega",
  "bebidas / adega": "adega",
  mercado: "mercado",
  padaria: "mercado",
  conveniencia: "mercado",
  conveniência: "mercado",
  "padaria / conveniência / mercado": "mercado",
  outros: "outros",
  outro: "outros",
};

export function resolveStorefrontThemeProfile(segment: string | null | undefined): StorefrontThemeProfile {
  if (!segment) return "outros";
  const normalized = segment.trim().toLocaleLowerCase("pt-BR");
  return SEGMENT_TO_PROFILE[normalized] ?? "outros";
}

export function getDefaultStoreBanner(segment: string | null | undefined): string {
  return DEFAULT_STORE_BANNERS[resolveStorefrontThemeProfile(segment)];
}

export function getDefaultWizardMobileBackground(segment: string | null | undefined): string {
  return DEFAULT_WIZARD_MOBILE_BACKGROUNDS[resolveStorefrontThemeProfile(segment)];
}
