import { supabase } from "@/integrations/supabase/client";
import type { ProductCapabilities, ProductType } from "./advanced-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

export type CategoryProductTemplate = {
  type: ProductType;
  label: string;
  capabilities: ProductCapabilities;
};

export type AdminCategoryProfile = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  default_capabilities: ProductCapabilities;
  product_templates: CategoryProductTemplate[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function adminListCategoryProfiles(): Promise<AdminCategoryProfile[]> {
  return unwrap<AdminCategoryProfile[]>(await rpc("admin_list_category_profiles"));
}

export async function adminSaveCategoryProfile(input: {
  id?: string | null;
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  capabilities: ProductCapabilities;
  templates: CategoryProductTemplate[];
  active: boolean;
  sortOrder: number;
}): Promise<string> {
  return unwrap<string>(await rpc("admin_save_category_profile", {
    _id: input.id ?? null,
    _code: input.code.trim().toLowerCase(),
    _name: input.name.trim(),
    _description: input.description?.trim() || null,
    _icon: input.icon?.trim() || null,
    _capabilities: input.capabilities,
    _templates: input.templates,
    _active: input.active,
    _sort_order: input.sortOrder,
  }));
}

export async function listActiveCategoryProfiles(): Promise<AdminCategoryProfile[]> {
  // Perfis ativos são deliberadamente legíveis por usuários autenticados; a escrita continua restrita ao admin SaaS.
  const { data, error } = await supabase
    .from("category_profiles")
    .select("id,code,name,description,icon,default_capabilities,product_templates,is_active,sort_order,created_at,updated_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminCategoryProfile[];
}
