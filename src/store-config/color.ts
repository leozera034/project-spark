/**
 * Tema da loja por tokens controlados.
 *
 * A loja escolhe apenas duas cores hexadecimais. Nada de CSS, HTML, JavaScript,
 * fonte externa ou objeto de tema arbitrário entra por aqui.
 */

export const STORE_THEME_FALLBACK = {
  primary: "#0f1114",
  accent: "#14b8a6",
} as const;

/** Normaliza para `#rrggbb` minúsculo. Retorna `null` quando o valor não é uma cor válida. */
export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  return null;
}

function channels(hex: string): [number, number, number] {
  const n = normalizeHexColor(hex) ?? STORE_THEME_FALLBACK.primary;
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function getContrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** Cor de texto legível sobre a cor informada. */
export function getContrastColor(background: string): "#ffffff" | "#0b0b0c" {
  return getContrastRatio(background, "#ffffff") >= getContrastRatio(background, "#0b0b0c")
    ? "#ffffff"
    : "#0b0b0c";
}

export interface StoreThemeIssue {
  field: "primary" | "accent";
  code: "formato" | "contraste";
  message: string;
}

export interface StoreThemeValidation {
  primary: string;
  accent: string;
  issues: StoreThemeIssue[];
  valid: boolean;
  contrast: { primaryOnSurface: number; accentOnSurface: number };
}

const SURFACE = "#ffffff";
const MIN_RATIO = 3; // componentes e superfícies grandes (WCAG AA não textual)

export function validateStoreTheme(
  primaryInput: string,
  accentInput: string,
): StoreThemeValidation {
  const issues: StoreThemeIssue[] = [];
  const primary = normalizeHexColor(primaryInput);
  const accent = normalizeHexColor(accentInput);

  if (!primary) {
    issues.push({
      field: "primary",
      code: "formato",
      message: "Informe uma cor no formato #RRGGBB.",
    });
  }
  if (!accent) {
    issues.push({
      field: "accent",
      code: "formato",
      message: "Informe uma cor no formato #RRGGBB.",
    });
  }

  const p = primary ?? STORE_THEME_FALLBACK.primary;
  const a = accent ?? STORE_THEME_FALLBACK.accent;

  const primaryOnSurface = getContrastRatio(p, SURFACE);
  const accentOnSurface = getContrastRatio(a, SURFACE);

  if (primary && primaryOnSurface < MIN_RATIO) {
    issues.push({
      field: "primary",
      code: "contraste",
      message: "Esta cor não fica legível sobre fundo claro. Escolha um tom mais escuro.",
    });
  }
  if (accent && accentOnSurface < MIN_RATIO) {
    issues.push({
      field: "accent",
      code: "contraste",
      message: "Esta cor não fica legível sobre fundo claro. Escolha um tom mais escuro.",
    });
  }

  return {
    primary: p,
    accent: a,
    issues,
    valid: issues.length === 0,
    contrast: { primaryOnSurface, accentOnSurface },
  };
}

export interface StoreThemeTokens {
  "--store-primary": string;
  "--store-primary-foreground": string;
  "--store-accent": string;
  "--store-accent-foreground": string;
}

/**
 * Gera apenas variáveis CSS conhecidas. Nunca gera regra CSS, seletor ou script.
 * Um tema inválido cai para o fallback acessível do Pediu Aqui.
 */
export function buildStoreThemeTokens(primary: string, accent: string): StoreThemeTokens {
  const result = validateStoreTheme(primary, accent);
  const p = result.valid ? result.primary : STORE_THEME_FALLBACK.primary;
  const a = result.valid ? result.accent : STORE_THEME_FALLBACK.accent;

  return {
    "--store-primary": p,
    "--store-primary-foreground": getContrastColor(p),
    "--store-accent": a,
    "--store-accent-foreground": getContrastColor(a),
  };
}
