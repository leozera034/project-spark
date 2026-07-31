import { Outlet, createFileRoute } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";
import { DemoProvider } from "@/demo/state/DemoProvider";

export const Route = createFileRoute("/preview")({
  component: PreviewLayout,
});

function PreviewLayout() {
  return (
    <DemoProvider>
      <Outlet />
      <Toaster position="top-center" />
    </DemoProvider>
  );
}
