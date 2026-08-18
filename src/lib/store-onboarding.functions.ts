import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Autocadastro de lojas (produção).
 *
 * O navegador nunca recebe credenciais privilegiadas. A criação do usuário e
 * a saga de provisionamento rodam na Edge Function allowlisted do Supabase
 * externo, que recebe as secret keys automaticamente pela própria plataforma.
 */

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen");

const createSchema = z.object({
  storeName: z.string().trim().min(3).max(80),
  slug: slugSchema,
  segment: z.string().trim().max(60).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2),
  phone: z.string().trim().min(8).max(20),
  ownerName: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(72),
  planCode: z.enum(["essencial", "profissional", "avancado"]).default("essencial"),
});

export type CreateStoreAccountInput = z.input<typeof createSchema>;

export const checkStoreSlug = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().trim().max(80) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("check_public_store_slug", {
      _slug: data.slug,
    } as never);

    if (error) {
      return { slug: data.slug, available: false, reason: "indisponivel" as string | null };
    }

    return result as { slug: string; available: boolean; reason: string | null };
  });

export const createStoreAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const { invokePediuBackendAction, PediuBackendApiError } = await import(
      "@/integrations/supabase/client.server"
    );

    try {
      return await invokePediuBackendAction<{ storeId: string; slug: string }>({
        action: "create_store_account",
        input: {
          ...data,
          email: data.email.toLowerCase(),
          state: data.state.toUpperCase(),
        },
      });
    } catch (error) {
      if (error instanceof PediuBackendApiError) {
        switch (error.code) {
          case "slug_in_use":
            throw new Error("Esse endereço de loja já está em uso.");
          case "invalid_slug":
            throw new Error("Endereço de loja inválido.");
          case "email_in_use":
            throw new Error("Já existe uma conta com esse e-mail. Entre com ela ou use outro e-mail.");
          case "invalid_input":
            throw new Error("Revise os dados informados e tente novamente.");
          case "account_creation_failed":
            throw new Error("Não foi possível criar o acesso do proprietário.");
          default:
            break;
        }
      }

      console.error("[store-onboarding] external Edge provisioning failed");
      throw new Error("Não foi possível criar a loja agora. Tente novamente.");
    }
  });
