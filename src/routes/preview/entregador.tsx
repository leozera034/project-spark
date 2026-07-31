import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { History, ListChecks, Navigation } from "lucide-react";

import { BrandSymbol } from "@/components/brand/BrandLogo";
import { BackToPreview, DemoBanner } from "@/components/demo/DemoBanner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useDemo } from "@/demo/state/useDemo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/preview/entregador")({
  component: CourierLayout,
});

const TABS = [
  { to: "/preview/entregador", label: "Disponíveis", icon: ListChecks, exact: true },
  { to: "/preview/entregador/rota", label: "Minha rota", icon: Navigation },
  { to: "/preview/entregador/historico", label: "Histórico", icon: History },
];

function CourierLayout() {
  const { courierOnline, toggleCourierOnline, couriers, sessionCourierId } = useDemo();
  const courier = couriers.find((item) => item.id === sessionCourierId);

  return (
    <div className="min-h-screen bg-background pb-24">
      <DemoBanner />
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <BrandSymbol tone="carbon-teal" className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{courier?.name}</p>
            <p className="text-xs text-muted-foreground">{courier?.vehicle} · Mercado Aurora</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Badge variant={courierOnline ? "success" : "secondary"}>
              {courierOnline ? "Online" : "Offline"}
            </Badge>
            <Switch
              checked={courierOnline}
              onCheckedChange={toggleCourierOnline}
              aria-label="Ficar online para receber entregas"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <Outlet />
        <BackToPreview className="mt-8" />
      </main>

      <nav
        aria-label="Seções do entregador"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-3">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <Link
                to={tab.to}
                activeOptions={{ exact: tab.exact ?? false }}
                className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground data-[status=active]:text-brand"
              >
                <tab.icon aria-hidden="true" className="size-5" />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
