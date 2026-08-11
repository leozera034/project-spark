import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BrandSymbol } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/app/entregador")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: () => (
    <RequireAuth signIn={AUTH_ROUTES.courierSignIn}>
      <RequirePasswordChangeCompleted>
        <RequireEnvironment environment="courier">
          <CourierAppLayout />
        </RequireEnvironment>
      </RequirePasswordChangeCompleted>
    </RequireAuth>
  ),
});

function CourierAppLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-background pb-[env(safe-area-inset-bottom)]">
      <header
        className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6 lg:px-8"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <BrandSymbol className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            aria-label="Sair"
            onClick={() =>
              void signOut("local").then(() => navigate({ to: AUTH_ROUTES.courierSignIn as never }))
            }
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
