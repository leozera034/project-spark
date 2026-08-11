import { Activity, Banknote, FileWarning, LogOut, ShieldCheck, Store } from "lucide-react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { BrandLogo, BrandSymbol } from "@/components/brand/BrandLogo";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth, RequireEnvironment, RequirePasswordChangeCompleted } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

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

const adminSections = [
  { label: "Operação", href: "#operacao", icon: Activity },
  { label: "Financeiro", href: "#financeiro", icon: Banknote },
  { label: "Lojas", href: "#lojas", icon: Store },
  { label: "Erros", href: "#erros", icon: FileWarning },
];

function AdminLayout() {
  const { authContext, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-svh bg-surface-muted/45 text-foreground lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="relative hidden min-h-svh border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--color-brand)_16%,transparent),transparent_68%)]" />
        <div className="relative flex h-20 items-center border-b border-sidebar-border px-6">
          <BrandLogo lockup="horizontal" className="h-8 w-auto" />
        </div>
        <div className="relative flex-1 px-4 py-5">
          <div className="mb-5 rounded-2xl border border-sidebar-border bg-sidebar-accent/45 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand/12 text-brand"><ShieldCheck className="size-5" /></div>
              <div className="min-w-0"><p className="truncate text-sm font-semibold">Administração</p><p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/45">{authContext?.full_name ?? "Plataforma"}</p></div>
            </div>
          </div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/35">Console</p>
          <nav className="space-y-1" aria-label="Seções administrativas">
            {adminSections.map(({ label, href, icon: Icon }) => (
              <a key={href} href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/62 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <Icon className="size-4 text-sidebar-foreground/45 transition-colors group-hover:text-brand" />
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="relative border-t border-sidebar-border p-4">
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={() => void signOut("local").then(() => navigate({ to: AUTH_ROUTES.adminSignIn as never }))}>
            <LogOut className="size-4" /> Sair da conta
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/70 bg-background/82 px-4 backdrop-blur-xl sm:px-6 lg:h-20 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-carbon text-carbon-foreground lg:hidden"><BrandSymbol className="size-5" /></div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-brand">Console da plataforma</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">Saúde, lojas, cobrança e observabilidade</p>
            </div>
          </div>
          <div className="flex items-center gap-2"><ThemeToggle /><Button variant="outline" size="sm" className="hidden sm:inline-flex lg:hidden" onClick={() => void signOut("local").then(() => navigate({ to: AUTH_ROUTES.adminSignIn as never }))}><LogOut className="size-4" />Sair</Button></div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
