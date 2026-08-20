import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

export type ProfessionalServiceOrderStatus =
  | "requested"
  | "awaiting_payment"
  | "paid"
  | "in_progress"
  | "delivered"
  | "cancelled"
  | "refunded";

export type ProfessionalService = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  is_active: boolean;
  sort_order: number;
  latest_order: null | {
    id: string;
    status: ProfessionalServiceOrderStatus;
    price_cents: number | null;
    requested_at: string;
    paid_at: string | null;
    in_progress_at: string | null;
    delivered_at: string | null;
  };
};

export type ProfessionalServiceOrder = {
  id: string;
  service_id: string;
  service_code: string;
  service_name: string;
  status: ProfessionalServiceOrderStatus;
  price_cents: number | null;
  currency: string;
  notes: string | null;
  stripe_checkout_session_id?: string | null;
  checkout_url?: string | null;
  requested_at: string;
  paid_at: string | null;
  in_progress_at: string | null;
  delivered_at: string | null;
  cancelled_at?: string | null;
};

export type ProfessionalServiceCheckout = {
  ok: true;
  reused: boolean;
  provider: "stripe";
  orderId: string;
  checkoutSessionId: string;
  checkoutUrl: string;
};

export async function listProfessionalServices(storeId: string): Promise<ProfessionalService[]> {
  const { data, error } = await rpc("list_professional_services", { _store_id: storeId });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfessionalService[];
}

export async function listProfessionalServiceOrders(storeId: string): Promise<ProfessionalServiceOrder[]> {
  const { data, error } = await rpc("list_store_professional_service_orders", { _store_id: storeId });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfessionalServiceOrder[];
}

export async function requestProfessionalService(storeId: string, serviceCode: string, notes: string) {
  const { data, error } = await rpc("request_professional_service", {
    _store_id: storeId,
    _service_code: serviceCode,
    _notes: notes.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; status: ProfessionalServiceOrderStatus; price_cents: number; currency: string; service_code: string; service_name: string };
}

export async function createProfessionalServiceCheckout(storeId: string, orderId: string): Promise<ProfessionalServiceCheckout> {
  const idempotencyKey = `professional-service-${orderId}-${Date.now()}`;
  const { data, error } = await supabase.functions.invoke("comandiva-professional-services?action=create_checkout", {
    headers: { "x-idempotency-key": idempotencyKey },
    body: { storeId, orderId },
  });
  if (error) throw new Error(error.message || "CHECKOUT_FAILED");
  if (!data?.ok || typeof data.checkoutUrl !== "string") throw new Error("CHECKOUT_FAILED");
  return data as ProfessionalServiceCheckout;
}
