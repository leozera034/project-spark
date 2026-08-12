import { slugSchema } from "@/lib/storefront.server";

export type PublicExperienceProfile = {
  code: string | null;
  name: string | null;
  icon: string | null;
  default_capabilities: Record<string, unknown>;
};

export async function loadPublicExperienceProfile(rawSlug: string): Promise<PublicExperienceProfile> {
  const slug = slugSchema.parse(rawSlug);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin.rpc as any)("storefront_experience_profile", {
    _slug: slug,
  });

  if (error) {
    console.warn("[storefront] experience profile unavailable; using capability fallback", error.message);
    return { code: null, name: null, icon: null, default_capabilities: {} };
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    code: typeof payload.code === "string" ? payload.code : null,
    name: typeof payload.name === "string" ? payload.name : null,
    icon: typeof payload.icon === "string" ? payload.icon : null,
    default_capabilities:
      payload.default_capabilities && typeof payload.default_capabilities === "object"
        ? (payload.default_capabilities as Record<string, unknown>)
        : {},
  };
}
