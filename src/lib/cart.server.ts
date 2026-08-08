/**
 * Fase 13 — Cotação pública do carrinho.
 *
 * SERVIDOR-ONLY (sufixo `.server.ts`). Mesmas regras das Fases 11 e 12:
 * - o visitante nunca toca nas tabelas: tudo passa por RPCs `storefront_*`;
 * - nenhum preço enviado pelo navegador é aceito: cada linha é recalculada
 *   pelo motor canônico (`storefront_price`, D-050);
 * - o `store_id` é resolvido pelo slug no servidor e nunca sai daqui;
 * - a taxa de entrega e o pedido mínimo vêm da validação de atendimento
 *   (Fase 12), nunca do aparelho do cliente;
 * - erros são normalizados; detalhe técnico fica só no log do servidor.
 */
import { cartQuoteRequestSchema, type CartQuoteRequest } from "@/lib/cart-contracts";
import { StorefrontError, computePublicPrice, loadPublicCatalog } from "@/lib/storefront.server";
import { validatePublicFulfillment } from "@/lib/fulfillment.server";

export type CartLineStatus =
  "ok" | "sold_out" | "unavailable" | "invalid_configuration" | "unpriceable";

export type CartQuoteLine = {
  lineId: string;
  productId: string;
  status: CartLineStatus;
  /** Nome atual publicado pela loja (o do aparelho é só um espelho). */
  productName: string | null;
  unitPrice: number | null;
  total: number | null;
  optionsTotal: number | null;
  /** Códigos genéricos do motor, sem detalhe de schema. */
  validationErrors: string[];
};

export type CartQuote = {
  currency: "BRL";
  quotedAt: string;
  configurationVersion: string | null;
  fulfillmentType: "entrega" | "retirada" | null;
  fulfillmentValid: boolean;
  fulfillmentErrors: string[];
  storeIsOpen: boolean;
  subtotal: number;
  deliveryFee: number | null;
  minimumOrderAmount: number | null;
  minimumOrderMet: boolean;
  estimatedMinutes: number | null;
  total: number;
  hasBlockingIssues: boolean;
  lines: CartQuoteLine[];
};

const round = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Recalcula todas as linhas em UMA única ida do navegador ao servidor.
 * Internamente reutilizamos o motor canônico por linha (a agregação acontece
 * aqui, no servidor, e não na rede do cliente).
 */
export async function quotePublicCart(input: CartQuoteRequest): Promise<CartQuote> {
  const parsed = cartQuoteRequestSchema.parse(input);

  const [catalog, fulfillment] = await Promise.all([
    loadPublicCatalog(parsed.slug),
    parsed.fulfillmentType
      ? validatePublicFulfillment({
          slug: parsed.slug,
          fulfillmentType: parsed.fulfillmentType,
          deliveryAreaId: parsed.deliveryAreaId ?? null,
          configurationVersion: parsed.configurationVersion ?? null,
        }).catch((error: unknown) => {
          if (error instanceof StorefrontError) throw error;
          return null;
        })
      : Promise.resolve(null),
  ]);

  const products = new Map(catalog.products.map((product) => [product.id, product]));

  const lines: CartQuoteLine[] = await Promise.all(
    parsed.lines.map(async (line): Promise<CartQuoteLine> => {
      const product = products.get(line.product_id);

      if (!product) {
        return {
          lineId: line.lineId,
          productId: line.product_id,
          status: "unavailable",
          productName: null,
          unitPrice: null,
          total: null,
          optionsTotal: null,
          validationErrors: [],
        };
      }

      if (product.is_sold_out) {
        return {
          lineId: line.lineId,
          productId: line.product_id,
          status: "sold_out",
          productName: product.name,
          unitPrice: null,
          total: null,
          optionsTotal: null,
          validationErrors: [],
        };
      }

      const price = await computePublicPrice({
        slug: parsed.slug,
        product_id: line.product_id,
        variant_id: line.variant_id ?? null,
        quantity: line.quantity,
        selections: line.selections,
      });

      if (!price.ok) {
        return {
          lineId: line.lineId,
          productId: line.product_id,
          status: price.error === "invalid_configuration" ? "invalid_configuration" : "unpriceable",
          productName: product.name,
          unitPrice: null,
          total: null,
          optionsTotal: null,
          validationErrors: price.validation_errors ?? [],
        };
      }

      return {
        lineId: line.lineId,
        productId: line.product_id,
        status: "ok",
        productName: product.name,
        unitPrice: round(price.unit_price ?? 0),
        total: round(price.total ?? 0),
        optionsTotal: round(price.options_total ?? 0),
        validationErrors: [],
      };
    }),
  );

  const subtotal = round(
    lines.reduce((sum, line) => sum + (line.status === "ok" ? (line.total ?? 0) : 0), 0),
  );

  const deliveryFee =
    parsed.fulfillmentType === "entrega" && fulfillment?.isValid
      ? (fulfillment.deliveryFee ?? 0)
      : null;

  const minimumOrderAmount = fulfillment?.minimumOrderAmount ?? null;
  const minimumOrderMet = minimumOrderAmount === null || subtotal >= minimumOrderAmount;
  const hasBlockingIssues = lines.some((line) => line.status !== "ok");

  return {
    currency: "BRL",
    quotedAt: new Date().toISOString(),
    configurationVersion: fulfillment?.configurationVersion ?? null,
    fulfillmentType: parsed.fulfillmentType ?? null,
    fulfillmentValid: fulfillment ? fulfillment.isValid : false,
    fulfillmentErrors: fulfillment?.validationErrors ?? [],
    storeIsOpen: fulfillment?.storeIsOpen ?? false,
    subtotal,
    deliveryFee,
    minimumOrderAmount,
    minimumOrderMet,
    estimatedMinutes: fulfillment?.estimatedMinutes ?? null,
    total: round(subtotal + (deliveryFee ?? 0)),
    hasBlockingIssues,
    lines,
  };
}
