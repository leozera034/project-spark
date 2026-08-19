import { z } from "zod";

const BRASIL_API_BASE_URL = "https://brasilapi.com.br/api";
const REQUEST_TIMEOUT_MS = 3_500;

export type ProviderLookupResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_found" | "unavailable" };

export interface BrasilApiCepResult {
  cep: string;
  state: string;
  city: string;
  neighborhood: string | null;
  street: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface BrasilApiCnpjResult {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  registrationStatus: string | null;
  cep: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  mainActivity: string | null;
}

const cepResponseSchema = z.object({
  cep: z.string(),
  state: z.string(),
  city: z.string(),
  neighborhood: z.string().nullish(),
  street: z.string().nullish(),
  timezoneName: z.string().nullish(),
  location: z
    .object({
      coordinates: z
        .object({
          longitude: z.union([z.string(), z.number()]).nullish(),
          latitude: z.union([z.string(), z.number()]).nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

const cnpjResponseSchema = z.object({
  cnpj: z.union([z.string(), z.number()]),
  razao_social: z.string(),
  nome_fantasia: z.string().nullish(),
  descricao_situacao_cadastral: z.string().nullish(),
  cep: z.union([z.string(), z.number()]).nullish(),
  uf: z.string().nullish(),
  municipio: z.string().nullish(),
  bairro: z.string().nullish(),
  logradouro: z.string().nullish(),
  numero: z.union([z.string(), z.number()]).nullish(),
  complemento: z.string().nullish(),
  cnae_fiscal_descricao: z.string().nullish(),
});

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function optionalText(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalCoordinate(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function brasilApiGet(path: string): Promise<ProviderLookupResult<unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BRASIL_API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Comandiva/1.0",
      },
      signal: controller.signal,
    });

    if (response.status === 404) return { ok: false, reason: "not_found" };
    if (!response.ok) return { ok: false, reason: "unavailable" };

    return { ok: true, data: (await response.json()) as unknown };
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupCepBrasilApi(rawCep: string): Promise<ProviderLookupResult<BrasilApiCepResult>> {
  const cep = onlyDigits(rawCep);
  if (cep.length !== 8) return { ok: false, reason: "not_found" };

  const response = await brasilApiGet(`/cep/v2/${encodeURIComponent(cep)}`);
  if (!response.ok) return response;

  const parsed = cepResponseSchema.safeParse(response.data);
  if (!parsed.success) return { ok: false, reason: "unavailable" };

  const coordinates = parsed.data.location?.coordinates;
  return {
    ok: true,
    data: {
      cep: onlyDigits(parsed.data.cep),
      state: parsed.data.state,
      city: parsed.data.city,
      neighborhood: optionalText(parsed.data.neighborhood),
      street: optionalText(parsed.data.street),
      timezone: optionalText(parsed.data.timezoneName),
      latitude: optionalCoordinate(coordinates?.latitude),
      longitude: optionalCoordinate(coordinates?.longitude),
    },
  };
}

export async function lookupCnpjBrasilApi(rawCnpj: string): Promise<ProviderLookupResult<BrasilApiCnpjResult>> {
  const cnpj = onlyDigits(rawCnpj);
  if (cnpj.length !== 14) return { ok: false, reason: "not_found" };

  const response = await brasilApiGet(`/cnpj/v1/${encodeURIComponent(cnpj)}`);
  if (!response.ok) return response;

  const parsed = cnpjResponseSchema.safeParse(response.data);
  if (!parsed.success) return { ok: false, reason: "unavailable" };

  return {
    ok: true,
    data: {
      cnpj: onlyDigits(String(parsed.data.cnpj)).padStart(14, "0"),
      legalName: parsed.data.razao_social,
      tradeName: optionalText(parsed.data.nome_fantasia),
      registrationStatus: optionalText(parsed.data.descricao_situacao_cadastral),
      cep: optionalText(parsed.data.cep),
      state: optionalText(parsed.data.uf),
      city: optionalText(parsed.data.municipio),
      neighborhood: optionalText(parsed.data.bairro),
      street: optionalText(parsed.data.logradouro),
      number: optionalText(parsed.data.numero),
      complement: optionalText(parsed.data.complemento),
      mainActivity: optionalText(parsed.data.cnae_fiscal_descricao),
    },
  };
}
