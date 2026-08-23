import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
function rpcCaller(client: { rpc: unknown }): RpcCaller { return client.rpc as unknown as RpcCaller; }

export type PaymentExceptionStatus = "open" | "in_review" | "resolved";

export interface AdminPaymentExceptionItem {
  id: string;
  storeId: string;
  storeName: string;
  orderId: string;
  orderNumber: number;
  providerPaymentId: string;
  providerChargeId: string | null;
  kind: "late_terminal_payment";
  status: PaymentExceptionStatus;
  amountCents: number;
  currency: string;
  detectedAt: string;
  reviewedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  metadata: Record<string, unknown>;
}

export const listAdminPaymentExceptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    status: z.enum(["open", "in_review", "resolved"]).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("admin_list_payment_exception_tasks", {
      _status: data.status ?? null,
      _limit: 200,
      _offset: 0,
    });
    if (result.error) throw result.error;
    return result.data as { total: number; items: AdminPaymentExceptionItem[] };
  });

export const reviewAdminPaymentException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    taskId: z.string().uuid(),
    note: z.string().trim().max(1000).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("admin_review_payment_exception_task", {
      _task_id: data.taskId,
      _note: data.note ?? null,
    });
    if (result.error) throw result.error;
    return result.data as { ok: boolean; id: string; status: PaymentExceptionStatus; reviewedAt?: string; resolvedAt?: string };
  });
