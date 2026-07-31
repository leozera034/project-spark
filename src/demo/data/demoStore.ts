import type { DemoNeighborhood, DemoStore } from "../types/demo";

/** Loja fictícia usada em todo o protótipo. Nenhum dado corresponde a negócio real. */
export const demoStore: DemoStore = {
  id: "store-aurora",
  slug: "mercado-aurora",
  name: "Mercado Aurora",
  tagline: "Padaria, mercearia e refeições do bairro",
  description:
    "Pão quentinho todos os dias, refeições prontas no almoço e a mercearia completa para o dia a dia.",
  coverAlt: "Fachada ilustrativa do Mercado Aurora",
  isOpen: true,
  opensAt: "07:00",
  closesAt: "22:00",
  etaDelivery: "35 a 50 min",
  etaPickup: "15 a 25 min",
  acceptsDelivery: true,
  acceptsPickup: true,
  minimumOrder: 20,
  address: "Rua das Laranjeiras, 100 — Centro (endereço fictício)",
  phone: "(00) 00000-0000",
  theme: {
    brand: "oklch(0.535 0.135 28)",
    brandForeground: "oklch(0.99 0.005 90)",
    brandSoft: "oklch(0.95 0.03 60)",
    brandSoftForeground: "oklch(0.44 0.11 32)",
    surfaceHero: "oklch(0.28 0.05 32)",
  },
};

export const demoNeighborhoods: DemoNeighborhood[] = [
  { id: "bairro-centro", name: "Centro", deliveryFee: 6, minimumOrder: 20, etaMinutes: 35 },
  { id: "bairro-aurora", name: "Jardim Aurora", deliveryFee: 8, minimumOrder: 25, etaMinutes: 40 },
  { id: "bairro-pinheiral", name: "Vila Pinheiral", deliveryFee: 9.5, minimumOrder: 30, etaMinutes: 45 },
  { id: "bairro-mirante", name: "Alto do Mirante", deliveryFee: 12, minimumOrder: 35, etaMinutes: 55 },
  { id: "bairro-ribeira", name: "Ribeira Nova", deliveryFee: 7, minimumOrder: 20, etaMinutes: 38 },
];

export function neighborhoodById(id: string): DemoNeighborhood | undefined {
  return demoNeighborhoods.find((item) => item.id === id);
}
