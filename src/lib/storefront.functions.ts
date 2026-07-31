import { createServerFn } from "@tanstack/react-start";

import {
  computePublicPrice,
  loadPublicCatalog,
  loadPublicProduct,
  loadPublicStore,
  priceInputSchema,
  slugSchema,
} from "@/lib/storefront.server";
import { productParamsSchema, storefrontRequestSchema } from "@/lib/storefront-contracts";

/** Loja pública + catálogo, em uma única ida ao servidor (conexão fraca). */
export const fetchStorefront = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => storefrontRequestSchema.parse(data))
  .handler(async ({ data }) => {
    const [store, catalog] = await Promise.all([
      loadPublicStore(data.slug),
      loadPublicCatalog(data.slug),
    ]);
    return { store, catalog };
  });

/** Detalhe do produto para a tela de montagem. */
export const fetchStorefrontProduct = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => productParamsSchema.parse(data))
  .handler(async ({ data }) => loadPublicProduct(data.slug, data.product_id));

/** Cálculo canônico. O navegador nunca soma preço. */
export const calculateStorefrontPrice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => priceInputSchema.parse(data))
  .handler(async ({ data }) => computePublicPrice(data));

/** Usada pela rota de SEO/sitemap para validar o slug antes de resolver. */
export const validateStorefrontSlug = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }) => ({ slug: data }));
