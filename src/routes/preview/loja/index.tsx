import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/loja/")({
  head: demoHead(
    "Início do painel — Pediu Aqui",
    "Quadro operacional do dia com pedidos por estado, atrasos e entregadores online.",
  ),
  component: StoreHome,
});

function StoreHome() {
  const { orders, couriers, deliveries } = useDemo();

  const count = (predicate: (status: string) => boolean) =>
    orders.filter((order) => predicate(order.status)).length;

  const cards = [
    { label: "Pedidos novos", value: count((status) => status === "novo"), tone: "info" as const },
    { label: "Em preparo", value: count((status) => status === "em_preparo"), tone: "warning" as const },
    { label: "Prontos", value: count((status) => status === "pronto"), tone: "brandSoft" as const },
    { label: "Em entrega", value: count((status) => status === "saiu_para_entrega"), tone: "info" as const },
    { label: "Aguardando retirada", value: count((status) => status === "aguardando_retirada"), tone: "brandSoft" as const },
    { label: "Concluídos hoje", value: count((status) => status === "concluido"), tone: "success" as const },
  ];

  const late = orders.filter((order) => order.late);
  const onlineCouriers = couriers.filter((courier) => courier.online);
  const deliveredToday = deliveries.filter(
    (delivery) => delivery.status === "entregue" && delivery.day === "hoje",
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionTitle
        title="Bom dia, Rita"
        description="Este é o quadro do dia. Só o que precisa de decisão agora."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {late.length > 0 ? (
        <div className="rounded-xl border border-warning-soft bg-warning-soft p-4">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle aria-hidden="true" className="size-4" />
            <p className="text-sm font-semibold">
              {late.length} pedido em atraso precisa de atenção
            </p>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-foreground/80">
            {late.map((order) => (
              <li key={order.id}>
                {order.code} · {order.customerName} · aguardando há {order.placedMinutesAgo} min
              </li>
            ))}
          </ul>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to="/preview/loja/pedidos">Abrir pedidos</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Entregadores online</h2>
          <ul className="mt-3 space-y-2">
            {onlineCouriers.map((courier) => (
              <li key={courier.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">{courier.name}</span>
                <Badge variant="success">Online</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            {deliveredToday} entregas concluídas hoje pela equipe da loja.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Avisos</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Café torrado e moído está marcado como esgotado no cardápio.</li>
            <li>Salada montada segue indisponível desde ontem.</li>
            <li>Mensalidade de julho vence em 10/08/2026.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
