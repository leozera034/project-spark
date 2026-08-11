import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bike } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandSymbol } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/app/entregador")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <RequireAuth signIn={AUTH_ROUTES.courierSignIn}>
      <RequirePasswordChangeCompleted>
        <RequireEnvironment environment="courier"><CourierAppLayout /></RequireEnvironment>
      </RequirePasswordChangeCompleted>
    </RequireAuth>
  ),
});

function CourierAppLayout() {
  const { authContext, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="pa-app-chrome">
      <header className="pa-app-header">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-brand/10 text-brand"><BrandSymbol className="h-7 w-auto" /></div>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.14em] text-brand"><Bike className="size-3" /> Entregador</p>
            <p className="max-w-44 truncate text-xs text-muted-foreground">{authContext?.full_name ?? "Operação de entregas"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void signOut("local").then(() => navigate({ to: AUTH_ROUTES.courierSignIn as never }))}>Sair</Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
