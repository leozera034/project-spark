/**
 * Fase 15 — Contratos do acompanhamento público do pedido.
 *
 * Client-safe: nada aqui importa módulo server-only.
 */
import { z } from "zod";

export const trackingTokenSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{32,128}$/, "código inválido");

export const trackingRequestSchema = z
  .object({
    token: trackingTokenSchema,
    knownVersion: z.string().trim().max(128).nullable().optional(),
  })
  .strict();

export const PUBLIC_ORDER_STATUS_CODES = [
  "received",
  "confirmed",
  "preparing",
  "ready",
  "waiting_delivery",
  "out_for_delivery",
  "ready_for_pickup",
  "delivered",
  "picked_up",
  "declined",
  "canceled",
  "unknown",
] as const;

export type PublicOrderStatusCode = (typeof PUBLIC_ORDER_STATUS_CODES)[number];

export type PublicDeliveryRoute = {
  distanceMeters: number;
  durationSeconds: number;
  estimatedMinutes: number;
  isApproximate: boolean;
  quality: "approximate" | "provider_route";
  estimatedAt: string | null;
};

export type PublicDeliveryProof = {
  mode: "none" | "pin";
  code: string | null;
};

export type PublicOrderTracking = {
  ok: true;
  changed: true;
  statusVersion: string;
  orderNumber: number;
  createdAt: string;
  lastUpdatedAt: string;
  store: {
    slug: string;
    name: string;
    logoUrl: string | null;
    publicPhone: string | null;
    publicWhatsapp: string | null;
  };
  status: {
    publicCode: PublicOrderStatusCode;
    isFinal: boolean;
    isSuccessful: boolean;
    publicMessage?: string | null;
  };
  fulfillment: {
    type: "entrega" | "retirada";
    neighborhoodName: string | null;
    estimatedMinutes: number | null;
    route?: PublicDeliveryRoute | null;
    proof?: PublicDeliveryProof | null;
  };
  items: {
    productName: string;
    variantName: string | null;
    quantity: number;
    measurementUnit: string | null;
    note: string | null;
    lineTotal: number;
    options: { groupName: string; optionName: string; quantity: number }[];
  }[];
  totals: { subtotal: number; deliveryFee: number; total: number };
  payment: {
    displayName: string | null;
    publicInstructions: string | null;
    changeFor: number | null;
  };
  timeline: { code: PublicOrderStatusCode; occurredAt: string }[];
};

export type TrackingResponse =
  | PublicOrderTracking
  | { ok: true; changed: false; statusVersion: string }
  | { ok: false; error: "not_found" | "invalid_request" | "rate_limited" | "unavailable" };

export const TRACKING_STEPS: Record<"entrega" | "retirada", PublicOrderStatusCode[]> = {
  entrega: ["received", "confirmed", "preparing", "out_for_delivery", "delivered"],
  retirada: ["received", "confirmed", "preparing", "ready_for_pickup", "picked_up"],
};

type Copy = { title: string; description: string };

export const TRACKING_COPY: Record<PublicOrderStatusCode, Copy> = {
  received: { title: "Pedido enviado", description: "A loja recebeu seu pedido e vai confirmar em instantes." },
  confirmed: { title: "Pedido confirmado", description: "A loja confirmou seu pedido e já vai começar o preparo." },
  preparing: { title: "Em preparo", description: "Seu pedido está sendo preparado agora." },
  ready: { title: "Pedido pronto", description: "O preparo terminou. A loja cuida do próximo passo." },
  waiting_delivery: { title: "Aguardando entregador", description: "O pedido está pronto e aguarda quem vai levar até você." },
  out_for_delivery: { title: "Saiu para entrega", description: "Seu pedido está a caminho do endereço confirmado." },
  ready_for_pickup: { title: "Pronto para retirada", description: "Pode buscar na loja. Leve o número do pedido." },
  delivered: { title: "Pedido entregue", description: "Entrega concluída. Bom apetite!" },
  picked_up: { title: "Pedido retirado", description: "Retirada concluída. Bom apetite!" },
  declined: { title: "Pedido recusado", description: "A loja não pôde aceitar este pedido. Fale com a loja para entender." },
  canceled: { title: "Pedido cancelado", description: "Este pedido foi cancelado." },
  unknown: { title: "Acompanhando seu pedido", description: "Estamos atualizando a situação do pedido." },
};

export const TRACKING_MESSAGES = {
  offline: "Você está sem conexão. Vamos retomar o acompanhamento assim que voltar.",
  notFound: "Não encontramos este pedido. Confira o link recebido ao finalizar.",
  rateLimited: "Muitas consultas seguidas. Aguarde alguns segundos.",
  failed: "Não conseguimos atualizar agora. Tentaremos de novo automaticamente.",
} as const;
