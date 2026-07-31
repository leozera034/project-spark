/**
 * Acesso do navegador aos endpoints públicos de atendimento.
 * Timeout, retry manual e proteção contra resposta fora de ordem.
 */
import {
  fetchStorefrontFulfillment,
  validateStorefrontFulfillment,
} from "@/lib/fulfillment.functions";
import type {
  FulfillmentType,
  FulfillmentValidation,
  PublicFulfillmentConfiguration,
} from "./customer-wizard.types";

const TIMEOUT_MS = 10_000;

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

export async function getFulfillmentConfiguration(
  slug: string,
): Promise<PublicFulfillmentConfiguration> {
  return withTimeout(fetchStorefrontFulfillment({ data: { slug } }));
}

export async function postFulfillmentValidation(input: {
  slug: string;
  fulfillmentType: FulfillmentType;
  deliveryAreaId?: string | null;
  configurationVersion?: string | null;
}): Promise<FulfillmentValidation> {
  return withTimeout(validateStorefrontFulfillment({ data: input }));
}
