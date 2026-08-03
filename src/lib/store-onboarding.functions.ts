import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Autocadastro de lojas (produção).
 *
 * Endpoint público, porém toda a decisão fica no servidor:
 *  - valida entrada com Zod;
 *  - cria o usuário no Auth via admin (nunca no navegador);
 *  - chama a saga `public.provision_store_with_owner` (idempotente);
 *  - compensa o Auth se o banco falhar.
 *
 * Nada de senha, chave de serviço ou detalhe interno é retornado ao cliente.
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

async function hashRequest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();
    const idempotencyKey = await hashRequest(`store-onboarding:${email}:${data.slug}`);
    const requestHash = await hashRequest(
      [data.storeName, data.slug, data.city, data.state, data.ownerName, email].join("|"),
    );

    // 1. Slug precisa estar livre antes de tocar no Auth.
    const { data: availability } = await supabaseAdmin.rpc("check_public_store_slug", {
      _slug: data.slug,
    } as never);
    const slugState = availability as { available: boolean; reason: string | null } | null;
    if (!slugState?.available) {
      throw new Error(
        slugState?.reason === "em_uso"
          ? "Esse endereço de loja já está em uso."
          : "Endereço de loja inválido.",
      );
    }

    // 2. Cria o usuário do proprietário no Auth.
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.ownerName, origin: "store_onboarding" },
    });

    if (createError || !created?.user) {
      const message = createError?.message ?? "";
      if (/already/i.test(message)) {
        throw new Error(
          "Já existe uma conta com esse e-mail. Entre com ela ou use outro e-mail.",
        );
      }
      throw new Error("Não foi possível criar o acesso do proprietário.");
    }

    const ownerUserId = created.user.id;

    // 3. Saga de banco (loja, configurações, horários, pagamentos, papel, assinatura).
    const { data: provisioned, error: provisionError } = await supabaseAdmin.rpc(
      "provision_store_with_owner",
      {
        _idempotency_key: idempotencyKey,
        _request_hash: requestHash,
        _owner_user_id: ownerUserId,
        _owner_full_name: data.ownerName,
        _store_name: data.storeName,
        _slug: data.slug,
        _city: data.city,
        _state: data.state,
        _segment: data.segment ?? null,
        _phone: data.phone,
        _plan_code: data.planCode,
        _origin: "autoatendimento",
        _requested_by: null,
      } as never,
    );

    if (provisionError || !provisioned) {
      // Compensação: remove o usuário criado para não deixar acesso órfão.
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId).catch(() => undefined);
      try {
        await supabaseAdmin.rpc("fail_store_provisioning", {
          _idempotency_key: idempotencyKey,
          _reason: provisionError?.message ?? "erro_desconhecido",
        } as never);
      } catch {
        // falha ao registrar a compensação não deve mascarar o erro original
      }
      console.error("[store-onboarding] falha na saga", provisionError);
      throw new Error("Não foi possível criar a loja agora. Tente novamente.");
    }

    const result = provisioned as { store_id: string; slug: string };
    return { storeId: result.store_id, slug: result.slug };
  });
