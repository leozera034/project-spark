export const DEFAULT_STORE_BANNERS = {
  pizzaria: "https://raw.githubusercontent.com/leozera034/project-spark/main/74434214-DD0F-4E72-A03F-433A5A4E35B8.png",
  hamburgueria: "https://raw.githubusercontent.com/leozera034/project-spark/main/54B3B572-B919-4C10-BB02-89EF17EF1F67.png",
  acai: "https://raw.githubusercontent.com/leozera034/project-spark/main/0D5AB711-DCF9-436C-AAC7-63211108D603.png",
  sorveteria: "https://raw.githubusercontent.com/leozera034/project-spark/main/AC5D7505-E062-461F-9501-B25E37347869.png",
  restaurante: "https://raw.githubusercontent.com/leozera034/project-spark/main/2E23EFDB-A01A-4D45-AB41-4E6C56F8E7C3.png",
  lanchonete: "https://raw.githubusercontent.com/leozera034/project-spark/main/BE76F350-A473-4585-9ED7-E39A512C6A4F.png",
  pastelaria: "https://raw.githubusercontent.com/leozera034/project-spark/main/5A28457F-09F0-4079-A5D7-9FA44C798D8E.png",
  adega: "https://raw.githubusercontent.com/leozera034/project-spark/main/D0AE951B-EB0D-4F14-8017-24D11683D8F8.png",
  mercado: "https://raw.githubusercontent.com/leozera034/project-spark/main/0DA1D163-99E0-4750-A567-49F7D7C94436.png",
} as const;

export type DefaultStoreBannerProfile = keyof typeof DEFAULT_STORE_BANNERS;

const SEGMENT_TO_PROFILE: Record<string, DefaultStoreBannerProfile> = {
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
};

export function getDefaultStoreBanner(segment: string | null | undefined): string | null {
  if (!segment) return null;
  const normalized = segment.trim().toLocaleLowerCase("pt-BR");
  const profile = SEGMENT_TO_PROFILE[normalized];
  return profile ? DEFAULT_STORE_BANNERS[profile] : null;
}
