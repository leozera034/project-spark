import { Outlet, createFileRoute } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";
import { DemoProvider } from "@/demo/state/DemoProvider";

export const Route = createFileRoute("/loja")({
  component: StorefrontLayout,
});

function StorefrontLayout() {
  return (
    <DemoProvider>
      <Outlet />
      <Toaster position="top-center" />
    </DemoProvider>
  );
}
