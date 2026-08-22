import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bike, History, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandSymbol } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/entregador")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
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

const NAV_ITEMS = [
  { to: "/app/entregador", label: "Operação", icon: Bike },
  { to: "/app/entregador/historico", label: "Histórico", icon: History },
] as const;

function activeRoute(pathname: string, to: string) {
  if (to === "/app/entregador") return pathname === "/app/entregador" || pathname === "/app/entregador/" || pathname.startsWith("/app/entregador/entrega");
  return pathname === to || pathname.startsWith(`${to}/`);
}

function pageLabel(pathname: string) {
  if (pathname.startsWith("/app/entregador/historico")) return "Histórico";
  return "Operação";
}

function CourierAppLayout() {
  const { authContext, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentLabel = pageLabel(pathname);
  const missionMode = pathname.startsWith("/app/entregador/entrega");

  const handleSignOut = () => void signOut("local").then(() => navigate({ to: AUTH_ROUTES.courierSignIn as never }));

  return (
    <div className={cn("min-h-dvh bg-background", missionMode ? "pb-0" : "pb-[calc(4.5rem+env(safe-area-inset-bottom))]")}>
      {!missionMode ? (
        <header
          className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 pb-3 pt-3 shadow-sm backdrop-blur-xl"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandSymbol className="size-9 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.15em] text-brand">Comandiva Entregas</p>
                <p className="truncate text-sm font-black text-foreground">{currentLabel}</p>
                {currentLabel === "Operação" && authContext?.full_name ? <p className="truncate text-[11px] text-muted-foreground">{authContext.full_name}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="icon" aria-label="Sair" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>
      ) : null}

      <Outlet />

      {!missionMode ? (
        <nav
          aria-label="Navegação do entregador"
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 backdrop-blur-xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex w-full max-w-lg">
            {NAV_ITEMS.map((item) => {
              const active = activeRoute(pathname, item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to as never}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-bold",
                    active ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {active ? <span className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-primary" /> : null}
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
