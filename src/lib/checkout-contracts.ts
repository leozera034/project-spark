/**
 * Fase 14 — Contratos de entrada do checkout público.
 *
 * Client-safe: nenhum módulo server-only é arrastado por este arquivo.
 *
 * Regras não negociáveis:
 * - o navegador nunca envia preço, taxa, total, pedido mínimo ou `store_id`;
 * - só chegam identificadores públicos, quantidades e dados de contato;
 * - toda a aritmética é refeita no servidor a partir do banco.
 */
import { z } from "zod";

import { cartSelectionSchema } from "@/lib/cart-contracts";
import { slugParamSchema } from "@/lib/storefront-contracts";

export const MAX_CHECKOUT_LINES = 40;

/** Somente dígitos; DDI 55 redundante é removido. */
export function normalizePhone(raw: string): string | null {
  let digits = (raw ?? "").replace(/\D+/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (digits[0] === "0" || digits[1] === "0") return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  return digits;
}

export function formatPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D+/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const checkoutLineSchema = z
  .object({
    lineId: z.string().min(1).max(64),
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().nullable().optional(),
    quantity: z.number().min(0.001).max(1000),
    notes: z.string().max(280).nullable().optional(),
    selections: z.array(cartSelectionSchema).max(60).default([]),
  })
  .strict();

export const checkoutAddressSchema = z
  .object({
    street: z.string().trim().min(3).max(140),
    number: z.string().trim().max(20).nullable().optional(),
    hasNoNumber: z.boolean().default(false),
    complement: z.string().trim().max(80).nullable().optional(),
    reference: z.string().trim().max(120).nullable().optional(),
    label: z.string().trim().max(40).nullable().optional(),
  })
  .strict();

export const checkoutRequestSchema = z
  .object({
    slug: slugParamSchema,
    idempotencyKey: z.string().trim().min(8).max(120),
    customer: z
      .object({
        firstName: z.string().trim().min(2).max(60),
        phone: z
          .string()
          .trim()
          .min(8)
          .max(24)
          .refine((value) => normalizePhone(value) !== null, "telefone inválido"),
      })
      .strict(),
    fulfillment: z
      .object({
        type: z.enum(["entrega", "retirada"]),
        deliveryAreaId: z.string().uuid().nullable().optional(),
        configurationVersion: z.string().max(64).nullable().optional(),
      })
      .strict(),
    address: checkoutAddressSchema.nullable().optional(),
    payment: z
      .object({
        methodId: z.string().uuid(),
        changeFor: z.number().min(0).max(100000).nullable().optional(),
      })
      .strict(),
    notes: z.string().trim().max(400).nullable().optional(),
    lines: z.array(checkoutLineSchema).min(1).max(MAX_CHECKOUT_LINES),
  })
  .strict()
  .refine(
    (value) => value.fulfillment.type !== "entrega" || Boolean(value.address && value.fulfillment.deliveryAreaId),
    { message: "endereço obrigatório para entrega", path: ["address"] },
  );

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutLineRequest = z.infer<typeof checkoutLineSchema>;
