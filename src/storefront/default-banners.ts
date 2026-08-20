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
  lanchonete: "/storefront/wizard/mobile/lanchonete.png",
  pastelaria: "/storefront/wizard/mobile/pastelaria.png",
  adega: "/storefront/wizard/mobile/adega.png",
  mercado: "/storefront/wizard/mobile/mercado.png",
  outros: "/storefront/wizard/mobile/outros.png",
};

export const DEFAULT_WIZARD_DESKTOP_BACKGROUNDS: Record<StorefrontThemeProfile, string> = {
  pizzaria: "/storefront/wizard/desktop/pizzaria.png",
  hamburgueria: "/storefront/wizard/desktop/hamburgueria.png",
  acai: "/storefront/wizard/desktop/acai.png",
  sorveteria: "/storefront/wizard/desktop/sorveteria.png",
  restaurante: "/storefront/wizard/desktop/restaurante.png",
  lanchonete: "/storefront/wizard/desktop/lanchonete.png",
  pastelaria: "/storefront/wizard/desktop/pastelaria.png",
  adega: "/storefront/wizard/desktop/adega.png",
  mercado: "/storefront/wizard/desktop/mercado.png",
  outros: "/storefront/wizard/desktop/outros.png",
};

export const DEFAULT_THEME_LOGOS: Record<StorefrontThemeProfile, string> = {
  pizzaria: "/brand/themes/pizzaria.png",
  hamburgueria: "/brand/themes/hamburgueria.png",
  acai: "/brand/themes/acai.png",
  sorveteria: "/brand/themes/sorveteria.png",
  restaurante: "/brand/themes/restaurante.png",
  lanchonete: "/brand/themes/lanchonete.png",
  pastelaria: "/brand/themes/pastelaria.png",
  adega: "/brand/themes/adega.png",
  mercado: "/brand/themes/mercado.png",
  outros: "/brand/themes/outros.png",
};

export type StorefrontThemeVisual = {
  foreground: string;
  mutedForeground: string;
  brand: string;
  background: string;
};

export const STOREFRONT_THEME_VISUALS: Record<StorefrontThemeProfile, StorefrontThemeVisual> = {
  pizzaria: { foreground: "14 47% 18%", mutedForeground: "14 23% 38%", brand: "7 61% 45%", background: "36 100% 98%" },
  hamburgueria: { foreground: "24 49% 14%", mutedForeground: "24 23% 35%", brand: "27 63% 37%", background: "36 100% 98%" },
  acai: { foreground: "292 49% 18%", mutedForeground: "292 20% 38%", brand: "289 50% 39%", background: "324 100% 99%" },
  sorveteria: { foreground: "334 39% 20%", mutedForeground: "334 19% 40%", brand: "337 55% 51%", background: "345 100% 99%" },
  restaurante: { foreground: "347 39% 18%", mutedForeground: "347 18% 38%", brand: "347 52% 36%", background: "36 100% 98%" },
  lanchonete: { foreground: "27 45% 17%", mutedForeground: "27 20% 38%", brand: "30 62% 42%", background: "36 100% 98%" },
  pastelaria: { foreground: "30 60% 18%", mutedForeground: "30 27% 38%", brand: "31 70% 45%", background: "37 100% 98%" },
  adega: { foreground: "343 43% 16%", mutedForeground: "343 20% 37%", brand: "343 55% 31%", background: "36 100% 98%" },
  mercado: { foreground: "84 33% 16%", mutedForeground: "84 18% 35%", brand: "85 43% 30%", background: "45 100% 98%" },
  outros: { foreground: "340 13% 17%", mutedForeground: "340 8% 38%", brand: "344 18% 36%", background: "36 50% 98%" },
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

  if (normalized.startsWith("__profile__:")) {
    const embedded = normalized.slice("__profile__:".length).trim();
    return SEGMENT_TO_PROFILE[embedded] ?? "outros";
  }
  if (normalized.startsWith("__other__:")) return "outros";

  return SEGMENT_TO_PROFILE[normalized] ?? "outros";
}

export function getDefaultStoreBanner(segment: string | null | undefined): string {
  return DEFAULT_STORE_BANNERS[resolveStorefrontThemeProfile(segment)];
}

export function getDefaultWizardMobileBackground(segment: string | null | undefined): string {
  return DEFAULT_WIZARD_MOBILE_BACKGROUNDS[resolveStorefrontThemeProfile(segment)];
}

export function getDefaultWizardDesktopBackground(segment: string | null | undefined): string {
  return DEFAULT_WIZARD_DESKTOP_BACKGROUNDS[resolveStorefrontThemeProfile(segment)];
}

export function getDefaultThemeLogo(segment: string | null | undefined): string {
  return DEFAULT_THEME_LOGOS[resolveStorefrontThemeProfile(segment)];
}

export function getStorefrontThemeVisual(segment: string | null | undefined): StorefrontThemeVisual {
  return STOREFRONT_THEME_VISUALS[resolveStorefrontThemeProfile(segment)];
}
