import { z } from "zod";

import type { CourierCreationResult } from "@/store/couriers/courier.types";

export const courierCreationSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  phone: z.string().trim().min(8).max(20),
  loginIdentifier: z.string().trim().min(4).max(30).regex(/^[a-z0-9._]+$/, "Identificador inválido"),
  canAcceptDeliveries: z.boolean(),
  isActive: z.boolean(),
  idempotencyKey: z.string().min(10).max(160),
});

export type CourierCreationInput = z.infer<typeof courierCreationSchema>;

/**
 * Privileged courier creation now runs inside the external Supabase Edge
 * gateway. The Lovable server forwards only the validated user's access token;
 * Auth admin credentials never leave Supabase.
 */
export async function provisionCourierForStore(
  data: CourierCreationInput,
  accessToken: string,
): Promise<CourierCreationResult> {
  const { invokePediuBackendAction, PediuBackendApiError } = await import(
    "@/integrations/supabase/client.server"
  );

  try {
    return await invokePediuBackendAction<CourierCreationResult>(
      {
        action: "create_courier",
        input: data,
      },
      { accessToken },
    );
  } catch (error) {
    if (error instanceof PediuBackendApiError) {
      switch (error.code) {
        case "unauthorized":
          throw new Error("NAO_AUTORIZADO");
        case "invalid_input":
          throw new Error("DADOS_INVALIDOS");
        case "courier_identifier_in_use":
          throw new Error("USUARIO_EXISTENTE");
        case "courier_auth_failed":
          throw new Error("FALHA_AUTH");
        case "courier_provision_failed":
          throw new Error("FALHA_PROVISIONAMENTO");
        default:
          break;
      }
    }

    console.error("[courier-provisioning] external Edge provisioning failed");
    throw new Error("FALHA_PROVISIONAMENTO");
  }
}
