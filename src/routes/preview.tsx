import { Outlet, createFileRoute } from "@tanstack/react-router";

import { DemoProvider } from "@/demo/state/DemoProvider";

export const Route = createFileRoute("/preview")({
  component: PreviewLayout,
});

function PreviewLayout() {
  return (
    <DemoProvider>
      <Outlet />
    </DemoProvider>
  );
}
