import { createServerFn } from "@tanstack/react-start";

const EXPECTED_SUPABASE_PROJECT_REF = "ypgteuxzgqmkkkpvibhi";
const EXPECTED_SUPABASE_URL = `https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co`;
const AUTH_SETTINGS_URL = `${EXPECTED_SUPABASE_URL}/auth/v1/settings`;
const VALIDATION_TIMEOUT_MS = 3_000;

export type PublicSupabaseBrowserConfig = {
  url: string;
  publishableKey: string | null;
};

function isBrowserSafeSupabaseKey(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized || normalized.startsWith("sb_secret_")) return false;
  if (normalized.startsWith("sb_publishable_")) return true;
  const parts = normalized.split(".");
  return parts.length === 3 && parts.every(Boolean) && normalized.startsWith("eyJ");
}

function parsePublishableKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.values(parsed).filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function configuredCandidates(): string[] {
  return [
    process.env.COMANDIVA_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ...parsePublishableKeys(process.env.SUPABASE_PUBLISHABLE_KEYS),
    process.env.SUPABASE_ANON_KEY,
  ]
    .filter(isBrowserSafeSupabaseKey)
    .map((value) => value.trim())
    .filter((value, index, values) => values.indexOf(value) === index);
}

async function belongsToExpectedProject(key: string): Promise<boolean> {
  if (process.env.CI === "true") return true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
  try {
    const response = await fetch(AUTH_SETTINGS_URL, {
      method: "GET",
      headers: { apikey: key },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

let resolvedConfig: Promise<PublicSupabaseBrowserConfig> | null = null;

async function resolvePublicConfig(): Promise<PublicSupabaseBrowserConfig> {
  const candidates = configuredCandidates();
  for (const candidate of candidates) {
    if (await belongsToExpectedProject(candidate)) {
      return { url: EXPECTED_SUPABASE_URL, publishableKey: candidate };
    }
  }

  console.error(
    `[Supabase] No browser-safe publishable key for ${EXPECTED_SUPABASE_PROJECT_REF} is available in the server runtime.`,
  );
  return { url: EXPECTED_SUPABASE_URL, publishableKey: null };
}

export const getPublicSupabaseBrowserConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSupabaseBrowserConfig> => {
    resolvedConfig ??= resolvePublicConfig();
    return resolvedConfig;
  },
);
