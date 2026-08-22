import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  BarChart3,
  Blocks,
  Building2,
  ChefHat,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo, BrandSymbol } from "@/components/brand/BrandLogo";
import { BillingStatusBanner } from "@/components/store/BillingStatusBanner";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useStoreBillingAccess } from "@/store/billing/store-billing.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";
import { useOrderCounts } from "@/store-orders/useStoreOrders";
import { fetchOperationalPreview } from "@/store-config/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/loja")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
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

type NavSection = "Operação" | "Gestão" | "Conta";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  section: NavSection;
  mobile?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/app/loja", label: "Início", icon: LayoutGrid, section: "Operação", mobile: true },
  { to: "/app/loja/pedidos", label: "Pedidos", icon: ShoppingBag, section: "Operação", mobile: true },
  { to: "/app/loja/cozinha", label: "Cozinha", icon: ChefHat, section: "Operação", mobile: true },
  { to: "/app/loja/entregas", label: "Entregas", icon: Truck, section: "Operação" },
  { to: "/app/loja/cardapio", label: "Cardápio", icon: UtensilsCrossed, section: "Gestão", mobile: true },
  { to: "/app/loja/crescimento", label: "Clientes", icon: Users, section: "Gestão" },
  { to: "/app/loja/whatsapp", label: "WhatsApp", icon: MessageCircle, section: "Gestão" },
  { to: "/app/loja/relatorios/entregas", label: "Relatórios", icon: BarChart3, section: "Gestão" },
  { to: "/app/loja/modulos", label: "Recursos", icon: Blocks, section: "Conta" },
  { to: "/app/loja/configuracoes", label: "Configurações", icon: Settings, section: "Conta" },
];

const NAV_SECTIONS: NavSection[] = ["Operação", "Gestão", "Conta"];
const MOBILE_PRIMARY = NAV_ITEMS.filter((item) => item.mobile);
const MOBILE_MORE = NAV_ITEMS.filter((item) => !item.mobile);

function isActive(pathname: string, to: string) {
  if (to === "/app/loja") return pathname === "/app/loja" || pathname === "/app/loja/";
  if (to === "/app/loja/entregas") {
    return pathname.startsWith("/app/loja/entregas") || pathname.startsWith("/app/loja/entregadores") || pathname.startsWith("/app/loja/devolucoes") || pathname.startsWith("/app/loja/smart-delivery");
  }
  if (to === "/app/loja/configuracoes" && pathname.startsWith("/app/loja/plano")) return true;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function badgeForItem(item: NavItem, newOrders: number) {
  return item.to === "/app/loja/pedidos" ? newOrders : 0;
}

function StoreAppLayout() {
  const { authContext, signOut } = useAuth();
  const scope = useStoreScope();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const billingQuery = useStoreBillingAccess(scope.storeId);
  const countsQuery = useOrderCounts(scope.storeId, Boolean(scope.storeId));
  const operationalQuery = useQuery({
    queryKey: ["store-shell", "operational", scope.storeId],
    queryFn: () => fetchOperationalPreview(scope.storeId as string),
    enabled: Boolean(scope.storeId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const currentItem = NAV_ITEMS.find((item) => isActive(pathname, item.to)) ?? NAV_ITEMS[0];
  const newOrders = countsQuery.data?.byStatus?.aguardando_confirmacao ?? 0;

  useEffect(() => {
    setMobileNavOpen(false);
    setMobileMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen && !mobileMoreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileNavOpen(false);
      setMobileMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMoreOpen, mobileNavOpen]);

  const handleSignOut = () => void signOut("local").then(() => navigate({ to: AUTH_ROUTES.storeSignIn as never }));

  return (
    <div className="app-premium-shell min-h-dvh bg-background lg:flex">
      <aside className={cn("app-premium-sidebar hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex", collapsed ? "w-[4.75rem]" : "w-[16.5rem]")}>        
        <div className="flex h-[76px] items-center gap-2 border-b border-sidebar-border px-3">
          {collapsed ? <BrandSymbol tone="white" className="mx-auto size-11" /> : <BrandLogo lockup="horizontal" tone="white" className="h-10 w-auto" />}
        </div>

        {!collapsed && scope.selectedStore ? (
          <div className="border-b border-sidebar-border p-3">
            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/45 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-sidebar-foreground/50">Loja em operação</p>
              <div className="mt-1 flex min-w-0 items-center gap-2"><Building2 className="size-4 shrink-0 text-sidebar-primary" /><p className="truncate text-sm font-bold text-sidebar-foreground">{scope.selectedStore.name}</p></div>
              {operationalQuery.data ? <p className="mt-2 text-xs font-semibold text-sidebar-foreground/65">{operationalQuery.data.is_open ? operationalQuery.data.closes_at ? `Aberta · fecha às ${operationalQuery.data.closes_at}` : "Aberta agora" : operationalQuery.data.next_open_at ? `Fechada · abre ${operationalQuery.data.next_open_day} às ${operationalQuery.data.next_open_at}` : "Fechada agora"}</p> : null}
            </div>
          </div>
        ) : null}

        <nav aria-label="Navegação da loja" className="flex-1 overflow-y-auto p-3">
          {NAV_SECTIONS.map((section, sectionIndex) => {
            const items = NAV_ITEMS.filter((item) => item.section === section);
            return (
              <div key={section} className={sectionIndex > 0 ? "mt-5" : undefined}>
                {collapsed ? null : <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[.16em] text-sidebar-foreground/40">{section}</p>}
                <div className="space-y-1">
                  {items.map((item) => <NavLink key={item.to} item={item} active={isActive(pathname, item.to)} collapsed={collapsed} badgeCount={badgeForItem(item, newOrders)} />)}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button variant="ghost" size="sm" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : undefined} className={cn("w-full text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground", collapsed ? "justify-center px-0" : "justify-start")}>
            <Menu className="size-4" aria-hidden="true" />{collapsed ? null : "Recolher menu"}
          </Button>
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu da loja">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-foreground/45 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <nav aria-label="Navegação da loja" className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[88vw] flex-col bg-sidebar text-sidebar-foreground shadow-e2" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex h-[76px] items-center justify-between border-b border-sidebar-border px-4">
              <BrandLogo lockup="horizontal" tone="white" className="h-10 w-auto" />
              <Button variant="ghost" size="icon" aria-label="Fechar menu" className="text-sidebar-foreground hover:bg-sidebar-accent/60" onClick={() => setMobileNavOpen(false)}><X className="size-5" /></Button>
            </div>
            {scope.selectedStore ? (
              <div className="border-b border-sidebar-border px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-sidebar-foreground/45">Loja em operação</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-sidebar-foreground">{scope.selectedStore.name}</p>
                  {operationalQuery.data ? <span className={cn("size-2.5 shrink-0 rounded-full", operationalQuery.data.is_open ? "bg-success" : "bg-sidebar-foreground/25")} aria-hidden="true" /> : null}
                </div>
                {operationalQuery.data ? <span className="sr-only">{operationalQuery.data.is_open ? "Loja aberta" : "Loja fechada"}</span> : null}
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto p-3">
              {NAV_SECTIONS.map((section, sectionIndex) => (
                <section key={section} className={sectionIndex > 0 ? "mt-5" : undefined}>
                  <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[.16em] text-sidebar-foreground/40">{section}</p>
                  <div className="space-y-1">
                    {NAV_ITEMS.filter((item) => item.section === section).map((item) => {
                      const active = isActive(pathname, item.to);
                      const Icon = item.icon;
                      const badgeCount = badgeForItem(item, newOrders);
                      return (
                        <Link key={item.to} to={item.to as never} onClick={() => setMobileNavOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")}>
                          <Icon className="size-5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{item.label}</span>{badgeCount > 0 ? <span className="min-w-6 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-black text-primary-foreground" aria-hidden="true">{badgeCount > 99 ? "99+" : badgeCount}</span> : null}{badgeCount > 0 ? <span className="sr-only">{badgeCount} novos pedidos</span> : null}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </nav>
        </div>
      ) : null}

      {mobileMoreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/40 px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 backdrop-blur-sm lg:hidden" onClick={() => setMobileMoreOpen(false)} role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
          <div className="max-h-[72dvh] w-full overflow-y-auto rounded-[24px] border border-border bg-card p-3 shadow-e3" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between px-2 py-1"><div><p id="mobile-more-title" className="font-display text-lg font-black">Mais opções</p><p className="text-xs text-muted-foreground">Gestão, comunicação e conta</p></div><Button variant="ghost" size="icon" onClick={() => setMobileMoreOpen(false)} aria-label="Fechar"><X className="size-4" /></Button></div>
            {NAV_SECTIONS.map((section) => {
              const items = MOBILE_MORE.filter((item) => item.section === section);
              if (items.length === 0) return null;
              return (
                <section key={section} className="mb-4 last:mb-0">
                  <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[.14em] text-muted-foreground">{section}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(pathname, item.to);
                      return <Link key={item.to} to={item.to as never} onClick={() => setMobileMoreOpen(false)} className={cn("flex min-h-[4.5rem] items-center gap-3 rounded-2xl border px-3 py-2 text-sm font-bold", active ? "border-brand/25 bg-brand-soft text-brand" : "border-border bg-surface-muted/35 text-foreground")}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background"><Icon className="size-4.5" /></span><span className="min-w-0 truncate">{item.label}</span></Link>;
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="app-premium-topbar sticky top-0 z-30 flex min-h-[68px] items-center justify-between gap-3 border-b px-3 sm:px-5 lg:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Abrir menu" onClick={() => { setMobileMoreOpen(false); setMobileNavOpen(true); }}><Menu className="size-5" /></Button>
            <BrandSymbol className="size-9 shrink-0 lg:hidden" />
            <div className="min-w-0"><p className="hidden text-[10px] font-black uppercase tracking-[.14em] text-muted-foreground sm:block">{currentItem.section}</p><p className="truncate text-sm font-bold text-foreground sm:text-base">{currentItem.label}</p></div>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            {operationalQuery.data ? <Badge variant={operationalQuery.data.is_open ? "success" : "secondary"} className="hidden lg:inline-flex" aria-live="polite">{operationalQuery.data.is_open ? "Loja aberta" : "Loja fechada"}</Badge> : null}
            <StoreSwitcher />
            <ThemeToggle />
            <div className="hidden min-w-0 border-l border-border pl-3 xl:block"><p className="max-w-36 truncate text-xs font-bold text-foreground">{authContext?.full_name ?? "Equipe"}</p><p className="text-[10px] text-muted-foreground">Equipe da loja</p></div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair" className="shrink-0 text-muted-foreground hover:text-foreground"><LogOut className="size-4" /></Button>
          </div>
        </header>

        {billingQuery.data ? <BillingStatusBanner access={billingQuery.data} /> : null}
        <main className="min-w-0 flex-1 pb-[calc(4.8rem+env(safe-area-inset-bottom))] lg:pb-0"><Outlet /></main>

        <nav aria-label="Navegação principal" className="app-premium-bottom-nav fixed inset-x-0 bottom-0 z-30 flex border-t backdrop-blur-xl lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {MOBILE_PRIMARY.map((item) => {
            const active = isActive(pathname, item.to);
            const Icon = item.icon;
            const badgeCount = badgeForItem(item, newOrders);
            return (
              <Link key={item.to} to={item.to as never} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[10px] font-semibold leading-tight sm:text-[11px]", active ? "text-brand" : "text-muted-foreground")}>
                {active ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" /> : null}
                <span className="relative"><Icon className="size-5 shrink-0" aria-hidden="true" />{badgeCount > 0 ? <span className="absolute -right-2.5 -top-2 min-w-4 rounded-full bg-primary px-1 text-[9px] font-black leading-4 text-primary-foreground" aria-hidden="true">{badgeCount > 9 ? "9+" : badgeCount}</span> : null}</span>
                <span className="max-w-full truncate">{item.label}</span>{badgeCount > 0 ? <span className="sr-only">{badgeCount} novos pedidos</span> : null}
              </Link>
            );
          })}
          <button type="button" onClick={() => { setMobileNavOpen(false); setMobileMoreOpen(true); }} aria-label="Abrir mais opções" aria-current={MOBILE_MORE.some((item) => isActive(pathname, item.to)) ? "page" : undefined} className={cn("relative flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[10px] font-semibold leading-tight sm:text-[11px]", MOBILE_MORE.some((item) => isActive(pathname, item.to)) ? "text-brand" : "text-muted-foreground")}>
            {MOBILE_MORE.some((item) => isActive(pathname, item.to)) ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" /> : null}<MoreHorizontal className="size-5 shrink-0" /><span>Mais</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function StoreSwitcher() {
  const scope = useStoreScope();
  const selected = scope.selectedStore;
  if (!selected) return null;

  if (scope.stores.length === 1) {
    return <div className="hidden max-w-48 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:flex"><Building2 className="size-4 shrink-0 text-brand" /><span className="truncate text-xs font-bold text-foreground">{selected.name}</span></div>;
  }

  return (
    <label className="flex max-w-[9.5rem] items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-2 shadow-sm transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:max-w-56 sm:px-3">
      <Building2 className="size-4 shrink-0 text-brand" aria-hidden="true" /><span className="sr-only">Loja em operação</span>
      <select aria-label="Loja em operação" value={selected.id} onChange={(event) => void scope.selectStore(event.target.value)} className="min-w-0 max-w-full cursor-pointer bg-transparent text-xs font-bold text-foreground outline-none sm:text-sm">
        {scope.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
      </select>
    </label>
  );
}

function NavLink({ item, active, collapsed, badgeCount }: { item: NavItem; active: boolean; collapsed: boolean; badgeCount: number }) {
  const Icon = item.icon;
  return (
    <Link to={item.to as never} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} className={cn("group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors", collapsed && "justify-center px-0", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/68 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")}>
      {active && !collapsed ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary" /> : null}
      <span className="relative shrink-0"><Icon className="size-5" aria-hidden="true" />{collapsed && badgeCount > 0 ? <span className="absolute -right-2 -top-2 size-4 rounded-full bg-primary text-center text-[9px] font-black leading-4 text-primary-foreground" aria-hidden="true">{badgeCount > 9 ? "9+" : badgeCount}</span> : null}</span>
      {collapsed ? null : <><span className="min-w-0 flex-1 truncate">{item.label}</span>{badgeCount > 0 ? <span className="min-w-6 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-black text-primary-foreground" aria-hidden="true">{badgeCount > 99 ? "99+" : badgeCount}</span> : null}{badgeCount > 0 ? <span className="sr-only">{badgeCount} novos pedidos</span> : null}</>}
    </Link>
  );
}
