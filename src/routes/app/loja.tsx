import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, Bike, ChefHat, ClipboardList, Home, Settings, ShoppingBag, Store, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

type StoreNavItem = {
  to:
    | "/app/loja"
    | "/app/loja/pedidos"
    | "/app/loja/cozinha"
    | "/app/loja/cardapio"
    | "/app/loja/entregadores"
    | "/app/loja/relatorios/entregas"
    | "/app/loja/configuracoes/dados";
  label: string;
  icon: LucideIcon;
  exact: boolean;
};

const NAV: StoreNavItem[] = [
  { to: "/app/loja", label: "Início", icon: Home, exact: true },
  { to: "/app/loja/pedidos", label: "Pedidos", icon: ClipboardList, exact: false },
  { to: "/app/loja/cozinha", label: "Cozinha", icon: ChefHat, exact: false },
  { to: "/app/loja/cardapio", label: "Cardápio", icon: ShoppingBag, exact: false },
  { to: "/app/loja/entregadores", label: "Entregadores", icon: Bike, exact: false },
  { to: "/app/loja/relatorios/entregas", label: "Relatórios", icon: BarChart3, exact: false },
  { to: "/app/loja/configuracoes/dados", label: "Configurações", icon: Settings, exact: false },
];

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
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="pa-app-chrome min-h-svh pb-20 lg:pb-0">
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

      <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100svh-68px)] border-r border-border/70 bg-card/55 px-3 py-5 lg:block">
          <nav className="sticky top-[88px] space-y-1.5" aria-label="Navegação principal da loja">
            <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[.14em] text-muted-foreground">Operação</p>
            {NAV.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? pathname === to || pathname === `${to}/` : pathname.startsWith(to);
              return (
                <Link key={to} to={to} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition", active ? "bg-carbon text-carbon-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  <Icon className={cn("size-4", active ? "text-brand" : "")} /><span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0"><Outlet /></div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/94 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden" aria-label="Navegação principal da loja">
        <div className="mx-auto flex max-w-xl items-center justify-around">
          {NAV.slice(0, 6).map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to || pathname === `${to}/` : pathname.startsWith(to);
            return (
              <Link key={to} to={to} aria-label={label} className={cn("flex min-w-12 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-extrabold transition", active ? "text-brand" : "text-muted-foreground")}>
                <Icon className="size-5" /><span className="max-w-14 truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
