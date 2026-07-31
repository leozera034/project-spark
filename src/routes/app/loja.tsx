import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/app/loja")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: () => (
    <RequireAuth signIn={AUTH_ROUTES.storeSignIn}>
      <RequirePasswordChangeCompleted>
        <RequireEnvironment environment="store">
          <StoreAppLayout />
        </RequireEnvironment>
      </RequirePasswordChangeCompleted>
    </RequireAuth>
  ),
});

function StoreAppLayout() {
  const { authContext, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 lg:px-8">
        <BrandLogo lockup="horizontal" className="h-7 w-auto" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {authContext?.full_name ?? "Equipe"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void signOut("local").then(() => navigate({ to: AUTH_ROUTES.storeSignIn as never }))
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
