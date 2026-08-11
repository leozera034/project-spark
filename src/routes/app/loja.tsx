import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/app/loja")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <RequireAuth signIn={AUTH_ROUTES.storeSignIn}>
      <RequirePasswordChangeCompleted>
        <RequireEnvironment environment="store"><StoreAppLayout /></RequireEnvironment>
      </RequirePasswordChangeCompleted>
    </RequireAuth>
  ),
});

function StoreAppLayout() {
  const { authContext, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="pa-app-chrome">
      <header className="pa-app-header">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo lockup="horizontal" className="h-7 w-auto" />
          <span className="hidden h-6 w-px bg-border sm:block" />
          <div className="hidden min-w-0 sm:block">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.14em] text-brand"><Store className="size-3" /> Painel da loja</p>
            <p className="truncate text-xs text-muted-foreground">Operação, pedidos e equipe</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <span className="hidden max-w-44 truncate text-sm font-semibold text-muted-foreground md:inline">{authContext?.full_name ?? "Equipe"}</span>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void signOut("local").then(() => navigate({ to: AUTH_ROUTES.storeSignIn as never }))}>Sair</Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
