import { createServerFn } from "@tanstack/react-start";

import {
  fulfillmentRequestSchema,
  fulfillmentValidateSchema,
} from "@/lib/fulfillment-contracts";

/** Configuração pública de atendimento: modalidades + bairros ativos. */
export const fetchStorefrontFulfillment = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => fulfillmentRequestSchema.parse(data))
  .handler(async ({ data }) => {
    const mod = await import("@/lib/fulfillment.server");
    return mod.loadPublicFulfillment(data.slug);
  });

/** Validação final do contexto. Recebe apenas IDs públicos e a versão. */
export const validateStorefrontFulfillment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => fulfillmentValidateSchema.parse(data))
  .handler(async ({ data }) => {
    const mod = await import("@/lib/fulfillment.server");
    return mod.validatePublicFulfillment(data);
  });
