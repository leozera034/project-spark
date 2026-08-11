import { supabase } from "@/integrations/supabase/client";
import { CourierDeliveryCounter, CourierDeliveryHistory } from "./courier-counter.types";

type RpcResult = { data: unknown; error: unknown };
type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

const rpc = supabase.rpc as unknown as RpcCaller;

export async function getMyCourierDeliveryCounter(
  startDate?: string,
  endDate?: string,
): Promise<CourierDeliveryCounter> {
  const { data, error } = await rpc("get_my_courier_delivery_counter", {
    _start_date: startDate,
    _end_date: endDate,
  });
  if (error) throw error;
  return data as CourierDeliveryCounter;
}

export async function listMyCompletedDeliveries(
  limit = 50,
  offset = 0,
): Promise<CourierDeliveryHistory> {
  const { data, error } = await rpc("list_my_completed_deliveries", {
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return data as CourierDeliveryHistory;
}
