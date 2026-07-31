import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Menu as MenuIcon,
  Receipt,
  ScrollText,
  UsersRound,
} from "lucide-react";
import { useState } from "react";

import { BrandSymbol } from "@/components/brand/BrandLogo";
import { BackToPreview, DemoBanner } from "@/components/demo/DemoBanner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/preview/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/preview/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/preview/admin/lojas", label: "Lojas", icon: Building2 },
  { to: "/preview/admin/planos", label: "Planos", icon: FileText },
  { to: "/preview/admin/cobrancas", label: "Cobranças", icon: Receipt },
  { to: "/preview/admin/usuarios", label: "Usuários", icon: UsersRound },
  { to: "/preview/admin/auditoria", label: "Auditoria", icon: ScrollText },
  { to: "/preview/admin/suporte", label: "Suporte", icon: LifeBuoy },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Seções administrativas">
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

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <DemoBanner />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar p-4 lg:flex">
          <div className="flex items-center gap-2">
            <BrandSymbol tone="white" className="size-7" />
            <span className="text-sm font-semibold text-sidebar-foreground">Administração</span>
          </div>
          <p className="mt-1 text-xs text-sidebar-foreground/60">Pediu Aqui</p>
          <div className="mt-6 flex-1">
            <NavList />
          </div>
          <BackToPreview className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border bg-surface">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="iconTouch" className="lg:hidden" aria-label="Abrir menu">
                    <MenuIcon aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
                  <SheetHeader>
                    <SheetTitle className="text-sidebar-foreground">Administração</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <NavList onNavigate={() => setMobileOpen(false)} />
                  </div>
                  <BackToPreview className="mt-4 justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">Painel administrativo</p>
                <p className="text-xs text-muted-foreground">Ambiente fictício · acesso interno</p>
              </div>
              <ThemeToggle className="ml-auto" />
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
