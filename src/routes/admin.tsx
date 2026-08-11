import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <RequireAuth signIn={AUTH_ROUTES.adminSignIn}>
      <RequirePasswordChangeCompleted>
        <RequireEnvironment environment="platform_admin"><AdminLayout /></RequireEnvironment>
      </RequirePasswordChangeCompleted>
    </RequireAuth>
  ),
});

function AdminLayout() {
  const { authContext, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="pa-app-chrome">
      <header className="pa-app-header">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo lockup="horizontal" className="h-7 w-auto" />
          <span className="hidden h-6 w-px bg-border sm:block" />
          <div className="hidden sm:block">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.14em] text-brand"><ShieldCheck className="size-3" /> Administração</p>
            <p className="text-xs text-muted-foreground">Saúde, lojas, cobrança e operação</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <span className="hidden max-w-44 truncate text-sm font-semibold text-muted-foreground md:inline">{authContext?.full_name ?? "Administrador"}</span>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void signOut("local").then(() => navigate({ to: AUTH_ROUTES.adminSignIn as never }))}>Sair</Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
