import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const getStoreAlerts = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await (supabase.rpc as any)('get_my_store_operational_alerts');
    if (error) throw error;
    return data;
  });

export const getCourierAlerts = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await (supabase.rpc as any)('get_my_courier_alerts');
    if (error) throw error;
    return data;
  });
