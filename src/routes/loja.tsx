import { Outlet, createFileRoute } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/loja")({
  component: StorefrontLayout,
});

function StorefrontLayout() {
  return (
    <>
      <Outlet />
      <Toaster position="top-center" />
    </>
  );
}
