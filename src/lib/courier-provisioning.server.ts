import { z } from "zod";

import { courierIdentifierToSyntheticEmail } from "@/auth/courierIdentifier";
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

const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTemporaryPassword(length = 14): string {
  const bytes = new Uint32Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let value = "";
  for (const byte of bytes) value += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  return `${value}7a`;
}

async function hashRequest(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function provisionCourierForStore(
  data: CourierCreationInput,
  actorUserId: string,
): Promise<CourierCreationResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: storeId, error: resolveError } = await supabaseAdmin.rpc(
    "resolve_courier_create_store_admin",
    { _actor_user_id: actorUserId, _store_id: null } as never,
  );

  if (resolveError || typeof storeId !== "string") {
    console.error("[courier-provisioning] store resolution failed", resolveError?.code);
    throw new Error("NAO_AUTORIZADO");
  }

  const syntheticEmail = await courierIdentifierToSyntheticEmail(data.loginIdentifier);
  const temporaryPassword = generateTemporaryPassword();
  const requestHash = await hashRequest(
    [data.fullName, data.phone, data.loginIdentifier, data.canAcceptDeliveries, data.isActive].join("|"),
  );
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: syntheticEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { role: "entregador", full_name: data.fullName },
  });

  if (authError || !authData.user) {
    if (authError?.message.includes("already registered")) throw new Error("USUARIO_EXISTENTE");
    throw new Error("FALHA_AUTH");
  }

  const authUserId = authData.user.id;
  const { data: provisioned, error: provisionError } = await supabaseAdmin.rpc(
    "provision_store_courier_admin",
    {
      _actor_user_id: actorUserId,
      _store_id: storeId,
      _auth_user_id: authUserId,
      _full_name: data.fullName,
      _phone: data.phone,
      _login_identifier: data.loginIdentifier,
      _synthetic_email: syntheticEmail,
      _can_accept_deliveries: data.canAcceptDeliveries,
      _is_active: data.isActive,
      _idempotency_key: data.idempotencyKey,
      _request_hash: requestHash,
    },
  );

  if (provisionError || !provisioned) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    await supabaseAdmin.rpc("fail_courier_provisioning_admin", {
      _store_id: storeId,
      _idempotency_key: data.idempotencyKey,
    });
    throw new Error(provisionError?.message ?? "FALHA_PROVISIONAMENTO");
  }

  const result = provisioned as { courierId?: string; courier_id?: string };
  const courierId = result.courierId ?? result.courier_id;
  if (!courierId) throw new Error("FALHA_PROVISIONAMENTO");

  return {
    courierId,
    created: true,
    loginIdentifier: data.loginIdentifier,
    temporaryPassword,
  };
}