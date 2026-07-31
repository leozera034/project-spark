/**
 * Contratos de entrada dos endpoints públicos do cardápio.
 * Fica separado de `storefront.server.ts` para poder ser importado por
 * `storefront.functions.ts` sem arrastar o módulo server-only.
 */
import { z } from "zod";

export const slugParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "slug inválido");

export const storefrontRequestSchema = z.object({
  slug: slugParamSchema,
});

export const productParamsSchema = z.object({
  slug: slugParamSchema,
  product_id: z.string().uuid(),
});

export type StorefrontRequest = z.infer<typeof storefrontRequestSchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
