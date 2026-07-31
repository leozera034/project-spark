/**
 * Contratos de entrada dos endpoints públicos de atendimento (Fase 12).
 * Client-safe: pode ser importado por `.functions.ts` sem arrastar server-only.
 *
 * O servidor só precisa de: slug, modalidade, ID público do bairro e versão.
 * Nome, rua, número, complemento, referência e coordenadas nunca são enviados.
 */
import { z } from "zod";

import { slugParamSchema } from "@/lib/storefront-contracts";

export const fulfillmentRequestSchema = z
  .object({
    slug: slugParamSchema,
  })
  .strict();

export const fulfillmentValidateSchema = z
  .object({
    slug: slugParamSchema,
    fulfillmentType: z.enum(["entrega", "retirada"]),
    deliveryAreaId: z.string().uuid().nullable().optional(),
    configurationVersion: z.string().max(64).nullable().optional(),
  })
  .strict();

export type FulfillmentRequest = z.infer<typeof fulfillmentRequestSchema>;
export type FulfillmentValidateRequest = z.infer<typeof fulfillmentValidateSchema>;
