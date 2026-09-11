/**
 * Validação defensiva do carrinho local.
 * Qualquer coisa vinda do Storage é dado hostil: passa por Zod antes de virar
 * estado. Documento inválido é descartado inteiro, sem quebrar a loja.
 */
import { z } from "zod";

import { MAX_CART_LINES } from "@/lib/cart-contracts";
import type { CartDocument, CartLine } from "./cart.types";

export const MAX_LINE_QUANTITY = 1000;
export const MAX_NOTES = 280;
export const CART_TTL_DAYS = 7;

const selectionSchema = z.object({
  option_group_id: z.string().uuid(),
  option_item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  nameSnapshot: z.string().max(120).default(""),
});

const lineSchema = z.object({
  lineId: z.string().min(1).max(64),
  productId: z.string().uuid(),
  productNameSnapshot: z.string().max(160).default(""),
  variantId: z.string().uuid().nullable().default(null),
  variantNameSnapshot: z.string().max(160).nullable().default(null),
  selections: z.array(selectionSchema).max(60).default([]),
  quantity: z.number().min(0.001).max(MAX_LINE_QUANTITY),
  notes: z.string().max(MAX_NOTES).nullable().default(null),
  saleMode: z.string().max(32).default("unit"),
  unitLabel: z.string().max(16).default("un"),
  minimumQuantity: z.number().min(0).max(MAX_LINE_QUANTITY).default(1),
  quantityStep: z.number().min(0.001).max(MAX_LINE_QUANTITY).default(1),
  maxQuantity: z.number().min(0).max(MAX_LINE_QUANTITY).nullable().default(null),
  lastKnownUnitPrice: z.number().min(0).max(1_000_000).default(0),
  lastKnownTotal: z.number().min(0).max(1_000_000).default(0),
  addedAt: z.string().max(40),
  updatedAt: z.string().max(40),
});

const documentSchema = z.object({
  schemaVersion: z.literal(1),
  slug: z.string().max(63),
  lines: z.array(lineSchema).max(MAX_CART_LINES),
  updatedAt: z.string().max(40),
  expiresAt: z.string().max(40),
});

export function emptyCart(slug: string): CartDocument {
  const now = new Date();
  return {
    schemaVersion: 1,
    slug,
    lines: [],
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CART_TTL_DAYS * 86_400_000).toISOString(),
  };
}

/** Retorna `null` para documento inválido, de outra loja ou expirado. */
export function parseCart(raw: unknown, slug: string): CartDocument | null {
  const result = documentSchema.safeParse(raw);
  if (!result.success) return null;
  if (result.data.slug !== slug) return null;

  const expiresAt = Date.parse(result.data.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  // Sem linhas duplicadas por lineId.
  const seen = new Set<string>();
  const lines = result.data.lines.filter((line) => {
    if (seen.has(line.lineId)) return false;
    seen.add(line.lineId);
    return true;
  });

  return { ...result.data, lines: lines as CartLine[] };
}

/** Assinatura da configuração: mesma configuração vira a mesma linha. */
export function lineSignature(input: {
  productId: string;
  variantId: string | null;
  selections: { option_group_id: string; option_item_id: string; quantity: number }[];
  notes: string | null;
}): string {
  const selections = [...input.selections]
    .map((s) => `${s.option_group_id}:${s.option_item_id}:${s.quantity}`)
    .sort()
    .join("|");
  const notes = (input.notes ?? "").trim().toLowerCase();
  return [input.productId, input.variantId ?? "-", selections, notes].join("#");
}

export function newLineId(): string {
  return crypto.randomUUID();
}

/** Ajusta a quantidade aos limites do produto, sem confiar no que veio da UI. */
export function clampQuantity(
  value: number,
  bounds: { minimumQuantity: number; quantityStep: number; maxQuantity: number | null },
): number {
  const step = bounds.quantityStep > 0 ? bounds.quantityStep : 1;
  const min = bounds.minimumQuantity > 0 ? bounds.minimumQuantity : step;
  const max = bounds.maxQuantity && bounds.maxQuantity > 0 ? bounds.maxQuantity : MAX_LINE_QUANTITY;
  const clamped = Math.min(Math.max(value, min), max);
  return Number(clamped.toFixed(3));
}
