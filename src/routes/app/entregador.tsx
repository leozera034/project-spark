import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BrandSymbol } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/app/entregador")({
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
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 lg:px-8">
        <BrandSymbol className="h-8 w-auto" />
        <div className="flex items-center gap-3">
        <ThemeToggle />
        <Button
          variant="outline"
          onClick={() =>
            void signOut("local").then(() => navigate({ to: AUTH_ROUTES.courierSignIn as never }))
          }
        >
          Sair
        </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
