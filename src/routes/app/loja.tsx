import {
  BarChart3,
  Bike,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UtensilsCrossed,
} from "lucide-react";
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo, BrandSymbol } from "@/components/brand/BrandLogo";
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

const primaryNavigation = [
  { label: "Visão geral", to: "/app/loja", icon: LayoutDashboard, exact: true },
  { label: "Pedidos", to: "/app/loja/pedidos", icon: ClipboardList },
  { label: "Cozinha", to: "/app/loja/cozinha", icon: ChefHat },
  { label: "Cardápio", to: "/app/loja/cardapio", icon: UtensilsCrossed },
  { label: "Entregadores", to: "/app/loja/entregadores", icon: Bike },
  { label: "Relatórios", to: "/app/loja/relatorios/entregas", icon: BarChart3 },
  { label: "Configurações", to: "/app/loja/configuracoes", icon: Settings },
] as const;

function isPathActive(pathname: string, to: string, exact?: boolean) {
  return exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

function StoreNavLink({
  label,
  to,
  icon: Icon,
  pathname,
  exact,
  compact = false,
}: {
  label: string;
  to: string;
  icon: LucideIcon;
  pathname: string;
  exact?: boolean;
  compact?: boolean;
}) {
  const active = isPathActive(pathname, to, exact);
  return (
    <Link
      to={to as never}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl font-semibold transition-[background-color,color,box-shadow,transform] duration-200",
        compact ? "flex-col gap-1 px-2 py-2 text-[10px]" : "px-3 py-2.5 text-sm",
        active
          ? "bg-brand text-brand-foreground shadow-[0_10px_28px_-16px_color-mix(in_oklab,var(--color-brand)_85%,transparent)]"
          : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon className={cn(compact ? "size-5" : "size-4.5", active ? "text-current" : "text-sidebar-foreground/55 group-hover:text-brand")} />
      <span>{label}</span>
    </Link>
  );
}

function StoreAppLayout() {
  const { authContext, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const roleLabel = authContext?.roles?.length ? authContext.roles.join(" · ") : "Equipe da loja";

  return (
    <div className="min-h-svh bg-surface-muted/45 text-foreground lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="relative hidden min-h-svh border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--color-brand)_16%,transparent),transparent_68%)]" />
        <div className="relative flex h-20 items-center border-b border-sidebar-border px-6">
          <BrandLogo lockup="horizontal" className="h-8 w-auto" />
        </div>

        <div className="relative flex-1 px-4 py-5">
          <div className="mb-5 rounded-2xl border border-sidebar-border bg-sidebar-accent/45 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
                <BrandSymbol className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {authContext?.full_name ?? "Equipe"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/45">{roleLabel}</p>
              </div>
            </div>
          </div>

          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/35">
            Operação
          </p>
          <nav className="space-y-1" aria-label="Navegação da loja">
            {primaryNavigation.map((item) => (
              <StoreNavLink key={item.to} {...item} pathname={pathname} />
            ))}
          </nav>
        </div>

        <div className="relative border-t border-sidebar-border p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() =>
              void signOut("local").then(() => navigate({ to: AUTH_ROUTES.storeSignIn as never }))
            }
          >
            <LogOut className="size-4" />
            Sair da conta
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:h-20 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-carbon text-carbon-foreground">
              <BrandSymbol className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">Pediu Aqui</p>
              <p className="truncate text-[10px] text-muted-foreground">Painel da loja</p>
            </div>
          </div>

          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Pediu Aqui</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              Operação da loja · {authContext?.full_name ?? "Equipe"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex lg:hidden"
              onClick={() =>
                void signOut("local").then(() => navigate({ to: AUTH_ROUTES.storeSignIn as never }))
              }
            >
              <LogOut className="size-4" />
              Sair
            </Button>
            <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu da conta">
              <Menu className="size-5" />
            </Button>
          </div>
        </header>

        <div className="min-h-[calc(100svh-4rem)] pb-24 lg:min-h-[calc(100svh-5rem)] lg:pb-0">
          <Outlet />
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border/80 bg-background/92 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_32px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:hidden"
        aria-label="Navegação principal"
      >
        <StoreNavLink label="Início" to="/app/loja" icon={LayoutDashboard} pathname={pathname} exact compact />
        <StoreNavLink label="Pedidos" to="/app/loja/pedidos" icon={ClipboardList} pathname={pathname} compact />
        <StoreNavLink label="Cozinha" to="/app/loja/cozinha" icon={ChefHat} pathname={pathname} compact />
        <StoreNavLink label="Cardápio" to="/app/loja/cardapio" icon={UtensilsCrossed} pathname={pathname} compact />
        <StoreNavLink label="Mais" to="/app/loja/configuracoes" icon={Settings} pathname={pathname} compact />
      </nav>
    </div>
  );
}
