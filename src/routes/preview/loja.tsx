import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Bike,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  Menu as MenuIcon,
  Settings,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { useState } from "react";

import { BrandSymbol } from "@/components/brand/BrandLogo";
import { BackToPreview, DemoBanner } from "@/components/demo/DemoBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDemo } from "@/demo/state/useDemo";

export const Route = createFileRoute("/preview/loja")({
  component: StorePanelLayout,
});

const NAV = [
  { to: "/preview/loja", label: "Início", icon: LayoutDashboard, exact: true },
  { to: "/preview/loja/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/preview/loja/cozinha", label: "Cozinha", icon: ChefHat },
  { to: "/preview/loja/cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { to: "/preview/loja/entregadores", label: "Entregadores", icon: Bike },
  { to: "/preview/loja/equipe", label: "Equipe", icon: Users },
  { to: "/preview/loja/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/preview/loja/configuracoes", label: "Configurações", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Seções da loja">
      <ul className="space-y-1">
        {NAV.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              onClick={onNavigate}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
            >
              <item.icon aria-hidden="true" className="size-4" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function StorePanelLayout() {
  const { store, storeOpen, toggleStoreOpen } = useDemo();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <DemoBanner />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar p-4 lg:flex">
          <div className="flex items-center gap-2">
            <BrandSymbol tone="white" className="size-7" />
            <span className="text-sm font-semibold text-sidebar-foreground">Painel da loja</span>
          </div>
          <p className="mt-1 text-xs text-sidebar-foreground/60">{store.name}</p>
          <div className="mt-6 flex-1">
            <NavList />
          </div>
          <BackToPreview className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border bg-surface">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="iconTouch" className="lg:hidden" aria-label="Abrir menu">
                    <MenuIcon aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
                  <SheetHeader>
                    <SheetTitle className="text-sidebar-foreground">{store.name}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <NavList onNavigate={() => setMobileOpen(false)} />
                  </div>
                  <BackToPreview className="mt-4 justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
                </SheetContent>
              </Sheet>

              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">{store.name}</p>
                <p className="text-xs text-muted-foreground">Ambiente fictício</p>
              </div>

              <Badge variant={storeOpen ? "success" : "danger"} className="ml-1">
                {storeOpen ? "Aberta" : "Fechada"}
              </Badge>

              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleStoreOpen}>
                  {storeOpen ? "Fechar loja" : "Abrir loja"}
                </Button>
                <Button asChild variant="brand" size="sm">
                  <Link to="/preview/loja/pedidos">Ir para pedidos</Link>
                </Button>
                <span className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:flex">
                  Rita Aurora · Proprietária
                </span>
              </div>
            </div>
          </header>

          <main className="px-4 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
