import { useState } from "react";
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  BarChart3,
  Bike,
  ChefHat,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  ShoppingBag,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

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

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  /** Exibido também na barra inferior do celular. */
  mobile?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/app/loja", label: "Visão geral", icon: LayoutGrid, mobile: true },
  { to: "/app/loja/pedidos", label: "Pedidos", icon: ShoppingBag, mobile: true },
  { to: "/app/loja/cozinha", label: "Cozinha", icon: ChefHat, mobile: true },
  { to: "/app/loja/cardapio", label: "Cardápio", icon: UtensilsCrossed, mobile: true },
  { to: "/app/loja/entregadores", label: "Entregadores", icon: Bike },
  { to: "/app/loja/relatorios/entregas", label: "Relatórios", icon: BarChart3, mobile: true },
  { to: "/app/loja/configuracoes", label: "Configurações", icon: Settings },
];

const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.mobile);

function isActive(pathname: string, to: string) {
  if (to === "/app/loja") return pathname === "/app/loja" || pathname === "/app/loja/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function StoreAppLayout() {
  const { authContext, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = () =>
    void signOut("local").then(() => navigate({ to: AUTH_ROUTES.storeSignIn as never }));

  return (
    <div className="min-h-dvh bg-background lg:flex">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-3">
          {collapsed ? (
            <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary font-display text-sm font-bold">
              PA
            </span>
          ) : (
            <BrandLogo lockup="horizontal" className="h-7 w-auto" />
          )}
        </div>

        <nav aria-label="Navegação da loja" className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "w-full text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              collapsed ? "justify-center px-0" : "justify-start",
            )}
          >
            <Menu className="size-4" aria-hidden="true" />
            {collapsed ? null : "Recolher"}
          </Button>
        </div>
      </aside>

      {/* Mobile off-canvas nav */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-carbon/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <nav
            aria-label="Navegação da loja"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-e2"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
              <BrandLogo lockup="horizontal" className="h-7 w-auto" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar menu"
                className="text-sidebar-foreground hover:bg-sidebar-accent/60"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      ) : null}

      <div className="flex min-h-dvh flex-1 flex-col">
        {/* Topbar */}
        <header
          className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:h-16 sm:px-6 lg:px-8"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <BrandLogo lockup="horizontal" className="h-6 w-auto lg:hidden" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {authContext?.full_name ?? "Equipe"}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>

        {/* Bottom nav mobile */}
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {MOBILE_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
