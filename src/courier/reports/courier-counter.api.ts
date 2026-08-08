import { supabase } from "@/integrations/supabase/client";
import { CourierDeliveryCounter, CourierDeliveryHistory } from "./courier-counter.types";

export async function getMyCourierDeliveryCounter(
  startDate?: string,
  endDate?: string,
): Promise<CourierDeliveryCounter> {
  const { data, error } = await supabase.rpc(
    "get_my_courier_delivery_counter" as never,
    {
      _start_date: startDate,
      _end_date: endDate,
    } as never,
  );
  if (error) throw error;
  return data as unknown as CourierDeliveryCounter;
}

export async function listMyCompletedDeliveries(
  limit = 50,
  offset = 0,
): Promise<CourierDeliveryHistory> {
  const { data, error } = await supabase.rpc(
    "list_my_completed_deliveries" as never,
    {
      _limit: limit,
      _offset: offset,
    } as never,
  );
  if (error) throw error;
  return data as unknown as CourierDeliveryHistory;
}
