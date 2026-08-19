import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  lookupCepBrasilApi,
  lookupCnpjBrasilApi,
} from "@/integrations/providers/brasil-api.server";

const cepSchema = z.object({
  cep: z.string().trim().min(8).max(10),
});

const cnpjSchema = z.object({
  cnpj: z.string().trim().min(14).max(18),
});

export const lookupCep = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cepSchema.parse(data))
  .handler(async ({ data }) => lookupCepBrasilApi(data.cep));

export const lookupCnpj = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cnpjSchema.parse(data))
  .handler(async ({ data }) => lookupCnpjBrasilApi(data.cnpj));
