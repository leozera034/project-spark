import { Outlet, createFileRoute } from "@tanstack/react-router";

import { DemoProvider } from "@/demo/state/DemoProvider";

export const Route = createFileRoute("/preview")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: PreviewLayout,
});

function PreviewLayout() {
  return (
    <DemoProvider>
      <Outlet />
    </DemoProvider>
  );
}
