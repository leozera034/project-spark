import { supabase } from "@/integrations/supabase/client";

import type { StoreConfiguration } from "./types";

// O schema Supabase gerado pode ficar atrás das migrations; o contrato é validado no RPC.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data;
}

export interface StoreAddressInput {
  storeId: string;
  postalCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
  expectedUpdatedAt: string;
}

export interface StoreLocationCoordinatesInput {
  storeId: string;
  latitude: number;
  longitude: number;
  source?: "manual_browser" | "manual_admin" | "google_geocoding";
  accuracyMeters?: number | null;
  expectedUpdatedAt: string;
}

export async function updateStoreAddress(input: StoreAddressInput): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("update_store_address", {
      _store_id: input.storeId,
      _postal_code: input.postalCode,
      _street: input.street,
      _address_number: input.addressNumber,
      _address_complement: input.addressComplement,
      _neighborhood: input.neighborhood,
      _city: input.city,
      _state: input.state,
      _expected_updated_at: input.expectedUpdatedAt,
    }),
  ) as StoreConfiguration;
}

export async function updateStoreLocationCoordinates(
  input: StoreLocationCoordinatesInput,
): Promise<StoreConfiguration> {
  return unwrap(
    await rpc("update_store_location_coordinates", {
      _store_id: input.storeId,
      _latitude: input.latitude,
      _longitude: input.longitude,
      _source: input.source ?? "manual_browser",
      _accuracy_meters: input.accuracyMeters ?? null,
      _expected_updated_at: input.expectedUpdatedAt,
    }),
  ) as StoreConfiguration;
}
