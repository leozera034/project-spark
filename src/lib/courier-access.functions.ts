import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Redefinição de acesso do entregador.
 *
 * A autorização tenant-aware, a atualização do Auth e a auditoria executam na
 * Edge Function do Supabase externo. O servidor Lovable apenas encaminha o
 * token do usuário já validado; a senha temporária continua sendo retornada
 * uma única vez e nunca é persistida ou logada pelo app.
 */
const inputSchema = z.object({ courier_id: z.string().uuid() });

export const resetCourierAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { invokePediuBackendAction, PediuBackendApiError } = await import(
      "@/integrations/supabase/client.server"
    );

    try {
      const result = await invokePediuBackendAction<{ temporaryPassword: string }>(
        {
          action: "reset_courier_access",
          input: data,
        },
        { accessToken: context.accessToken },
      );
      return { temporary_password: result.temporaryPassword };
    } catch (error) {
      if (error instanceof PediuBackendApiError) {
        if (error.code === "unauthorized") throw new Error("nao_autorizado");
        if (error.code === "courier_reset_failed") throw new Error("falha_redefinicao");
      }
      console.error("[courier-access] external Edge reset failed");
      throw new Error("falha_redefinicao");
    }
  });
