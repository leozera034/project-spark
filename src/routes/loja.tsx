import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/loja")({
  component: StorefrontLayout,
});

function StorefrontLayout() {
  return (
    <>
      <Outlet />
    </>
  );
}
