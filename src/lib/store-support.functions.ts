import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
function rpcCaller(client: { rpc: unknown }): RpcCaller { return client.rpc as RpcCaller; }

export type SupportCategory = "pedidos" | "cardapio" | "entregas" | "financeiro" | "pagamentos" | "conta" | "integracoes" | "outro";
export type SupportStatus = "aberto" | "em_atendimento" | "aguardando_loja" | "resolvido" | "fechado";

export interface SupportTicketListItem {
  id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  priority: "normal" | "alta" | "urgente";
  lastMessageAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
export interface StoreSupportCenter {
  summary: { total: number; active: number; resolved: number };
  items: SupportTicketListItem[];
  generatedAt: string;
}
export interface StoreSupportTicketDetail {
  ticket: Omit<SupportTicketListItem, "lastMessageAt" | "messageCount" | "resolvedAt"> & { resolvedAt: string | null };
  messages: Array<{ id: string; authorKind: "loja" | "admin" | "sistema"; body: string; createdAt: string }>;
}

const storeSchema = z.object({ storeId: z.string().uuid() });
const categorySchema = z.enum(["pedidos","cardapio","entregas","financeiro","pagamentos","conta","integracoes","outro"]);

export const getStoreSupportCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_my_store_support_center", { _store_id: data.storeId, _limit: 200, _offset: 0 });
    if (result.error) throw result.error;
    return result.data as StoreSupportCenter;
  });

export const getStoreSupportTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: z.string().uuid(), ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("get_my_store_support_ticket", { _store_id: data.storeId, _ticket_id: data.ticketId });
    if (result.error) throw result.error;
    return result.data as StoreSupportTicketDetail;
  });

export const openStoreSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: z.string().uuid(), category: categorySchema, subject: z.string().trim().min(3).max(160), message: z.string().trim().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("open_my_store_support_ticket", { _store_id: data.storeId, _category: data.category, _subject: data.subject, _message: data.message });
    if (result.error) throw result.error;
    return result.data as { id: string; status: SupportStatus; createdAt: string };
  });

export const replyStoreSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: z.string().uuid(), ticketId: z.string().uuid(), message: z.string().trim().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("reply_my_store_support_ticket", { _store_id: data.storeId, _ticket_id: data.ticketId, _message: data.message });
    if (result.error) throw result.error;
    return result.data as { ok: boolean; ticketId: string; status: SupportStatus; updatedAt: string };
  });

export const closeStoreSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeId: z.string().uuid(), ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await rpcCaller(context.supabase)("close_my_store_support_ticket", { _store_id: data.storeId, _ticket_id: data.ticketId });
    if (result.error) throw result.error;
    return result.data as { ok: boolean; ticketId: string; status: SupportStatus };
  });
