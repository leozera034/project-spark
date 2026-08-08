import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const listSubscriptions = createServerFn({ method: "GET" })
  .validator((d: { search?: string; status?: string; limit?: number; offset?: number }) => d)
  .handler(async ({ data: input }) => {
    const { data, error } = await (supabase.rpc as any)("list_platform_subscriptions", {
      _search: input.search,
      _status: input.status,
      _limit: input.limit || 50,
      _offset: input.offset || 0,
    });
    if (error) throw error;
    return data;
  });

export const registerPayment = createServerFn({ method: "POST" })
  .validator(
    (d: {
      subscriptionId: string;
      amountCents: number;
      discountCents?: number;
      method: "manual_transfer" | "pix_manual" | "cash" | "other";
      notes?: string;
    }) =>
      z
        .object({
          subscriptionId: z.string().uuid(),
          amountCents: z.number().int().min(0),
          discountCents: z.number().int().min(0).optional(),
          method: z.enum(["manual_transfer", "pix_manual", "cash", "other"]),
          notes: z.string().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await (supabase.rpc as any)("register_manual_payment", {
      _subscription_id: data.subscriptionId,
      _amount_paid_cents: data.amountCents,
      _discount_amount_cents: data.discountCents || 0,
      _payment_method: data.method,
      _notes: data.notes,
    });
    if (error) throw error;
    return { success: true };
  });
