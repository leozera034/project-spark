import { supabase } from "@/integrations/supabase/client";
import type { FulfillmentType, FulfillmentValidation, PublicFulfillmentConfiguration } from "./customer-wizard.types";

const TIMEOUT_MS = 10_000;

type PublicSupportResponse<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
};

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("request_failed"));
      },
    );
  });
}

async function invokePublicSupport<T>(action: string, input: Record<string, unknown>): Promise<T> {
  const result = await supabase.functions.invoke("pediu-public-support", {
    body: { action, input },
  });
  if (result.error) throw result.error;

  const payload = (result.data ?? {}) as PublicSupportResponse<T>;
  if (payload.ok !== true || payload.data == null) {
    throw new Error(payload.error || "request_failed");
  }
  return payload.data;
}

export function getFulfillmentConfiguration(slug: string): Promise<PublicFulfillmentConfiguration> {
  return withTimeout(invokePublicSupport<PublicFulfillmentConfiguration>("storefront_fulfillment", { slug }));
}

export function postFulfillmentValidation(input: {
  slug: string;
  fulfillmentType: FulfillmentType;
  deliveryAreaId?: string | null;
  configurationVersion?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<FulfillmentValidation> {
  return withTimeout(invokePublicSupport<FulfillmentValidation>("storefront_fulfillment_validate", input));
}
