import { createClientOnlyFn } from "@tanstack/react-start";

export type BrowserCartQuoteBody = {
  fulfillmentType: "entrega" | "retirada" | null;
  deliveryAreaId: string | null;
  configurationVersion: string | null;
  lines: {
    lineId: string;
    product_id: string;
    variant_id: string | null;
    quantity: number;
    selections: { option_group_id: string; option_item_id: string; quantity: number }[];
  }[];
};

export const quoteCartForBrowser = createClientOnlyFn(
  async ({ slug, body }: { slug: string; body: BrowserCartQuoteBody }) => {
    const { quotePublicCartFromBrowser } = await import("./public-commerce.client");
    return quotePublicCartFromBrowser(slug, body);
  },
);

export const paymentMethodsForBrowser = createClientOnlyFn(
  async ({ slug, fulfillmentType }: { slug: string; fulfillmentType: "entrega" | "retirada" }) => {
    const { loadPaymentMethodsFromBrowser } = await import("./public-commerce.client");
    return loadPaymentMethodsFromBrowser(slug, fulfillmentType);
  },
);

export const submitOrderForBrowser = createClientOnlyFn(
  async ({ slug, body }: { slug: string; body: unknown }) => {
    const { submitPublicOrderFromBrowser } = await import("./public-commerce.client");
    return submitPublicOrderFromBrowser(slug, body);
  },
);
