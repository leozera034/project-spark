import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Building2,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BrandLogo, BrandSymbol } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: () => (
    <RequireAuth signIn={AUTH_ROUTES.adminSignIn}>
      <RequirePasswordChangeCompleted>
        <RequireEnvironment environment="platform_admin">
          <AdminLayout />
        </RequireEnvironment>
      </RequirePasswordChangeCompleted>
    </RequireAuth>
  ),
});

const NAV = [
  { href: "#visao-geral", label: "Visão geral", icon: BarChart3 },
  { href: "#operacao", label: "Operação", icon: Activity },
  { href: "#lojas", label: "Lojas", icon: Building2 },
  { href: "#observabilidade", label: "Observabilidade", icon: ShieldCheck },
] as const;

function AdminLayout() {
  const { signOut, authContext } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = () =>
    void signOut("local").then(() => navigate({ to: AUTH_ROUTES.adminSignIn as never }));

  const Nav = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className="space-y-1" aria-label="Administração SaaS">
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={() => mobile && setMobileOpen(false)}
            className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/55 transition hover:bg-violet-500/10 hover:text-white"
          >
            <span className="grid size-8 place-items-center rounded-lg border border-white/[.06] bg-white/[.035] transition group-hover:border-violet-400/20 group-hover:bg-violet-500/10">
              <Icon className="size-4 text-violet-300" />
            </span>
            {item.label}
          </a>
        );
      })}
    </nav>
  );

  return (
    <div className="app-premium-shell min-h-dvh text-foreground lg:flex">
      <aside className="app-premium-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-20 items-center border-b border-white/[.06] px-5">
          <BrandLogo className="h-8 w-auto" />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-5 rounded-2xl border border-violet-300/10 bg-violet-500/[.06] p-3">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-[.14em] text-white/65">SaaS Control</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/38">Operação, receita e saúde da plataforma em uma única visão.</p>
          </div>
          <Nav />
        </div>
        <div className="border-t border-white/[.06] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2">
            <BrandSymbol className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{authContext?.full_name ?? "Administrador"}</p>
              <p className="text-[11px] text-white/38">Administração da plataforma</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start" onClick={logout}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />
          <aside className="app-premium-sidebar absolute inset-y-0 left-0 flex w-[82vw] max-w-80 flex-col border-r p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="mb-5 flex items-center justify-between">
              <BrandLogo className="h-8 w-auto" />
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X className="size-5" /></Button>
            </div>
            <Nav mobile />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <header className="app-premium-topbar sticky top-0 z-40 flex min-h-16 items-center justify-between border-b px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white">Pediu Aqui</span>
                <span className="rounded-full border border-violet-400/15 bg-violet-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em] text-violet-200">Admin SaaS</span>
              </div>
              <p className="hidden text-xs text-white/35 sm:block">Centro de controle da plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={logout}><LogOut className="size-4" /> Sair</Button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
