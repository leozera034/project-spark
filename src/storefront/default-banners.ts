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
  brandForeground: string;
  background: string;
};

// Tokens em OKLCH, no mesmo formato do design system global.
// O tema muda a personalidade, mas preserva contraste e hierarquia.
export const STOREFRONT_THEME_VISUALS: Record<StorefrontThemeProfile, StorefrontThemeVisual> = {
  pizzaria: {
    foreground: "oklch(0.27 0.055 28)",
    mutedForeground: "oklch(0.46 0.035 35)",
    brand: "oklch(0.53 0.17 31)",
    brandForeground: "oklch(0.985 0.006 80)",
    background: "oklch(0.975 0.018 78)",
  },
  hamburgueria: {
    foreground: "oklch(0.97 0.012 75)",
    mutedForeground: "oklch(0.82 0.024 68)",
    brand: "oklch(0.73 0.14 62)",
    brandForeground: "oklch(0.22 0.035 46)",
    background: "oklch(0.235 0.038 43)",
  },
  acai: {
    foreground: "oklch(0.29 0.09 318)",
    mutedForeground: "oklch(0.48 0.055 318)",
    brand: "oklch(0.49 0.16 316)",
    brandForeground: "oklch(0.985 0.008 320)",
    background: "oklch(0.978 0.017 326)",
  },
  sorveteria: {
    foreground: "oklch(0.30 0.065 350)",
    mutedForeground: "oklch(0.50 0.045 350)",
    brand: "oklch(0.61 0.15 353)",
    brandForeground: "oklch(0.99 0.006 80)",
    background: "oklch(0.979 0.018 18)",
  },
  restaurante: {
    foreground: "oklch(0.28 0.06 17)",
    mutedForeground: "oklch(0.47 0.036 23)",
    brand: "oklch(0.48 0.13 18)",
    brandForeground: "oklch(0.985 0.008 80)",
    background: "oklch(0.974 0.015 78)",
  },
  lanchonete: {
    foreground: "oklch(0.28 0.05 54)",
    mutedForeground: "oklch(0.48 0.035 55)",
    brand: "oklch(0.61 0.12 59)",
    brandForeground: "oklch(0.20 0.028 48)",
    background: "oklch(0.975 0.017 76)",
  },
  pastelaria: {
    foreground: "oklch(0.29 0.055 60)",
    mutedForeground: "oklch(0.49 0.04 63)",
    brand: "oklch(0.67 0.14 66)",
    brandForeground: "oklch(0.22 0.03 50)",
    background: "oklch(0.977 0.02 78)",
  },
  adega: {
    foreground: "oklch(0.97 0.012 70)",
    mutedForeground: "oklch(0.83 0.025 35)",
    brand: "oklch(0.57 0.13 10)",
    brandForeground: "oklch(0.985 0.01 72)",
    background: "oklch(0.235 0.042 25)",
  },
  mercado: {
    foreground: "oklch(0.28 0.052 126)",
    mutedForeground: "oklch(0.47 0.04 126)",
    brand: "oklch(0.50 0.12 125)",
    brandForeground: "oklch(0.985 0.008 90)",
    background: "oklch(0.977 0.018 92)",
  },
  outros: {
    foreground: "oklch(0.27 0.02 25)",
    mutedForeground: "oklch(0.48 0.018 35)",
    brand: "oklch(0.49 0.07 20)",
    brandForeground: "oklch(0.985 0.006 80)",
    background: "oklch(0.974 0.012 78)",
  },
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
