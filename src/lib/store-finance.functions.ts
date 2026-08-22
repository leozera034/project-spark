import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

function rpcCaller(client: { rpc: unknown }): RpcCaller {
  return client.rpc as RpcCaller;
}

export type PayoutSpeed = "standard" | "daily" | "fast" | "instant";

export interface StoreFinancialSettlement {
  id: string;
  orderId: string | null;
  orderNumber: number | null;
  grossCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
  merchantPayableCents: number;
  status: string;
  availableAt: string | null;
  createdAt: string;
}

export interface StorePayoutHistoryItem {
  id: string;
  speed: PayoutSpeed;
  grossCents: number;
  feeBps: number;
  feeCents: number;
  netCents: number;
  status: string;
  requestedAt: string | null;
  targetReleaseAt: string | null;
  paidAt: string | null;
  completedAt: string | null;
  message: string | null;
}

export interface StoreFinancialCenter {
  storeId: string;
  currency: "BRL";
  balances: {
    availableCents: number;
    pendingCents: number;
    reservedCents: number;
    transferredCents: number;
  };
  connection: {
    configured: boolean;
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    transfersEnabled: boolean;
  };
  fees: {
    orderApplicationFeeBps: number;
    payoutStandardFeeBps: number;
    payoutDailyFeeBps: number;
    payoutFastFeeBps: number;
    payoutInstantFeeBps: number;
  };
  payoutPreference: {
    speed: PayoutSpeed;
    automatic: boolean;
    minimumPayoutCents: number;
  };
  automaticPayoutAvailable: boolean;
  settlements: StoreFinancialSettlement[];
  payouts: StorePayoutHistoryItem[];
  generatedAt: string;
}

const storeIdSchema = z.object({ storeId: z.string().uuid() });

export const getStoreFinancialCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_my_store_financial_center", {
      _store_id: data.storeId,
    });
    if (result.error) throw result.error;
    return result.data as StoreFinancialCenter;
  });

export const requestStorePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      storeId: z.string().uuid(),
      speed: z.enum(["standard", "daily", "fast", "instant"]),
      idempotencyKey: z.string().min(8).max(160),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("request_my_store_payout", {
      _store_id: data.storeId,
      _payout_speed: data.speed,
      _idempotency_key: data.idempotencyKey,
    });
    if (result.error) throw result.error;
    return result.data as { id: string; status: string; net_payout_cents: number; reused?: boolean };
  });
