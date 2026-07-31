/**
 * Fase 13 — Contratos de entrada do endpoint público de cotação do carrinho.
 *
 * Client-safe: pode ser importado por `.functions.ts` e pelo navegador sem
 * arrastar nenhum módulo server-only.
 *
 * O servidor recebe apenas identificadores públicos e quantidades.
 * Nome do cliente, endereço, telefone e qualquer preço vindo do navegador
 * NÃO fazem parte deste contrato — preço é sempre recalculado no servidor.
 */
import { z } from "zod";

import { slugParamSchema } from "@/lib/storefront-contracts";

export const MAX_CART_LINES = 40;

export const cartSelectionSchema = z
  .object({
    option_group_id: z.string().uuid(),
    option_item_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(50).default(1),
  })
  .strict();

export const cartQuoteLineSchema = z
  .object({
    lineId: z.string().min(1).max(64),
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().nullable().optional(),
    quantity: z.number().min(0.001).max(1000),
    selections: z.array(cartSelectionSchema).max(60).default([]),
  })
  .strict();

export const cartQuoteRequestSchema = z
  .object({
    slug: slugParamSchema,
    fulfillmentType: z.enum(["entrega", "retirada"]).nullable().optional(),
    deliveryAreaId: z.string().uuid().nullable().optional(),
    configurationVersion: z.string().max(64).nullable().optional(),
    lines: z.array(cartQuoteLineSchema).min(1).max(MAX_CART_LINES),
  })
  .strict();

export type CartQuoteRequest = z.infer<typeof cartQuoteRequestSchema>;
export type CartQuoteLineRequest = z.infer<typeof cartQuoteLineSchema>;
