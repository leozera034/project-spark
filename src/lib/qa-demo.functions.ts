import { createServerFn } from "@tanstack/react-start";

export const getDemoCenterStatus = createServerFn({ method: "GET" }).handler(async () => {
  const mod = await import("./qa-demo.server");
  if (!mod.isDemoEnvironmentEnabled()) {
    return { enabled: false as const, unlocked: false as const, profiles: [] };
  }
  const capability = await mod.readDemoCapability();
  return {
    enabled: true as const,
    unlocked: capability.valid,
    profiles: mod.listDemoProfiles(),
  };
});

export const unlockDemoCenter = createServerFn({ method: "POST" })
  .inputValidator((data: { accessKey: string }) => ({ accessKey: String(data?.accessKey ?? "") }))
  .handler(async ({ data }) => {
    const mod = await import("./qa-demo.server");
    return mod.unlockDemoCapability(data.accessKey);
  });

export const lockDemoCenter = createServerFn({ method: "POST" }).handler(async () => {
  const mod = await import("./qa-demo.server");
  return mod.clearDemoCapability();
});

export const requestDemoSession = createServerFn({ method: "POST" })
  .inputValidator((data: { profileId: string }) => ({ profileId: String(data?.profileId ?? "") }))
  .handler(async ({ data }) => {
    const mod = await import("./qa-demo.server");
    return mod.issueDemoMagicLink(data.profileId);
  });
