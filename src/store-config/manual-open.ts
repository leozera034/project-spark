import { supabase } from "@/integrations/supabase/client";
import type { StoreConfiguration } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

export async function setManualStoreOpen(params: {
  storeId: string;
  open: boolean;
  expectedUpdatedAt: string | null;
}): Promise<StoreConfiguration> {
  const { data, error } = await rpc("set_my_store_manual_open", {
    _store_id: params.storeId,
    _open: params.open,
    _expected_updated_at: params.expectedUpdatedAt,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_FOUND");
  return data as StoreConfiguration;
}
