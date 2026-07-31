import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Redefinição de acesso do entregador (D-033).
 *
 * Executa somente no servidor. O cliente envia apenas o identificador do
 * entregador; loja, papel e identidade são resolvidos no banco.
 * A senha temporária é retornada uma única vez e nunca é persistida ou logada.
 */

const inputSchema = z.object({ courier_id: z.string().uuid() });

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

export const resetCourierAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Autorização no servidor: somente proprietário ou gerente ativo da mesma loja.
    const { data: rows, error } = await supabaseAdmin.rpc("authorize_courier_reset", {
      _actor_user_id: context.userId,
      _courier_id: data.courier_id,
    });

    const identity = Array.isArray(rows) ? rows[0] : null;
    if (error || !identity) {
      // Resposta genérica para qualquer caso não autorizado ou inexistente.
      throw new Error("nao_autorizado");
    }

    const temporaryPassword = generateTemporaryPassword();

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      identity.auth_user_id,
      { password: temporaryPassword },
    );
    if (updateError) throw new Error("falha_redefinicao");

    const { error: flagError } = await supabaseAdmin
      .from("courier_auth_identities")
      .update({
        requires_password_change: true,
        is_login_enabled: true,
        temporary_password_issued_at: new Date().toISOString(),
      })
      .eq("id", identity.identity_id);
    if (flagError) throw new Error("falha_redefinicao");

    // Auditoria sem senha, sem e-mail sintético e sem token.
    await supabaseAdmin.from("audit_logs").insert({
      store_id: identity.store_id,
      actor_user_id: context.userId,
      actor_kind: "loja",
      action: "courier_access_reset",
      entity: "courier_auth_identities",
      entity_id: identity.identity_id,
      context: { courier_id: data.courier_id },
    });

    return { temporary_password: temporaryPassword };
  });
