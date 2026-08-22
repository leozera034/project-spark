import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupportCategory, SupportStatus } from "@/lib/store-support.functions";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
function rpcCaller(client: { rpc: unknown }): RpcCaller { return client.rpc as RpcCaller; }

export interface AdminSupportTicketItem {
  id: string;
  storeId: string;
  storeName: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  priority: "normal" | "alta" | "urgente";
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
}
export interface AdminSupportTicketDetail {
  ticket: Omit<AdminSupportTicketItem, "lastMessageAt" | "messageCount"> & { updatedAt: string };
  messages: Array<{ id: string; authorKind: "loja" | "admin" | "sistema"; body: string; createdAt: string }>;
}

export const listAdminSupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ status: z.enum(["aberto","em_atendimento","aguardando_loja","resolvido","fechado"]).nullable().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("admin_list_store_support_tickets", { _status: data.status ?? null, _limit: 200, _offset: 0 });
    if (result.error) throw result.error;
    return result.data as { total: number; items: AdminSupportTicketItem[] };
  });

export const getAdminSupportTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("admin_get_store_support_ticket", { _ticket_id: data.ticketId });
    if (result.error) throw result.error;
    return result.data as AdminSupportTicketDetail;
  });

export const replyAdminSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ticketId: z.string().uuid(), message: z.string().trim().min(1).max(4000), status: z.enum(["em_atendimento","aguardando_loja","resolvido","fechado"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("admin_reply_store_support_ticket", { _ticket_id: data.ticketId, _message: data.message, _status: data.status });
    if (result.error) throw result.error;
    return result.data as { ok: boolean; ticketId: string; status: SupportStatus; updatedAt: string };
  });
