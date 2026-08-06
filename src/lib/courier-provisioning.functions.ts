import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { courierCreationSchema, provisionCourierForStore } from "@/lib/courier-provisioning.server";

export const createStoreCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => courierCreationSchema.parse(data))
  .handler(({ data, context }) => provisionCourierForStore(data, context.userId));
