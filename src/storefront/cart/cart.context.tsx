/**
 * Estado do carrinho público. Um único provider por loja.
 *
 * Regras não negociáveis:
 * - o carrinho vive apenas no aparelho, isolado pelo slug canônico;
 * - nenhum total exibido para decisão vem do navegador: o servidor recotiza
 *   o carrinho inteiro em uma única chamada;
 * - mudança de preço, item esgotado ou item removido do cardápio é sempre
 *   comunicada de forma explícita, nunca aplicada em silêncio;
 * - nada do carrinho é gravado no banco nesta fase.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { MAX_CART_LINES } from "@/lib/cart-contracts";
import { useCustomerWizard } from "@/storefront/customer/customer-wizard.context";
import { CART_MESSAGES } from "./cart.errors";
import { CartQuoteError, postCartQuote } from "./cart.api";
import { clearCart, isCartStorageAvailable, readCart, writeCart } from "./cart.storage";
import { clampQuantity, emptyCart, lineSignature, newLineId } from "./cart.validation";
import type {
  CartDocument,
  CartLine,
  CartLineInput,
  CartLineIssue,
  CartQuote,
  CartQuoteLine,
  CartQuoteState,
} from "./cart.types";

const QUOTE_DEBOUNCE_MS = 400;

export type CartLineView = {
  line: CartLine;
  quote: CartQuoteLine | null;
  issues: CartLineIssue[];
  /** Total autoritativo do servidor quando disponível. */
  total: number | null;
  unitPrice: number | null;
  blocked: boolean;
};

type CartContextValue = {
  slug: string;
  hydrated: boolean;
  storageAvailable: boolean;
  lines: CartLine[];
  views: CartLineView[];
  itemCount: number;
  quote: CartQuote | null;
  quoteState: CartQuoteState;
  quoteMessage: string | null;
  /** Soma informativa do último valor conhecido — usada só offline. */
  fallbackSubtotal: number;
  subtotal: number;
  deliveryFee: number | null;
  total: number;
  minimumOrderAmount: number | null;
  minimumOrderMet: boolean;
  canCheckout: boolean;
  hasBlockingIssues: boolean;
  addLine: (input: CartLineInput) => { lineId: string; merged: boolean } | null;
  replaceLine: (lineId: string, input: CartLineInput) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  incrementLine: (lineId: string, direction: 1 | -1) => void;
  setNotes: (lineId: string, notes: string) => void;
  removeLine: (lineId: string) => void;
  emptyAll: () => void;
  revalidate: () => void;
};

const Ctx = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCart fora do provider");
  return value;
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const wizard = useCustomerWizard();
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [cart, setCart] = useState<CartDocument>(() => emptyCart(slug));
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoteState, setQuoteState] = useState<CartQuoteState>("idle");
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);

  const requestSeq = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidratação apenas no cliente: SSR nunca conhece o carrinho.
  useEffect(() => {
    setStorageAvailable(isCartStorageAvailable());
    setCart(readCart(slug));
    setHydrated(true);
  }, [slug]);

  const persist = useCallback(
    (next: CartDocument) => {
      setCart(next);
      writeCart(slug, next);
    },
    [slug],
  );

  const mutate = useCallback(
    (updater: (lines: CartLine[]) => CartLine[]) => {
      setCart((current) => {
        const next: CartDocument = {
          ...current,
          slug,
          lines: updater(current.lines),
          updatedAt: new Date().toISOString(),
        };
        writeCart(slug, next);
        return next;
      });
    },
    [slug],
  );

  const orderingContext = wizard.orderingContext;
  const fulfillmentType = orderingContext?.type ?? null;
  const deliveryAreaId =
    orderingContext && orderingContext.type === "entrega"
      ? orderingContext.address.neighborhoodId
      : null;
  const configurationVersion = wizard.configuration?.configurationVersion ?? null;

  const linesKey = useMemo(
    () =>
      cart.lines
        .map(
          (line) =>
            `${line.lineId}:${line.productId}:${line.variantId ?? "-"}:${line.quantity}:${line.selections
              .map((s) => `${s.option_item_id}x${s.quantity}`)
              .sort()
              .join(",")}`,
        )
        .join("|"),
    [cart.lines],
  );

  const runQuote = useCallback(async () => {
    const currentLines = cart.lines;
    if (currentLines.length === 0) {
      setQuote(null);
      setQuoteState("idle");
      setQuoteMessage(null);
      return;
    }

    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setQuoteState("loading");

    try {
      const result = await postCartQuote(slug, {
        fulfillmentType,
        deliveryAreaId,
        configurationVersion,
        lines: currentLines.map((line) => ({
          lineId: line.lineId,
          product_id: line.productId,
          variant_id: line.variantId,
          quantity: line.quantity,
          selections: line.selections.map((s) => ({
            option_group_id: s.option_group_id,
            option_item_id: s.option_item_id,
            quantity: s.quantity,
          })),
        })),
      });

      // Resposta fora de ordem é descartada.
      if (seq !== requestSeq.current) return;

      setQuote(result);
      setQuoteState("ready");
      setQuoteMessage(
        result.hasBlockingIssues || !result.minimumOrderMet
          ? null
          : !result.storeIsOpen
            ? CART_MESSAGES.storeClosed
            : null,
      );
    } catch (error) {
      if (seq !== requestSeq.current) return;
      const code = error instanceof CartQuoteError ? error.code : "failed";
      setQuoteState(code === "offline" ? "offline" : "error");
      setQuoteMessage(
        code === "offline"
          ? CART_MESSAGES.offline
          : code === "rate_limited"
            ? CART_MESSAGES.rateLimited
            : CART_MESSAGES.quoteFailed,
      );
    }
  }, [cart.lines, slug, fulfillmentType, deliveryAreaId, configurationVersion]);

  // Recotização com debounce a cada mudança relevante.
  useEffect(() => {
    if (!hydrated) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runQuote();
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // `runQuote` muda junto com as linhas; usamos a chave estável.
  }, [hydrated, linesKey, fulfillmentType, deliveryAreaId, configurationVersion, runQuote]);

  // Volta do segundo plano ou da rede: recotiza.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => void runQuote();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [runQuote]);

  const addLine = useCallback<CartContextValue["addLine"]>(
    (input) => {
      const signature = lineSignature({
        productId: input.productId,
        variantId: input.variantId,
        selections: input.selections,
        notes: input.notes,
      });

      let outcome: { lineId: string; merged: boolean } | null = null;

      setCart((current) => {
        const existing = current.lines.find(
          (line) =>
            lineSignature({
              productId: line.productId,
              variantId: line.variantId,
              selections: line.selections,
              notes: line.notes,
            }) === signature,
        );

        if (!existing && current.lines.length >= MAX_CART_LINES) {
          outcome = null;
          return current;
        }

        const now = new Date().toISOString();
        const lines = existing
          ? current.lines.map((line) =>
              line.lineId === existing.lineId
                ? {
                    ...line,
                    quantity: clampQuantity(line.quantity + input.quantity, input),
                    lastKnownUnitPrice: input.lastKnownUnitPrice,
                    lastKnownTotal: input.lastKnownTotal,
                    updatedAt: now,
                  }
                : line,
            )
          : [
              ...current.lines,
              {
                ...input,
                lineId: newLineId(),
                quantity: clampQuantity(input.quantity, input),
                addedAt: now,
                updatedAt: now,
              } satisfies CartLine,
            ];

        outcome = {
          lineId: existing ? existing.lineId : lines[lines.length - 1].lineId,
          merged: Boolean(existing),
        };

        const next: CartDocument = { ...current, slug, lines, updatedAt: now };
        writeCart(slug, next);
        return next;
      });

      return outcome;
    },
    [slug],
  );

  const replaceLine = useCallback<CartContextValue["replaceLine"]>(
    (lineId, input) => {
      mutate((lines) =>
        lines.map((line) =>
          line.lineId === lineId
            ? {
                ...line,
                ...input,
                lineId,
                quantity: clampQuantity(input.quantity, input),
                updatedAt: new Date().toISOString(),
              }
            : line,
        ),
      );
    },
    [mutate],
  );

  const setQuantity = useCallback<CartContextValue["setQuantity"]>(
    (lineId, quantity) => {
      mutate((lines) =>
        lines.map((line) =>
          line.lineId === lineId
            ? {
                ...line,
                quantity: clampQuantity(quantity, line),
                updatedAt: new Date().toISOString(),
              }
            : line,
        ),
      );
    },
    [mutate],
  );

  const incrementLine = useCallback<CartContextValue["incrementLine"]>(
    (lineId, direction) => {
      mutate((lines) =>
        lines.map((line) => {
          if (line.lineId !== lineId) return line;
          const step = line.quantityStep > 0 ? line.quantityStep : 1;
          return {
            ...line,
            quantity: clampQuantity(line.quantity + step * direction, line),
            updatedAt: new Date().toISOString(),
          };
        }),
      );
    },
    [mutate],
  );

  const setNotes = useCallback<CartContextValue["setNotes"]>(
    (lineId, notes) => {
      mutate((lines) =>
        lines.map((line) =>
          line.lineId === lineId
            ? {
                ...line,
                notes: notes.trim() ? notes.slice(0, 280) : null,
                updatedAt: new Date().toISOString(),
              }
            : line,
        ),
      );
    },
    [mutate],
  );

  const removeLine = useCallback<CartContextValue["removeLine"]>(
    (lineId) => {
      mutate((lines) => lines.filter((line) => line.lineId !== lineId));
    },
    [mutate],
  );

  const emptyAll = useCallback(() => {
    clearCart(slug);
    persist(emptyCart(slug));
    setQuote(null);
    setQuoteState("idle");
    setQuoteMessage(null);
  }, [persist, slug]);

  const views = useMemo<CartLineView[]>(() => {
    const quoteMap = new Map((quote?.lines ?? []).map((line) => [line.lineId, line]));
    return cart.lines.map((line) => {
      const quoted = quoteMap.get(line.lineId) ?? null;
      const issues: CartLineIssue[] = [];

      if (quoted && quoted.status !== "ok") {
        issues.push(quoted.status as CartLineIssue);
      }
      if (
        quoted?.status === "ok" &&
        quoted.total !== null &&
        Math.abs(quoted.total - line.lastKnownTotal) > 0.009
      ) {
        issues.push("price_changed");
      }

      return {
        line,
        quote: quoted,
        issues,
        total: quoted?.status === "ok" ? quoted.total : null,
        unitPrice: quoted?.status === "ok" ? quoted.unitPrice : null,
        blocked: Boolean(quoted && quoted.status !== "ok"),
      };
    });
  }, [cart.lines, quote]);

  const fallbackSubtotal = useMemo(
    () => round(cart.lines.reduce((sum, line) => sum + line.lastKnownTotal, 0)),
    [cart.lines],
  );

  const itemCount = cart.lines.length;
  const subtotal = quoteState === "ready" && quote ? quote.subtotal : fallbackSubtotal;
  const deliveryFee = quoteState === "ready" && quote ? quote.deliveryFee : null;
  const total = quoteState === "ready" && quote ? quote.total : fallbackSubtotal;
  const minimumOrderAmount = quote?.minimumOrderAmount ?? null;
  const minimumOrderMet = quote ? quote.minimumOrderMet : true;
  const hasBlockingIssues = quote ? quote.hasBlockingIssues : false;

  const canCheckout =
    quoteState === "ready" &&
    Boolean(quote) &&
    itemCount > 0 &&
    !hasBlockingIssues &&
    minimumOrderMet &&
    Boolean(orderingContext);

  const value = useMemo<CartContextValue>(
    () => ({
      slug,
      hydrated,
      storageAvailable,
      lines: cart.lines,
      views,
      itemCount,
      quote,
      quoteState,
      quoteMessage,
      fallbackSubtotal,
      subtotal,
      deliveryFee,
      total,
      minimumOrderAmount,
      minimumOrderMet,
      canCheckout,
      hasBlockingIssues,
      addLine,
      replaceLine,
      setQuantity,
      incrementLine,
      setNotes,
      removeLine,
      emptyAll,
      revalidate: () => void runQuote(),
    }),
    [
      slug,
      hydrated,
      storageAvailable,
      cart.lines,
      views,
      itemCount,
      quote,
      quoteState,
      quoteMessage,
      fallbackSubtotal,
      subtotal,
      deliveryFee,
      total,
      minimumOrderAmount,
      minimumOrderMet,
      canCheckout,
      hasBlockingIssues,
      addLine,
      replaceLine,
      setQuantity,
      incrementLine,
      setNotes,
      removeLine,
      emptyAll,
      runQuote,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
