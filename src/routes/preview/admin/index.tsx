import { Link, createFileRoute } from "@tanstack/react-router";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";
import { saasStoreStatusLabel, saasStoreStatusTone } from "@/demo/utils/labels";

export const Route = createFileRoute("/preview/admin/")({
  head: demoHead(
    "Visão geral da administração — Pediu Aqui",
    "Indicadores do negócio: lojas ativas, cobranças em aberto e chamados de suporte.",
  ),
  component: AdminHome,
});

function AdminHome() {
  const { saasStores, invoices, supportTickets } = useDemo();

  const active = saasStores.filter((store) => store.status === "ativa").length;
  const suspended = saasStores.filter((store) => store.status === "suspensa").length;
  const onboarding = saasStores.filter((store) => store.status === "em_implantacao").length;
  const overdue = invoices.filter((invoice) => invoice.status === "vencido");
  const openTickets = supportTickets.filter((ticket) => ticket.status !== "resolvido");
  const monthlyRecurring = saasStores
    .filter((store) => store.status === "ativa")
    .reduce((sum, store) => sum + (store.planId === "plano-pro" ? 149.9 : 79.9), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionTitle
        title="Visão geral"
        description="Saúde do negócio em números diretos."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Lojas ativas", value: String(active) },
          { label: "Em implantação", value: String(onboarding) },
          { label: "Suspensas", value: String(suspended) },
          { label: "Receita recorrente", value: formatBRL(monthlyRecurring) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Cobranças vencidas</h2>
          {overdue.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma cobrança vencida.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {overdue.map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground">{invoice.storeName}</span>
                  <span className="text-muted-foreground">venceu {invoice.dueDate}</span>
                  <span className="text-foreground">{formatBRL(invoice.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/preview/admin/cobrancas">Abrir cobranças</Link>
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Chamados abertos</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {openTickets.map((ticket) => (
              <li key={ticket.id}>
                <span className="text-foreground">{ticket.storeName}</span> · {ticket.subject}
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/preview/admin/suporte">Abrir suporte</Link>
          </Button>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Lojas recentes</h2>
        <ul className="mt-3 space-y-2">
          {saasStores.slice(0, 5).map((store) => (
            <li key={store.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-foreground">{store.name}</span>
              <span className="text-muted-foreground">{store.ordersInPeriod} pedidos no mês</span>
              <Badge variant={saasStoreStatusTone[store.status]}>
                {saasStoreStatusLabel[store.status]}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
