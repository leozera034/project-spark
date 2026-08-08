import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: () => (
    <RequireAuth signIn={AUTH_ROUTES.adminSignIn}>
      <RequirePasswordChangeCompleted>
        <RequireEnvironment environment="platform_admin">
          <AdminLayout />
        </RequireEnvironment>
      </RequirePasswordChangeCompleted>
    </RequireAuth>
  ),
});

function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 lg:px-8">
        <BrandLogo lockup="horizontal" className="h-7 w-auto" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void signOut("local").then(() => navigate({ to: AUTH_ROUTES.adminSignIn as never }))
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
