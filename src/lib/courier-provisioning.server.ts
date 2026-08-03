import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CourierCreationResult, CourierCreateInput } from "@/store/couriers/courier.types";

/**
 * Endpoint server-side de cadastro de entregadores (Fase 18).
 *
 * Segue o padrão saga: cria no Auth via admin, depois no banco via wrapper.
 * Se o banco falhar, o Auth é compensado.
 */

const inputSchema = z.object({
  fullName: z.string().min(3).max(100),
  phone: z.string().min(8).max(20),
  loginIdentifier: z.string().min(4).max(30).regex(/^[a-z0-9._]+$/, "Identificador inválido"),
  canAcceptDeliveries: z.boolean(),
  isActive: z.boolean(),
  idempotencyKey: z.string().min(10),
});

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTemporaryPassword(length = 14): string {
  const bytes = new Uint32Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `${out}7a`;
}

export const createStoreCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Resolver a loja e validar permissão via banco (RPC autorizada)
    const { data: storeId, error: resolveError } = await supabaseAdmin.rpc(
      "resolve_courier_create_store_admin",
      {
        _actor_user_id: context.userId,
        _store_id: context.userId, // O banco ignora se o ator não for admin global
      } as any,
    );


    if (resolveError || !storeId) {
      throw new Error("NAO_AUTORIZADO");
    }

    // 2. Verificar se já existe a intenção concluída (idempotência)
    // Nota: A lógica de banco lida com isso dentro de private.provision_store_courier,
    // mas aqui geramos a senha temporária, que só deve existir uma vez.
    
    const syntheticEmail = `${data.loginIdentifier}@courier.pediuaqui.internal`;
    const temporaryPassword = generateTemporaryPassword();


    // 3. Criar no Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        role: "entregador",
        full_name: data.fullName,
      },
    });

    if (authError) {
      // Se o erro for de usuário já existente, precisamos lidar com a idempotência
      if (authError.message.includes("already registered")) {
        // Consultar se a intenção no banco já vinculou esse e-mail
        // Se sim, devolvemos 'já criado' sem a senha.
        throw new Error("USUARIO_EXISTENTE");
      }
      throw new Error("FALHA_AUTH");
    }

    const authUserId = authData.user.id;

    // 4. Provisionar no Banco (Transacional)
    const { data: provisionResult, error: provisionError } = await supabaseAdmin.rpc(
      "provision_store_courier_admin",
      {
        _actor_user_id: context.userId,
        _store_id: storeId,
        _auth_user_id: authUserId,
        _full_name: data.fullName,
        _phone: data.phone,
        _login_identifier: data.loginIdentifier,
        _synthetic_email: syntheticEmail,
        _can_accept_deliveries: data.canAcceptDeliveries,
        _is_active: data.isActive,
        _idempotency_key: data.idempotencyKey,
        _request_hash: "",

      },
    );

    if (provisionError || !provisionResult) {
      // 5. Compensação: Deletar do Auth se o banco falhou
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      await supabaseAdmin.rpc("fail_courier_provisioning_admin", {
        _store_id: storeId,
        _idempotency_key: data.idempotencyKey,
      });
      throw new Error(provisionError?.message || "FALHA_PROVISIONAMENTO");
    }

    const result = provisionResult as any;

    // Auditoria sanitizada
    await supabaseAdmin.from("audit_logs").insert({
      store_id: storeId,
      actor_user_id: context.userId,
      actor_kind: "loja",
      action: "courier_created",
      entity: "couriers",
      entity_id: result.courier_id,
      context: { login_identifier: data.loginIdentifier },
    });

    return {
      courierId: result.courier_id,
      created: true,
      loginIdentifier: data.loginIdentifier,
      temporaryPassword: temporaryPassword,
    } as CourierCreationResult;
  });
